# Soper

<!-- toc -->

- [Quick start](#quick-start)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Data files](#data-files)
  * [`fats.json`](#fatsjson)
  * [`glossary.json`](#glossaryjson)
  * [`fatty-acids.json`](#fatty-acidsjson)
- [Adding a new fat](#adding-a-new-fat)
- [Configuration](#configuration)
  * [Property Ranges (`lib/constants.js`)](#property-ranges-libconstantsjs)
  * [Recipe note thresholds](#recipe-note-thresholds)
- [Key concepts](#key-concepts)
  * [Fat locking](#fat-locking)
  * [Profile builder](#profile-builder)
  * [Pure calculations](#pure-calculations)
- [No build system](#no-build-system)

<!-- tocstop -->

## Quick start

```bash
# Requires HTTP server for ES6 modules
python3 -m http.server 8000
# or
npx serve

# Open http://localhost:8000
```

Prerequisites: modern browser (Chrome, Firefox, Safari, Edge)

## Architecture

```
User Input → main.js (orchestration) → calculator.js (compute) → ui.js (render)
                 ↓
            state.js (reactive state via Proxy)
```

| Module | Purpose |
|--------|---------|
| `main.js` | Entry point, event binding, data loading |
| `core/calculator.js` | Pure calculation functions (no DOM) |
| `core/optimizer.js` | Recipe optimization algorithm |
| `state/state.js` | Reactive state management |
| `ui/ui.js` | DOM rendering |
| `ui/helpers.js` | DOM utilities |
| `lib/constants.js` | Element IDs, thresholds, ranges |
| `lib/validation.js` | JSON schema validation |

## Project Structure

```
soap-generator/
├── index.html              # SPA entry point
├── css/styles.css          # Dark theme, responsive grid
├── js/
│   ├── main.js             # App orchestration
│   ├── core/
│   │   ├── calculator.js   # Lye, water, fatty acid math
│   │   └── optimizer.js    # Profile-matching algorithm
│   ├── state/
│   │   └── state.js        # Proxy-based reactive state
│   ├── ui/
│   │   ├── ui.js           # All DOM rendering
│   │   └── helpers.js      # $(), delegate(), etc.
│   ├── lib/
│   │   ├── constants.js    # ELEMENT_IDS, PROPERTY_RANGES
│   │   └── validation.js   # AJV schema validation
│   └── vendor/
│       └── ajv.min.js      # JSON schema validator
└── data/
    ├── fats.json           # Fat/oil database
    ├── glossary.json       # Educational definitions
    ├── fatty-acids.json    # Chemistry reference
    └── schemas/            # JSON validation schemas
```

## Data files

Each file contains data derived from scientifically verified, publicly funded primary sources.

### `fats.json`

Each fat entry contains:

```json
{
  "Olive Oil": {
    "sap": { "naoh": 0.135, "koh": 0.19 },
    "fattyAcids": {
      "lauric": 0, "myristic": 0, "palmitic": 11,
      "stearic": 3, "ricinoleic": 0, "oleic": 75,
      "linoleic": 9, "linolenic": 1
    },
    "iodine": 85,
    "ins": 105,
    "density": 0.91,
    "usage": { "min": 0, "max": 100 },
    "description": "...",
    "properties": "...",
    "references": [{ "source": "...", "section": "...", "url": "..." }]
  }
}
```

### `glossary.json`

Educational terms with categories, descriptions, and related terms.

### `fatty-acids.json`

Chemistry data: formula, carbon chain, melting point, saturation.

## Adding a new fat

1. Add entry to `data/fats.json`:

```json
"new-fat-name": {
  "sap": { "naoh": 0.XXX, "koh": 0.XXX },
  "fattyAcids": {
    "lauric": 0, "myristic": 0, "palmitic": 0,
    "stearic": 0, "ricinoleic": 0, "oleic": 0,
    "linoleic": 0, "linolenic": 0
  },
  "iodine": 0,
  "ins": 0,
  "density": 0.91,
  "usage": { "min": 0, "max": 100 },
  "description": "Description here",
  "properties": "Properties here",
  "references": []
}
```

2. Fatty acid percentages should total ~100%
3. SAP values: NaOH typically 0.12-0.19, KOH = NaOH × 1.4
4. Refresh browser - validation runs automatically

## Configuration

### Property Ranges (`lib/constants.js`)

```javascript
export const PROPERTY_RANGES = {
  hardness:         { min: 29, max: 54 },
  degreasing:       { min: 12, max: 22 },
  moisturizing:     { min: 44, max: 69 },
  'lather-volume':  { min: 14, max: 46 },
  'lather-density': { min: 16, max: 48 },
  iodine:           { min: 41, max: 70 },
  ins:              { min: 136, max: 165 }
};
```

These drive the UI range indicators and recipe notes.

### Recipe note thresholds

```javascript
export const NOTE_THRESHOLDS = {
  HIGH_DEGREASING: 20,       // Triggers "may strip skin" note
  LOW_DEGREASING: 10,        // Triggers "very gentle" note
  HIGH_POLYUNSATURATED: 15,  // Triggers DOS warning
  HIGH_LINOLENIC: 5,         // Triggers stability warning
  LOW_LATHER_VOLUME: 20,     // Triggers lather suggestion
  HIGH_MOISTURIZING: 65,     // Used in balance check
  LOW_HARDNESS: 35           // Used in balance check
};
```

## Key concepts

### Fat locking

When a fat is "locked", other fats are scaled around it. Useful to maintain a specific amount or proportion of one fat while adjusting the recipe.

### Profile builder

The optimizer uses iterative gradient descent to find fat combinations matching target properties. Not globally optimal but produces practical results.

### Pure calculations

`calculator.js` has zero DOM dependencies. All functions are pure and can be unit tested independently.

## No build system

This project intentionally avoids build tools:

- ES6 modules load natively in browsers
- No transpilation needed (modern browser targets)
- No bundling: files stay separate and debuggable
- Instant iteration: edit file, refresh browser

Trade-off: Requires HTTP server for local development (CORS).
