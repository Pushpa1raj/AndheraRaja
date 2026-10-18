-- Andhera Raja: initial authoritative schema
-- Virtual credits are non-redeemable, non-transferable integer units.
-- This migration is intended for a new Supabase project and must be applied before the API starts.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Enumerations
-- -----------------------------------------------------------------------------
create type public.user_role as enum ('user', 'admin');
create type public.user_status as enum ('active', 'suspended', 'restricted');
create type public.transaction_type as enum (
  'admin_allocation', 'game_wager', 'game_win', 'game_loss',
  'admin_correction', 'round_cancellation'
);
create type public.credit_request_status as enum (
  'pending', 'approved', 'partially_approved', 'rejected', 'cancelled'
);
create type public.game_type as enum ('aviator', 'mines');
create type public.game_status as enum ('active', 'disabled', 'maintenance');
create type public.aviator_round_status as enum (
  'waiting', 'running', 'crashed', 'cancelled', 'completed'
);
create type public.bet_status as enum ('placed', 'cashed_out', 'lost', 'cancelled');
create type public.mines_session_status as enum ('running', 'cashed_out', 'lost', 'cancelled');

-- -----------------------------------------------------------------------------
-- Identity and append-only business records
-- -----------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null check (char_length(trim(display_name)) between 2 and 60),
  avatar_url text,
  role public.user_role not null default 'user',
  status public.user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.credit_accounts (
  user_id uuid primary key references public.users(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);

create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  type public.transaction_type not null,
  -- Signed amount. The before/after values make every movement independently auditable.
  amount bigint not null check (amount <> 0),
  balance_before bigint not null check (balance_before >= 0),
  balance_after bigint not null check (balance_after >= 0),
  reference_type text not null,
  reference_id uuid not null,
  reason text,
  created_at timestamptz not null default now(),
  check (balance_after = balance_before + amount)
);

create table public.credit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  requested_amount bigint not null check (requested_amount > 0),
  approved_amount bigint check (approved_amount > 0),
  status public.credit_request_status not null default 'pending',
  message text check (message is null or char_length(message) <= 1_000),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1_000),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'pending' and approved_amount is null and reviewed_by is null and reviewed_at is null)
    or (status in ('approved', 'partially_approved') and approved_amount is not null and reviewed_by is not null and reviewed_at is not null)
    or (status in ('rejected', 'cancelled') and approved_amount is null)
  )
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  type public.game_type not null unique,
  name text not null,
  status public.game_status not null default 'active',
  description text not null,
  current_config_version integer not null default 1 check (current_config_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_configurations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  version integer not null check (version > 0),
  configuration jsonb not null,
  effective_at timestamptz not null default now(),
  created_by uuid not null references public.users(id),
  change_reason text not null check (char_length(trim(change_reason)) > 0),
  created_at timestamptz not null default now(),
  unique (game_id, version)
);

-- The encrypted_server_seed column is readable only by the backend database role.
-- Its plaintext is never returned through a browser route or Realtime.
create table public.aviator_rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  configuration_id uuid not null references public.game_configurations(id),
  status public.aviator_round_status not null default 'waiting',
  starts_at timestamptz not null,
  betting_closes_at timestamptz not null,
  crash_at timestamptz not null,
  server_seed_hash text not null check (server_seed_hash ~ '^[a-f0-9]{64}$'),
  encrypted_server_seed bytea not null,
  client_nonce text not null,
  fairness_algorithm text not null default 'hmac-sha256-v1',
  crash_multiplier_bps integer not null check (crash_multiplier_bps >= 100 and crash_multiplier_bps <= 1000000),
  revealed_server_seed text,
  cancellation_reason text,
  cancelled_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check (betting_closes_at <= starts_at and starts_at < crash_at),
  check (
    (status <> 'cancelled') or (cancellation_reason is not null and cancelled_by is not null)
  ),
  check (
    (status not in ('crashed', 'completed', 'cancelled')) or revealed_server_seed is not null
  )
);

