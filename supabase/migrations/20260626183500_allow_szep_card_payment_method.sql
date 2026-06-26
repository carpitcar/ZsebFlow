alter table public.transactions
drop constraint if exists transactions_payment_method_check;

alter table public.transactions
add constraint transactions_payment_method_check
check (
  payment_method in (
    'unknown',
    'card',
    'szep_card',
    'cash',
    'bank_transfer',
    'revolut'
  )
);
