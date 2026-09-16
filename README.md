## UVI Space (Migración de Informes Moodle)

Base inicial para migrar la aplicación PHP de reportes Moodle a Next.js + `shadcn/ui`.

### Estado actual

- Repositorio central de utilidades en `/`
- Módulos de reportes creados como rutas de App Router:
	- `/reportes/alistamiento`
	- `/reportes/efc/1`, `/reportes/efc/2`, `/reportes/efc/3`
	- `/reportes/consultas-usuarios`
	- `/reportes/ingles`
	- `/reportes/institucionales`
- Utilidad base para futura consola SQL en `/utilidades/sql-console`
- Configuración de conexión BD con almacenamiento local cifrado en `/configuracion/bd`
- Módulos de gestión sobre la API REST de Moodle:
	- `/gestion/matriculas`, `/gestion/matriculas/masiva`
	- `/gestion/roles` — cambio de roles dentro de cursos
	- `/gestion/numero-id` — revisión y corrección en lote del Número ID de los cursos

### Módulo conectado (fase 1)

- `Alistamiento` ya consulta datos reales mediante `POST /api/reportes/alistamiento`
- Entrada actual: `categoryId` (ID de categoría Moodle)
- Salida actual: cursos de la categoría + docentes asociados (rol 3)

### Módulo: cambio de roles en cursos (`/gestion/roles`)

Asigna y retira roles de participantes **dentro de un curso**. No matricula ni
desmatricula: los usuarios siguen inscritos y solo cambia su asignación de rol.

Flujo: se pegan uno o varios `courseid` (coma, espacio o salto de línea), se
consultan los participantes consolidados —un usuario aparece una sola vez con
todos sus cursos y roles—, se seleccionan usuarios, se elige el rol destino y si
el cambio **intercambia** (agrega y retira) o **solo agrega** (acumula roles).
Antes de ejecutar hay una previsualización contable; el resultado por operación
se exporta a CSV.

**Funciones de Moodle:** `core_enrol_get_enrolled_users` para leer,
`core_role_assign_roles` y `core_role_unassign_roles` para escribir, todas por
POST con el token en el cuerpo.

**Reglas de operación:**

- Se asigna, se verifica releyendo el curso y **solo entonces** se retira. Si el
	rol destino no queda confirmado, no se retira nada y se reporta el error.
- Si el usuario ya tiene el rol destino, la asignación se omite como «sin
	cambios»; en modo intercambiar el retiro sí se aplica.
- Si el cambio deja algún curso **sin ningún usuario con rol de profesor con
	edición**, la previsualización lo destaca y exige una confirmación explícita
	antes de habilitar el botón de ejecutar. No lo bloquea: evita que pase por
	descuido. El cálculo sale de los participantes ya consultados.
- Máximo 3 llamadas concurrentes contra Moodle.
- Un error no detiene el lote; cada operación se reporta por separado.

**Catálogo de roles:** `lib/moodle/roles.ts` es el punto único de verdad. Para
habilitar un rol nuevo basta añadirlo con `asignable: true`. La lógica y la UI
trabajan siempre por `roleid`, nunca por nombre: en Moodle un rol se puede
renombrar por curso.

Son asignables los core `editingteacher` (3), `teacher` (4) y `student` (5) y
los institucionales `profesordeingles` (16) y `rolmatricula` (19). Lo que no
está en el catálogo no se puede asignar ni retirar: `manager` (1) y los demás
roles de sistema quedan fuera a propósito. La lista blanca del servidor y los
roles del módulo de matrículas se derivan de esta misma lista, así que no pueden
desincronizarse.

**Token:** el módulo consume el token ya configurado en Ajustes a través de
`hooks/use-moodle-config.ts`, el único punto que lee el almacenamiento del
navegador. Migrar a un secreto de servidor es cambiar ese archivo.

**Límites conocidos:**

- Solo opera sobre usuarios ya matriculados en el curso. Asignar un rol no
	matricula, así que un usuario que no esté en la lista de participantes no
	aparece y no se le puede asignar nada.
