alter table public.payment_sources
drop constraint if exists payment_sources_system_key_check;

alter table public.payment_sources
add constraint payment_sources_system_key_check
check (
  system_key is null or system_key in (
    'card',
    'szep_card',
    'cash',
    'bank_transfer',
    'revolut',
    'health_fund'
  )
);

insert into public.payment_sources (
  user_id,
  name,
  system_key,
  icon,
  color,
  sort_order,
  is_active,
  use_for_income,
  use_for_expense
)
select profiles.id,
       'Egészségpénztár',
       'health_fund',
       '+',
       '#dc2626',
       60,
       true,
       true,
       true
from public.profiles
where not exists (
  select 1
  from public.payment_sources existing_source
  where existing_source.user_id = profiles.id
    and existing_source.system_key = 'health_fund'
)
and not exists (
  select 1
  from public.payment_sources existing_source
  where existing_source.user_id = profiles.id
    and lower(btrim(existing_source.name)) = lower(btrim('Egészségpénztár'))
);
