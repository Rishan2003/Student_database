import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
try {
  await db.exec(`
    create schema auth;
    create role anon nologin;
    create role authenticated nologin;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
  `);
  for (const file of ['202609110001_student_desk.sql', '202609110002_student_desk_rpc.sql', '20260911180723_require_batch_for_new_students.sql']) {
    const sql = (await readFile('supabase/migrations/' + file, 'utf8'))
      .replace('create extension if not exists pgcrypto;', '');
    await db.exec(sql);
  }
  const source = await readFile('supabase/setup/first-administrator.sql', 'utf8');
  const configured = email => source.replace("owner_email text := 'CHANGE_ME@example.com'", `owner_email text := '${email}'`);
  async function rejects(sql, reason) {
    await assert.rejects(db.exec(sql), reason);
    await db.exec('rollback');
  }
  await rejects(source, /Replace CHANGE_ME/);
  await rejects(configured('owner@example.test'), /No Auth account/);
  assert.equal((await db.query('select count(*)::int n from public.branches')).rows[0].n, 0);

  await db.exec(`insert into auth.users(id,email) values
    ('00000000-0000-4000-8000-000000000001','owner@example.test'),
    ('00000000-0000-4000-8000-000000000002','other@example.test');`);
  await db.exec(configured('owner@example.test'));
  const activated = (await db.query(`select p.is_active, r.name role, b.code
    from public.profiles p join public.roles r on r.id=p.role_id
    join public.branches b on b.id=p.branch_id
    where p.id='00000000-0000-4000-8000-000000000001'`)).rows[0];
  assert.deepEqual(activated, { is_active: true, role: 'super_admin', code: 'MT' });
  await db.exec(configured('owner@example.test'));
  assert.equal((await db.query('select count(*)::int n from public.branches')).rows[0].n, 1);
  assert.equal((await db.query('select count(*)::int n from public.user_branch_access')).rows[0].n, 1);
  await rejects(configured('other@example.test'), /active administrator already exists/);
  assert.equal((await db.query("select is_active from public.profiles where id='00000000-0000-4000-8000-000000000002'")).rows[0].is_active, false);
  console.log('PASS: Administrator setup rejects placeholders and unknown accounts, activates the correct owner, can safely repeat for that owner, and blocks a different owner.');
} finally {
  await db.close();
}
