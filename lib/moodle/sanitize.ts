/** Longitud mínima para tratar el token como tal al filtrarlo.
 *
 *  Un token de Moodle son 32 caracteres hexadecimales. Por debajo de este
 *  umbral, buscar la cadena dentro del mensaje produce más falsos positivos que
 *  aciertos: un token de prueba de una letra convertía "getaddrinfo" en
 *  "ge[token oculto]addrinfo". */
const LONGITUD_MINIMA_TOKEN = 16;

/** Quita el token de un mensaje antes de mostrarlo o exportarlo.
 *
 *  Moodle no devuelve el token en sus excepciones, pero los mensajes crudos se
 *  muestran en pantalla y se exportan a CSV: el filtro es la garantía de que un
 *  cambio futuro en Moodle no lo filtre por esa vía. */
export function sinToken(mensaje: string, token: string): string {
  if (token.length < LONGITUD_MINIMA_TOKEN) return mensaje;
  return mensaje.split(token).join("[token oculto]");
}
