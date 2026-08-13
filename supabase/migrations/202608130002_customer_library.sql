create extension if not exists pg_trgm with schema extensions;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 1 and 160),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id)
);

create type public.photo_variant as enum ('original', 'processed');

create table public.photos (
  id uuid primary key,
  customer_id uuid not null references public.customers (id) on delete cascade,
  storage_path text not null unique,
  variant public.photo_variant not null default 'original',
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id),
  check (storage_path ~ ('^customers/' || customer_id::text || '/' || id::text || '/[^/]+$'))
);

create index customers_full_name_trgm_idx on public.customers using gin (full_name extensions.gin_trgm_ops);
create index customers_updated_at_idx on public.customers (updated_at desc);
create index photos_customer_created_idx on public.photos (customer_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at before update on public.customers
for each row execute procedure public.set_updated_at();

alter table public.customers enable row level security;
alter table public.photos enable row level security;

revoke all on public.customers, public.photos from anon, authenticated;
grant select, insert, update, delete on public.customers, public.photos to authenticated;

create policy "Active staff can read customers" on public.customers for select to authenticated using ((select public.is_active_staff()));
create policy "Active staff can create customers" on public.customers for insert to authenticated with check ((select public.is_active_staff()) and created_by = (select auth.uid()));
create policy "Active staff can update customers" on public.customers for update to authenticated using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy "Active staff can delete customers" on public.customers for delete to authenticated using ((select public.is_active_staff()));

create policy "Active staff can read photos" on public.photos for select to authenticated using ((select public.is_active_staff()));
create policy "Active staff can create photos" on public.photos for insert to authenticated with check ((select public.is_active_staff()) and created_by = (select auth.uid()));
create policy "Active staff can update photos" on public.photos for update to authenticated using ((select public.is_active_staff())) with check ((select public.is_active_staff()));
create policy "Active staff can delete photos" on public.photos for delete to authenticated using ((select public.is_active_staff()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('customer-photos', 'customer-photos', false, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Active staff can view customer photos" on storage.objects for select to authenticated
using (bucket_id = 'customer-photos' and (select public.is_active_staff()));

create policy "Active staff can upload customer photos" on storage.objects for insert to authenticated
with check (
  bucket_id = 'customer-photos'
  and (select public.is_active_staff())
  and (storage.foldername(name))[1] = 'customers'
  and array_length(storage.foldername(name), 1) = 3
  and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
  and (storage.foldername(name))[3] ~ '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.customers
    where id::text = (storage.foldername(name))[2]
  )
);

create policy "Active staff can delete customer photos" on storage.objects for delete to authenticated
using (bucket_id = 'customer-photos' and (select public.is_active_staff()));
