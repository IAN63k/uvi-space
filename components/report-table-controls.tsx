"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ReportTableControlsProps = {
  filters: ReactNode;
  columns: ReactNode;
  filteredCount: number;
  totalCount: number;
  visibleCount: number;
  onResetFilters: () => void;
  onDownloadCsv: () => void;
  disableDownload: boolean;
  columnsPanelClassName?: string;
  itemLabel?: string;
  resetLabel?: string;
  downloadLabel?: string;
};

export function ReportTableControls({
  filters,
  columns,
  filteredCount,
  totalCount,
  visibleCount,
  onResetFilters,
  onDownloadCsv,
  disableDownload,
  columnsPanelClassName = "w-72",
  itemLabel = "cursos",
  resetLabel = "Limpiar filtros",
  downloadLabel = "Descargar CSV",
}: ReportTableControlsProps) {
  return (
    <div className="rounded-lg border p-3">
      {filters}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Mostrando {filteredCount} de {totalCount} {itemLabel} · {visibleCount} columnas visibles
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <details className="relative">
            <summary className="cursor-pointer rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground">
              Ocultar/mostrar columnas
            </summary>

            <div
              className={`absolute right-0 z-20 mt-2 max-h-80 overflow-auto rounded-md border bg-popover p-2 shadow-lg ${columnsPanelClassName}`}
            >
              {columns}
            </div>
          </details>

          <Button type="button" variant="outline" onClick={onResetFilters}>
            {resetLabel}
          </Button>
          <Button type="button" onClick={onDownloadCsv} disabled={disableDownload}>
            {downloadLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
