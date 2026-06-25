/**
 * Proxy-based reactive state management
 * Provides centralized state with automatic change notifications
 */

import { DEFAULTS } from '../lib/constants.js';

/**
 * Create a reactive state object that notifies subscribers on changes
 * @param {Object} initialState - Initial state values
 * @returns {Object} Reactive state proxy with subscribe/unsubscribe methods
 */
function createReactiveState(initialState) {
    const subscribers = new Map(); // key -> Set of callbacks
    const state = { ...initialState };

    /**
     * Subscribe to changes on a specific key
     * @param {string} key - State key to watch
     * @param {Function} callback - Called with (newValue, oldValue, key)
     * @returns {Function} Unsubscribe function
     */
    function subscribe(key, callback) {
        if (!subscribers.has(key)) {
            subscribers.set(key, new Set());
        }
        subscribers.get(key).add(callback);

        // Return unsubscribe function
        return () => subscribers.get(key)?.delete(callback);
    }

    /**
     * Subscribe to all state changes
     * @param {Function} callback - Called with (newValue, oldValue, key)
     * @returns {Function} Unsubscribe function
     */
    function subscribeAll(callback) {
        return subscribe('*', callback);
    }

    /**
     * Notify subscribers of a change
     * @param {string} key - Changed key
     * @param {*} newValue - New value
     * @param {*} oldValue - Previous value
     */
    function notify(key, newValue, oldValue) {
        // Notify key-specific subscribers
        subscribers.get(key)?.forEach(cb => cb(newValue, oldValue, key));
        // Notify wildcard subscribers
        subscribers.get('*')?.forEach(cb => cb(newValue, oldValue, key));
    }

    // Create proxy for reactive access
    const proxy = new Proxy(state, {
        get(target, prop) {
            // Expose subscribe methods
            if (prop === 'subscribe') return subscribe;
            if (prop === 'subscribeAll') return subscribeAll;
            if (prop === '_state') return { ...target }; // Snapshot for debugging

            return target[prop];
        },

        set(target, prop, value) {
            const oldValue = target[prop];

            // Only notify if value actually changed
            // Handle Sets specially since JSON.stringify(Set) returns "{}"
            let hasChanged;
            if (value instanceof Set && oldValue instanceof Set) {
                hasChanged = value.size !== oldValue.size ||
                    [...value].some(v => !oldValue.has(v));
            } else {
                const oldJson = JSON.stringify(oldValue);
                const newJson = JSON.stringify(value);
                hasChanged = oldJson !== newJson;
            }

            if (hasChanged) {
                target[prop] = value;
                notify(prop, value, oldValue);
            }

            return true;
        }
    });

    return proxy;
}

// ============================================
// State Helpers
// ============================================

/**
 * Create a toggle lock function for a given state key
 * @param {string} stateKey - The state property holding the Set of locks
 * @returns {Function} Toggle function that takes an index
 */
function createToggleLock(stateKey) {
    return (index) => {
        const newLocks = new Set(state[stateKey]);
        if (newLocks.has(index)) {
            newLocks.delete(index);
        } else {
            newLocks.add(index);
        }
        state[stateKey] = newLocks;
    };
}

/**
 * Adjust lock indices after removing an item at a given index
 * @param {Set} locksSet - Current set of locked indices
 * @param {number} removedIndex - Index that was removed
 * @returns {Set} New set with adjusted indices
 */
function adjustIndicesAfterRemoval(locksSet, removedIndex) {
    const newLocks = new Set();
    for (const lockedIndex of locksSet) {
        if (lockedIndex < removedIndex) {
            newLocks.add(lockedIndex);
        } else if (lockedIndex > removedIndex) {
            newLocks.add(lockedIndex - 1);
        }
        // If lockedIndex === removedIndex, it's removed (not added to new set)
    }
    return newLocks;
}

/**
 * Create add / remove / update mutators for a state array of `{id, [valueField]}` items.
 * The reactive proxy treats array reassignment as a change, so each mutator builds
 * a new array and assigns it back.
 *
 * @param {string} stateKey - Property on `state` holding the array
 * @param {Object} options
 * @param {string} options.valueField - Field name for the per-item value (e.g. 'weight').
 * @param {*} [options.defaultValue] - Default value used by `add` when none is supplied.
 * @param {string} [options.locksKey] - Companion Set on `state` whose indices need
 *   to shift when an item is removed.
 * @returns {{ add: Function, remove: Function, update: Function }}
 */
