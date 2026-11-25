import { createHandler } from './handler.ts';

function equal(actual: unknown, expected: unknown) {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const user = '10000000-0000-4000-8000-000000000001';
const receipt = '20000000-0000-4000-8000-000000000001';
const body = { receipt_id: receipt, storage_path: `${user}/${receipt}.jpg` };
const extraction = {
  receipt: {
    merchant: 'Synthetic shop',
    date: '2026-11-25',
    total: '12.34',
    tax: '0.01',
    currency: 'DOP',
    items: [{ description: 'Synthetic item', amount: '12.34' }],
    confidence: { merchant: 1, date: 1, total: 1 },
  },
};

const defaults = {
  authenticate: () => Promise.resolve(user),
  consumeQuota: () => Promise.resolve(true),
  download: () => Promise.resolve(new Blob(['synthetic'])),
  vision: () => Promise.resolve(extraction),
};

Deno.test(
  'passes the same quota identity on retries and a different one for a new receipt',
  async () => {
    const charged = new Set<string>();
    const handler = createHandler({
      ...defaults,
      consumeQuota(userId, receiptId) {
        const key = `${userId}/${receiptId}`;
        if (charged.has(key)) return Promise.resolve(true);
        if (charged.size === 1) return Promise.resolve(false);
        charged.add(key);
        return Promise.resolve(true);
      },
    });
    equal((await handler(request())).status, 200);
    equal((await handler(request())).status, 200);
    equal([...charged][0], `${user}/${receipt}`);
    equal(
      (await handler(request({ receipt_id: user, storage_path: `${user}/${user}.jpg` }))).status,
      429,
    );
  },
);

function request(payload: unknown = body, token = 'Bearer synthetic') {
  return new Request('http://localhost/scan-receipt', {
    method: 'POST',
    headers: { Authorization: token },
    body: JSON.stringify(payload),
  });
}

Deno.test('returns only the validated receipt with amounts in minor units', async () => {
  const response = await createHandler(defaults)(request());
  equal(response.status, 200);
  const result = await response.json();
  equal(result.merchant, extraction.receipt.merchant);
  equal(result.date, extraction.receipt.date);
  equal(result.total_minor, 1234);
  equal(result.tax_minor, 1);
  equal(result.currency, 'DOP');
  equal(result.items.length, 1);
  equal(result.items[0].description, 'Synthetic item');
  equal(result.items[0].amount_minor, 1234);
  equal(result.confidence.merchant, 1);
  equal(result.confidence.date, 1);
  equal(result.confidence.total, 1);
  equal(Object.keys(result).length, 7);
});

const cases = [
  { status: 401, code: 'unauthorized', input: request(body, '') },
  { status: 401, code: 'unauthorized', authenticate: () => Promise.resolve(null) },
  { status: 400, code: 'invalid_request', input: request({}) },
  {
    status: 400,
    code: 'invalid_request',
    input: request({ ...body, storage_path: `${user}/${user}.jpg` }),
  },
  {
    status: 400,
    code: 'invalid_request',
    input: request({ ...body, storage_path: `${receipt}/${receipt}.jpg` }),
  },
  { status: 429, code: 'quota_exceeded', consumeQuota: () => Promise.resolve(false) },
  { status: 404, code: 'image_not_found', download: () => Promise.resolve(null) },
  { status: 422, code: 'not_a_receipt', vision: () => Promise.resolve({ receipt: null }) },
  { status: 502, code: 'provider_error', vision: () => Promise.resolve({ receipt: {} }) },
  {
    status: 502,
    code: 'provider_error',
    vision: () =>
      Promise.resolve({ receipt: { ...extraction.receipt, total: '90071992547409.92' } }),
  },
  {
    status: 500,
    code: 'internal_error',
    consumeQuota: () => Promise.reject(new Error('Synthetic quota failure')),
  },
  {
    status: 502,
    code: 'provider_error',
    vision: () => Promise.reject(new Error('Synthetic provider failure')),
  },
];

for (const [index, { status, code, input, ...overrides }] of cases.entries()) {
  Deno.test(`${status} ${code} (${index})`, async () => {
    let downloads = 0;
    const handler = createHandler({
      ...defaults,
      ...overrides,
      download: () => {
        downloads++;
        return (overrides.download ?? defaults.download)();
      },
    });
    const response = await handler(input ?? request());
    equal(response.status, status);
    const result = await response.json();
    equal(result.error.code, code);
    equal(Object.keys(result).join(), 'error');
    if (status < 404 || status === 429) equal(downloads, 0);
  });
}
