/** Data local no formato AAAA-MM-DD. */
export function ymdOf(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Hoje deslocado em `days` dias, no formato AAAA-MM-DD. */
export function ymd(days = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return ymdOf(date);
}

export const today = (): string => ymd(0);

/** 2026-10-03 → 03/10/2026; vazio → "—". */
export function formatDate(value: string | undefined): string {
  if (!value) return '—';
  return new Date(`${value}T12:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** 2026-10-03 → 03/10. */
export function formatShortDate(value: string | undefined): string {
  return value ? formatDate(value).slice(0, 5) : '';
}

export function dayLabel(iso: string): string {
  const key = ymdOf(new Date(iso));
  if (key === ymd(0)) return 'Hoje';
  if (key === ymd(-1)) return 'Ontem';
  return formatDate(key);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