function createArrayMutators(stateKey, { valueField, defaultValue, locksKey } = {}) {
    return {
        add(id, value = defaultValue) {
            if (state[stateKey].some(item => item.id === id)) return false;
            state[stateKey] = [...state[stateKey], { id, [valueField]: value }];
            return true;
        },
        remove(index) {
            const next = [...state[stateKey]];
            next.splice(index, 1);
            state[stateKey] = next;
            if (locksKey) {
                state[locksKey] = adjustIndicesAfterRemoval(state[locksKey], index);
            }
        },
        update(index, value) {
            const next = [...state[stateKey]];
            next[index] = { ...next[index], [valueField]: parseFloat(value) || 0 };
            state[stateKey] = next;
        }
    };
}

// ============================================
// Application State
// ============================================

export const state = createReactiveState({
    // Recipe state (Select fats mode - percentage-based input)
    recipe: [],              // Array of {id, percentage}

    recipeAdditives: [],     // Array of {id, weight}

    // YOLO mode state
    yoloRecipe: [],          // Array of {id, percentage}
    yoloLockedIndices: new Set(),  // Set of locked fat indices in YOLO mode

    // Properties mode state
    propertiesRecipe: [],    // Array of {id, percentage} from profile builder
    propertiesLockedIndices: new Set(),  // Set of locked fat indices in properties mode

    // Data (loaded from JSON)
    fatsDatabase: {},           // Fat data with SAP values, fatty acids
    glossaryData: {},           // Educational definitions (soapmaking knowledge)
    tooltipsData: {},           // UI help text (site usage)
    fattyAcidsData: {},         // Fatty acid information
    fragrancesDatabase: {},     // Essential oils for fragrance
    colourantsDatabase: {},     // Colourant additives (oxides, micas, clays, botanicals)
    soapPerformanceDatabase: {},// Bar quality additives (hardeners, lather enhancers, antioxidants)
    skinCareDatabase: {},       // Skin effect additives (emollients, exfoliants)
    sourcesData: {},            // Reference sources data
    formulasData: {},           // Calculation formulas documentation

    // UI state
    excludedFats: [],        // Fats excluded from profile builder

    // Cupboard cleaner state (weight-based input)
    cupboardFats: [],              // Array of {id, weight}
    cupboardLocks: new Set(),      // Indices of locked cupboard fat weights
    cupboardSuggestions: [],       // Array of {id, weight, percentage}
    allowRatioMode: false,         // If true, optimizer can suggest ratio changes

    // Suggestion exclusions (YOLO and Cupboard modes)
    suggestionExcludedFats: []     // Fats excluded from YOLO and Cupboard suggestions
});

// ============================================
// Convenience Methods
// ============================================

/**
 * Default percentage for new fats in select fats mode
 */
const DEFAULT_PERCENTAGE = 10;

const recipeMutators = createArrayMutators('recipe', {
    valueField: 'percentage',
    defaultValue: DEFAULT_PERCENTAGE
});
export const addFatToRecipe = recipeMutators.add;
export const removeFatFromRecipe = recipeMutators.remove;
export const updateFatPercentage = recipeMutators.update;

/**
 * Clear the entire recipe
 */
export function clearRecipe() {
    state.recipe = [];
}

/**
 * Get total percentage of recipe (should sum to 100% ideally)
 * @returns {number} Total percentage
 */
export function getTotalPercentage() {
    return state.recipe.reduce((sum, fat) => sum + fat.percentage, 0);
}

/**
 * Add a fat to the exclusion list
 * @param {string} id - Fat id (kebab-case key)
 */
export function addExclusion(id) {
    if (!id || state.excludedFats.includes(id)) return;
    state.excludedFats = [...state.excludedFats, id];
}

/**
 * Remove a fat from the exclusion list
 * @param {string} id - Fat id (kebab-case key)
 */
export function removeExclusion(id) {
    state.excludedFats = state.excludedFats.filter(fat => fat !== id);
}


