-- ===================================================================
-- RLS con dos usuarios — T-028 (Pruebas de sincronización y RLS)
-- ===================================================================
-- Comando de ejecución (repo raíz):
--   docker exec -i supabase_db_bolsillo psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/tests/rls-two-users.sql
--
-- auth.uid() lee request.jwt.claim.sub; con psql lo establecemos con
-- SET antes de cada grupo de comprobaciones.
-- El script falla con ON_ERROR_STOP si falta RLS y dice claramente
-- 'FALTA RLS: <usuario> pudo ...' en ese caso.
-- Los bloques DO también imprimen 'ok: ...' cuando RLS bloquea.

\echo '=== usuarios de prueba (limpieza inicial) ==='
delete from auth.users where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
insert into auth.users (id) values ('11111111-1111-1111-1111-111111111111'), ('22222222-2222-2222-2222-222222222222');

\echo '=== conexión como rol authenticated (RLS se aplica) ==='
set role authenticated;
select current_user, session_user;

-- -------------------------------------------------------------------
-- category
-- -------------------------------------------------------------------
\echo '=== category ==='
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select auth.uid() as session_user, 'A' as sesion;
insert into category (user_id, id, name, kind, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', '6126ab26-5f32-4c94-bd14-c53c69d048a4', 'Categoria A', 'expense', now(), now());
select count(*) as a_categorias_propias from category where id = '6126ab26-5f32-4c94-bd14-c53c69d048a4';

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select auth.uid() as session_user, 'B' as sesion;
select count(*) as b_ve_categorias_de_a from category where user_id = '11111111-1111-1111-1111-111111111111';

do $$
declare
  inserted boolean default false;
begin
  begin
    insert into category (user_id, id, name, kind, created_at, updated_at)
    values ('11111111-1111-1111-1111-111111111111', '21decd55-e9d4-4b60-9f82-f544e3f02b48', 'Categoria B', 'expense', now(), now());
    inserted := true;
  exception when others then
    raise notice 'ok: inserto cruzado en category rechazado';
  end;
  if inserted then
    raise exception 'FALTA RLS: B pudo insertar en category de A';
  end if;
end $$;

do $$
declare
  changed int default 0;
begin
  update category set name = 'Hackeado'
   where user_id = '11111111-1111-1111-1111-111111111111' and id = '6126ab26-5f32-4c94-bd14-c53c69d048a4';
  select count(*) into changed from category
   where user_id = '11111111-1111-1111-1111-111111111111' and id = '6126ab26-5f32-4c94-bd14-c53c69d048a4'
     and name = 'Hackeado';
  if changed > 0 then
    raise exception 'FALTA RLS: B pudo actualizar category de A';
  end if;
  raise notice 'ok: actualizacion cruzada en category bloqueada';
end $$;

do $$
declare
  left_rows int default 0;
begin
  delete from category where user_id = '11111111-1111-1111-1111-111111111111' and id = '6126ab26-5f32-4c94-bd14-c53c69d048a4';
  select count(*) into left_rows from category
   where user_id = '11111111-1111-1111-1111-111111111111' and id = '6126ab26-5f32-4c94-bd14-c53c69d048a4';
  if left_rows > 0 then
    raise exception 'FALTA RLS: B pudo borrar category de A';
  end if;
  raise notice 'ok: borrado cruzado en category bloqueado';
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as a_categorias_propias_visibles from category where id = '6126ab26-5f32-4c94-bd14-c53c69d048a4';
update category set name = 'Categoria A v2' where id = '6126ab26-5f32-4c94-bd14-c53c69d048a4';
select name as a_categoria_actualizada from category where id = '6126ab26-5f32-4c94-bd14-c53c69d048a4';

-- -------------------------------------------------------------------
-- receipt
-- -------------------------------------------------------------------
\echo '=== receipt ==='
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into receipt (user_id, id, local_uri, status, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', 'd6dcd8cb-9472-4e09-a39e-736be5785c31', 'file:///synthetic-rls-a.jpg', 'done', now(), now());
select count(*) as a_recibos_propios from receipt where id = 'd6dcd8cb-9472-4e09-a39e-736be5785c31';

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as b_ve_recibos_de_a from receipt where user_id = '11111111-1111-1111-1111-111111111111';

do $$
declare
  inserted boolean default false;
begin
  begin
    insert into receipt (user_id, id, status, created_at, updated_at)
    values ('11111111-1111-1111-1111-111111111111', '4147e1c9-164d-407f-83f9-9ac8b8823134', 'done', now(), now());
    inserted := true;
  exception when others then
    raise notice 'ok: inserto cruzado en receipt rechazado';
  end;
  if inserted then
    raise exception 'FALTA RLS: B pudo insertar en receipt de A';
  end if;
end $$;

do $$
declare
  changed int default 0;
begin
  update receipt set status = 'failed'
   where user_id = '11111111-1111-1111-1111-111111111111' and id = 'd6dcd8cb-9472-4e09-a39e-736be5785c31';
  select count(*) into changed from receipt
   where user_id = '11111111-1111-1111-1111-111111111111' and id = 'd6dcd8cb-9472-4e09-a39e-736be5785c31'
     and status = 'failed';
  if changed > 0 then
    raise exception 'FALTA RLS: B pudo actualizar receipt de A';
  end if;
  raise notice 'ok: actualizacion cruzada en receipt bloqueada';
end $$;

do $$
declare
  left_rows int default 0;
begin
  delete from receipt where user_id = '11111111-1111-1111-1111-111111111111' and id = 'd6dcd8cb-9472-4e09-a39e-736be5785c31';
  select count(*) into left_rows from receipt
   where user_id = '11111111-1111-1111-1111-111111111111' and id = 'd6dcd8cb-9472-4e09-a39e-736be5785c31';
  if left_rows > 0 then
    raise exception 'FALTA RLS: B pudo borrar receipt de A';
  end if;
  raise notice 'ok: borrado cruzado en receipt bloqueado';
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as a_recibos_propios_visibles from receipt where id = 'd6dcd8cb-9472-4e09-a39e-736be5785c31';

-- -------------------------------------------------------------------
-- recurring_rule
-- -------------------------------------------------------------------
\echo '=== recurring_rule ==='
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into category (user_id, id, name, kind, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', '9bb99312-f2f8-4a44-bf85-66c801f542d3', 'Categoria A recurrente', 'expense', now(), now());
insert into recurring_rule
       (user_id, id, kind, amount_minor, category_id, frequency, next_due, remind_days_before, active, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', '5d2917a4-3157-4cf9-8191-542295c6a723', 'expense', 1000, '9bb99312-f2f8-4a44-bf85-66c801f542d3',
        'monthly', '2026-11-25', 0, 1, now(), now());
select count(*) as a_recurring_propios from recurring_rule where id = '5d2917a4-3157-4cf9-8191-542295c6a723';

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as b_ve_recurring_de_a from recurring_rule where user_id = '11111111-1111-1111-1111-111111111111';

do $$
declare
  inserted boolean default false;
begin
  begin
    insert into recurring_rule
           (user_id, id, kind, amount_minor, category_id, frequency, next_due, remind_days_before, active, created_at, updated_at)
    values ('11111111-1111-1111-1111-111111111111', '4df08e7b-2320-40c3-a2ef-d4851e2bfd2d', 'expense', 1000,
            '9bb99312-f2f8-4a44-bf85-66c801f542d3', 'monthly', '2026-11-25', 0, 1, now(), now());
    inserted := true;
  exception when others then
    raise notice 'ok: inserto cruzado en recurring_rule rechazado';
  end;
  if inserted then
    raise exception 'FALTA RLS: B pudo insertar en recurring_rule de A';
  end if;
end $$;

do $$
declare
  changed int default 0;
begin
  update recurring_rule set active = 0
   where user_id = '11111111-1111-1111-1111-111111111111' and id = '5d2917a4-3157-4cf9-8191-542295c6a723';
  select count(*) into changed from recurring_rule
   where user_id = '11111111-1111-1111-1111-111111111111' and id = '5d2917a4-3157-4cf9-8191-542295c6a723'
     and active = 0;
  if changed > 0 then
    raise exception 'FALTA RLS: B pudo actualizar recurring_rule de A';
  end if;
  raise notice 'ok: actualizacion cruzada en recurring_rule bloqueada';
end $$;

do $$
declare
  left_rows int default 0;
begin
  delete from recurring_rule where user_id = '11111111-1111-1111-1111-111111111111' and id = '5d2917a4-3157-4cf9-8191-542295c6a723';
  select count(*) into left_rows from recurring_rule
   where user_id = '11111111-1111-1111-1111-111111111111' and id = '5d2917a4-3157-4cf9-8191-542295c6a723';
  if left_rows > 0 then
    raise exception 'FALTA RLS: B pudo borrar recurring_rule de A';
  end if;
  raise notice 'ok: borrado cruzado en recurring_rule bloqueado';
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as a_recurring_propios_visibles from recurring_rule where id = '5d2917a4-3157-4cf9-8191-542295c6a723';

-- -------------------------------------------------------------------
-- transaction
-- -------------------------------------------------------------------
\echo '=== transaction ==='
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into "transaction"
       (user_id, id, kind, amount_minor, currency, category_id, merchant, occurred_at, receipt_id, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', '1ecf2663-751e-4cc3-8c9b-a7a0a67cd1a3', 'expense', 500, 'DOP', '6126ab26-5f32-4c94-bd14-c53c69d048a4',
        'Comercio A', '2026-11-25', 'd6dcd8cb-9472-4e09-a39e-736be5785c31', now(), now());
select count(*) as a_transacciones_propias from "transaction" where id = '1ecf2663-751e-4cc3-8c9b-a7a0a67cd1a3';

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as b_ve_transacciones_de_a from "transaction" where user_id = '11111111-1111-1111-1111-111111111111';

do $$
declare
  inserted boolean default false;
begin
  begin
    insert into "transaction"
           (user_id, id, kind, amount_minor, currency, category_id, merchant, occurred_at, created_at, updated_at)
    values ('11111111-1111-1111-1111-111111111111', '017bbe63-22d1-40bd-a922-84f8446a39de', 'expense', 500, 'DOP',
            '6126ab26-5f32-4c94-bd14-c53c69d048a4', 'Categoria B', '2026-11-25', now(), now());
    inserted := true;
  exception when others then
    raise notice 'ok: inserto cruzado en transaction rechazado';
  end;
  if inserted then
    raise exception 'FALTA RLS: B pudo insertar en transaction de A';
  end if;
end $$;

do $$
declare
  changed int default 0;
begin
  update "transaction" set merchant = 'Hackeado'
   where user_id = '11111111-1111-1111-1111-111111111111' and id = '1ecf2663-751e-4cc3-8c9b-a7a0a67cd1a3';
  select count(*) into changed from "transaction"
   where user_id = '11111111-1111-1111-1111-111111111111' and id = '1ecf2663-751e-4cc3-8c9b-a7a0a67cd1a3'
     and merchant = 'Hackeado';
  if changed > 0 then
    raise exception 'FALTA RLS: B pudo actualizar transaction de A';
  end if;
  raise notice 'ok: actualizacion cruzada en transaction bloqueada';
end $$;

do $$
declare
  left_rows int default 0;
begin
  delete from "transaction" where user_id = '11111111-1111-1111-1111-111111111111' and id = '1ecf2663-751e-4cc3-8c9b-a7a0a67cd1a3';
  select count(*) into left_rows from "transaction"
   where user_id = '11111111-1111-1111-1111-111111111111' and id = '1ecf2663-751e-4cc3-8c9b-a7a0a67cd1a3';
  if left_rows > 0 then
    raise exception 'FALTA RLS: B pudo borrar transaction de A';
  end if;
  raise notice 'ok: borrado cruzado en transaction bloqueado';
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as a_transacciones_propias_visibles from "transaction" where id = '1ecf2663-751e-4cc3-8c9b-a7a0a67cd1a3';

-- -------------------------------------------------------------------
-- budget
-- -------------------------------------------------------------------
\echo '=== budget ==='
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into budget (user_id, id, category_id, month, limit_minor, created_at, updated_at)
values ('11111111-1111-1111-1111-111111111111', 'eb38ddcf-0831-42a2-b3c9-7442483df17c', '6126ab26-5f32-4c94-bd14-c53c69d048a4', '2026-11', 10000, now(), now());
select count(*) as a_presupuestos_propios from budget where id = 'eb38ddcf-0831-42a2-b3c9-7442483df17c';

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) as b_ve_presupuestos_de_a from budget where user_id = '11111111-1111-1111-1111-111111111111';

do $$
declare
  inserted boolean default false;
begin
  begin
    insert into budget (user_id, id, category_id, month, limit_minor, created_at, updated_at)
    values ('11111111-1111-1111-1111-111111111111', 'c1b2c3d4-e5f6-4789-9abc-def012345678',
            '6126ab26-5f32-4c94-bd14-c53c69d048a4', '2026-11', 1, now(), now());
    inserted := true;
  exception when others then
    raise notice 'ok: inserto cruzado en budget rechazado';
  end;
  if inserted then
    raise exception 'FALTA RLS: B pudo insertar en budget de A';
  end if;
end $$;

do $$
declare
  changed int default 0;
begin
  update budget set limit_minor = 1
   where user_id = '11111111-1111-1111-1111-111111111111' and id = 'eb38ddcf-0831-42a2-b3c9-7442483df17c';
  select count(*) into changed from budget
   where user_id = '11111111-1111-1111-1111-111111111111' and id = 'eb38ddcf-0831-42a2-b3c9-7442483df17c'
     and limit_minor = 1;
  if changed > 0 then
    raise exception 'FALTA RLS: B pudo actualizar budget de A';
  end if;
  raise notice 'ok: actualizacion cruzada en budget bloqueada';
end $$;

do $$
declare
  left_rows int default 0;
begin
  delete from budget where user_id = '11111111-1111-1111-1111-111111111111' and id = 'eb38ddcf-0831-42a2-b3c9-7442483df17c';
  select count(*) into left_rows from budget
   where user_id = '11111111-1111-1111-1111-111111111111' and id = 'eb38ddcf-0831-42a2-b3c9-7442483df17c';
  if left_rows > 0 then
    raise exception 'FALTA RLS: B pudo borrar budget de A';
  end if;
  raise notice 'ok: borrado cruzado en budget bloqueado';
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as a_presupuestos_propios_visibles from budget where id = 'eb38ddcf-0831-42a2-b3c9-7442483df17c';

-- -------------------------------------------------------------------
-- scan_usage (diseño: solo service_role)
-- -------------------------------------------------------------------
\echo '=== scan_usage ==='
\echo 'nota: scan_usage es de diseño solo para service_role; se concede a authenticated y se crean políticas temporalmente (rls_test_*) para ejercer RLS con dos usuarios, y se revocan y dropean despues'
reset role;
grant select, insert, update, delete on scan_usage to authenticated;
create policy rls_test_select on scan_usage for select to authenticated
     using (user_id = (select auth.uid()));
create policy rls_test_insert on scan_usage for insert to authenticated
     with check (user_id = (select auth.uid()));
create policy rls_test_update on scan_usage for update to authenticated
     using (user_id = (select auth.uid()));
create policy rls_test_delete on scan_usage for delete to authenticated
     using (user_id = (select auth.uid()));
set role authenticated;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select auth.uid() as session_user, 'A' as sesion;
insert into scan_usage (user_id, day, count, updated_at) values ('11111111-1111-1111-1111-111111111111', '2026-11-25', 1, now());
select count(*) as a_scan_propios from scan_usage where user_id = '11111111-1111-1111-1111-111111111111';

set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select auth.uid() as session_user, 'B' as sesion;
select count(*) as b_ve_scan_de_a from scan_usage where user_id = '11111111-1111-1111-1111-111111111111';

do $$
declare
  inserted boolean default false;
begin
  begin
    insert into scan_usage (user_id, day, count, updated_at)
    values ('11111111-1111-1111-1111-111111111111', '2026-11-25', 1, now());
    inserted := true;
  exception when others then
    raise notice 'ok: inserto cruzado en scan_usage rechazado';
  end;
  if inserted then
    raise exception 'FALTA RLS: B pudo insertar en scan_usage de A';
  end if;
end $$;

do $$
declare
  changed int default 0;
begin
  update scan_usage set count = 5
   where user_id = '11111111-1111-1111-1111-111111111111' and day = '2026-11-25';
  select count(*) into changed from scan_usage
   where user_id = '11111111-1111-1111-1111-111111111111' and day = '2026-11-25' and count = 5;
  if changed > 0 then
    raise exception 'FALTA RLS: B pudo actualizar scan_usage de A';
  end if;
  raise notice 'ok: actualizacion cruzada en scan_usage bloqueada';
end $$;

do $$
declare
  left_rows int default 0;
begin
  delete from scan_usage where user_id = '11111111-1111-1111-1111-111111111111' and day = '2026-11-25';
  select count(*) into left_rows from scan_usage
   where user_id = '11111111-1111-1111-1111-111111111111' and day = '2026-11-25';
  if left_rows > 0 then
    raise exception 'FALTA RLS: B pudo borrar scan_usage de A';
  end if;
  raise notice 'ok: borrado cruzado en scan_usage bloqueado';
end $$;

do $$
declare
  inserted boolean default false;
begin
  begin
    insert into scan_usage (user_id, day, count, updated_at)
    values ('22222222-2222-2222-2222-222222222222', '2026-11-26', 1, now());
    inserted := true;
  exception when others then
    raise notice 'ok: error inesperado insertando fila propia en scan_usage';
  end;
  if inserted then
    raise notice 'ok: B pudo insertar filas propias en scan_usage';
  end if;
end $$;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) as a_scan_propios_visibles from scan_usage where user_id = '11111111-1111-1111-1111-111111111111';

\echo '=== devolviendo grants y políticas temporales de scan_usage ==='
reset role;
drop policy rls_test_select on scan_usage;
drop policy rls_test_insert on scan_usage;
drop policy rls_test_update on scan_usage;
drop policy rls_test_delete on scan_usage;
revoke select, insert, update, delete on scan_usage from authenticated;

\echo 'RLS dos usuarios: T-028 finalizada sin hallazgos (ver notas en el reporte).'
