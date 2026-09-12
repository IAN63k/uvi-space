import { Badge } from "@/components/ui/badge";
import { nombreRol, rolPorId } from "@/lib/moodle/roles";
import { cn } from "@/lib/utils";

interface RolBadgeProps {
  roleId: number;
  /** Nombre devuelto por Moodle, por si el rol no está en el catálogo. */
  nombreEnMoodle?: string;
  className?: string;
}

/** Los roles institucionales se distinguen de los core de Moodle, y ambos de
 *  los que no están en el catálogo y la herramienta no puede tocar. */
export function RolBadge({ roleId, nombreEnMoodle, className }: RolBadgeProps) {
  const rol = rolPorId(roleId);

  if (!rol) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        {nombreRol(roleId, nombreEnMoodle)}
      </Badge>
    );
  }

  return (
    <Badge variant={rol.tipo === "institucional" ? "default" : "secondary"} className={className}>
      {rol.nombre}
    </Badge>
  );
}
