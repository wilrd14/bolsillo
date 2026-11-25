import { createHandler } from './handler.ts';

const user = '10000000-0000-4000-8000-000000000001';
const receiptId = '20000000-0000-4000-8000-000000000001';
const storagePath = `${user}/${receiptId}.jpg`;

function equal(actual: unknown, expected: unknown) {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function loadFixture(name: string) {
  const path = new URL(`../../../e2e/fixtures/receipts/${name}`, import.meta.url);
  return JSON.parse(Deno.readTextFileSync(path));
}

interface Deps {
  authenticate: (token: string) => Promise<string | null>;
  consumeQuota: (userId: string) => Promise<boolean>;
  download: (path: string, token: string) => Promise<Blob | null>;
  vision: (image: Blob) => Promise<unknown>;
}

const defaults: Deps = {
  authenticate: () => Promise.resolve(user),
  consumeQuota: () => Promise.resolve(true),
  download: () => Promise.resolve(new Blob(['synthetic'])),
  vision: () => Promise.resolve(loadFixture('synthetic-001.json')),
};

function request(payload: unknown = { receipt_id: receiptId, storage_path: storagePath }) {
  return new Request('http://localhost/scan-receipt', {
    method: 'POST',
    headers: { Authorization: 'Bearer synthetic' },
    body: JSON.stringify(payload),
  });
}

async function scan(
  deps: Deps,
  payload: unknown = { receipt_id: receiptId, storage_path: storagePath },
) {
  return createHandler(deps)(request(payload));
}

async function expectError(status: number, code: string, deps: Deps, payload?: unknown) {
  const response = await scan(deps, payload);
  equal(response.status, status);
  const result = await response.json();
  equal(result.error.code, code);
  equal(Object.keys(result).join(), 'error');
}

Deno.test('camino feliz: fixture sintética devuelve importes en unidad menor', async () => {
  const response = await scan({
    ...defaults,
    vision: () => Promise.resolve(loadFixture('synthetic-001.json')),
  });
  equal(response.status, 200);
  const result = await response.json();
  equal(result.merchant, 'Tienda Sintética');
  equal(result.date, '2026-11-25');
  equal(result.total_minor, 1234);
  equal(result.tax_minor, 1);
  equal(result.currency, 'DOP');
  equal(result.items.length, 2);
  equal(result.items[0].description, 'Frutas');
  equal(result.items[0].amount_minor, 500);
  equal(result.items[1].description, 'Embalaje');
  equal(result.items[1].amount_minor, 733);
});

Deno.test('factura sintética con campos nulos: merchant y date devuelven null', async () => {
  const response = await scan({
    ...defaults,
    vision: () => Promise.resolve(loadFixture('synthetic-002.json')),
  });
  equal(response.status, 200);
  const result = await response.json();
  equal(result.merchant, null);
  equal(result.date, null);
  equal(result.total_minor, 2000);
  equal(result.tax_minor, 0);
});

Deno.test('factura sin total: rechazada con provider_error', async () => {
  await expectError(502, 'provider_error', {
    ...defaults,
    vision: () => Promise.resolve(loadFixture('synthetic-003.json')),
  });
});

Deno.test('imagen no factura: 422 not_a_receipt', async () => {
  await expectError(422, 'not_a_receipt', {
    ...defaults,
    vision: () => Promise.resolve({ receipt: null }),
  });
});

Deno.test('cupo agotado: 429 quota_exceeded', async () => {
  await expectError(429, 'quota_exceeded', {
    ...defaults,
    consumeQuota: () => Promise.resolve(false),
  });
});

Deno.test('JWT inválido: 401 unauthorized', async () => {
  await expectError(401, 'unauthorized', {
    ...defaults,
    authenticate: () => Promise.resolve(null),
  });
});

Deno.test('ruta ajena: 400 invalid_request', async () => {
  await expectError(400, 'invalid_request', defaults, {
    receipt_id: receiptId,
    storage_path: `${receiptId}/${receiptId}.jpg`,
  });
});

Deno.test('imagen faltante: 404 image_not_found', async () => {
  await expectError(404, 'image_not_found', { ...defaults, download: () => Promise.resolve(null) });
});

Deno.test('respuesta del modelo malformada: 502 provider_error', async () => {
  await expectError(502, 'provider_error', { ...defaults, vision: () => Promise.resolve({}) });
});

Deno.test('importes con punto: fixture sintética validada en unidad menor', async () => {
  const response = await scan({
    ...defaults,
    vision: () => Promise.resolve(loadFixture('synthetic-004.json')),
  });
  equal(response.status, 200);
  const result = await response.json();
  equal(result.total_minor, 1234567);
  equal(result.tax_minor, 825);
  equal(result.items.length, 1);
  equal(result.items[0].amount_minor, 1200050);
});

Deno.test('importes con comas: rechazados con provider_error', async () => {
  await expectError(502, 'provider_error', {
    ...defaults,
    vision: () => Promise.resolve(loadFixture('synthetic-005.json')),
  });
});

Deno.test('fallo interno: 500 internal_error', async () => {
  await expectError(500, 'internal_error', {
    ...defaults,
    consumeQuota: () => Promise.reject(new Error('Synthetic quota failure')),
  });
});