- Las asignaciones de rol creadas por un plugin de matriculación no se pueden
	retirar por API y **no hay forma de detectarlo antes de intentarlo**. El
	retiro falla y el mensaje crudo de Moodle llega íntegro al CSV. Como el
	retiro es el último paso, el rol destino ya quedó asignado y verificado: el
	usuario termina con ambos roles, no en un estado a medias.
- Si el token no puede ver los roles de los participantes, la tabla lo informa
	en vez de mostrarse vacía sin explicación.

### Módulo: Número ID de cursos (`/gestion/numero-id`)

Revisa y corrige en lote el **Número ID** (`idnumber`) de los cursos de una
categoría. **Solo escribe ese campo**: no toca nombre corto, nombre completo,
categoría ni ningún otro dato, y no crea ni borra cursos, matrículas o roles. La
ruta de escritura reconstruye cada cambio con `id` e `idnumber` y descarta
cualquier otro campo que llegue en la petición.

Flujo: se elige una categoría (con o sin subcategorías) y se consultan sus
cursos. Se edita la columna «Número ID propuesto», a mano o con la copia
asistida del nombre corto. Se previsualiza, se ejecuta, y el resultado verificado
se exporta a CSV.

**Funciones de Moodle:** `core_course_get_categories` (árbol de categorías),
`core_course_get_courses_by_field` con `category` (cursos de cada categoría),
`idnumber` (valor ocupado) e `ids` (verificación), y `core_course_update_courses`
para escribir. `field=category` solo devuelve los cursos directos: con
«incluir subcategorías» se recorre el árbol.

#### ⚠ El Número ID es siempre una cadena

En este módulo el `idnumber` es texto en todo el recorrido: cliente, rutas,
servicio y verificación. **Nunca se convierte a número.** `Number("00123")` es
`123`, y Moodle guardaría «123» sin devolver ningún error. Las rutas de servidor
rechazan un `idnumber` que no llegue como cadena, en vez de convertirlo. Las
comparaciones se hacen entre cadenas con `===`.

Es un error fácil de reintroducir: las rutas genéricas `/api/moodle/update-course`
y `/api/moodle/update-courses-batch` convierten a número cualquier valor formado
solo por dígitos, así que **no deben usarse para este campo**.

#### Reglas de operación

- **Se ejecuta lo seleccionado.** El checkbox de la fila significa «escribir
	este curso». Editar una fila a mano o rellenarla con la copia asistida la
	selecciona. Una fila seleccionada sin cambios se omite como «sin cambios».
- **Copia asistida del nombre corto** en tres modos: *solo los vacíos* (por
	defecto: sin Número ID en Moodle y sin propuesta escrita), *solo las
	seleccionadas* y *todas, sobrescribiendo* (destructivo: exige una
	confirmación explícita). Solo rellena la tabla; no ejecuta nada.
- **Valor:** se recortan los espacios de los extremos, con un máximo de 100
	caracteres (la columna de Moodle). Los espacios internos y los caracteres
	poco habituales generan un aviso, pero no bloquean.
- **Vacío es válido** y no está sujeto a unicidad: varios cursos pueden quedar
	sin Número ID. Vaciar un valor existente es una acción legítima y se muestra
	como destructiva.
- **Unicidad sin distinguir mayúsculas ni tildes**, igual que la colación `_ci`
	de MySQL: «MAT-101» y «mat-101» chocan. Si la instancia distinguiera
	mayúsculas, se marcarían conflictos de más, nunca de menos.
- Máximo 3 llamadas concurrentes contra Moodle. Un error no detiene el lote.

#### Modos de fallo

Se distinguen, no se agrupan en un «error» genérico:

1. **Duplicado en el lote:** dos filas acabarían con el mismo valor. Se detecta
	en código antes de cualquier llamada, se marcan ambas filas y el botón de
	ejecutar queda bloqueado hasta resolverlo.
2. **Ocupado por otro curso:** antes de ejecutar se consulta en Moodle cada
	valor que cambia. Si lo tiene un curso ajeno a la consulta, se muestra cuál
	(id, nombre corto y nombre completo). La fila queda fuera de la ejecución,
	pero no bloquea al resto. Si la consulta falla, la fila queda «sin
	comprobar» y también se excluye, nunca se da por libre.
