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

// ============================================
// Application State
// ============================================

export const state = createReactiveState({
    // Recipe state (Select fats mode - percentage-based input)
    recipe: [],              // Array of {id, percentage, lockedWeight?}
    recipeLocks: new Set(),  // Set of indices with locked weights

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

/**
 * Add a fat to the recipe
 * @param {string} id - Fat id (kebab-case key)
 * @param {number} percentage - Initial percentage (default 10%)
 * @returns {boolean} True if added, false if already exists
 */
export function addFatToRecipe(id, percentage = DEFAULT_PERCENTAGE) {
    if (state.recipe.some(fat => fat.id === id)) {
        return false;
    }
    state.recipe = [...state.recipe, { id, percentage }];
    return true;
}

/**
 * Remove a fat from the recipe by index
 * @param {number} index - Index to remove
 */
export function removeFatFromRecipe(index) {
    const newRecipe = [...state.recipe];
    newRecipe.splice(index, 1);
    state.recipe = newRecipe;

    // Adjust lock indices
    state.recipeLocks = adjustIndicesAfterRemoval(state.recipeLocks, index);
}

/**
 * Update a fat's percentage in the recipe
 * @param {number} index - Fat index
 * @param {number} percentage - New percentage
 */
export function updateFatPercentage(index, percentage) {
    const newRecipe = [...state.recipe];
    newRecipe[index] = { ...newRecipe[index], percentage: parseFloat(percentage) || 0 };
    state.recipe = newRecipe;
}

/** Toggle lock on a recipe fat (legacy - kept for YOLO/Properties compatibility) */
export const toggleRecipeLock = createToggleLock('recipeLocks');

/**
 * Lock a recipe fat's weight (sets lockedWeight on the recipe item)
 * @param {number} index - Fat index
 * @param {number} weight - Weight to lock at
 */
export function lockFatWeight(index, weight) {
    const newRecipe = [...state.recipe];
    newRecipe[index] = { ...newRecipe[index], lockedWeight: weight };
    state.recipe = newRecipe;

    const newLocks = new Set(state.recipeLocks);
    newLocks.add(index);
    state.recipeLocks = newLocks;
}

/**
 * Unlock a recipe fat's weight (removes lockedWeight from the recipe item)
 * @param {number} index - Fat index
 */
export function unlockFatWeight(index) {
    const newRecipe = [...state.recipe];
    const { lockedWeight: _, ...rest } = newRecipe[index];
    newRecipe[index] = rest;
    state.recipe = newRecipe;

    const newLocks = new Set(state.recipeLocks);
    newLocks.delete(index);
    state.recipeLocks = newLocks;
}

/**
 * Update a locked recipe fat's weight
 * @param {number} index - Fat index
 * @param {number} weight - New weight
 */
export function updateLockedWeight(index, weight) {
    const newRecipe = [...state.recipe];
    newRecipe[index] = { ...newRecipe[index], lockedWeight: parseFloat(weight) || 0 };
    state.recipe = newRecipe;
}

/**
 * Clear the entire recipe
 */
export function clearRecipe() {
    state.recipe = [];
    state.recipeLocks = new Set();
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

/**
 * Add an additive to the recipe
 * @param {string} id - Additive id (kebab-case key)
 * @param {number} weight - Weight in current unit (default from DEFAULTS.ADDITIVE_WEIGHT)
 * @returns {boolean} True if added, false if already exists
 */
export function addAdditiveToRecipe(id, weight = DEFAULTS.ADDITIVE_WEIGHT) {
    if (state.recipeAdditives.some(a => a.id === id)) {
        return false;
    }
    state.recipeAdditives = [...state.recipeAdditives, { id, weight }];
    return true;
}

/**
 * Remove an additive from the recipe by index
 * @param {number} index - Index to remove
 */
export function removeAdditiveFromRecipe(index) {
    const newAdditives = [...state.recipeAdditives];
    newAdditives.splice(index, 1);
    state.recipeAdditives = newAdditives;
}

/**
 * Update an additive's weight in the recipe
 * @param {number} index - Additive index
 * @param {number} weight - New weight
 */
export function updateAdditiveWeight(index, weight) {
    const newAdditives = [...state.recipeAdditives];
    newAdditives[index] = { ...newAdditives[index], weight: parseFloat(weight) || 0 };
    state.recipeAdditives = newAdditives;
}

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

/**
 * Add a fat to the cupboard
 * @param {string} id - Fat id (kebab-case key)
 * @param {number} weight - Weight in grams
 * @returns {boolean} True if added, false if already exists
 */
export function addCupboardFat(id, weight = DEFAULTS.FAT_WEIGHT) {
    if (state.cupboardFats.some(fat => fat.id === id)) {
        return false;
    }
    state.cupboardFats = [...state.cupboardFats, { id, weight }];
    return true;
}

/**
 * Remove a fat from the cupboard by index
 * @param {number} index - Index to remove
 */
export function removeCupboardFat(index) {
    const newFats = [...state.cupboardFats];
    newFats.splice(index, 1);
    state.cupboardFats = newFats;
    state.cupboardLocks = adjustIndicesAfterRemoval(state.cupboardLocks, index);
}

/**
 * Update a cupboard fat's weight
 * @param {number} index - Fat index
 * @param {number} weight - New weight
 */
export function updateCupboardFatWeight(index, weight) {
    const newFats = [...state.cupboardFats];
    newFats[index] = { ...newFats[index], weight: parseFloat(weight) || 0 };
    state.cupboardFats = newFats;
}

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

/**
 * Remove a suggestion from the cupboard suggestions by index
 * @param {number} index - Index to remove
 */
export function removeCupboardSuggestion(index) {
    const newSuggestions = [...state.cupboardSuggestions];
    newSuggestions.splice(index, 1);
    state.cupboardSuggestions = newSuggestions;
}

/**
 * Update a cupboard suggestion's weight
 * @param {number} index - Suggestion index
 * @param {number} weight - New weight
 */
export function updateCupboardSuggestionWeight(index, weight) {
    const newSuggestions = [...state.cupboardSuggestions];
    const newWeight = parseFloat(weight) || 0;
    newSuggestions[index] = { ...newSuggestions[index], weight: newWeight };
    state.cupboardSuggestions = newSuggestions;
}

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
            version: 3, // Track format version for migration
            recipe: state.recipe,
            recipeLocks: Array.from(state.recipeLocks),
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
                    // Already in new format
                    state.recipe = data.recipe;
                } else if (data.recipe.length > 0 && 'weight' in data.recipe[0]) {
                    // Old format - migrate
                    state.recipe = migrateRecipeToPercentage(data.recipe);
                } else {
                    state.recipe = data.recipe;
                }
            }

            // Handle locks - migrate old names to new
            // v3 changed lock semantics from percentage to weight, so clear locks from v2
            if (data.version >= 3 && Array.isArray(data.recipeLocks)) {
                state.recipeLocks = new Set(data.recipeLocks);
            } else {
                // v2 or earlier: clear locks (semantics changed)
                state.recipeLocks = new Set();
                // Also strip any stale lockedWeight from recipe items
                if (state.recipe.length > 0) {
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
