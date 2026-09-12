import { ENROLMENT_ROLES } from "@/lib/matriculas/api";

/** Opciones de rol agrupadas por origen, para cualquier `select` de roles.
 *  Separar los institucionales de los core evita elegir uno por otro en una
 *  lista plana. */
export function RoleOptions() {
  const institucionales = ENROLMENT_ROLES.filter((rol) => rol.tipo === "institucional");
  const core = ENROLMENT_ROLES.filter((rol) => rol.tipo === "core");

  return (
    <>
      <optgroup label="Roles core de Moodle">
        {core.map((rol) => (
          <option key={rol.id} value={rol.id}>
            {rol.label}
          </option>
        ))}
      </optgroup>
      {institucionales.length > 0 && (
        <optgroup label="Roles institucionales">
          {institucionales.map((rol) => (
            <option key={rol.id} value={rol.id}>
              {rol.label}
            </option>
          ))}
        </optgroup>
      )}
    </>
  );
}
