alter table public.profiles add column if not exists username text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_format') then
    alter table public.profiles add constraint profiles_username_format
      check (username is null or username ~ '^[a-z0-9._-]{3,32}$');
  end if;
end
$$;

create unique index if not exists profiles_username_unique
on public.profiles (lower(username)) where username is not null;
