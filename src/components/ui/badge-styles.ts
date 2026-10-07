export const METHOD_STYLES: Record<string, string> = {
  GET: 'text-emerald-700 bg-emerald-500/12 dark:text-emerald-400',
  POST: 'text-sky-700 bg-sky-500/12 dark:text-sky-400',
  PUT: 'text-amber-700 bg-amber-500/14 dark:text-amber-400',
  PATCH: 'text-violet-700 bg-violet-500/12 dark:text-violet-400',
  DELETE: 'text-rose-700 bg-rose-500/12 dark:text-rose-400',
  HEAD: 'text-slate-600 bg-slate-500/12 dark:text-slate-400',
  OPTIONS: 'text-slate-600 bg-slate-500/12 dark:text-slate-400',
}

export const methodTextColor: Record<string, string> = {
  GET: 'text-emerald-600 dark:text-emerald-400',
  POST: 'text-sky-600 dark:text-sky-400',
  PUT: 'text-amber-600 dark:text-amber-400',
  PATCH: 'text-violet-600 dark:text-violet-400',
  DELETE: 'text-rose-600 dark:text-rose-400',
  HEAD: 'text-slate-500',
  OPTIONS: 'text-slate-500',
}

export function statusTone(status: number | null | undefined) {
  if (!status) return 'text-muted bg-surface-3'
  if (status < 300) return 'text-emerald-700 bg-emerald-500/12 dark:text-emerald-400'
  if (status < 400) return 'text-sky-700 bg-sky-500/12 dark:text-sky-400'
  if (status < 500) return 'text-amber-700 bg-amber-500/14 dark:text-amber-400'
  return 'text-rose-700 bg-rose-500/12 dark:text-rose-400'
}
