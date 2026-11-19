-- Profiles for accounts that existed before the on_auth_user_created trigger (this project was
-- reused, so some auth users predate PetApp). Same name rules as handle_new_user().
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name',
    split_part(coalesce(u.email, ''), '@', 1),
    ''
  )
from auth.users u
on conflict (id) do nothing;
