/** Quita el token de un mensaje antes de mostrarlo o exportarlo.
 *
 *  Moodle no devuelve el token en sus excepciones, pero los mensajes crudos se
 *  muestran en pantalla y se exportan a CSV: el filtro es la garantía de que un
 *  cambio futuro en Moodle no lo filtre por esa vía. */
export function sinToken(mensaje: string, token: string): string {
  if (!token) return mensaje;
  return mensaje.split(token).join("[token oculto]");
}