// ============================================
// Additive Methods
// ============================================

const additiveMutators = createArrayMutators('recipeAdditives', {
    valueField: 'weight',
    defaultValue: DEFAULTS.ADDITIVE_WEIGHT
});
export const addAdditiveToRecipe = additiveMutators.add;
export const removeAdditiveFromRecipe = additiveMutators.remove;
export const updateAdditiveWeight = additiveMutators.update;

// ============================================
// YOLO Methods
// ============================================

/**
 * Set the YOLO recipe
 * @param {Array} recipe - Array of {id, percentage}
 * @param {Set|null} preserveLockedIndices - Set of locked indices to preserve (null to reset)
 */
export function setYoloRecipe(recipe, preserveLockedIndices = null) {
    state.yoloRecipe = recipe;
    state.yoloLockedIndices = preserveLockedIndices || new Set();
}

/** Toggle lock on a YOLO fat */
export const toggleYoloLock = createToggleLock('yoloLockedIndices');

/**
 * Remove a fat from the YOLO recipe by index
 * @param {number} index - Index to remove
 */
export function removeYoloFat(index) {
    const newRecipe = [...state.yoloRecipe];
    newRecipe.splice(index, 1);
    state.yoloRecipe = newRecipe;
    state.yoloLockedIndices = adjustIndicesAfterRemoval(state.yoloLockedIndices, index);
}

/**
 * Get locked fat IDs from YOLO recipe (locks presence, not percentage)
 * @returns {Array} Array of fat IDs that are locked
 */
export function getYoloLockedFats() {
    return state.yoloRecipe
        .filter((_, i) => state.yoloLockedIndices.has(i))
        .map(f => f.id);
}

/**
 * Clear the YOLO recipe
 */
export function clearYoloRecipe() {
    state.yoloRecipe = [];
    state.yoloLockedIndices = new Set();
}

// ============================================
// Properties Mode Methods
// ============================================

/**
 * Set properties recipe from profile builder
 * @param {Array} recipe - Array of {id, percentage}
 * @param {Set} preserveLockedIndices - Optional locked indices to preserve
 */
export function setPropertiesRecipe(recipe, preserveLockedIndices = null) {
    state.propertiesRecipe = recipe;
    state.propertiesLockedIndices = preserveLockedIndices || new Set();
}

/** Toggle lock on a properties mode fat */
export const togglePropertiesLock = createToggleLock('propertiesLockedIndices');

/**
 * Get locked fats from properties recipe
 * @returns {Array} Array of {id, percentage} for locked fats
 */
export function getPropertiesLockedFats() {
    return [...state.propertiesLockedIndices]
        .filter(i => i < state.propertiesRecipe.length)
        .map(i => state.propertiesRecipe[i]);
}

/**
 * Clear properties recipe
 */
export function clearPropertiesRecipe() {
    state.propertiesRecipe = [];
    state.propertiesLockedIndices = new Set();
}

// ============================================
// Cupboard Cleaner Methods
// ============================================

const cupboardFatMutators = createArrayMutators('cupboardFats', {
    valueField: 'weight',
    defaultValue: DEFAULTS.FAT_WEIGHT,
    locksKey: 'cupboardLocks'
});
export const addCupboardFat = cupboardFatMutators.add;
export const removeCupboardFat = cupboardFatMutators.remove;
export const updateCupboardFatWeight = cupboardFatMutators.update;

/**
 * Clear all cupboard fats
 */
export function clearCupboardFats() {
    state.cupboardFats = [];
    state.cupboardLocks = new Set();
    state.cupboardSuggestions = [];
}

/** Toggle lock on a cupboard fat weight */
export const toggleCupboardLock = createToggleLock('cupboardLocks');

/**
 * Set cupboard suggestions from optimizer
 * @param {Array} suggestions - Array of {id, weight, percentage}
 */
export function setCupboardSuggestions(suggestions) {
    state.cupboardSuggestions = suggestions;
}

const cupboardSuggestionMutators = createArrayMutators('cupboardSuggestions', {
    valueField: 'weight'
});
export const removeCupboardSuggestion = cupboardSuggestionMutators.remove;
export const updateCupboardSuggestionWeight = cupboardSuggestionMutators.update;

