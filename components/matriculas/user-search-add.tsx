"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { UserSearchPanel, type FoundUser } from "@/components/matriculas/user-search-panel";
import { toBulkUser, type BulkUser } from "@/lib/matriculas/api";
import type { MoodleConfig } from "@/lib/encrypted-local-storage";

interface UserSearchAddProps {
  config: MoodleConfig | null;
  onAdd: (users: BulkUser[]) => void;
}

/** Búsqueda individual (incluye nombre completo) con botón para añadir a la lista. */
export function UserSearchAdd({ config, onAdd }: UserSearchAddProps) {
  const [found, setFound] = useState<FoundUser | null>(null);

  const add = () => {
    if (!found) return;
    onAdd([toBulkUser(found.user)]);
    setFound(null);
  };

  return (
    <div className="space-y-3">
      <UserSearchPanel config={config} found={found} onUserFound={setFound} />
      {found && (
        <Button type="button" onClick={add}>
          <UserPlus className="mr-1.5 h-4 w-4" />
          Añadir a la lista
        </Button>
      )}
    </div>
  );
}
