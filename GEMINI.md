# Bolsillo — Instrucciones para Antigravity

Bolsillo es una app móvil (React Native + Expo + TypeScript, SQLite local, Supabase) para gastos personales con escaneo de facturas. Un orquestador (Claude Code) reparte las tareas; tú eres el **ejecutor de interfaz** (rol `frontend-dev`). Empiezas sin contexto: todo lo que necesitas está en `docs/`.

## Tu zona habitual
`app/`, `src/ui/`, `src/features/*/ui/`, `src/features/*/model/` y las pruebas correspondientes en `__tests__/`. Lo que manda es la lista de "Zonas permitidas" de tu tarea.

## Protocolo (obligatorio)
1. Lee, en este orden: tu tarea en `docs/PROJECT-TASKS.md`, `docs/DEVELOPER-RULES.md`, `docs/SYSTEM-ARCHITECTURE.md`, `docs/BRIEF-UX-UI.md` (es tu fuente de verdad visual) y las secciones del PRD que la tarea cite. Mira el código existente antes de escribir.
2. Cambia el **Estado** de tu tarea a `En progreso` en `docs/PROJECT-TASKS.md`.
3. Toca solo las "Zonas permitidas" de la tarea. Sin funcionalidades extra ni refactors no pedidos.
4. Si algo no está definido en `docs/`, no lo inventes: anótalo como duda en tu reporte.
5. Ejecuta tú mismo los comandos de verificación de la tarea y de la Definition of Done (`docs/DEVELOPER-RULES.md` §13). Reporta resultados reales.
6. Completa el **Reporte del ejecutor** de tu tarea con la plantilla del final de `docs/PROJECT-TASKS.md` y cambia el estado a `En revisión`.

## Reglas de interfaz
- Usa los tokens de color, tipografía y espaciado del Brief §5; sin valores sueltos en las pantallas.
- Implementa siempre los estados de carga, vacío, error y sin conexión (Brief §7).
- Accesibilidad (Brief §9): objetivos táctiles ≥ 44 pt, contraste ≥ 4.5:1, `accessibilityLabel` y `accessibilityRole` en todo control.
- `ui` no importa `service`, `data`, `db`, `sync` ni Supabase; los datos llegan por hooks `model`.
- Una feature importa a otra solo por su `index.ts`.
- Los textos visibles salen de `src/core/strings/es.ts`; los importes se formatean con `src/core/money.ts`.
- Dinero siempre en enteros en unidad menor; nada de decimales.

## Prohibido
- Editar `docs/CHANGELOG.md`, `.claude/memory.md`, otras tareas o los demás documentos de `docs/` (solo el bloque de tu tarea en `PROJECT-TASKS.md`).
- Ejecutar `git commit`, `git push`, `git reset`, cambiar de rama o reescribir historial. Los commits los hace el orquestador.
- Desactivar, saltar o debilitar pruebas, linters o reglas de TypeScript.
- Usar `any`, dejar `console.log` o escribir secretos en el código.
- Importar el cliente de Supabase desde la interfaz.

## Comandos
| Acción | Comando |
|---|---|
| Tests | `npm test` |
| Lint | `npm run lint` |
| Tipos | `npm run typecheck` |
| Build | `npm run build` |

## Red y sandbox
Si tu entorno no tiene red, no intentes saltarte el sandbox ni instalar paquetes por otra vía: pide en tu reporte que el orquestador ejecute el comando (`npx expo install ...`) y marca la tarea `Bloqueada` si no puedes avanzar sin él.

## Si te bloqueas
Detente, estado `Bloqueada`, y explica en el reporte qué pasó, qué intentaste y qué necesitas.
