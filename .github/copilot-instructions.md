# Copilot Instructions - Informes Moodle

## Arquitectura del Proyecto

Aplicación PHP para generar reportes técnicos de cursos Moodle. Conecta directamente a la base de datos de Moodle para extraer información de alistamiento, avances formativos y estadísticas.

### Estructura de Capas
```
index.php              → Punto de entrada, formulario de selección
report/                → Generadores de reportes (alistamiento, avances, estadistica)
  └─ sql_console.php   → Consola SQL interactiva
models/                → Clases PHP con getters/setters (alistamiento_model.php)
services/              → Conexión BD y queries SQL (connection.php, reportRequest.php)
selectors/             → Carga dinámica de opciones para formularios
helpers/
  ├─ strings.php       → Constantes globales (nombres de categorías, criterios)
  └─ footer.php        → Footer reutilizable con versión de app
css/
  ├─ theme.css         → Sistema de temas con CSS variables (claro/oscuro)
  └─ style-dashboard.css → Estilos legacy (deprecated)
js/
  ├─ theme.js          → Gestión de temas con ThemeManager
  └─ *.js              → Lógica frontend (DataTables, SweetAlert, UI)
```

## Convenciones Críticas

### Base de Datos
- **Credenciales**: Usar variables de entorno desde `.env`, cargar con `services/env.php`
- **Charset**: Siempre configurar `mysqli_set_charset($con, "utf8")` y `$connection->set_charset("utf8")`
- **Conexión Singleton**: NO cerrar conexión con `->close()`, el singleton en `connection()` la reutiliza
- **Tablas Moodle**: Prefijo `mdl_` (ej: `mdl_course`, `mdl_user`, `mdl_course_categories`)

### Patrón de Queries (services/reportRequest.php)
```php
function NombreFuncion($parametro) {
    require_once("../services/connection.php");
    $con = connection();
    mysqli_set_charset($con, "utf8");
    $result = $con->query("SELECT ... FROM mdl_tabla WHERE ...");
    // NO usar $con->close() - el singleton maneja la conexión
    return $result;
}
```

### Tipos de Reportes
| Valor | Reporte | Archivo | Función |
|-------|---------|---------|---------|
| 1 | Alistamiento | `report/alistamiento.php` | `enlistmentReport()` |
| 2-4 | Avance Formativo 1-3 | `report/avances.php` | `advanceReport()` |
| 5 | Estadísticas | `report/estadistica.php` | `statistics()` |
| 6 | Institucionales | `report/estadistica_institucionales.php` | `estadisticasInstitucionales()` |
| 7 | Inglés | `report/estadistica_ingles.php` | - |

### Constantes de Evaluación (helpers/strings.php)
```php
$fails = 'NO CUMPLE';
$succes = 'CUMPLE';      // ⚠️ Typo intencional, mantener consistencia
$notApply = 'NO APLICA';
$hidden = 'OCULTA';
$notExist = 'NO EXISTE';
```

### Categorías de Calificaciones
```php
$ac1 = 'EFC01';  // Evaluación formativa y continua 1
$ac2 = 'EFC02';  // Evaluación formativa y continua 2
$ac3 = 'EFC03';  // Evaluación formativa y continua 3
```

## Flujo de Datos

1. Usuario selecciona tipo de reporte en `index.php`
2. Formulario POST envía a `report/tipo_reporte.php`
3. Switch determina qué archivo de reporte incluir
4. Reporte ejecuta queries vía `services/reportRequest.php`
5. Resultado renderizado con DataTables y Bootstrap

## Frontend

- **CSS Custom Properties**: Sistema de temas en `css/theme.css` con variables CSS
- **Tema claro/oscuro**: Detección automática con `prefers-color-scheme`, toggle manual
- **jQuery 3.3.1**: Manipulación DOM y AJAX
- **DataTables**: Exportación a Excel/CSV, búsqueda, paginación
- **SweetAlert2**: Alertas y confirmaciones
- **Tipografía**: DM Sans (UI) + JetBrains Mono (código)

### Sistema de Temas (css/theme.css, js/theme.js)
```css
/* Variables de tema - usar siempre variables en lugar de colores hardcoded */
--color-primary: #0066ff;
--surface-card: #ffffff;
--text-primary: #1a1a2e;
--border-light: #e2e8f0;
```

```javascript
// Cambiar tema programáticamente
ThemeManager.toggle();           // Alternar tema
ThemeManager.setTheme('dark');   // Establecer tema específico
ThemeManager.getEffectiveTheme(); // Obtener tema actual
```

### Componentes CSS Reutilizables
- `.card`, `.card-header`, `.card-body` → Contenedores con bordes
- `.btn`, `.btn-secondary`, `.btn-ghost` → Botones estilizados
- `.form-control`, `.form-select` → Inputs de formulario
- `.sidebar-item`, `.program-item` → Items de navegación/selección
- `.status-cumple`, `.status-no-cumple` → Badges de estado

## Entorno de Desarrollo

- **Servidor**: XAMPP (Apache + MySQL)
- **Ruta**: `c:\xampp\htdocs\Informes`
- **Acceso**: `http://localhost/Informes/`
- **PHP**: Archivos con `header('Content-Type: text/html; charset=UTF-8')`

## Seguridad

- `.env` debe estar en `.gitignore`
- No exponer credenciales en código fuente
- Validar inputs antes de incluirlos en queries SQL