3. **Rechazo de Moodle al escribir:** llega como excepción o como HTTP 200 con
	`warnings[]`. Cualquier warning cuenta como fallo de ese curso, aunque la
	relectura muestre el valor esperado. Se escribe un curso por llamada, para
	que cada warning pertenezca sin ambigüedad a su curso.
4. **Falta de capacidad:** si todas las escrituras intentadas fallan por
	`nopermissions` o `accessexception`, se muestra un único aviso con la
	capacidad que falta (`moodle/course:changeidnumber`) y el mensaje de Moodle
	una sola vez. Se clasifica por `errorcode`, que no depende del idioma.

**Verificación posterior:** después de cada tanda se releen los cursos. Solo es
«aplicado» lo que la relectura confirma con el valor exacto. Si Moodle no
reporta error pero el valor no cambió, o no se pudo releer, el resultado es un
error. Al terminar, la tabla se vuelve a consultar: lo aplicado pierde su
propuesta y su selección, y lo fallido las conserva para reintentar.

**Cadenas e intercambios:** si A toma el valor actual de B y B cambia a otro,
se escribe primero B. Si B no se aplica, A no se intenta. Un **intercambio
circular** (A quiere el valor de B y B el de A) se bloquea: Moodle no admite dos
cursos con el mismo valor ni un instante. La previsualización nombra ambos
cursos y explica la salida en dos pasadas: primero se vacía uno y después se
asigna su valor definitivo.

#### Riesgo: Número ID con dueño externo

Cuando el Número ID actual no está vacío y no coincide con el nombre corto,
puede pertenecer a una **integración externa que empareja cursos por
`idnumber`** (por ejemplo, un sistema académico que sincroniza matrículas).
Sobrescribirlo o vaciarlo rompería ese vínculo sin ningún error visible en
Moodle. La tabla marca esas filas con «No coincide con el nombre corto». La copia
asistida, la previsualización y la confirmación cuentan cuántos cursos
perderían un valor así. **No bloquea**: comprobar si ese valor tiene dueño es
responsabilidad del operador.

#### Respuesta de `core_course_update_courses`

Según el código de Moodle (`course/externallib.php`), `update_courses` captura
la excepción de cada curso y la devuelve como `warnings[]` con HTTP 200
(`courseidnumbertaken`, `nopermissions`…). Solo los errores generales llegan
como excepción: token inválido o función no habilitada en el servicio. Una
escritura correcta responde `{"warnings": []}`.

> Pendiente de confirmar contra la instancia con la sonda sobre el curso de
> prueba de «#CURSOS INTERNOS DEL EJE».

#### Límites conocidos

- `core_course_get_courses_by_field` solo devuelve los cursos que el token puede
	ver. Un curso oculto que ya tenga el valor no aparece en la comprobación
	previa. El rechazo llega al escribir (`courseidnumbertaken`) y se reporta
	como error, nunca como éxito.
- Excel puede mostrar «00123» como `123` al abrir el CSV. El archivo contiene
	la cadena exacta.
- No hay importación de Número ID desde CSV ni pegado desde Excel (queda para
	una segunda versión).

#### Deuda conocida (fuera de este módulo)

- Revisión de cursos: la corrección masiva de `idnumber_exists` escribe el
	mismo valor en todos los cursos afectados, así que solo puede aplicarse al
	primero.
- `/api/moodle/update-course` y `/api/moodle/update-courses-batch` convierten a
	número los valores formados solo por dígitos, en cualquier campo de texto.

### Stack

- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- `shadcn/ui` (estilo `base-nova`)

## Desarrollo

Ejecuta el servidor de desarrollo:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Abre [http://localhost:3000](http://localhost:3000) para ver la aplicación.

### Nota de seguridad

La configuración de base de datos se cifra en `localStorage` del navegador para uso local del operador. Esto no reemplaza un backend seguro con secretos en servidor; es un paso de transición para esta fase de migración.

## Siguientes pasos de migración

- Crear API Routes para reemplazar `services/reportRequest.php`
- Implementar conexión server-side a MySQL usando variables de entorno del servidor
- Migrar tablas DataTables y exportación de reportes
- Agregar autenticación/autorización para utilidades críticas (ej. consola SQL)

## Referencias

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
