import { z } from 'zod';
import { extractionSchema, toReceipt } from './extraction.ts';

const requestSchema = z.strictObject({ receipt_id: z.uuid(), storage_path: z.string() });

const errors = {
  invalid_request: [400, 'Solicitud de escaneo inválida.'],
  unauthorized: [401, 'Se requiere una sesión válida.'],
  image_not_found: [404, 'No se encontró la imagen.'],
  not_a_receipt: [422, 'No pudimos leer la factura.'],
  quota_exceeded: [429, 'Llegaste al límite de escaneos de hoy.'],
  provider_error: [502, 'No se pudo procesar la factura.'],
  internal_error: [500, 'No se pudo completar el escaneo.'],
} as const;

type ErrorCode = keyof typeof errors;

function fail(code: ErrorCode) {
  const [status, message] = errors[code];
  return Response.json({ error: { code, message } }, { status });
}

type Dependencies = {
  authenticate: (token: string) => Promise<string | null>;
  consumeQuota: (userId: string, receiptId: string) => Promise<boolean>;
  download: (path: string, token: string) => Promise<Blob | null>;
  vision: (image: Blob) => Promise<unknown>;
  log?: (userId: string | null, code: ErrorCode | 'ok', elapsedMs: number) => void;
};

async function extract(vision: Dependencies['vision'], image: Blob) {
  try {
    const result = extractionSchema.safeParse(await vision(image));
    if (!result.success) return fail('provider_error');
    if (!result.data.receipt) return fail('not_a_receipt');
    return Response.json(toReceipt(result.data.receipt));
  } catch {
    return fail('provider_error');
  }
}

/** Construye el handler HTTP con dependencias sustituibles en pruebas. */
export function createHandler(deps: Dependencies) {
  return async (request: Request) => {
    const started = performance.now();
    let userId: string | null = null;

    async function scan() {
      if (request.method !== 'POST') return fail('invalid_request');

      const token = /^Bearer ([^\s]+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
      if (!token) return fail('unauthorized');
      userId = await deps.authenticate(token);
      if (!userId) return fail('unauthorized');

      const body = requestSchema.safeParse(await request.json().catch(() => undefined));
      if (!body.success) return fail('invalid_request');
      const { receipt_id: receiptId, storage_path: path } = body.data;
      if (path !== `${userId}/${receiptId}.jpg`) return fail('invalid_request');

      if (!(await deps.consumeQuota(userId, receiptId))) return fail('quota_exceeded');
      const image = await deps.download(path, token);
      if (!image) return fail('image_not_found');
      return extract(deps.vision, image);
    }

    const response = await scan().catch(() => fail('internal_error'));
    const code = (Object.keys(errors) as ErrorCode[]).find(
      (key) => errors[key][0] === response.status,
    );
    deps.log?.(userId, code ?? 'ok', Math.round(performance.now() - started));
    return response;
  };
}
