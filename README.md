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
- Máximo 3 llamadas concurrentes contra Moodle.
- Un error no detiene el lote; cada operación se reporta por separado.

**Catálogo de roles:** `lib/moodle/roles.ts` es el punto único de verdad. Para
habilitar un rol nuevo basta añadirlo con `asignable: true`. La lógica y la UI
trabajan siempre por `roleid`, nunca por nombre: en Moodle un rol se puede
renombrar por curso.

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
