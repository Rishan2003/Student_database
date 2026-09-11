import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = await readFile('app/api/config/route.ts', 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { GET, dynamic, runtime } = await import('data:text/javascript;base64,' + Buffer.from(outputText).toString('base64'));
assert.equal(dynamic, 'force-dynamic');
assert.equal(runtime, 'nodejs');
const original = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
try {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  assert.deepEqual(await (await GET()).json(), { configured: false });
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'sb_publishable_test_fixture';
  const response = await GET();
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal((await response.json()).configured, true);
  process.env.SUPABASE_ANON_KEY = 'sb_secret_test_fixture';
  assert.deepEqual(await (await GET()).json(), { configured: false });
  const jwt = role => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.fixture';
  process.env.SUPABASE_ANON_KEY = jwt('service_role');
  assert.deepEqual(await (await GET()).json(), { configured: false });
  process.env.SUPABASE_ANON_KEY = jwt('anon');
  assert.equal((await (await GET()).json()).configured, true);
  console.log('PASS: Vercel runtime configuration loads public keys, rejects secret/service-role keys and prevents caching.');
} finally {
  for (const [name, value] of [['SUPABASE_URL', original.url], ['SUPABASE_ANON_KEY', original.key]]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}
