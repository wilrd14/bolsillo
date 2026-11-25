// Mide la latencia del escaneo con los fixtures sintéticos de e2e/fixtures/receipts/.
// El proveedor es el simulado a menos que se pase uno real por la variable de entorno
// ANTHROPIC_API_KEY. Ejecutar con: deno run --config supabase/functions/scan-receipt/deno.json
// supabase/functions/scan-receipt/latency.ts

import { createHandler } from './handler.ts';
import { anthropicVision } from './vision.ts';

const user = '10000000-0000-4000-8000-000000000001';
const receiptId = '20000000-0000-4000-8000-000000000001';
const fixtureNames = ['synthetic-001.json', 'synthetic-002.json', 'synthetic-004.json'];

function writeLine(line: string) {
  Deno.stdout.writeSync(new TextEncoder().encode(`${line}\n`));
}

function p95(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

interface Sample {
  fixture: string;
  status: number;
  latencyMs: number;
}

async function main() {
  const useRealProvider = Deno.env.has('ANTHROPIC_API_KEY');
  const samples: Sample[] = [];

  for (const name of fixtureNames) {
    const path = new URL(`../../../e2e/fixtures/receipts/${name}`, import.meta.url);
    const extraction = JSON.parse(Deno.readTextFileSync(path));
    const handler = createHandler({
      authenticate: () => Promise.resolve(user),
      consumeQuota: () => Promise.resolve(true),
      download: () => Promise.resolve(new Blob(['synthetic-image'])),
      vision: useRealProvider ? anthropicVision : () => Promise.resolve(extraction),
    });
    const request = new Request('http://localhost/scan-receipt', {
      method: 'POST',
      headers: { Authorization: 'Bearer synthetic' },
      body: JSON.stringify({ receipt_id: receiptId, storage_path: `${user}/${receiptId}.jpg` }),
    });
    const started = performance.now();
    const response = await handler(request);
    samples.push({
      fixture: name,
      status: response.status,
      latencyMs: performance.now() - started,
    });
  }

  writeLine('Latencia del escaneo (proveedor simulado, fixtures sintéticos):');
  for (const sample of samples) {
    writeLine(`  ${sample.fixture}: ${sample.status} ${sample.latencyMs.toFixed(2)} ms`);
  }
  const latencies = samples.map((sample) => sample.latencyMs);
  const average = latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
  writeLine(`Promedio: ${average.toFixed(2)} ms · p95: ${p95(latencies).toFixed(2)} ms`);
}

await main();