create table public.aviator_bets (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.aviator_rounds(id),
  user_id uuid not null references public.users(id),
  wager_amount bigint not null check (wager_amount > 0),
  status public.bet_status not null default 'placed',
  cashout_multiplier_bps integer check (cashout_multiplier_bps >= 100),
  payout_amount bigint check (payout_amount >= 0),
  wager_transaction_id uuid not null unique references public.credit_transactions(id),
  payout_transaction_id uuid unique references public.credit_transactions(id),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (round_id, user_id),
  check (
    (status = 'cashed_out' and cashout_multiplier_bps is not null and payout_amount is not null and payout_transaction_id is not null and settled_at is not null)
    or (status in ('placed', 'lost', 'cancelled'))
  )
);

create table public.mines_sessions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id),
  user_id uuid not null references public.users(id),
  configuration_id uuid not null references public.game_configurations(id),
  status public.mines_session_status not null default 'running',
  wager_amount bigint not null check (wager_amount > 0),
  grid_size smallint not null check (grid_size between 2 and 10),
  mine_count smallint not null check (mine_count > 0 and mine_count < grid_size * grid_size),
  server_seed_hash text not null check (server_seed_hash ~ '^[a-f0-9]{64}$'),
  encrypted_server_seed bytea not null,
  client_nonce text not null,
  fairness_algorithm text not null default 'hmac-sha256-v1',
  revealed_cells integer[] not null default '{}',
  event_sequence integer not null default 0 check (event_sequence >= 0),
  current_multiplier_bps integer not null default 10000 check (current_multiplier_bps >= 10000),
  payout_amount bigint check (payout_amount >= 0),
  wager_transaction_id uuid not null unique references public.credit_transactions(id),
  payout_transaction_id uuid unique references public.credit_transactions(id),
  revealed_server_seed text,
  revealed_mine_positions integer[],
  cancellation_reason text,
  cancelled_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check (cardinality(revealed_cells) <= grid_size * grid_size - mine_count),
  check (
    (status = 'running') or (revealed_server_seed is not null and revealed_mine_positions is not null and settled_at is not null)
  )
);

create table public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_type public.game_type not null,
  aggregate_id uuid not null,
  sequence integer not null check (sequence > 0),
  event_type text not null,
  actor_id uuid references public.users(id),
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (game_type, aggregate_id, sequence),
  unique nulls not distinct (actor_id, idempotency_key)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  type text not null,
  title text not null,
  message text not null,
  reference_type text,
  reference_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  administrator_id uuid not null references public.users(id),
  action text not null,
  target_type text not null,
  target_id uuid not null,
  previous_state jsonb,
  new_state jsonb,
  reason text,
  request_id uuid,
  created_at timestamptz not null default now()
);

create table public.idempotency_keys (
  actor_id uuid not null references public.users(id),
  operation text not null,
  key text not null check (char_length(key) between 16 and 255),
  request_hash text not null,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (actor_id, operation, key)
);

-- -----------------------------------------------------------------------------
-- Supporting indexes
-- -----------------------------------------------------------------------------
create index credit_transactions_user_created_idx on public.credit_transactions (user_id, created_at desc);
create index credit_transactions_reference_idx on public.credit_transactions (reference_type, reference_id);
create index credit_requests_status_created_idx on public.credit_requests (status, created_at asc);
create index game_configurations_game_version_idx on public.game_configurations (game_id, version desc);
create index aviator_rounds_status_starts_idx on public.aviator_rounds (status, starts_at);
create index aviator_bets_user_created_idx on public.aviator_bets (user_id, created_at desc);
create index mines_sessions_user_created_idx on public.mines_sessions (user_id, created_at desc);
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index audit_logs_target_created_idx on public.audit_logs (target_type, target_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Security-definer helpers. They use a fixed search_path to avoid search-path injection.
-- -----------------------------------------------------------------------------
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1))
  );
  insert into public.credit_accounts (user_id) values (new.id);
  return new;
end;
$$;

create trigger auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_touch_updated_at before update on public.users for each row execute function public.touch_updated_at();
create trigger credit_accounts_touch_updated_at before update on public.credit_accounts for each row execute function public.touch_updated_at();
create trigger credit_requests_touch_updated_at before update on public.credit_requests for each row execute function public.touch_updated_at();
create trigger games_touch_updated_at before update on public.games for each row execute function public.touch_updated_at();

-- Prevent destructive/rewrite operations against historical records even from a
-- mistakenly implemented application path. Corrections are separate records.
create or replace function public.prevent_history_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Historical records are immutable';
end;
$$;

