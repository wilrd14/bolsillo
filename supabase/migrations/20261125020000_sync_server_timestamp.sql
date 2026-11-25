create function public.set_synced_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.synced_at := clock_timestamp();
    return new;
end;
$$;

do $$
declare
    entity text;
begin
    foreach entity in array array['category', 'receipt', 'recurring_rule', 'budget', 'transaction']
    loop
        execute format(
            'alter table public.%I add column synced_at timestamptz not null default now()', entity
        );
        execute format(
            'create index on public.%I (user_id, synced_at, id)', entity
        );
        execute format(
            'create trigger set_synced_at before insert or update on public.%I
             for each row execute function public.set_synced_at()', entity
        );
    end loop;
end;
$$;
