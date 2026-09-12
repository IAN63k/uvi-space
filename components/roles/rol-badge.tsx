import { Badge } from "@/components/ui/badge";
import { esRolAsignable, nombreRol } from "@/lib/moodle/roles";
import { cn } from "@/lib/utils";

interface RolBadgeProps {
  roleId: number;
  /** Nombre devuelto por Moodle, por si el rol no está en el catálogo. */
  nombreEnMoodle?: string;
  className?: string;
}

/** Los roles que la herramienta gestiona se distinguen de los informativos:
 *  el operador ve de un vistazo sobre cuáles puede actuar. */
export function RolBadge({ roleId, nombreEnMoodle, className }: RolBadgeProps) {
  const gestionable = esRolAsignable(roleId);

  return (
    <Badge
      variant={gestionable ? "default" : "outline"}
      className={cn(!gestionable && "text-muted-foreground", className)}
    >
      {nombreRol(roleId, nombreEnMoodle)}
    </Badge>
  );
}