/**
 * Set whether ratio mode is allowed
 * @param {boolean} allow - Whether to allow ratio adjustments
 */
export function setAllowRatioMode(allow) {
    state.allowRatioMode = allow;
}

// ============================================
// Suggestion Exclusion Methods
// ============================================

/**
 * Add a fat to the suggestion exclusion list (YOLO and Cupboard modes)
 * @param {string} id - Fat id (kebab-case key)
 */
export function addSuggestionExclusion(id) {
    if (!id || state.suggestionExcludedFats.includes(id)) return;
    state.suggestionExcludedFats = [...state.suggestionExcludedFats, id];
}

/**
 * Clear all suggestion exclusions
 */
export function clearSuggestionExclusions() {
    state.suggestionExcludedFats = [];
}

/**
 * Get the total weight of cupboard fats
 * @returns {number} Total weight
 */
export function getCupboardTotalWeight() {
    return state.cupboardFats.reduce((sum, fat) => sum + fat.weight, 0);
}

// ============================================
// Persistence
// ============================================

const STORAGE_KEY = 'soapCalculatorState';

/**
 * Save current recipe state to localStorage
 */
export function saveState() {
    try {
        const dataToSave = {
            version: 4, // Track format version for migration
            recipe: state.recipe,
            excludedFats: state.excludedFats,
            recipeAdditives: state.recipeAdditives,
            // Cupboard cleaner state
            cupboardFats: state.cupboardFats,
            cupboardLocks: Array.from(state.cupboardLocks),
            cupboardSuggestions: state.cupboardSuggestions,
            allowRatioMode: state.allowRatioMode
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (_e) {
        // localStorage not available or full
    }
}

/**
 * Migrate old weight-based recipe to percentage-based
 * @param {Array} oldRecipe - Array of {id, weight}
 * @returns {Array} Array of {id, percentage}
 */
function migrateRecipeToPercentage(oldRecipe) {
    const totalWeight = oldRecipe.reduce((sum, fat) => sum + (fat.weight || 0), 0);
    if (totalWeight === 0) {
        return oldRecipe.map(fat => ({ id: fat.id, percentage: 0 }));
    }
    return oldRecipe.map(fat => ({
        id: fat.id,
        percentage: Math.round((fat.weight / totalWeight) * 1000) / 10 // One decimal place
    }));
}

/**
 * Restore recipe state from localStorage
 * @returns {boolean} True if state was restored
 */
export function restoreState() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);

            // Handle recipe - migrate from v1 (weight-based) to v2 (percentage-based)
            if (Array.isArray(data.recipe)) {
                if (data.version >= 2) {
                    state.recipe = data.recipe;
                } else if (data.recipe.length > 0 && 'weight' in data.recipe[0]) {
                    state.recipe = migrateRecipeToPercentage(data.recipe);
                } else {
                    state.recipe = data.recipe;
                }
                // Strip any lockedWeight left over from v3 — locking was removed in v4
                if (state.recipe.length > 0 && state.recipe.some(f => 'lockedWeight' in f)) {
                    state.recipe = state.recipe.map(({ lockedWeight: _, ...rest }) => rest);
                }
            }

            if (Array.isArray(data.excludedFats)) {
                state.excludedFats = data.excludedFats;
            }
            if (Array.isArray(data.recipeAdditives)) {
                state.recipeAdditives = data.recipeAdditives;
            }

            // Cupboard cleaner state
            if (Array.isArray(data.cupboardFats)) {
                state.cupboardFats = data.cupboardFats;
            }
            if (Array.isArray(data.cupboardLocks)) {
                state.cupboardLocks = new Set(data.cupboardLocks);
            } else if (Array.isArray(data.cupboardFatLocks)) {
                // Migrate old cupboardFatLocks to cupboardLocks
                state.cupboardLocks = new Set(data.cupboardFatLocks);
            }
            if (Array.isArray(data.cupboardSuggestions)) {
                state.cupboardSuggestions = data.cupboardSuggestions;
            }
            if (typeof data.allowRatioMode === 'boolean') {
                state.allowRatioMode = data.allowRatioMode;
            }
            return true;
        }
    } catch (_e) {
        // Invalid or unavailable localStorage
    }
    return false;
}
