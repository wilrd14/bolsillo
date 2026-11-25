import { z } from 'zod';

import { AppError, type AppErrorCode } from '@/core/errors';

const confidence = z.number().min(0).max(1);
export const receiptExtractionSchema = z.strictObject({
  merchant: z.string().nullable(),
  date: z.iso.date().nullable(),
  total_minor: z.int(),
  tax_minor: z.int(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  items: z.array(z.strictObject({ description: z.string(), amount_minor: z.int() })),
  confidence: z.strictObject({ merchant: confidence, date: confidence, total: confidence }),
});

export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;

const serverError = z.object({ error: z.object({ code: z.string() }) });

export function scanError(body: unknown) {
  const code = serverError.safeParse(body).data?.error.code;
  const appCode: AppErrorCode =
    code === 'quota_exceeded'
      ? 'QUOTA_EXCEEDED'
      : code === 'not_a_receipt'
        ? 'NOT_A_RECEIPT'
        : 'VALIDATION';
  return new AppError(appCode, 'Receipt scan failed');
}
