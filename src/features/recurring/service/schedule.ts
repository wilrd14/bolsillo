import { toDateKey } from '@/core/dates';
import type { RecurringRule } from '@/features/recurring/data/recurring-repository';

/** Avanza en UTC y recupera el dia original tras un mes corto. */
export function advanceDue(rule: RecurringRule, anchor: number): string {
  const date = new Date(rule.next_due + 'T00:00:00Z');
  if (rule.frequency === 'weekly') {
    date.setUTCDate(date.getUTCDate() + 7);
    return toDateKey(date);
  }

  const step = rule.frequency === 'monthly' ? 1 : 12;
  date.setUTCMonth(date.getUTCMonth() + step + 1, 0);
  date.setUTCDate(Math.min(anchor, date.getUTCDate()));
  return toDateKey(date);
}

export interface RecurringReminders {
  /** Reemplaza el aviso de la regla por ID. Con null cancela el aviso. */
  replace(ruleId: string, date: Date | null): Promise<void>;
}

export function reminderDate(rule: RecurringRule, now: Date): Date | null {
  if (!rule.active) return null;
  const reminder = new Date(rule.next_due + 'T00:00:00Z');
  reminder.setUTCDate(reminder.getUTCDate() - rule.remind_days_before);
  return reminder > now ? reminder : null;
}
