export type UtilityItem = {
  title: string;
  description: string;
  href: string;
  badge?: string;
};

export const reportUtilities: UtilityItem[] = [
  {
    title: "Alistamiento",
    description:
      "Verificación técnica de estructura del curso, bloques clave y criterios institucionales.",
    href: "/reportes/alistamiento",
  },
  {
    title: "Evaluación formativa y continua 1",
    description:
      "Revisión de calificaciones y retroalimentaciones para EFC01.",
    href: "/reportes/efc/1",
    badge: "EFC01",
  },
  {
    title: "Evaluación formativa y continua 2",
    description:
      "Revisión de calificaciones y retroalimentaciones para EFC02.",
    href: "/reportes/efc/2",
    badge: "EFC02",
  },
  {
    title: "Evaluación formativa y continua 3",
    description:
      "Revisión de calificaciones y retroalimentaciones para EFC03.",
    href: "/reportes/efc/3",
    badge: "EFC03",
  },
  {
    title: "Consultas de usuarios",
    description: "Consulta de usuarios y métricas operativas relacionadas.",
    href: "/reportes/consultas-usuarios",
  },
  {
    title: "Reporte de inglés",
    description: "Panel para reportes asociados a cursos y programas de inglés.",
    href: "/reportes/ingles",
  },
  {
    title: "Reporte institucional",
    description:
      "Resumen estadístico institucional de cursos, docentes y estudiantes.",
    href: "/reportes/institucionales",
  },
];

export const adminUtilities: UtilityItem[] = [
  {
    title: "Configuración de base de datos",
    description:
      "Guarda localmente la conexión de Moodle en almacenamiento cifrado del navegador.",
    href: "/configuracion/bd",
  },
  {
    title: "Consola SQL",
    description:
      "Espacio para la futura migración de la consola SQL interactiva desde PHP.",
    href: "/utilidades/sql-console",
    badge: "Próximamente",
  },
];