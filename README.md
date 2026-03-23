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

### Módulo conectado (fase 1)

- `Alistamiento` ya consulta datos reales mediante `POST /api/reportes/alistamiento`
- Entrada actual: `categoryId` (ID de categoría Moodle)
- Salida actual: cursos de la categoría + docentes asociados (rol 3)

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