create trigger credit_transactions_immutable before update or delete on public.credit_transactions
  for each row execute function public.prevent_history_mutation();
create trigger game_events_immutable before update or delete on public.game_events
  for each row execute function public.prevent_history_mutation();
create trigger game_configurations_immutable before update or delete on public.game_configurations
  for each row execute function public.prevent_history_mutation();
create trigger audit_logs_immutable before update or delete on public.audit_logs
  for each row execute function public.prevent_history_mutation();

-- Atomic authoritative ledger mutation. The API invokes it in the same
-- transaction as the related request/bet/session transition.
create or replace function public.apply_credit_transaction(
  p_user_id uuid,
  p_type public.transaction_type,
  p_amount bigint,
  p_reference_type text,
  p_reference_id uuid,
  p_reason text default null
)
returns public.credit_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.credit_accounts;
  v_transaction public.credit_transactions;
begin
  if p_amount = 0 then
    raise exception 'Credit mutation amount cannot be zero';
  end if;

  select * into v_account
  from public.credit_accounts
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Credit account not found';
  end if;
  if v_account.balance + p_amount < 0 then
    raise exception 'Insufficient virtual credits';
  end if;

  update public.credit_accounts
  set balance = v_account.balance + p_amount,
      version = version + 1,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.credit_transactions (
    user_id, type, amount, balance_before, balance_after,
    reference_type, reference_id, reason
  ) values (
    p_user_id, p_type, p_amount, v_account.balance, v_account.balance + p_amount,
    p_reference_type, p_reference_id, p_reason
  ) returning * into v_transaction;

  return v_transaction;
end;
$$;

-- -----------------------------------------------------------------------------
-- Row-level security: browser clients receive a read-only, owner-only surface.
-- FastAPI uses a server-only database/service role for mutations.
-- -----------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.credit_requests enable row level security;
alter table public.games enable row level security;
alter table public.game_configurations enable row level security;
alter table public.aviator_rounds enable row level security;
alter table public.aviator_bets enable row level security;
alter table public.mines_sessions enable row level security;
alter table public.game_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.idempotency_keys enable row level security;

create policy users_read_own on public.users for select to authenticated using (id = auth.uid());
create policy users_read_for_admin on public.users for select to authenticated using (public.is_current_user_admin());
create policy credit_accounts_read_own on public.credit_accounts for select to authenticated using (user_id = auth.uid());
create policy credit_transactions_read_own on public.credit_transactions for select to authenticated using (user_id = auth.uid());
create policy credit_requests_read_own on public.credit_requests for select to authenticated using (user_id = auth.uid());
create policy games_read_authenticated on public.games for select to authenticated using (true);
create policy game_configurations_read_authenticated on public.game_configurations for select to authenticated using (true);
create policy aviator_rounds_read_authenticated on public.aviator_rounds for select to authenticated using (true);
create policy aviator_bets_read_own on public.aviator_bets for select to authenticated using (user_id = auth.uid());
create policy mines_sessions_read_own on public.mines_sessions for select to authenticated using (user_id = auth.uid());
create policy notifications_read_own on public.notifications for select to authenticated using (user_id = auth.uid());
create policy audit_logs_read_admin on public.audit_logs for select to authenticated using (public.is_current_user_admin());

-- No client insert/update/delete policies deliberately exist for authoritative data.
-- The backend controls every mutation through its trusted database connection.

-- Seed initial game records. The first admin creates configuration version 1 via
-- the API after the initial admin bootstrap step described in docs/DEPLOYMENT.md.
insert into public.games (type, name, description) values
  ('aviator', 'Aviator', 'Cash out virtual credits before the committed flight crashes.'),
  ('mines', 'Mines', 'Reveal safe cells and collect before finding a mine.');

grant usage on schema public to anon, authenticated, service_role;
grant select on public.users, public.credit_accounts, public.credit_transactions,
  public.credit_requests, public.games, public.game_configurations,
  public.aviator_rounds, public.aviator_bets, public.mines_sessions,
  public.notifications, public.audit_logs to authenticated;
grant all privileges on all tables in schema public to service_role;
grant execute on function public.apply_credit_transaction(uuid, public.transaction_type, bigint, text, uuid, text) to service_role;
