export type ValidationType = "equals" | "contains" | "exists" | "min_date" | "max_date";

export interface FieldRuleConfig {
  active: boolean;
  expected: string | number | boolean;
}

export type RulesConfig = Record<string, FieldRuleConfig>;

export interface FieldDefinition {
  name: string;
  /** Nombre descriptivo en español para mostrar en la UI */
  label: string;
  description: string;
  activeByDefault: boolean;
  defaultValue: string | number | boolean;
  inputType: "text" | "number" | "boolean" | "date";
  validationType: ValidationType;
}

export interface ApiFunctionConfig {
  wsfunction: string;
  label: string;
  description: string;
  /** Key used for localStorage: uvi-space.rules.{storageKey}.v1 */
  storageKey: string;
  fields: FieldDefinition[];
}

// Registry — add new API functions here to extend the settings UI
export const API_FUNCTIONS: ApiFunctionConfig[] = [
  {
    wsfunction: "core_course_get_courses",
    label: "core_course_get_courses",
    description: "Configuración de reglas de validación de cursos",
    storageKey: "moodle_rules_core_course_get_courses",
    fields: [
      // ── Validaciones de contenido/texto ─────────────────────────────────────
      {
        name: "fullname_contains",
        label: "El nombre del curso contiene texto",
        description: "Verifica que el nombre completo del curso contenga el texto indicado (ej: '1 2026')",
        activeByDefault: true,
        defaultValue: "1 2026",
        inputType: "text",
        validationType: "contains",
      },
      // ── Validaciones de existencia ───────────────────────────────────────────
      {
        name: "shortname_exists",
        label: "Nombre corto del curso existe",
        description: "El curso debe tener un nombre corto definido (no vacío)",
        activeByDefault: true,
        defaultValue: true,
        inputType: "boolean",
        validationType: "exists",
      },
      {
        name: "idnumber_exists",
        label: "Número ID del curso existe",
        description: "El curso debe tener un número ID definido (no vacío)",
        activeByDefault: true,
        defaultValue: true,
        inputType: "boolean",
        validationType: "exists",
      },
      {
        name: "startdate_exists",
        label: "Fecha de inicio definida",
        description: "El curso debe tener una fecha de inicio configurada",
        activeByDefault: true,
        defaultValue: true,
        inputType: "boolean",
        validationType: "exists",
      },
      {
        name: "enddate_exists",
        label: "Fecha de finalización definida",
        description: "El curso debe tener una fecha de finalización configurada",
        activeByDefault: true,
        defaultValue: false,
        inputType: "boolean",
        validationType: "exists",
      },
      // ── Validaciones de rango de fechas ──────────────────────────────────────
      {
        name: "startdate_min",
        label: "Fecha de inicio mínima",
        description: "La fecha de inicio del curso debe ser igual o posterior a la fecha indicada",
        activeByDefault: false,
        defaultValue: "",
        inputType: "date",
        validationType: "min_date",
      },
      {
        name: "enddate_max",
        label: "Fecha de finalización máxima",
        description: "La fecha de finalización del curso debe ser igual o anterior a la fecha indicada",
        activeByDefault: false,
        defaultValue: "",
        inputType: "date",
        validationType: "max_date",
      },
      // ── Validaciones de igualdad (campos estándar) ───────────────────────────
      {
        name: "visible",
        label: "Curso publicado",
        description: "El curso debe estar publicado y visible para los estudiantes (1=sí, 0=no)",
        activeByDefault: true,
        defaultValue: 1,
        inputType: "number",
        validationType: "equals",
      },
      {
        name: "format",
        label: "Formato del curso",
        description: "Formato de organización del curso (ej: onetopic, weeks, topics)",
        activeByDefault: false,
        defaultValue: "onetopic",
        inputType: "text",
        validationType: "equals",
      },
      {
        name: "enablecompletion",
        label: "Seguimiento de finalización activo",
        description: "Rastreo de finalización de actividades habilitado (1=sí, 0=no)",
        activeByDefault: true,
        defaultValue: 1,
        inputType: "number",
        validationType: "equals",
      },
      {
        name: "maxbytes",
        label: "Tamaño máximo de archivos adjuntos",
        description: "Límite de tamaño para archivos adjuntos en el curso (en bytes)",
        activeByDefault: true,
        defaultValue: 5242880,
        inputType: "number",
        validationType: "equals",
      },
      {
        name: "lang",
        label: "Idioma forzado del curso",
        description: "Idioma forzado del curso (ej: es, en). Vacío para no forzar idioma",
        activeByDefault: false,
        defaultValue: "es",
        inputType: "text",
        validationType: "equals",
      },
      {
        name: "showgrades",
        label: "Mostrar calificaciones a estudiantes",
        description: "Permite a los estudiantes ver el libro de calificaciones (1=sí, 0=no)",
        activeByDefault: true,
        defaultValue: 1,
        inputType: "number",
        validationType: "equals",
      },
      {
        name: "groupmode",
        label: "Modo de grupos del curso",
        description: "Modo de grupos aplicado al curso (0=ninguno, 1=separados, 2=visibles)",
        activeByDefault: true,
        defaultValue: 0,
        inputType: "number",
        validationType: "equals",
      },
      {
        name: "newsitems",
        label: "Cantidad de noticias recientes",
        description: "Número de anuncios recientes mostrados en el bloque de novedades",
        activeByDefault: false,
        defaultValue: 10,
        inputType: "number",
        validationType: "equals",
      },
      {
        name: "showreports",
        label: "Mostrar informes de actividad",
        description: "Permite a los estudiantes ver sus propios informes de actividad (1=sí, 0=no)",
        activeByDefault: false,
        defaultValue: 1,
        inputType: "number",
        validationType: "equals",
      },
      {
        name: "groupmodeforce",
        label: "Forzar modo de grupos en actividades",
        description: "Aplica el modo de grupos a todas las actividades del curso (1=sí, 0=no)",
        activeByDefault: true,
        defaultValue: 0,
        inputType: "number",
        validationType: "equals",
      },
      {
        name: "completionnotify",
        label: "Notificar al completar el curso",
        description: "Envía una notificación cuando un estudiante completa el curso (1=sí, 0=no)",
        activeByDefault: false,
        defaultValue: 0,
        inputType: "number",
        validationType: "equals",
      },
      {
        name: "forcetheme",
        label: "Tema visual forzado",
        description: "Tema visual del curso. Dejar vacío para usar el tema predeterminado del sitio",
        activeByDefault: false,
        defaultValue: "",
        inputType: "text",
        validationType: "equals",
      },
      {
        name: "showactivitydates",
        label: "Mostrar fechas de actividad",
        description: "Muestra las fechas de apertura y cierre de cada actividad a los estudiantes",
        activeByDefault: true,
        defaultValue: true,
        inputType: "boolean",
        validationType: "equals",
      },
      {
        name: "showcompletionconditions",
        label: "Mostrar condiciones de finalización",
        description: "Muestra las condiciones de finalización en la vista de cada actividad",
        activeByDefault: true,
        defaultValue: true,
        inputType: "boolean",
        validationType: "equals",
      },
      {
        name: "summaryformat",
        label: "Formato del resumen del curso",
        description: "Formato del resumen del curso (0=Moodle, 1=HTML, 2=Texto plano, 4=Markdown)",
        activeByDefault: false,
        defaultValue: 1,
        inputType: "number",
        validationType: "equals",
      },
      {
        name: "defaultgroupingid",
        label: "Agrupación por defecto",
        description: "ID de la agrupación por defecto del curso (0=ninguna)",
        activeByDefault: true,
        defaultValue: 0,
        inputType: "number",
        validationType: "equals",
      },
    ],
  },
];

export function buildDefaultRulesConfig(fn: ApiFunctionConfig): RulesConfig {
  return Object.fromEntries(
    fn.fields.map((f) => [f.name, { active: f.activeByDefault, expected: f.defaultValue }]),
  );
}

/** Returns only the active fields as a flat { field: expectedValue } object for the API */
export function buildValidationRules(config: RulesConfig): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(config)
      .filter(([, rule]) => rule.active)
      .map(([field, rule]) => [field, rule.expected]),
  );
}

export function localStorageKey(storageKey: string) {
  return `uvi-space.rules.${storageKey}.v1`;
}

/** Devuelve la etiqueta en español de un campo dado su nombre */
export function getFieldLabelFromRules(fieldName: string): string {
  for (const fn of API_FUNCTIONS) {
    const def = fn.fields.find((f) => f.name === fieldName);
    if (def) return def.label;
  }
  return fieldName;
}
