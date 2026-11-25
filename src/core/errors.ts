export const APP_ERROR_CODES = [
  'OFFLINE',
  'QUOTA_EXCEEDED',
  'NOT_A_RECEIPT',
  'VALIDATION',
] as const;
export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'AppError';
  }

  /** Omite la causa, que puede contener datos privados o referencias circulares. */
  toJSON(): { code: AppErrorCode; message: string } {
    return { code: this.code, message: this.message };
  }
}
