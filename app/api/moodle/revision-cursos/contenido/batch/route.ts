import { NextResponse } from "next/server";
import {
  getCategoryInfo,
  getAllSubcategoriesFlat,
  getCoursesByCategory,
} from "@/lib/moodle/moodle.service";
import { validateCourseContent } from "@/lib/moodle/validators/course-content.validator";
import type { BatchValidationResult, CourseContentValidationResult } from "@/lib/moodle/types";

/** Configurable concurrency limit — keeps Moodle from being overwhelmed */
const BATCH_VALIDATION_CHUNK_SIZE = 5;

type RequestBody = {
  moodleUrl: string;
  token: string;
  categoryId: number;
  includeSubcategories: boolean;
};

export async function POST(request: Request) {
  let body: Partial<RequestBody>;

  try {
    body = (await request.json()) as Partial<RequestBody>;
  } catch {
    return NextResponse.json({ message: "Cuerpo de solicitud inválido" }, { status: 400 });
  }

  const { moodleUrl, token, categoryId, includeSubcategories = true } = body;

  if (!moodleUrl || typeof moodleUrl !== "string" || !moodleUrl.trim()) {
    return NextResponse.json({ message: "Falta la URL de Moodle" }, { status: 400 });
  }

  if (!token || typeof token !== "string" || !token.trim()) {
    return NextResponse.json({ message: "Falta el token de la API de Moodle" }, { status: 400 });
  }

  if (!categoryId || typeof categoryId !== "number") {
    return NextResponse.json({ message: "Falta el ID de la categoría (categoryId)" }, { status: 400 });
  }

  const url   = moodleUrl.trim();
  const tkn   = token.trim();
  const start = Date.now();

  try {
    // --- 1. Resolve category name ----------------------------------------
    const rootCategory = await getCategoryInfo(url, tkn, categoryId);
    const categoryName = rootCategory?.name ?? `Categoría ${categoryId}`;

    // --- 2. Collect all category IDs to process --------------------------
    let categoryIds: number[];

    if (includeSubcategories) {
      const subcategories = await getAllSubcategoriesFlat(url, tkn, categoryId);
      categoryIds = [categoryId, ...subcategories.map((c) => c.id)];
    } else {
      categoryIds = [categoryId];
    }

    // --- 3. Fetch all courses (deduplicated) ------------------------------
    const courseArrays = await Promise.all(
      categoryIds.map((id) => getCoursesByCategory(url, tkn, id)),
    );

    const seenIds = new Set<number>();
    const courses = courseArrays.flat().filter((c) => {
      if (seenIds.has(c.id)) return false;
      seenIds.add(c.id);
      return true;
    });

    // --- 4. Validate in chunks of BATCH_VALIDATION_CHUNK_SIZE ------------
    const results: CourseContentValidationResult[] = [];

    for (let i = 0; i < courses.length; i += BATCH_VALIDATION_CHUNK_SIZE) {
      const chunk = courses.slice(i, i + BATCH_VALIDATION_CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map((c) =>
          validateCourseContent(url, tkn, c.id, c.format, c.fullname),
        ),
      );
      results.push(...chunkResults);
    }

    // --- 5. Build summary ------------------------------------------------
    const passed = results.filter((r) => r.passed).length;
    const failed = results.length - passed;

    const response: BatchValidationResult = {
      categoryId,
      categoryName,
      totalCourses: results.length,
      passed,
      failed,
      results,
      executionTimeMs: Date.now() - start,
    };

    return NextResponse.json(response);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error inesperado al consultar la API de Moodle";
    return NextResponse.json({ message }, { status: 500 });
  }
}
