-- Row-level security check. Paste into the dashboard SQL editor and run.
-- It creates throwaway users, acts as each one, then raises an exception so everything rolls back.
-- Expected: v10=<today>/none | B pets before join=0 B reads invites=0 after=1 B sees activities=2
--   B sees profiles=2 B insert=denied reuse=invite_used B invite=denied | expired sitter insert=denied
--   | D undo A food rows=1 D edit kind=denied D self-promote rows=0 D removes B rows=0 | A removes B rows=1
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  pet uuid; viewer_code text; sitter_code text; caregiver_code text; r text := ''; n int;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data) values
    (a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls.test', '{"full_name":"Ana Souza"}'),
    (b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls.test', '{"name":"Bia"}'),
    (c, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'c@rls.test', '{}'),
    (d, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'd@rls.test', '{}');

  -- A: owner (insert ... returning must work before the owner row exists)
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.pets (name, species, sex) values ('Thor', 'dog', 'male') returning id into pet;
  insert into public.health_items (pet_id, item_id, name, interval_days, last_date, guess) values (pet, 'v10', 'V10', 365, '2026-01-15', 'month');
  insert into public.activities (id, pet_id, kind, day) values (gen_random_uuid(), pet, 'food', current_date);
  viewer_code := public.create_invite(pet, 'viewer');
  sitter_code := public.create_invite(pet, 'sitter', now() - interval '1 hour');
  caregiver_code := public.create_invite(pet, 'caregiver');
  insert into public.activities (id, pet_id, kind, health_item_id, day) values (gen_random_uuid(), pet, 'health', 'v10', current_date);
  select 'v10=' || last_date::text || '/' || coalesce(guess, 'none') into r from public.health_items where pet_id = pet and item_id = 'v10';
  reset role;

  -- B: viewer
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.pets; r := r || ' | B pets before join=' || n;
  select count(*) into n from public.invites; r := r || ' B reads invites=' || n;
  perform public.redeem_invite(lower(viewer_code));
  select count(*) into n from public.pets; r := r || ' after=' || n;
  select count(*) into n from public.activities; r := r || ' B sees activities=' || n;
  select count(*) into n from public.profiles; r := r || ' B sees profiles=' || n;
  begin insert into public.activities (id, pet_id, kind, day) values (gen_random_uuid(), pet, 'water', current_date); r := r || ' B insert=ALLOWED(bad)';
  exception when others then r := r || ' B insert=denied'; end;
  begin perform public.redeem_invite(viewer_code); r := r || ' reuse=ALLOWED(bad)';
  exception when others then r := r || ' reuse=' || sqlerrm; end;
  begin perform public.create_invite(pet, 'caregiver'); r := r || ' B invite=ALLOWED(bad)';
  exception when others then r := r || ' B invite=denied'; end;
  reset role;

  -- C: sitter whose time already ended
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.redeem_invite(sitter_code);
  begin insert into public.activities (id, pet_id, kind, day) values (gen_random_uuid(), pet, 'walk', current_date); r := r || ' | expired sitter insert=ALLOWED(bad)';
  exception when others then r := r || ' | expired sitter insert=denied'; end;
  reset role;

  -- D: caregiver logs, can undo A's food, cannot edit other columns or manage members
  perform set_config('request.jwt.claims', json_build_object('sub', d, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.redeem_invite(caregiver_code);
  insert into public.activities (id, pet_id, kind, day) values (gen_random_uuid(), pet, 'play', current_date);
  update public.activities set deleted_at = now() where pet_id = pet and kind = 'food';
  get diagnostics n = row_count; r := r || ' | D undo A food rows=' || n;
  begin update public.activities set kind = 'walk' where pet_id = pet and kind = 'play'; r := r || ' D edit kind=ALLOWED(bad)';
  exception when others then r := r || ' D edit kind=denied'; end;
  update public.pet_members set role = 'owner' where pet_id = pet and user_id = d;
  get diagnostics n = row_count; r := r || ' D self-promote rows=' || n;
  delete from public.pet_members where pet_id = pet and user_id = b;
  get diagnostics n = row_count; r := r || ' D removes B rows=' || n;
  reset role;

  -- A: owner removes B
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  delete from public.pet_members where pet_id = pet and user_id = b;
  get diagnostics n = row_count; r := r || ' | A removes B rows=' || n;
  reset role;

  raise exception 'RLS RESULT: %', r;
end $$;
