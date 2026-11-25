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
