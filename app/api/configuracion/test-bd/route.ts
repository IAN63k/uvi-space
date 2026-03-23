import { NextRequest, NextResponse } from "next/server";
import mysql from "mysql2/promise";

import type { DatabaseConfig } from "@/lib/database-config";

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
        { ok: false, message: "Datos incompletos de conexión." },
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

    await connection.query("SELECT 1");

    return NextResponse.json({
      ok: true,
      message: "Conexión exitosa a la base de datos.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? `Error de conexión: ${error.message}`
        : "No fue posible conectarse a la base de datos.";

    return NextResponse.json({ ok: false, message }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
