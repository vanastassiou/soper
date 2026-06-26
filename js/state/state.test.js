import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    state,
    addFatToRecipe,
    removeFatFromRecipe,
    updateFatPercentage,
    clearRecipe,
    getTotalPercentage,
    addExclusion,
    removeExclusion,
    setYoloRecipe,
    toggleYoloLock,
    removeYoloFat,
    getYoloLockedFats,
    addCupboardFat,
    removeCupboardFat,
    toggleCupboardLock,
    getCupboardTotalWeight,
    saveState,
    restoreState
} from './state.js';

/** Minimal in-memory localStorage stand-in for the node test environment. */
function installMockLocalStorage() {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
        clear: () => store.clear()
    };
    return store;
}

beforeEach(() => {
    // Reset shared singleton state between tests.
    clearRecipe();
    state.excludedFats = [];
    state.recipeAdditives = [];
    state.yoloRecipe = [];
    state.yoloLockedIndices = new Set();
    state.cupboardFats = [];
    state.cupboardLocks = new Set();
    state.cupboardSuggestions = [];
});

describe('recipe mutators', () => {
    it('adds a fat with the default percentage and refuses duplicates', () => {
        expect(addFatToRecipe('olive')).toBe(true);
        expect(addFatToRecipe('olive')).toBe(false);
        expect(state.recipe).toHaveLength(1);
        expect(state.recipe[0]).toEqual({ id: 'olive', percentage: 10 });
    });

    it('replaces the array reference on mutation (reactive proxy contract)', () => {
        const before = state.recipe;
        addFatToRecipe('olive');
        expect(state.recipe).not.toBe(before);
    });

    it('updates a fat percentage by index', () => {
        addFatToRecipe('olive');
        updateFatPercentage(0, '42');
        expect(state.recipe[0].percentage).toBe(42);
    });

    it('coerces invalid percentage input to zero', () => {
        addFatToRecipe('olive');
        updateFatPercentage(0, 'not-a-number');
        expect(state.recipe[0].percentage).toBe(0);
    });

    it('removes a fat by index', () => {
        addFatToRecipe('olive');
        addFatToRecipe('coconut');
        removeFatFromRecipe(0);
        expect(state.recipe.map(f => f.id)).toEqual(['coconut']);
    });

    it('sums total percentage across the recipe', () => {
        addFatToRecipe('olive');
        addFatToRecipe('coconut');
        updateFatPercentage(0, 30);
        updateFatPercentage(1, 70);
        expect(getTotalPercentage()).toBe(100);
    });
});

describe('exclusions', () => {
    it('adds unique exclusions and ignores blanks and duplicates', () => {
        addExclusion('palm');
        addExclusion('palm');
        addExclusion('');
        expect(state.excludedFats).toEqual(['palm']);
    });

    it('removes an exclusion', () => {
        addExclusion('palm');
        removeExclusion('palm');
        expect(state.excludedFats).toEqual([]);
    });
});

describe('YOLO locks', () => {
    it('toggles a lock on and off', () => {
        setYoloRecipe([{ id: 'a', percentage: 50 }, { id: 'b', percentage: 50 }]);
        toggleYoloLock(0);
        expect(getYoloLockedFats()).toEqual(['a']);
        toggleYoloLock(0);
        expect(getYoloLockedFats()).toEqual([]);
    });

    it('shifts lock indices down when an earlier fat is removed', () => {
        setYoloRecipe([{ id: 'a', percentage: 33 }, { id: 'b', percentage: 33 }, { id: 'c', percentage: 34 }]);
        toggleYoloLock(2); // lock 'c'
        removeYoloFat(0);   // remove 'a'
        expect(getYoloLockedFats()).toEqual(['c']);
    });
});

describe('cupboard fats', () => {
    it('adds, totals, and removes cupboard fats with lock index adjustment', () => {
        addCupboardFat('coconut', 200);
        addCupboardFat('olive', 300);
        expect(getCupboardTotalWeight()).toBe(500);
        toggleCupboardLock(1); // lock 'olive'
        removeCupboardFat(0);  // remove 'coconut' -> lock shifts to index 0
        expect(state.cupboardLocks.has(0)).toBe(true);
        expect(state.cupboardFats).toHaveLength(1);
    });
});

describe('persistence', () => {
    beforeEach(() => {
        installMockLocalStorage();
    });

    it('round-trips recipe, additives, and cupboard state through localStorage', () => {
        addFatToRecipe('olive');
        updateFatPercentage(0, 60);
        addCupboardFat('coconut', 150);
        saveState();

        // Wipe in-memory state, then restore from storage.
        clearRecipe();
        state.cupboardFats = [];
        expect(restoreState()).toBe(true);
        expect(state.recipe).toEqual([{ id: 'olive', percentage: 60 }]);
        expect(state.cupboardFats).toEqual([{ id: 'coconut', weight: 150 }]);
    });

    it('persists a version-4 schema field', () => {
        addFatToRecipe('olive');
        saveState();
        const saved = JSON.parse(globalThis.localStorage.getItem('soapCalculatorState'));
        expect(saved.version).toBe(4);
    });

    it('strips leftover lockedWeight fields from older saved recipes', () => {
        globalThis.localStorage.setItem('soapCalculatorState', JSON.stringify({
            version: 4,
            recipe: [{ id: 'olive', percentage: 50, lockedWeight: 250 }]
        }));
        restoreState();
        expect(state.recipe[0]).not.toHaveProperty('lockedWeight');
    });

    it('returns false and does not throw when storage is empty', () => {
        globalThis.localStorage.clear();
        expect(restoreState()).toBe(false);
    });

    it('swallows malformed JSON without throwing', () => {
        globalThis.localStorage.setItem('soapCalculatorState', '{not valid json');
        expect(() => restoreState()).not.toThrow();
    });
});
