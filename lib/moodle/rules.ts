export interface FieldRuleConfig {
  active: boolean;
  expected: string | number;
}

export type RulesConfig = Record<string, FieldRuleConfig>;

export interface FieldDefinition {
  name: string;
  description: string;
  activeByDefault: boolean;
  defaultValue: string | number;
  inputType: "text" | "number";
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
      { name: "visible",                   description: "El curso debe estar publicado (1=sí, 0=no)",              activeByDefault: true,  defaultValue: 1,          inputType: "number" },
      { name: "format",                    description: "Formato del curso (ej: onetopic, weeks, topics)",          activeByDefault: true,  defaultValue: "onetopic", inputType: "text"   },
      { name: "enablecompletion",          description: "Rastreo de finalización activo (1=sí, 0=no)",             activeByDefault: true,  defaultValue: 1,          inputType: "number" },
      { name: "maxbytes",                  description: "Tamaño máximo de archivos adjuntos (bytes)",              activeByDefault: true,  defaultValue: 5242880,    inputType: "number" },
      { name: "lang",                      description: "Idioma forzado del curso (ej: es, en)",                   activeByDefault: false, defaultValue: "es",       inputType: "text"   },
      { name: "showgrades",                description: "Mostrar calificaciones a estudiantes (1=sí, 0=no)",       activeByDefault: false, defaultValue: 1,          inputType: "number" },
      { name: "groupmode",                 description: "Modo de grupos (0=ninguno, 1=separados, 2=visibles)",     activeByDefault: false, defaultValue: 0,          inputType: "number" },
      { name: "newsitems",                 description: "Cantidad de noticias recientes en el bloque de novedades", activeByDefault: false, defaultValue: 0,          inputType: "number" },
      { name: "showreports",               description: "Mostrar informes de actividad a estudiantes (1=sí, 0=no)", activeByDefault: false, defaultValue: 0,          inputType: "number" },
      { name: "groupmodeforce",            description: "Forzar modo de grupos en todas las actividades (1=sí, 0=no)", activeByDefault: false, defaultValue: 0,       inputType: "number" },
      { name: "completionnotify",          description: "Notificar al completar el curso (1=sí, 0=no)",            activeByDefault: false, defaultValue: 0,          inputType: "number" },
      { name: "forcetheme",                description: "Tema visual forzado del curso (dejar vacío para no forzar)", activeByDefault: false, defaultValue: "",       inputType: "text"   },
      { name: "showactivitydates",         description: "Mostrar fechas de las actividades a estudiantes (1=sí, 0=no)", activeByDefault: false, defaultValue: 1,     inputType: "number" },
      { name: "showcompletionconditions",  description: "Mostrar condiciones de finalización en actividades (1=sí, 0=no)", activeByDefault: false, defaultValue: 1,  inputType: "number" },
      { name: "summaryformat",             description: "Formato del resumen (0=Moodle, 1=HTML, 2=Texto plano, 4=Markdown)", activeByDefault: false, defaultValue: 1, inputType: "number" },
      { name: "defaultgroupingid",         description: "ID de la agrupación por defecto (0=ninguna)",             activeByDefault: false, defaultValue: 0,          inputType: "number" },
    ],
  },
];

export function buildDefaultRulesConfig(fn: ApiFunctionConfig): RulesConfig {
  return Object.fromEntries(
    fn.fields.map((f) => [f.name, { active: f.activeByDefault, expected: f.defaultValue }]),
  );
}

/** Returns only the active fields as a flat { field: expectedValue } object for the API */
export function buildValidationRules(config: RulesConfig): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(config)
      .filter(([, rule]) => rule.active)
      .map(([field, rule]) => [field, rule.expected]),
  );
}

export function localStorageKey(storageKey: string) {
  return `uvi-space.rules.${storageKey}.v1`;
}
