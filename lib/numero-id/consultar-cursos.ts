import { mapConConcurrencia } from "@/lib/moodle/concurrency";
import { getCategoriesByParent, getCategoryInfo, getCoursesByCategory } from "@/lib/moodle/moodle.service";
import { sinToken } from "@/lib/moodle/sanitize";
import type { MoodleCategory } from "@/lib/moodle/types";

import type { CategoriaConsultada, CursoIdnumber, CursosResponse } from "./types";

/** Moodle es un servidor compartido: nunca más de 3 llamadas en vuelo. */
const CONCURRENCIA = 3;

interface ConsultaCursos {
  moodleUrl: string;
  token: string;
  categoryId: number;
  incluirSubcategorias: boolean;
}

interface Categoria {
  id: number;
  nombre: string;
}

const textoDeError = (err: unknown, token: string) =>
  sinToken(err instanceof Error ? err.message : "Error desconocido de Moodle", token);

/** Recorre el árbol por niveles para respetar el límite de concurrencia.
 *  Una categoría cuyas hijas no se pudieron listar se reporta y el resto sigue. */
async function resolverArbol(
  { moodleUrl, token }: ConsultaCursos,
  raiz: Categoria,
): Promise<{ categorias: Categoria[]; fallidas: CategoriaConsultada[] }> {
  const categorias: Categoria[] = [raiz];
  const fallidas: CategoriaConsultada[] = [];
  const vistas = new Set([raiz.id]);
  let nivel = [raiz];

  while (nivel.length > 0) {
    const hijas = await mapConConcurrencia(nivel, CONCURRENCIA, async (categoria) => {
      try {
        return await getCategoriesByParent(moodleUrl, token, categoria.id);
      } catch (err) {
        fallidas.push({
          ...categoria,
          ok: false,
          totalCursos: 0,
          error: `No se pudieron listar sus subcategorías: ${textoDeError(err, token)}`,
        });
        return [] as MoodleCategory[];
      }
    });

    nivel = hijas
      .flat()
      .filter((hija) => !vistas.has(hija.id))
      .map((hija) => ({ id: hija.id, nombre: hija.name }));
    nivel.forEach((categoria) => vistas.add(categoria.id));
    categorias.push(...nivel);
  }

  return { categorias, fallidas };
}

/** Cursos directos de cada categoría (field=category no incluye subcategorías).
 *
 *  El idnumber se copia como cadena tal cual llega de Moodle, sin recortar ni
 *  convertir: es el valor contra el que se compara todo lo demás. */
async function cursosPorCategoria({ moodleUrl, token }: ConsultaCursos, categorias: Categoria[]) {
  return mapConConcurrencia(categorias, CONCURRENCIA, async (categoria) => {
    try {
      const cursos = await getCoursesByCategory(moodleUrl, token, categoria.id);
      return {
        consultada: { ...categoria, ok: true, totalCursos: cursos.length } satisfies CategoriaConsultada,
        cursos: cursos.map(
          (curso): CursoIdnumber => ({
            id: curso.id,
            fullname: curso.fullname,
            shortname: curso.shortname,
            idnumber: curso.idnumber ?? "",
            categoryId: categoria.id,
            categoryName: categoria.nombre,
          }),
        ),
      };
    } catch (err) {
      return {
        consultada: { ...categoria, ok: false, totalCursos: 0, error: textoDeError(err, token) },
        cursos: [] as CursoIdnumber[],
      };
    }
  });
}

export async function consultarCursos(consulta: ConsultaCursos): Promise<CursosResponse> {
  const { moodleUrl, token, categoryId, incluirSubcategorias } = consulta;

  const info = await getCategoryInfo(moodleUrl, token, categoryId);
  if (!info) {
    throw new Error(`La categoría ${categoryId} no existe o el token no puede verla`);
  }

  const raiz = { id: info.id, nombre: info.name };
  const { categorias, fallidas } = incluirSubcategorias
    ? await resolverArbol(consulta, raiz)
    : { categorias: [raiz], fallidas: [] };

  const consultas = await cursosPorCategoria(consulta, categorias);
  const cursos = [...new Map(consultas.flatMap((c) => c.cursos).map((curso) => [curso.id, curso])).values()];

  return {
    cursos: cursos.sort((a, b) => a.fullname.localeCompare(b.fullname, "es")),
    categorias: [...consultas.map((c) => c.consultada), ...fallidas],
  };
}
