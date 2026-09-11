begin;

create function private.desk_require_initial_enrollment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.enrollments e
    where e.student_id = new.id
  ) then
    raise exception 'Choose a batch before creating a student.';
  end if;

  return new;
end
$$;

create constraint trigger desk_students_require_initial_enrollment
after insert on public.students
deferrable initially deferred
for each row
execute function private.desk_require_initial_enrollment();

revoke execute on function private.desk_require_initial_enrollment() from public, anon, authenticated;

commit;
