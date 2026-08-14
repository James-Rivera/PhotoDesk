create table if not exists public.auth_rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0)
);

alter table public.auth_rate_limits enable row level security;

revoke all on table public.auth_rate_limits from anon, authenticated;

create or replace function public.consume_auth_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.auth_rate_limits%rowtype;
  remaining_seconds integer;
begin
  if length(p_key) <> 64 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit input';
  end if;

  insert into public.auth_rate_limits as limits (key, window_started_at, attempt_count)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_started_at = case
          when limits.window_started_at + make_interval(secs => p_window_seconds) <= now() then now()
          else limits.window_started_at
        end,
        attempt_count = case
          when limits.window_started_at + make_interval(secs => p_window_seconds) <= now() then 1
          else limits.attempt_count + 1
        end
  returning * into current_row;

  remaining_seconds := greatest(0, ceil(extract(epoch from (
    current_row.window_started_at + make_interval(secs => p_window_seconds) - now()
  )))::integer);

  return jsonb_build_object(
    'allowed', current_row.attempt_count <= p_limit,
    'retry_after_seconds', case when current_row.attempt_count <= p_limit then 0 else remaining_seconds end
  );
end;
$$;

create or replace function public.clear_auth_rate_limit(p_key text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.auth_rate_limits where key = p_key;
$$;

revoke all on function public.consume_auth_rate_limit(text, integer, integer) from public;
revoke all on function public.clear_auth_rate_limit(text) from public;
grant execute on function public.consume_auth_rate_limit(text, integer, integer) to anon, authenticated;
grant execute on function public.clear_auth_rate_limit(text) to anon, authenticated;

comment on table public.auth_rate_limits is 'Hashed, short-lived counters for login and password-help throttling. No email addresses or IP addresses are stored.';
