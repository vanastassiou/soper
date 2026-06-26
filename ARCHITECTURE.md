# Architecture report: Soper

A client-side soap recipe builder written in vanilla JavaScript (no build step, no framework). ES modules load directly in the browser; a service worker provides offline support. Roughly 7,000 lines of source spread across ~40 modules.

A development toolchain was added without changing how the app ships: Vitest for unit tests and benchmarks over the pure logic, and TypeScript in `checkJs` mode (`tsc --noEmit`) to enforce the JSDoc contracts. Neither runs at serve time; the browser still loads the raw ES modules.

## Module layout and dependency direction

The code follows a layered architecture with a strict dependency direction from top to bottom:

```text
                       index.html
                            ↓
                        js/main.js          ← orchestrator / composition root
                  /    /      |    \      \
      js/loaders/ js/wiring/ js/features/ js/ui/ js/state/  ← view + behaviour layer
                  \         |        /
                       js/core/             ← pure domain logic (calculator, optimizer/*)
                            ↓
                        js/lib/             ← pure utilities (constants, types, dietary,
                                              validation, references, cards)
```

`js/loaders/` holds the data-load/validation step; `js/wiring/` holds extracted listener/filter wiring. `js/core/optimizer/` is a folder of focused modules (`scoring`, `weights`, `profile`, `generation`, `cupboard`, `dietary`) behind a thin `optimizer.js` barrel. `js/ui/panels/` holds the per-panel renderers behind the `ui.js` barrel. `js/lib/types.js` carries the shared JSDoc `@typedef`s.

The dependency arrows reflect the actual imports. `core/` imports only from `lib/`, never from `state/` or `ui/`. `lib/` is a leaf with no internal imports beyond its own folder. This is a deliberate version of what some teams call the "stable dependencies principle": low-level modules stay unaware of higher-level ones, so changes in the UI cannot break the domain logic and vice versa.

The `core/` modules show this clearly: `calculator.js` and `optimizer/*` are pure functions over plain data. They take a recipe and return a number or a new recipe, with no DOM, global, or shared-`state` dependencies. That makes them straightforward to reason about and to test; Vitest now covers them directly.

## State management

`js/state/state.js` is the single source of truth: one big proxy-wrapped object containing recipe, additives, exclusions, databases, etc. Mutations flow through exported helpers (`addFatToRecipe`, `updateFatPercentage`, ...) rather than direct assignment, because the proxy needs whole-array replacement to detect changes.

The proxy supports a publish-subscribe API (`subscribe`, `subscribeAll`). `state.subscribeAll(saveState)` drives persistence, and `main.js` now also wires two focus-safe view subscriptions: `state.subscribe('recipe', calculate)` and `state.subscribe('yoloRecipe', renderYoloRecipe)`. The wiring is deliberately partial: list renderers for the editable weight inputs (Select Fats, Cupboard, Additives) are not auto-subscribed, because those inputs update derived displays in place on each keystroke and re-rendering mid-edit would drop input focus. Other views still re-render imperatively after user actions.

That's a deliberate trade-off: simpler than a React-style data-flow, using the observer pattern only where it removes a real "forgot to re-render" bug class without forcing a framework-style data flow. For an app this size it works fine.

## Rendering and view

The view layer is pull-based and imperative. Each feature exposes `renderX()` functions; handlers mutate state and then call them. Common UI mechanics are factored out:

- `js/ui/components/itemRow.js`: a shared row component used by every fat / additive list. `renderList()` wraps the row-rendering + event-attachment lifecycle, including `AbortSignal`-based cleanup so re-renders don't stack listeners.
- `js/ui/components/toast.js`, `js/ui/panelManager.js`: focused UI primitives.
- `js/ui/finalRecipe.js`, `js/ui/ui.js`, `js/ui/properties.js`: page-level rendering.

Event handling uses delegated listeners rather than per-element binding: a single listener on a container catches clicks on its children by `data-action` attribute. Cheaper than re-binding, and the only sensible approach without a framework's reconciler.

## Feature modules

Each build mode (Select Fats, YOLO, Profile Builder, Cupboard, Additives) lives in its own folder under `js/features/`, split into `index.js` (handlers, state mutations, event wiring) and `render.js` (pure HTML generation). They are initialised by `main.js` with a small dependency-injection object:

```js
initYolo({
    createFatInfoHandler,
    getCombinedExclusions,
    onTransferRecipe: transferRecipeToSelectFats
});
```

