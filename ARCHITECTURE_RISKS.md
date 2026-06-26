# Risk reports

Per-risk analysis of the items in `ARCHITECTURE.md`. Each section identifies the architectural principle being violated, current and future consequences, a planned mitigation, and how that mitigation aligns with widely accepted principles.

All six mitigations have been implemented on the `deduplicate` branch. Each section below carries a **Status** line describing what shipped. Risks 4 and 5 are deliberately incremental: the type checker and coverage floor are enforced over the pure layers now and ratchet outward over time.

## Risk 1: Stale service-worker manifest

**Principle violated.** Single source of truth, and fail-fast. The filesystem is the real list of assets; the SW maintains a hand-edited mirror. Two sources for one fact.

**Current consequences.** On a fresh install or version bump, `cache.addAll()` is called against paths that don't exist. Depending on browser, this either fails the whole install (silently, in production) or partially populates and degrades offline behaviour. Cache versioning doesn't help because the list itself is wrong.

**Future and downstream consequences.** Every future rename, split, or deletion is a hidden footgun. The list rots faster as the project moves. When a user reports "offline doesn't work," diagnosis is painful: nothing logs and nothing throws; DevTools just shows an empty cache. Confidence in the PWA capability erodes; the team starts avoiding offline-dependent work.

**Mitigation.** Generate the manifest at deploy time. A 20-line shell script that `find`s `js/ data/ *.html *.css *.json` and writes the array into `service-worker.js` (or a sidecar `manifest.json` the SW reads) eliminates the manual list. Optionally, wrap the install handler so any individual `fetch` failure logs which path was missing instead of failing silently.

**Why it aligns.** Restores single source of truth (filesystem is authoritative). Aligns with "automation over discipline": the manifest cannot drift because it is regenerated. Adds fail-fast: install errors become visible.

**Status: implemented.** `scripts/generate-sw-manifest.mjs` regenerates the `STATIC_ASSETS`/`DATA_ASSETS` arrays from the filesystem between markers in `service-worker.js` (`npm run build:sw`; `npm run check:sw` fails if stale, for CI). The install handler now caches each asset individually via `Promise.allSettled`, so one missing path no longer blanks the cache, and it logs exactly which path failed. The regeneration also restored `js/vendor/ajv.min.js`, which the hand-written list had omitted. `CACHE_VERSION` bumped to 4.

## Risk 2: Oversized `ui/ui.js` and `main.js`

**Principle violated.** Single Responsibility Principle and separation of concerns. `main.js` mixes the composition root with handlers, dietary filtering, settings reset, and panel coordination. `ui.js` mixes the four info-panel renderers, settings extraction, and exclude-select population.

**Current consequences.** Two ~800-line modules sit at the gravitational centre of nearly every change. They dominate merge conflicts. Function lookup is noisy; you have to load the whole file mentally before working in it. Coupling concentrates here because almost everything imports from them.

**Future and downstream consequences.** Without intervention these will become god modules. Every new feature deposits something in `main.js` by default because that's where wiring lives. Refactoring later gets harder because more downstream code reaches into internal helpers. Newcomers face a steep on-ramp.

**Mitigation.** Split along the seams that the recent helpers already identified:

- `main.js`: lift the `setup*` listener-wiring functions to `js/wiring/` (one file per concern). Move data loading and the `DATA_CONFIG` table to `js/loaders/`. Leave `main.js` as ~150 lines of composition root.
- `ui/ui.js`: extract each `show*Info` function into `js/ui/panels/{fat,glossary,fattyAcid,additive}.js`. Move `populateExcludeIngredientSelect` and friends to `js/ui/exclusions.js`. `getSettings` belongs in its own small `js/ui/settings.js`.

**Why it aligns.** Each module gets one reason to change. Coupling becomes visible in import statements. Aligns with SRP and separation of concerns; reduces shotgun surgery when modifying a single feature.

**Status: implemented.** `ui.js` dropped from 831 to 258 lines and is now a re-export barrel over `js/ui/panels/{shared,fat,glossary,fattyAcid,additive}.js`, `js/ui/exclusions.js`, and `js/ui/settings.js`; it retains only the results-table property display and the help-popup system. Every `import * as ui` / named import keeps working through the barrel. `main.js` dropped from 811 to 656 lines: data loading moved to `js/loaders/dataLoader.js` and the dietary-filter concern (predicate, fat-select repopulation, combined exclusions) to `js/wiring/dietaryFilters.js`. The remaining `setup*` wiring stays in `main.js` as the composition root; lifting it into per-concern `js/wiring/` files is the natural next step but needs dependency-injection plumbing that is riskier without UI-integration tests.

