-- CJNET's first administrator. Safe to run more than once.
update public.profiles as profile
set role = 'admin'::public.staff_role,
    active = true
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = lower('jamescarlorivera52@gmail.com');

do $$
begin
  if not exists (
    select 1
    from public.profiles as profile
    join auth.users as auth_user on auth_user.id = profile.id
    where lower(auth_user.email) = lower('jamescarlorivera52@gmail.com')
      and profile.role = 'admin'::public.staff_role
      and profile.active = true
  ) then
    raise exception 'Admin assignment failed: the Auth user or matching profile was not found.';
  end if;
end
$$;
