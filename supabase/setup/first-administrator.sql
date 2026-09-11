-- Run in your Supabase SQL Editor after both migrations and after creating
-- your own account in Authentication > Users or through the app's signup form.
-- Change the email below to that account's email. This script sets no password.
-- Only an administrator with database access can run this setup script.

begin;
do $$
declare
  owner_email text := 'CHANGE_ME@example.com';
  owner_name text := 'HEXA’S Administrator';
  campus_name text := 'HEXA’S MajorTila';
  campus_code text := 'MT';
  owner_id uuid;
  campus_id uuid;
  admin_role_id uuid;
begin
  if owner_email = 'CHANGE_ME@example.com' or trim(owner_email) = '' then
    raise exception 'Replace CHANGE_ME@example.com with your actual Auth account email first.';
  end if;

  select id into owner_id from auth.users
  where lower(email) = lower(trim(owner_email));
  if owner_id is null then
    raise exception 'No Auth account found. Create your account first, then run this script.';
  end if;

  select id into admin_role_id from public.roles where name = 'super_admin';
  if admin_role_id is null then
    raise exception 'The student desk migrations must be applied before administrator setup.';
  end if;

  if exists (
    select 1 from public.profiles
    where role_id = admin_role_id and is_active and id <> owner_id
  ) then
    raise exception 'An active administrator already exists. Use Settings & access in the app to manage additional staff.';
  end if;

  insert into public.branches(name, code)
  values(campus_name, campus_code)
  on conflict(code) do nothing;
  select id into campus_id from public.branches where code = campus_code;

  insert into public.profiles(id, full_name, branch_id, role_id, is_active)
  values(owner_id, owner_name, campus_id, admin_role_id, true)
  on conflict(id) do update set
    full_name = excluded.full_name,
    branch_id = excluded.branch_id,
    role_id = excluded.role_id,
    is_active = true,
    updated_at = now();

  insert into public.user_branch_access(user_id, branch_id)
  values(owner_id, campus_id)
  on conflict(user_id, branch_id) do nothing;
end
$$;
commit;

select p.full_name, r.name as role, b.name as campus, p.is_active
from public.profiles p
join public.roles r on r.id = p.role_id
left join public.branches b on b.id = p.branch_id
where r.name = 'super_admin' and p.is_active;
