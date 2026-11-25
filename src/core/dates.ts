export function toIsoUtc(date: Date): string {
  return date.toISOString();
}

export function toDateKey(date: Date): string {
  const iso = toIsoUtc(date);
  if (iso.length !== 24) {
    throw new RangeError('Date key requires a four-digit year');
  }
  return iso.slice(0, 10);
}

export function toMonthKey(date: Date): string {
  return toDateKey(date).slice(0, 7);
}

export function startOfMonth(date: Date): string {
  return `${toMonthKey(date)}-01`;
}

export function endOfMonth(date: Date): string {
  const end = new Date(date);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  return toDateKey(end);
}

function weekBoundary(date: Date, offset: number): string {
  const boundary = new Date(date);
  const daysSinceMonday = (boundary.getUTCDay() + 6) % 7;
  boundary.setUTCDate(boundary.getUTCDate() - daysSinceMonday + offset);
  return toDateKey(boundary);
}

/** Devuelve el lunes de la semana UTC. */
export function startOfWeek(date: Date): string {
  return weekBoundary(date, 0);
}

/** Devuelve el domingo de la semana UTC. */
export function endOfWeek(date: Date): string {
  return weekBoundary(date, 6);
}

/** Clave AAAA-MM-DD con las partes locales (no UTC) de la fecha. */
export function toLocalDateKey(date: Date): string {
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Fecha local a mediodía (evita saltos de día por horario de verano) a partir de AAAA-MM-DD. */
export function fromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

/** "2026-11-25" -> "25/11/2026"; lo que no sea AAAA-MM-DD se devuelve tal cual. */
export function formatDisplayDate(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : dateKey;
}

/** "25/11/2026" -> "2026-11-25"; null si no tiene ese formato. */
export function parseDisplayDate(display: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

/** "2026-11" -> "11/2026"; lo que no sea AAAA-MM se devuelve tal cual. */
export function formatDisplayMonth(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  return match ? `${match[2]}/${match[1]}` : monthKey;
}
