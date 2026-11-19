-- Phase 2: pets shared by a family. Every table is readable by the pet's members only.
-- Roles: owner (everything), caregiver (logs care), sitter (logs care until expires_at), viewer (read only).

-- Pets and members ---------------------------------------------------------

create table public.pets (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 40),
  species text not null check (species in ('dog', 'cat', 'other')),
  breed text not null default '',
  birth text not null default '',            -- "mm/aaaa" or ''
  weight_kg text not null default '',
  sex text not null check (sex in ('male', 'female')),
  meals int not null default 2 check (meals between 1 and 4),
  walk_minutes int not null default 30 check (walk_minutes > 0),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pet_members (
  pet_id uuid not null references public.pets (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'caregiver', 'sitter', 'viewer')),
  expires_at timestamptz,                    -- sitters only
  joined_at timestamptz not null default now(),
  primary key (pet_id, user_id)
);
create index pet_members_user on public.pet_members (user_id);

-- Role checks run as definer so policies on pet_members don't recurse into themselves.
create function public.pet_role(p_pet uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.pet_members
  where pet_id = p_pet and user_id = auth.uid()
    and (role <> 'sitter' or expires_at is null or expires_at > now());
$$;

create function public.is_pet_member(p_pet uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pet_members where pet_id = p_pet and user_id = auth.uid());
$$;

create function public.can_log(p_pet uuid) returns boolean
language sql stable as $$ select coalesce(public.pet_role(p_pet) in ('owner', 'caregiver', 'sitter'), false); $$;

create function public.can_manage(p_pet uuid) returns boolean
language sql stable as $$ select coalesce(public.pet_role(p_pet) in ('owner', 'caregiver'), false); $$;

create function public.is_pet_owner(p_pet uuid) returns boolean
language sql stable as $$ select coalesce(public.pet_role(p_pet) = 'owner', false); $$;

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger pets_touch before update on public.pets for each row execute function public.touch_updated_at();

-- Whoever creates a pet becomes its owner.
create function public.add_pet_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.pet_members (pet_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end;
$$;
create trigger pets_add_owner after insert on public.pets for each row execute function public.add_pet_owner();

alter table public.pets enable row level security;
-- created_by too: insert ... returning checks this before the after-insert trigger adds the owner row.
create policy "pets: members read" on public.pets for select to authenticated
  using (public.is_pet_member(id) or created_by = auth.uid());
create policy "pets: create own" on public.pets for insert to authenticated with check (created_by = auth.uid());
create policy "pets: managers edit" on public.pets for update to authenticated
  using (public.can_manage(id)) with check (public.can_manage(id));
create policy "pets: owner deletes" on public.pets for delete to authenticated using (public.is_pet_owner(id));

alter table public.pet_members enable row level security;
create policy "members: members read" on public.pet_members for select to authenticated using (public.is_pet_member(pet_id));
create policy "members: owner edits" on public.pet_members for update to authenticated
  using (public.is_pet_owner(pet_id)) with check (public.is_pet_owner(pet_id));
-- The owner removes anyone else; anyone can leave (owners leave by deleting the pet).
create policy "members: owner removes or leave" on public.pet_members for delete to authenticated
  using ((public.is_pet_owner(pet_id) and user_id <> auth.uid()) or (user_id = auth.uid() and role <> 'owner'));
-- No insert policy: members join through redeem_invite() or the owner trigger.

-- Family members see each other's names.
create policy "profiles: read pet family" on public.profiles for select to authenticated using (
  exists (
    select 1 from public.pet_members mine
    join public.pet_members theirs on theirs.pet_id = mine.pet_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);

-- Activity log (append-only; undo = soft delete) ----------------------------

create table public.activities (
  id uuid primary key,                       -- generated on the phone, so retries are idempotent
  pet_id uuid not null references public.pets (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('food', 'water', 'walk', 'play', 'health')),
  health_item_id text,
  day date not null,                         -- the logger's local day
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  check ((kind = 'health') = (health_item_id is not null))
);
create index activities_sync on public.activities (pet_id, updated_at);
create index activities_day on public.activities (pet_id, day);

-- Only deleted_at may change after insert.
create function public.activities_guard() returns trigger language plpgsql as $$
begin
  if new.id <> old.id or new.pet_id <> old.pet_id or new.user_id <> old.user_id or new.kind <> old.kind
     or new.health_item_id is distinct from old.health_item_id or new.day <> old.day or new.created_at <> old.created_at then
    raise exception 'activities are append-only; only deleted_at can change';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger activities_guard before update on public.activities for each row execute function public.activities_guard();

alter table public.activities enable row level security;
create policy "activities: members read" on public.activities for select to authenticated using (public.is_pet_member(pet_id));
create policy "activities: loggers add own" on public.activities for insert to authenticated
  with check (user_id = auth.uid() and public.can_log(pet_id));
-- Any logger can undo (a partner may tap off what someone else logged).
create policy "activities: loggers undo" on public.activities for update to authenticated
  using (public.can_log(pet_id)) with check (public.can_log(pet_id));

-- Health items ------------------------------------------------------------

create table public.health_items (
  pet_id uuid not null references public.pets (id) on delete cascade,
  item_id text not null,
  name text not null,
  interval_days int not null check (interval_days > 0),
  last_date date,
  guess text check (guess in ('month', 'late')),
  updated_at timestamptz not null default now(),
  primary key (pet_id, item_id)
);
create trigger health_items_touch before update on public.health_items for each row execute function public.touch_updated_at();

alter table public.health_items enable row level security;
create policy "health: members read" on public.health_items for select to authenticated using (public.is_pet_member(pet_id));
create policy "health: managers add" on public.health_items for insert to authenticated with check (public.can_manage(pet_id));
create policy "health: managers edit" on public.health_items for update to authenticated
  using (public.can_manage(pet_id)) with check (public.can_manage(pet_id));
create policy "health: managers remove" on public.health_items for delete to authenticated using (public.can_manage(pet_id));

-- A health activity is the dose: it moves last_date forward and clears a guess.
create function public.apply_health_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'health' and new.deleted_at is null then
    update public.health_items
      set last_date = greatest(coalesce(last_date, new.day), new.day), guess = null
      where pet_id = new.pet_id and item_id = new.health_item_id;
  end if;
  return new;
end;
$$;
create trigger activities_health after insert on public.activities for each row execute function public.apply_health_activity();

-- Badges (per pet, shared by the family) -------------------------------------

create table public.badges (
  pet_id uuid not null references public.pets (id) on delete cascade,
  badge_id text not null,
  unlocked_at timestamptz not null default now(),
  unlocked_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (pet_id, badge_id)
);
alter table public.badges enable row level security;
create policy "badges: members read" on public.badges for select to authenticated using (public.is_pet_member(pet_id));
create policy "badges: loggers unlock" on public.badges for insert to authenticated with check (public.can_log(pet_id));

-- Weekly schedule ("quem faz o quê") ------------------------------------------

create table public.schedule (
  pet_id uuid not null references public.pets (id) on delete cascade,
  weekday int not null check (weekday between 0 and 6),   -- 0 = Sunday, like Date.getDay()
  task text not null check (task in ('food', 'water', 'walk', 'play')),
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (pet_id, weekday, task)
);
alter table public.schedule enable row level security;
create policy "schedule: members read" on public.schedule for select to authenticated using (public.is_pet_member(pet_id));
create policy "schedule: owner writes" on public.schedule for all to authenticated
  using (public.is_pet_owner(pet_id)) with check (public.is_pet_owner(pet_id));

-- Invites ------------------------------------------------------------------

create table public.invites (
  code text primary key,
  pet_id uuid not null references public.pets (id) on delete cascade,
  role text not null check (role in ('caregiver', 'sitter', 'viewer')),
  sitter_until timestamptz,                  -- membership end for sitters
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '48 hours',
  used_by uuid references auth.users (id) on delete set null,
  used_at timestamptz,
  check ((role = 'sitter') = (sitter_until is not null))
);
alter table public.invites enable row level security;
-- Owners see and revoke their pet's invites; nobody else reads this table (redeem goes through a function).
create policy "invites: owner reads" on public.invites for select to authenticated using (public.is_pet_owner(pet_id));
create policy "invites: owner revokes" on public.invites for delete to authenticated using (public.is_pet_owner(pet_id));

-- 6 characters without look-alikes (0/O, 1/I/L).
create function public.create_invite(p_pet uuid, p_role text, p_sitter_until timestamptz default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  if not public.is_pet_owner(p_pet) then
    raise exception 'only the owner can invite' using errcode = '42501';
  end if;
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.invites (code, pet_id, role, sitter_until)
      values (new_code, p_pet, p_role, case when p_role = 'sitter' then p_sitter_until end);
      return new_code;
    exception when unique_violation then
      -- try another code
    end;
  end loop;
end;
$$;

-- Joins the pet behind a code. Returns the pet id. Errors: invalid / expired / used.
create function public.redeem_invite(p_code text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  inv public.invites;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  select * into inv from public.invites where code = upper(trim(p_code)) for update;
  if not found then raise exception 'invite_invalid'; end if;
  if inv.used_at is not null then raise exception 'invite_used'; end if;
  if inv.expires_at < now() then raise exception 'invite_expired'; end if;

  -- Already a member: keep the current role (an owner must not downgrade themselves).
  insert into public.pet_members (pet_id, user_id, role, expires_at)
  values (inv.pet_id, auth.uid(), inv.role, inv.sitter_until)
  on conflict (pet_id, user_id) do nothing;

  update public.invites set used_by = auth.uid(), used_at = now() where code = inv.code;
  return inv.pet_id;
end;
$$;

revoke execute on function public.create_invite(uuid, text, timestamptz) from public, anon;
revoke execute on function public.redeem_invite(text) from public, anon;
grant execute on function public.create_invite(uuid, text, timestamptz) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;

-- Push tokens --------------------------------------------------------------

create table public.push_tokens (
  token text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create trigger push_tokens_touch before update on public.push_tokens for each row execute function public.touch_updated_at();
alter table public.push_tokens enable row level security;
create policy "push: own tokens" on public.push_tokens for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Live updates for the family --------------------------------------------------

alter publication supabase_realtime add table
  public.pets, public.pet_members, public.activities, public.health_items, public.badges, public.schedule;
