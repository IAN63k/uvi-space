export type ReportStatus = "CUMPLE" | "NO CUMPLE" | "NO APLICA" | "NO EXISTE";

export const REPORT_STATUS = {
  success: "CUMPLE" as const,
  fails: "NO CUMPLE" as const,
  notApply: "NO APLICA" as const,
  notExist: "NO EXISTE" as const,
};

export function getStatusClass(status: ReportStatus) {
  if (status === REPORT_STATUS.success) {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
  }

  if (status === REPORT_STATUS.notApply) {
    return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }

  if (status === REPORT_STATUS.notExist) {
    return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  }

  return "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300";
}