This is plain constructor injection: features declare what they need, `main.js` supplies it. The features don't import each other; cross-feature actions (like "transfer recipe from YOLO to Select Fats") are routed through `main.js`. That keeps feature coupling near zero.

## Cross-cutting concerns

`js/lib/` collects small, focused modules used everywhere:

- `constants.js`: magic numbers, element IDs, defaults. Centralised, but it is also the largest `lib` module at 465 lines, edging toward a "junk drawer."
- `dietary.js`, `references.js`, `validation.js`, `cards.js`: narrow, single-purpose. Healthy.

The subsites under `pages/` (a soapmaking craft section, a how-it-works explainer) import from the main app's `js/lib` rather than duplicating it. `renderEntryCard` lives there because both subsites use it. The subsites share code without a bundler because the deployment is static files served from one root.

## Deployment

The whole app is static, with no backend, build, or Node runtime at serve time. The service worker (`service-worker.js`) implements cache-first for static assets and network-first for data, the standard PWA recipe for offline-tolerant tools. Its precache manifest is generated from the filesystem by `scripts/generate-sw-manifest.mjs` (`npm run build:sw`) at deploy time. State persists to `localStorage` with a schema-version field for migration.

## Strengths

- Clean layering. Dependency direction is real and respected. You can read `core/` without knowing the UI exists.
- Feature isolation. Per-feature folders + DI mean changes to one mode don't touch others. The recent removal of locking from Select Fats only touched that feature plus state.
- Cohesive shared primitives. `renderList`, `renderItemRow`, `renderEntryCard`, `formatWeight`, `createArrayMutators` are genuine reuse rather than an abstract framework layer. Recent commits have collapsed duplication into them.
- Little accidental complexity. The code runs as written, with no build step, framework upgrade treadmill, or transpilation at serve time.

## Risks and rough edges

The items flagged in earlier reviews have been addressed; `ARCHITECTURE_RISKS.md` carries the per-risk detail.

- Service-worker manifest drift: resolved. `scripts/generate-sw-manifest.mjs` regenerates the precache lists from the filesystem, and the install handler caches assets individually so a missing path logs instead of blanking the cache.
- Oversized modules: resolved. `ui.js` is 258 lines (was 831) behind a re-export barrel over `ui/panels/*`, `ui/exclusions.js`, and `ui/settings.js`. `optimizer.js` is a barrel over `optimizer/*`. `main.js` is 656 lines (was 811) after data loading moved to `loaders/` and dietary-filter wiring to `wiring/`.
- Optimizer testing and performance: `optimizer/*` has unit tests plus a benchmark that records the O(iterations·n²) baseline, so future regressions surface as deltas.
- Type checking: `tsconfig.json` runs `tsc --noEmit` in strict `checkJs` mode over `lib/` and `core/`, enforcing the JSDoc contracts.
- Test framework: Vitest covers `core/`, `lib/dietary`, `lib/references`, and `state/` (with a mocked `localStorage`).
- Imperative render calls: `main.js` wires focus-safe `state.subscribe` updates for `recipe` and `yoloRecipe`.

Open follow-ups:

- `constants.js` is the largest `lib` module at 465 lines and edges toward a junk drawer.
- The `setup*` listener wiring still lives in `main.js`; lifting it into per-concern `js/wiring/` files wants UI-integration tests first.
- Type checking and the coverage floor reach only the pure layers so far; widening to `state/`, `ui/`, `features/`, and `wiring/` is the next ratchet.

## Pattern names

Translated into terms you will see in textbooks:

- Layered / hexagonal-ish. Pure core, IO at the edge. `core/` is the hexagon; `ui/` and `state/` are the adapters.
- Composition root. `main.js` constructs and wires everything.
- Dependency injection. Features receive their collaborators, don't reach for them.
- Single source of truth + observer pattern. Used for persistence and a few focus-safe view updates.
- Component composition. `renderItemRow` is the soap-calc equivalent of a stateless functional component.
- Pull-based MVC, weighted toward C and V. Models are plain data, controllers (`main.js` handlers) mutate state and re-render, views (`render.js` files) generate HTML from state snapshots.

## Verdict

The architecture is small-app-appropriate and more disciplined than is typical for vanilla-JS projects this size. Recent refactoring removed duplication and made the dependency direction explicit. The operational and prophylactic items from earlier reviews are now handled: the service-worker manifest is generated, the two biggest modules are split, and the pure core has tests, a benchmark, and type checking. The next investments are widening the type checker and coverage floor outward from `lib`/`core`, and lifting the remaining `main.js` wiring into `js/wiring/`.
