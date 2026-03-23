import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";

import type { DatabaseConfig } from "@/lib/database-config";

type CategoryRow = RowDataPacket & {
  id: number;
  name: string;
  coursecount: number;
};

function sanitizeDbConfig(config: Partial<DatabaseConfig>): DatabaseConfig | null {
  if (!config.server || !config.user || !config.password || !config.database) {
    return null;
  }
  return {
    server: String(config.server).trim(),
    user: String(config.user).trim(),
    password: String(config.password),
    database: String(config.database).trim(),
  };
}

export async function POST(request: NextRequest) {
  let connection: mysql.Connection | null = null;

  try {
    const body = (await request.json()) as { dbConfig?: Partial<DatabaseConfig> };
    const dbConfig = sanitizeDbConfig(body.dbConfig ?? {});

    if (!dbConfig) {
      return NextResponse.json(
        { message: "Configuración de base de datos inválida o incompleta." },
        { status: 400 },
      );
    }

    connection = await mysql.createConnection({
      host: dbConfig.server,
      user: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.database,
      connectTimeout: 10_000,
      charset: "utf8mb4",
    });

    const [rows] = await connection.execute<CategoryRow[]>(
      `SELECT id, name, coursecount
       FROM mdl_course_categories
       WHERE parent = 0
       ORDER BY name ASC`,
    );

    return NextResponse.json({
      categories: rows.map((row) => ({
        id: row.id,
        name: row.name,
        courseCount: row.coursecount,
      })),
    });
  } catch {
    return NextResponse.json(
      { message: "No fue posible obtener las categorías. Verifica la conexión a la base de datos." },
      { status: 500 },
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
