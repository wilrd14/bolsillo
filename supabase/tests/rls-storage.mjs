// Pruebas de RLS del bucket `receipts` con dos usuarios — T-028.
// Comando de ejecución (repo raíz):
//   node supabase/tests/rls-storage.mjs
// Requiere Supabase local en marcha (API en http://127.0.0.1:54321).
// Las claves locales se obtienen con `supabase status -o env` (no se leen .env ni bolsillo_keys.txt).

import { Buffer } from 'node:buffer';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';

function out(line) {
  process.stdout.write(`${line}\n`);
}

function readEnvFromSupabase() {
  const values = {};
  for (const line of execSync('supabase status -o env', {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  }).split('\n')) {
    const match = /^([A-Z_0-9]+)="?([^"\n]+)"?$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function signJwt(secret, sub) {
  const b64url = (value) => Buffer.from(value).toString('base64url');
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims = {
    sub,
    role: 'authenticated',
    iss: 'supabase',
    aud: 'api',
    exp: Math.floor(Date.now() / 1000) + 600,
  };
  const payload = b64url(JSON.stringify(claims));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function timedFetch(url, init) {
  return fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
}

const failures = [];
function check(name, ok, detail = '') {
  if (ok) out(`ok: ${name}`);
  else {
    failures.push(name);
    out(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const envVars = readEnvFromSupabase();
if (!envVars.API_URL || !envVars.JWT_SECRET) {
  process.stderr.write('No se pudo obtener API_URL/JWT_SECRET con `supabase status -o env`\n');
  process.exit(2);
}
execSync(
  `docker exec supabase_db_bolsillo psql -U postgres -d postgres -t -A ` +
    `-c "insert into auth.users (id) values ('${USER_A}'), ('${USER_B}') on conflict do nothing;"`,
  { stdio: 'inherit' },
);

const jwtA = signJwt(envVars.JWT_SECRET, USER_A);
const jwtB = signJwt(envVars.JWT_SECRET, USER_B);
const headers = (jwt) => ({ Authorization: `Bearer ${jwt}` });
const isOk = (status) => status >= 200 && status < 300;
const isBlocked = (status) => status >= 400;

const stamp = Date.now();
const pathA = `${USER_A}/rls-storage-${stamp}.jpg`;
const pathB = `${USER_B}/rls-storage-${stamp}.jpg`;
const body = 'imagen sintetica de prueba';

const uploadA = await timedFetch(`${envVars.API_URL}/storage/v1/object/receipts/${pathA}`, {
  method: 'POST',
  headers: { ...headers(jwtA), 'content-type': 'image/jpeg' },
  body,
});
check('A sube su objeto a receipts', isOk(uploadA.status), `status=${uploadA.status}`);

const downloadA = await timedFetch(`${envVars.API_URL}/storage/v1/object/receipts/${pathA}`, {
  headers: headers(jwtA),
});
const textA = await downloadA.text().catch(() => '');
check('A descarga su propio objeto', downloadA.status === 200, `status=${downloadA.status}`);
check('A recupera el contenido del objeto', textA === body, `text=${textA}`);

const downloadB = await timedFetch(`${envVars.API_URL}/storage/v1/object/receipts/${pathA}`, {
  headers: headers(jwtB),
});
check('B no puede leer el objeto de A', isBlocked(downloadB.status), `status=${downloadB.status}`);

const uploadB = await timedFetch(`${envVars.API_URL}/storage/v1/object/receipts/${pathA}`, {
  method: 'POST',
  headers: { ...headers(jwtB), 'content-type': 'image/jpeg' },
  body: 'sombra de A',
});
check(
  'B no puede sobrescribir el objeto de A',
  isBlocked(uploadB.status),
  `status=${uploadB.status}`,
);

const deleteB = await timedFetch(`${envVars.API_URL}/storage/v1/object/receipts/${pathA}`, {
  method: 'DELETE',
  headers: headers(jwtB),
});
check('B no puede borrar el objeto de A', isBlocked(deleteB.status), `status=${deleteB.status}`);

const downloadA2 = await timedFetch(`${envVars.API_URL}/storage/v1/object/receipts/${pathA}`, {
  headers: headers(jwtA),
});
const textA2 = await downloadA2.text().catch(() => '');
check(
  'A sigue viendo su objeto tras los intentos de B',
  downloadA2.status === 200,
  `status=${downloadA2.status}`,
);
check('el objeto de A conserva el contenido original', textA2 === body, `text=${textA2}`);

const uploadOwnB = await timedFetch(`${envVars.API_URL}/storage/v1/object/receipts/${pathB}`, {
  method: 'POST',
  headers: { ...headers(jwtB), 'content-type': 'image/jpeg' },
  body,
});
check('B sube su propio objeto a receipts', isOk(uploadOwnB.status), `status=${uploadOwnB.status}`);
const downloadOwnB = await timedFetch(`${envVars.API_URL}/storage/v1/object/receipts/${pathB}`, {
  headers: headers(jwtB),
});
check('B descarga su propio objeto', downloadOwnB.status === 200, `status=${downloadOwnB.status}`);

const cleanupA = await timedFetch(`${envVars.API_URL}/storage/v1/object/receipts/${pathA}`, {
  method: 'DELETE',
  headers: headers(jwtA),
});
check('A borra su objeto (limpieza)', isOk(cleanupA.status), `status=${cleanupA.status}`);
const cleanupB = await timedFetch(`${envVars.API_URL}/storage/v1/object/receipts/${pathB}`, {
  method: 'DELETE',
  headers: headers(jwtB),
});
check('B borra su objeto (limpieza)', isOk(cleanupB.status), `status=${cleanupB.status}`);

if (failures.length > 0) {
  out(`RLS bucket receipts: ${failures.length} fallos`);
  process.exit(1);
}
out('RLS bucket receipts (dos usuarios): Sin hallazgos');
