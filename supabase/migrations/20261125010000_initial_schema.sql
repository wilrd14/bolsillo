begin;

-- Los UUID de las categorías iniciales se reutilizan entre cuentas.
create table public.category (
    user_id uuid not null references auth.users(id) on delete cascade,
    id uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    primary key (user_id, id),
    name text not null,
    kind text not null check (kind in ('expense', 'income')),
    icon text,
    color text,
    is_default smallint not null default 0 check (is_default in (0, 1)),
    archived smallint not null default 0 check (archived in (0, 1))
);

create table public.recurring_rule (
    user_id uuid not null references auth.users(id) on delete cascade,
    id uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    primary key (user_id, id),
    kind text not null check (kind in ('expense', 'income')),
    amount_minor bigint not null check (amount_minor > 0),
    category_id uuid not null,
    frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
    next_due date not null,
    remind_days_before integer not null default 0 check (remind_days_before >= 0),
    active smallint not null default 1 check (active in (0, 1)),
    foreign key (user_id, category_id) references public.category (user_id, id)
);

create table public.receipt (
    user_id uuid not null references auth.users(id) on delete cascade,
    id uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    primary key (user_id, id),
    local_uri text,
    storage_path text,
    status text not null check (status in ('pending', 'processing', 'done', 'failed')),
    extracted_json text,
    error_code text
);

create table public."transaction" (
    user_id uuid not null references auth.users(id) on delete cascade,
    id uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    primary key (user_id, id),
    kind text not null check (kind in ('expense', 'income')),
    amount_minor bigint not null check (amount_minor > 0),
    currency text not null,
    category_id uuid not null,
    merchant text,
    note text,
    occurred_at date not null,
    receipt_id uuid,
    recurring_id uuid,
    occurrence_index integer,
    foreign key (user_id, category_id) references public.category (user_id, id),
    foreign key (user_id, receipt_id) references public.receipt (user_id, id),
    foreign key (user_id, recurring_id) references public.recurring_rule (user_id, id),
    unique (user_id, receipt_id),
    unique (user_id, recurring_id, occurrence_index),
    check ((recurring_id is null) = (occurrence_index is null)),
    check (occurrence_index >= 0)
);

create table public.budget (
    user_id uuid not null references auth.users(id) on delete cascade,
    id uuid not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    primary key (user_id, id),
    category_id uuid not null,
    month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    limit_minor bigint not null check (limit_minor > 0),
    alerted_80 smallint not null default 0 check (alerted_80 in (0, 1)),
    alerted_100 smallint not null default 0 check (alerted_100 in (0, 1)),
    foreign key (user_id, category_id) references public.category (user_id, id),
    unique (user_id, category_id, month)
);

create table public.scan_usage (
    user_id uuid not null references auth.users(id) on delete cascade,
    day date not null,
    count integer not null check (count > 0),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    primary key (user_id, day)
);

alter table public.category enable row level security;
revoke all on public.category from public, anon, authenticated;
grant select, insert, update, delete on public.category to authenticated;
create policy own_select on public.category for select to authenticated
    using (user_id = (select auth.uid()));
create policy own_insert on public.category for insert to authenticated
    with check (user_id = (select auth.uid()));
create policy own_update on public.category for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
create policy own_delete on public.category for delete to authenticated
    using (user_id = (select auth.uid()));

alter table public.recurring_rule enable row level security;
revoke all on public.recurring_rule from public, anon, authenticated;
grant select, insert, update, delete on public.recurring_rule to authenticated;
create policy own_select on public.recurring_rule for select to authenticated
    using (user_id = (select auth.uid()));
create policy own_insert on public.recurring_rule for insert to authenticated
    with check (user_id = (select auth.uid()));
create policy own_update on public.recurring_rule for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
create policy own_delete on public.recurring_rule for delete to authenticated
    using (user_id = (select auth.uid()));

alter table public.receipt enable row level security;
revoke all on public.receipt from public, anon, authenticated;
grant select, insert, update, delete on public.receipt to authenticated;
create policy own_select on public.receipt for select to authenticated
    using (user_id = (select auth.uid()));
create policy own_insert on public.receipt for insert to authenticated
    with check (user_id = (select auth.uid()));
create policy own_update on public.receipt for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
create policy own_delete on public.receipt for delete to authenticated
    using (user_id = (select auth.uid()));

alter table public."transaction" enable row level security;
revoke all on public."transaction" from public, anon, authenticated;
grant select, insert, update, delete on public."transaction" to authenticated;
create policy own_select on public."transaction" for select to authenticated
    using (user_id = (select auth.uid()));
create policy own_insert on public."transaction" for insert to authenticated
    with check (user_id = (select auth.uid()));
create policy own_update on public."transaction" for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
create policy own_delete on public."transaction" for delete to authenticated
    using (user_id = (select auth.uid()));

alter table public.budget enable row level security;
revoke all on public.budget from public, anon, authenticated;
grant select, insert, update, delete on public.budget to authenticated;
create policy own_select on public.budget for select to authenticated
    using (user_id = (select auth.uid()));
create policy own_insert on public.budget for insert to authenticated
    with check (user_id = (select auth.uid()));
create policy own_update on public.budget for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
create policy own_delete on public.budget for delete to authenticated
    using (user_id = (select auth.uid()));

alter table public.scan_usage enable row level security;
revoke all on public.scan_usage from public, anon, authenticated;
grant select, insert, update on public.scan_usage to service_role;
create policy own_select on public.scan_usage for select to service_role
    using (user_id = (select auth.uid()));
create policy own_insert on public.scan_usage for insert to service_role
    with check (user_id = (select auth.uid()));
create policy own_update on public.scan_usage for update to service_role
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));
create policy own_delete on public.scan_usage for delete to service_role
    using (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false);

create policy receipts_own_folder on storage.objects for all to authenticated
    using (
        bucket_id = 'receipts'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    )
    with check (
        bucket_id = 'receipts'
        and (storage.foldername(name))[1] = (select auth.uid())::text
    );

-- La Edge Function pasa el UUID del JWT verificado mediante su cliente de servidor.
create function public.increment_scan_usage(day date, "limit" integer, p_user_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
    with consumed as (
        insert into public.scan_usage as current_usage (user_id, day, count)
        select $3, $1, 1
        where $2 > 0
        on conflict on constraint scan_usage_pkey do update
        set count = current_usage.count + 1, updated_at = now()
        where current_usage.count < $2
        returning 1
    )
    select exists (select 1 from consumed);
$$;

revoke execute on function public.increment_scan_usage(date, integer, uuid)
    from public, anon, authenticated;
grant execute on function public.increment_scan_usage(date, integer, uuid) to service_role;

-- Comprueba el límite durante el reset y revierte los datos sintéticos.
do $$
declare
    test_user uuid := gen_random_uuid();
    test_day date := date '2000-01-01';
    zero_limit boolean;
    first_scan boolean;
    second_scan boolean;
    third_scan boolean;
begin
    insert into auth.users (id) values (test_user);
    zero_limit := public.increment_scan_usage(test_day, 0, test_user);
    first_scan := public.increment_scan_usage(test_day, 2, test_user);
    second_scan := public.increment_scan_usage(test_day, 2, test_user);
    third_scan := public.increment_scan_usage(test_day, 2, test_user);
    if zero_limit or not first_scan or not second_scan or third_scan
       or (select count from public.scan_usage where user_id = test_user and day = test_day)
          is distinct from 2 then
        raise exception 'scan quota self-check failed';
    end if;
    raise sqlstate 'BQ001';
exception when sqlstate 'BQ001' then
    null;
end;
$$;

commit;