## Risk 3: `optimizer.js` is large, untested, and quadratic

**Principle violated.** SRP (the optimizer contains scoring, generation, weight optimisation, profile matching, and cupboard logic in one file), testability as a design property, and "measure, don't guess" for performance.

**Current consequences.** Confidence in optimizer changes is low; nobody can refactor it without manual end-to-end testing. Performance is uncharacterised: fine at today's database size, unknown at 2× or 5×. Bugs ship and are only caught by reading recipe output.

**Future and downstream consequences.** As the fat database grows or the Profile Builder triggers more candidate evaluations, latency could degrade silently. A bug in the optimizer ships bad recipes, and at low superfat that has real safety implications. A "don't touch the optimizer" culture emerges, which compounds: any module nobody refactors gets steadily worse.

**Mitigation.** Wire Vitest (CLAUDE.md already names this as planned). Start with the targets it lists: `calculateProfileError`, `scoreFatForTarget`, `optimizeWeights`, `scaleToTotal`. Add a small bench file (Vitest supports `bench`) with representative database sizes so future performance regressions surface as benchmark deltas. Then split the file along its natural seams: `optimizer/scoring.js`, `optimizer/generation.js`, `optimizer/weights.js`, `optimizer/cupboard.js`.

**Why it aligns.** Tests document invariants and enable confident refactoring. Benchmarks turn "is it fast enough" from a hunch into a measurement. Aligns with the test pyramid (pure logic at the base), SRP, and "make hidden costs visible".

**Status: implemented.** Vitest is wired (`npm test`). `optimizer.js` is now a thin public barrel over `js/core/optimizer/{scoring,weights,profile,generation,cupboard,dietary}.js`, split along the seams named above (`scoring.js` is the dependency leaf; no cycles). The public `* as optimizer` API and all importers are unchanged. `js/core/optimizer.test.js` and `js/core/optimizer.bench.js` cover and benchmark the algorithms; the benchmark confirms the quadratic cost (6 fats ≈ 14× slower than 3; a 5× database ≈ 10× slower than 1×), giving a baseline for future regressions.

## Risk 4: No type system (JSDoc not enforced)

**Principle violated.** Design by contract: JSDoc declares contracts that nothing enforces. Shift bugs left: type errors should surface at edit time rather than at user time. Make invalid states unrepresentable.

**Current consequences.** Refactors rely on grep, `node --input-type=module --check`, and careful reading. Function signatures and their JSDoc drift silently. A renamed property in state is only caught if you remember every call site (the recent `lockedWeight` removal required careful manual searching). Whole bug classes (null/undefined access, mismatched argument counts, wrong property names) stay uncaught until a user hits them.

**Future and downstream consequences.** Refactor cost grows superlinearly with code size. Contributors will fear renames and instead add new functions, which inflates surface area. The JSDoc that does exist gradually goes stale because nothing keeps it honest.

**Mitigation.** Add a `tsconfig.json` with `allowJs: true`, `checkJs: true`, `noEmit: true`, `strict: true`. File extensions stay unchanged, and there is no transpilation or runtime cost. The existing JSDoc becomes load-bearing. CI runs `tsc --noEmit` and fails on type errors. Walk through errors layer by layer: `lib/` first (smallest, purest), then `state/`, then `core/`, then UI. Allow `// @ts-expect-error` strategically during migration.

**Why it aligns.** Enforces the contracts JSDoc already promises. Catches a class of bugs at edit time rather than user time. Aligns with shift-left, fail-fast, and design by contract.

**Status: implemented (incremental).** `tsconfig.json` enables `allowJs`, `checkJs`, `noEmit`, and `strict`; `npm run typecheck` runs `tsc --noEmit` and fails on type errors. `js/lib/types.js` holds shared `@typedef`s for the JSON data shapes (`Fat`, `FatsDatabase`, `FattyAcids`, `PropertyValues`, `RecipeItem`, `WeightItem`, `PercentItem`, `ScoredFat`). The `lib/` and `core/` layers (the tested, safety-critical pure logic) now type-check cleanly under `strict`; the 311 initial errors were driven to zero with shared typedefs and a handful of localized casts. Per the doc's "lib first, then core, then state, then UI" order, `tsconfig.json`'s `include` is scoped to `lib`/`core` today; widening to `state/`, `ui/`, `features/`, and `wiring/` is the next ratchet.

