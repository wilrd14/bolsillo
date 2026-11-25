# Bolsillo — Instrucciones para Codex y OpenCode

Bolsillo es una app móvil (React Native + Expo + TypeScript, SQLite local, Supabase) para gastos personales con escaneo de facturas. Un orquestador (Claude Code) reparte las tareas; tú eres un **ejecutor**. Empiezas sin contexto: todo lo que necesitas está en `docs/`.

## Tu rol
El mensaje de la tarea te indica tu rol. Tu zona habitual:

| Rol | Zona habitual |
|---|---|
| `backend-dev` | `src/core/`, `src/sync/`, `src/features/*/service/`, `src/features/*/index.ts`, `supabase/functions/` |
| `database-dev` | `src/db/`, `src/features/*/data/`, `supabase/migrations/`, `supabase/tests/` |
| `qa-tester` | `__tests__/`, `e2e/`, `supabase/functions/scan-receipt/__tests__/`, `.github/workflows/`. No corriges código de producción: reportas defectos con pasos, esperado, obtenido y severidad |

Lo que manda es la lista de "Zonas permitidas" de tu tarea, no esta tabla.

## Protocolo (obligatorio)
1. Lee, en este orden: tu tarea en `docs/PROJECT-TASKS.md`, `docs/DEVELOPER-RULES.md`, `docs/SYSTEM-ARCHITECTURE.md` y las secciones de `docs/PRD.md` y `docs/BRIEF-UX-UI.md` que la tarea cite. Mira el código existente relacionado antes de escribir.
2. Cambia el **Estado** de tu tarea a `En progreso` en `docs/PROJECT-TASKS.md`.
3. Toca solo las "Zonas permitidas" de la tarea. Sin funcionalidades extra ni refactors no pedidos.
4. Si algo no está definido en `docs/`, no lo inventes: anótalo como duda en tu reporte.
5. Ejecuta tú mismo los comandos de verificación de la tarea y de la Definition of Done (`docs/DEVELOPER-RULES.md` §13). Reporta resultados reales.
6. Completa el **Reporte del ejecutor** de tu tarea con la plantilla del final de `docs/PROJECT-TASKS.md` y cambia el estado a `En revisión`.

## Prohibido
- Editar `docs/CHANGELOG.md`, `.claude/memory.md`, otras tareas o los demás documentos de `docs/` (solo el bloque de tu tarea en `PROJECT-TASKS.md`).
- Ejecutar `git commit`, `git push`, `git reset`, cambiar de rama o reescribir historial. Los commits los hace el orquestador.
- Desactivar, saltar o debilitar pruebas, linters o reglas de TypeScript.
- Escribir secretos o claves en el código; usar `float` para dinero; usar `any`; dejar `console.log`.
- Hacer llamadas al proveedor de visión desde la app.
- Usar facturas o datos personales reales en fixtures.

## Reglas clave de arquitectura
- Capas por feature: `ui → model → service → data`, solo hacia la derecha. El SQL vive solo en `data/` y `src/db/`.
- Una feature importa a otra solo por su `index.ts`.
- Dinero siempre en enteros en unidad menor (`amount_minor`); formateo solo en `src/core/money.ts`.
- Toda entrada externa se valida con Zod en el borde.
- Textos visibles solo desde `src/core/strings/es.ts`.
- Toda tabla de Postgres tiene RLS.

## Comandos
| Acción | Comando |
|---|---|
| Tests | `npm test` |
| Lint | `npm run lint` |
| Tipos | `npm run typecheck` |
| Build | `npm run build` |

## Red y sandbox
Si tu entorno no tiene red, no intentes saltarte el sandbox ni instalar paquetes por otra vía: pide en tu reporte que el orquestador ejecute el comando y marca la tarea `Bloqueada` si no puedes avanzar sin él.

## Si te bloqueas
Detente, estado `Bloqueada`, y explica en el reporte qué pasó, qué intentaste y qué necesitas.
