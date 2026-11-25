begin;

alter table public.recurring_rule add column anchor_day smallint check (anchor_day between 1 and 31);

create function public.merge_sync_budget(payload jsonb)
returns public."budget"
language plpgsql security invoker set search_path = ''
as $$
declare
    canonical public."budget";
    proposed public."budget" := jsonb_populate_record(null::public."budget", payload);
begin
    -- Serializa cambios de identidad y fusiones de la misma cuenta.
    if proposed.user_id is distinct from auth.uid() then
        raise insufficient_privilege;
    end if;
    perform pg_advisory_xact_lock(hashtextextended('budget/' || proposed.user_id::text, 0));
    select * into canonical from public."budget"
    where user_id = proposed.user_id and id = proposed.id
    for update;
    if found and (canonical.category_id, canonical.month)
        is distinct from (proposed.category_id, proposed.month) then
        if proposed.updated_at <= canonical.updated_at then
            return canonical;
        end if;
        if not exists (
            select 1 from public."budget"
            where user_id = proposed.user_id
              and category_id = proposed.category_id
              and month = proposed.month
        ) then
            update public."budget"
            set category_id = proposed.category_id,
                month = proposed.month,
                updated_at = proposed.updated_at,
                deleted_at = proposed.deleted_at,
                limit_minor = proposed.limit_minor,
                alerted_80 = proposed.alerted_80,
                alerted_100 = proposed.alerted_100
            where user_id = proposed.user_id and id = proposed.id
            returning * into canonical;
            return canonical;
        end if;

        update public."budget"
        set deleted_at = proposed.updated_at, updated_at = proposed.updated_at
        where user_id = proposed.user_id and id = proposed.id;
    end if;

    insert into public."budget" as current_row
        (user_id, id, created_at, updated_at, deleted_at, category_id, month, limit_minor, alerted_80, alerted_100)
    select incoming.user_id, incoming.id, incoming.created_at, incoming.updated_at, incoming.deleted_at, incoming.category_id, incoming.month, incoming.limit_minor, incoming.alerted_80, incoming.alerted_100
    from jsonb_populate_record(null::public."budget", payload) as incoming
    on conflict (user_id, category_id, month) do update
    set updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        limit_minor = excluded.limit_minor,
        alerted_80 = excluded.alerted_80,
        alerted_100 = excluded.alerted_100
    where excluded.updated_at > current_row.updated_at
       or (excluded.updated_at = current_row.updated_at
           and excluded.deleted_at is not null and current_row.deleted_at is null)
    returning * into canonical;

    if not found then
        select * into strict canonical from public."budget"
        where user_id = (payload ->> 'user_id')::uuid
          and category_id = (payload ->> 'category_id')::uuid
          and month = (payload ->> 'month')::text;
    end if;
    return canonical;
end;
$$;

revoke execute on function public.merge_sync_budget(jsonb) from public, anon;
grant execute on function public.merge_sync_budget(jsonb) to authenticated;

create function public.merge_sync_transaction(payload jsonb)
returns public."transaction"
language plpgsql security invoker set search_path = ''
as $$
declare
    canonical public."transaction";
    proposed public."transaction" := jsonb_populate_record(null::public."transaction", payload);
begin
    -- Serializa cambios de identidad y fusiones de la misma cuenta.
    if proposed.user_id is distinct from auth.uid() then
        raise insufficient_privilege;
    end if;
    perform pg_advisory_xact_lock(hashtextextended('transaction/' || proposed.user_id::text, 0));
    select * into canonical from public."transaction"
    where user_id = proposed.user_id and id = proposed.id
    for update;
    if found and (canonical.recurring_id, canonical.occurrence_index)
        is distinct from (proposed.recurring_id, proposed.occurrence_index) then
        if proposed.updated_at <= canonical.updated_at then
            return canonical;
        end if;
        if not exists (
            select 1 from public."transaction"
            where user_id = proposed.user_id
              and recurring_id = proposed.recurring_id
              and occurrence_index = proposed.occurrence_index
        ) then
            update public."transaction"
            set recurring_id = proposed.recurring_id,
                occurrence_index = proposed.occurrence_index,
                updated_at = proposed.updated_at,
                deleted_at = proposed.deleted_at,
                kind = proposed.kind,
                amount_minor = proposed.amount_minor,
                currency = proposed.currency,
                category_id = proposed.category_id,
                merchant = proposed.merchant,
                note = proposed.note,
                occurred_at = proposed.occurred_at,
                receipt_id = proposed.receipt_id
            where user_id = proposed.user_id and id = proposed.id
            returning * into canonical;
            return canonical;
        end if;

        update public."transaction"
        set deleted_at = proposed.updated_at, updated_at = proposed.updated_at, receipt_id = null
        where user_id = proposed.user_id and id = proposed.id;
    end if;

    insert into public."transaction" as current_row
        (user_id, id, created_at, updated_at, deleted_at, recurring_id, occurrence_index, kind, amount_minor, currency, category_id, merchant, note, occurred_at, receipt_id)
    select incoming.user_id, incoming.id, incoming.created_at, incoming.updated_at, incoming.deleted_at, incoming.recurring_id, incoming.occurrence_index, incoming.kind, incoming.amount_minor, incoming.currency, incoming.category_id, incoming.merchant, incoming.note, incoming.occurred_at, incoming.receipt_id
    from jsonb_populate_record(null::public."transaction", payload) as incoming
    on conflict (user_id, recurring_id, occurrence_index) do update
    set updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at,
        kind = excluded.kind,
        amount_minor = excluded.amount_minor,
        currency = excluded.currency,
        category_id = excluded.category_id,
        merchant = excluded.merchant,
        note = excluded.note,
        occurred_at = excluded.occurred_at,
        receipt_id = excluded.receipt_id
    where excluded.updated_at > current_row.updated_at
       or (excluded.updated_at = current_row.updated_at
           and excluded.deleted_at is not null and current_row.deleted_at is null)
    returning * into canonical;

    if not found then
        select * into strict canonical from public."transaction"
        where user_id = (payload ->> 'user_id')::uuid
          and recurring_id = (payload ->> 'recurring_id')::uuid
          and occurrence_index = (payload ->> 'occurrence_index')::integer;
    end if;
    return canonical;
end;
$$;

revoke execute on function public.merge_sync_transaction(jsonb) from public, anon;
grant execute on function public.merge_sync_transaction(jsonb) to authenticated;

create table public.scan_receipt_charge (
    user_id uuid not null references auth.users(id) on delete cascade,
    receipt_id uuid not null,
    primary key (user_id, receipt_id)
);

alter table public.scan_receipt_charge enable row level security;
revoke all on public.scan_receipt_charge from public, anon, authenticated;
grant select, insert, delete on public.scan_receipt_charge to service_role;
create policy own_charge on public.scan_receipt_charge for all to service_role
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create function public.increment_scan_usage(
    day date, "limit" integer, p_user_id uuid, p_receipt_id uuid
)
returns boolean
language plpgsql security invoker set search_path = ''
as $$
begin
    insert into public.scan_receipt_charge (user_id, receipt_id)
    values (p_user_id, p_receipt_id) on conflict do nothing;
    if not found then
        return true;
    end if;
    if public.increment_scan_usage(day, "limit", p_user_id) then
        return true;
    end if;
    delete from public.scan_receipt_charge
    where user_id = p_user_id and receipt_id = p_receipt_id;
    return false;
end;
$$;

revoke execute on function public.increment_scan_usage(date, integer, uuid, uuid)
    from public, anon, authenticated;
grant execute on function public.increment_scan_usage(date, integer, uuid, uuid) to service_role;

commit;