## Risk 5: No test framework

**Principle violated.** Testability as a first-class design constraint. Trust through verification (today, trust comes from reading; that's expensive and lossy).

**Current consequences.** Every refactor is hand-verified. Pure functions in `core/` are unprotected against regression despite being the easiest things in the codebase to test. Bugs ship and are caught either by me using the app or by users.

**Future and downstream consequences.** Adding tests retroactively gets harder as code grows. Untested code accretes hidden assumptions that you only learn about when you violate one. The optimizer (Risk 3) is the load-bearing example: silent regressions there ship bad recipes, which at 0% superfat is a safety concern.

**Mitigation.** Wire Vitest at the project level. Target the pure modules first: `core/calculator.js`, `core/optimizer.js`, `lib/dietary.js`, `lib/references.js`, and `state/state.js` (with a mocked `localStorage`). Set a low coverage floor (say 30%) and ratchet it up by 5% every quarter. Skip UI integration tests for now; their cost/benefit is wrong for a vanilla-JS project this size, and the pure-core base catches most of the value.

**Why it aligns.** Aligns with the test pyramid (broad base of fast unit tests over pure logic). Provides regression resistance and fast feedback. Pairs naturally with Risk 4's type checking; both shift cost from production to authoring time.

**Status: implemented.** Vitest runs against the raw ES modules with no build step (`vitest.config.mjs`, node environment). 84 unit tests cover `core/calculator.js`, `core/optimizer.js`, `lib/dietary.js`, `lib/references.js`, and `state/state.js` (with a mocked `localStorage`); shared fixtures live in `tests/fixtures.js`. Statement coverage over the included pure modules is ~84%, comfortably above the 30% floor set in config to ratchet upward over time. UI integration tests are deliberately out of scope for now.

## Risk 6: Imperative render calls are easy to forget

**Principle violated.** Tell-don't-ask: callers shouldn't have to remember to inform the view of state changes. Don't repeat yourself: every mutation site duplicates the "mutate, render, recalculate" sequence. Coupling between cause and consequence: mutators must know what depends on them downstream.

**Current consequences.** An active bug class: mutate `state.recipe` somewhere new, forget to call `renderRecipeList()`, ship a UI that's silently stale until the next unrelated re-render. The `createArrayMutators` factory shaved this on the mutation side but did nothing for the rendering side. Handlers across the feature modules all repeat the same three-step ritual.

**Future and downstream consequences.** New mutations are very likely to forget some derived view. Tests cannot easily catch this; DOM-state inconsistencies require integration tests that the project doesn't have (Risk 5). Adding a new build mode requires knowing the full set of `render*()` functions to invoke.

**Mitigation.** Use the proxy's `subscribe` machinery that already exists but currently has only one consumer (`saveState`). Wire selected key subscriptions in `main.js`:

```js
state.subscribe('recipe', () => { renderRecipeList(); calculate(); });
state.subscribe('recipeAdditives', () => renderAdditivesList());
state.subscribe('yoloRecipe', () => renderYoloRecipe());
// ... etc
```

Deliberately partial: don't add it everywhere, only where forgetting a render hurts. Multi-step actions (like `transferRecipe`) should still do explicit work because they coordinate beyond a single state slice.

**Why it aligns.** Aligns with the observer pattern, the right tool for "many views, one source of truth", and with single responsibility (mutators only mutate, renderers only render). It reuses existing infrastructure rather than adding an abstraction, and reduces a real bug class without forcing the codebase into a framework-style data flow it doesn't need.

**Status: implemented (narrower than the sketch above, by design).** `main.js` now wires `state.subscribe('recipe', calculate)` and `state.subscribe('yoloRecipe', renderYoloRecipe)`. The example's `state.subscribe('recipe', renderRecipeList)` was deliberately **not** wired: the Select Fats, Cupboard, and Additives weight inputs update their derived displays in place on each keystroke and intentionally skip the full list re-render to preserve input focus, so auto-subscribing a list renderer to those slices would drop focus mid-edit. Only focus-safe updates are wired: `calculate()` refreshes the property panel and additive amounts without touching the recipe inputs, and YOLO has no per-keystroke editing path. The rationale is documented inline at the wiring site.
