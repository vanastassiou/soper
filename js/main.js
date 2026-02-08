/**
 * Main application entry point
 * Orchestrates state, data loading, and event binding
 */

import * as calc from './core/calculator.js';
import * as optimizer from './core/optimizer.js';
import { ADDITIVE_CATEGORIES, ADDITIVE_WARNING_TYPES, CSS_CLASSES, DEFAULTS, ELEMENT_IDS, getWeightLabel, PROPERTY_KEYS, PROPERTY_RANGES, UI_MESSAGES, VOLUME } from './lib/constants.js';
import * as validation from './lib/validation.js';
import {
    addAdditiveToRecipe, addExclusion, addFatToRecipe, clearRecipe,
    clearYoloRecipe, clearCupboardFats,
    getYoloLockedFats, removeAdditiveFromRecipe, removeExclusion,
    removeFatFromRecipe, removeYoloFat, restoreState, saveState,
    setYoloRecipe, state, toggleRecipeLock, updateFatPercentage,
    toggleYoloLock, updateAdditiveWeight, getTotalPercentage,
    lockFatWeight, unlockFatWeight, updateLockedWeight,
    // Properties mode state functions
    setPropertiesRecipe, togglePropertiesLock, getPropertiesLockedFats, clearPropertiesRecipe,
    // Cupboard cleaner state functions
    addCupboardFat, removeCupboardFat, updateCupboardFatWeight,
    toggleCupboardLock, setCupboardSuggestions,
    removeCupboardSuggestion, updateCupboardSuggestionWeight, setAllowRatioMode,
    // Suggestion exclusion functions
    addSuggestionExclusion, clearSuggestionExclusions
} from './state/state.js';
import { attachRowEventHandlers, renderItemRow } from './ui/components/itemRow.js';
import { toast } from './ui/components/toast.js';
import { $, enableTabArrowNavigation, setVisibility } from './ui/helpers.js';
import * as ui from './ui/ui.js';

// ============================================
// Shared Handlers
// ============================================

/**
 * Create a fat info handler for a specific recipe context
 * @param {Function} getRecipe - Function that returns the relevant recipe array
 * @returns {Function} Handler function that shows fat info with proper fatty acid context
 */
function createFatInfoHandler(getRecipe) {
    return (fatId) => {
        if (fatId && state.fatsDatabase[fatId]) {
            ui.showFatInfo(fatId, state.fatsDatabase, state.fattyAcidsData, state.sourcesData, (acidKey) => {
                ui.showFattyAcidInfo(acidKey, state.fattyAcidsData, getRecipe(), state.fatsDatabase, state.sourcesData);
            });
        }
    };
}

/**
 * Update all property displays with values from a properties object
 * @param {Object} properties - Object with property values (hardness, degreasing, etc.)
 */
function applyPropertyUpdates(properties) {
    PROPERTY_KEYS.forEach(key => {
        const range = PROPERTY_RANGES[key];
        ui.updateProperty(key, properties[key], range.min, range.max);
    });
}

// ============================================
// Data Loading
// ============================================

async function loadData() {
    try {
        // Additive databases (4 separate files by category)
        const additiveFiles = ['fragrances', 'colourants', 'soap-performance', 'skin-care'];

        const [fatsResponse, glossaryResponse, fattyAcidsResponse, tooltipsResponse, sourcesResponse, formulasResponse,
               ...additiveResponses] = await Promise.all([
            fetch('./data/fats.json'),
            fetch('./data/glossary.json'),
            fetch('./data/fatty-acids.json'),
            fetch('./data/tooltips.json'),
            fetch('./data/sources.json'),
            fetch('./data/formulas.json'),
            ...additiveFiles.map(f => fetch(`./data/${f}.json`))
        ]);

        const [fatsSchemaResponse, glossarySchemaResponse, fattyAcidsSchemaResponse, tooltipsSchemaResponse, sourcesSchemaResponse, formulasSchemaResponse,
               commonDefinitionsSchemaResponse, ...additiveSchemaResponses] = await Promise.all([
            fetch('./data/schemas/fats.schema.json'),
            fetch('./data/schemas/glossary.schema.json'),
            fetch('./data/schemas/fatty-acids.schema.json'),
            fetch('./data/schemas/tooltips.schema.json'),
            fetch('./data/schemas/sources.schema.json'),
            fetch('./data/schemas/formulas.schema.json'),
            fetch('./data/schemas/common-definitions.schema.json'),
            ...additiveFiles.map(f => fetch(`./data/schemas/${f}.schema.json`))
        ]);

        state.fatsDatabase = await fatsResponse.json();
        state.glossaryData = await glossaryResponse.json();
        state.fattyAcidsData = await fattyAcidsResponse.json();
        state.tooltipsData = await tooltipsResponse.json();
        state.sourcesData = await sourcesResponse.json();
        state.formulasData = await formulasResponse.json();

        // Load additive databases into state
        const additiveData = await Promise.all(additiveResponses.map(r => r.json()));
        state.fragrancesDatabase = additiveData[0];
        state.colourantsDatabase = additiveData[1];
        state.soapPerformanceDatabase = additiveData[2];
        state.skinCareDatabase = additiveData[3];

        const additiveSchemas = await Promise.all(additiveSchemaResponses.map(r => r.json()));
        const schemas = {
            fats: await fatsSchemaResponse.json(),
            glossary: await glossarySchemaResponse.json(),
            fattyAcids: await fattyAcidsSchemaResponse.json(),
            tooltips: await tooltipsSchemaResponse.json(),
            sources: await sourcesSchemaResponse.json(),
            formulas: await formulasSchemaResponse.json(),
            commonDefinitions: await commonDefinitionsSchemaResponse.json(),
            fragrances: additiveSchemas[0],
            colourants: additiveSchemas[1],
            soapPerformance: additiveSchemas[2],
            skinCare: additiveSchemas[3]
        };

        validation.initValidation(schemas);
        validation.validateAllStrict({
            fats: state.fatsDatabase,
            glossary: state.glossaryData,
            fattyAcids: state.fattyAcidsData,
            tooltips: state.tooltipsData,
            sources: state.sourcesData,
            formulas: state.formulasData,
            fragrances: state.fragrancesDatabase,
            colourants: state.colourantsDatabase,
            soapPerformance: state.soapPerformanceDatabase,
            skinCare: state.skinCareDatabase
        });
    } catch (error) {
        console.error('Error loading or validating data:', error);
        document.body.innerHTML = `
            <div style="color: #ff6b6b; padding: 40px; font-family: monospace; background: #1a1a2e;">
                <h1 style="color: #ff6b6b;">Data Loading Error</h1>
                <pre style="white-space: pre-wrap; margin-top: 20px;">${error.message}</pre>
            </div>
        `;
        throw error;
    }
}

// ============================================
// Calculations
// ============================================

function calculate() {
    const settings = ui.getSettings();
    const recipe = state.recipe;
    const fatsDatabase = state.fatsDatabase;

    // Convert percentage-based recipe to weights for calculations
    const recipeAsWeights = recipe.map(fat => ({
        id: fat.id,
        weight: fat.percentage  // Use percentage as weight (total=100%)
    }));

    const fa = calc.calculateFattyAcids(recipeAsWeights, fatsDatabase);
    const iodine = calc.calculateIodine(recipeAsWeights, fatsDatabase);
    const ins = calc.calculateINS(recipeAsWeights, fatsDatabase);
    const properties = calc.calculateProperties(fa);

    applyPropertyUpdates({ ...properties, iodine, ins });

    // Render additives
    renderAdditivesList();
}

function renderRecipeList() {
    const container = $(ELEMENT_IDS.recipeFats);
    const useFatsAction = $(ELEMENT_IDS.useFatsAction);
    const settings = ui.getSettings();

    ui.renderRecipe(container, state.recipe, state.recipeLocks, state.fatsDatabase, {
        onPercentageChange: handlePercentageChange,
        onWeightChange: handleRecipeWeightCellChange,
        onToggleLock: handleToggleRecipeLock,
        onRemove: handleRemoveFat,
        onFatInfo: createFatInfoHandler(() => state.recipe)
    }, settings.recipeWeight, getWeightLabel(settings.unit));

    // Show/hide "Use these fats" button based on recipe content
    setVisibility(useFatsAction, state.recipe.length > 0);
}

function renderAdditivesList() {
    const container = $(ELEMENT_IDS.recipeAdditives);
    if (!container) return [];

    const settings = ui.getSettings();
    const totalFatWeight = settings.recipeWeight;
    const allAdditives = getAllAdditivesDatabase();

    return ui.renderAdditives(
        container,
        state.recipeAdditives,
        allAdditives,
        totalFatWeight,
        getWeightLabel(settings.unit),
        {
            onWeightChange: handleAdditiveWeightChange,
            onRemove: handleRemoveAdditive,
            onInfo: (additiveId) => ui.showAdditiveInfo(additiveId, allAdditives, state.sourcesData)
        }
    );
}

/**
 * Convert additive warnings to recipe note format
 * @param {Array} notes - Existing recipe notes
 * @param {Array} warnings - Additive warnings from renderAdditives
 * @returns {Array} Merged notes array
 */
function mergeAdditiveWarningsIntoNotes(notes, warnings) {
    if (!warnings || warnings.length === 0) return notes;

    const warningNotes = warnings.map(warning => {
        let noteType = 'info';
        let icon = '⚠️';

        if (warning.type === ADDITIVE_WARNING_TYPES.DANGER) {
            noteType = 'warning';
            icon = '🚫';
        } else if (warning.type === ADDITIVE_WARNING_TYPES.WARNING) {
            noteType = 'warning';
            icon = '⚠️';
        }

        return {
            type: noteType,
            icon,
            text: `${warning.additiveName}: ${warning.message}`
        };
    });

    return [...warningNotes, ...notes];
}

// ============================================
// Event Handlers
// ============================================

function handleAddFat() {
    const select = $(ELEMENT_IDS.fatSelect);
    const fatId = select.value;

    if (!fatId) return;

    if (!addFatToRecipe(fatId)) {
        toast.warning(UI_MESSAGES.FAT_ALREADY_EXISTS);
        return;
    }

    renderRecipeList();
    updateFatSelectWithFilters();
    calculate();
}

function handleRemoveFat(index) {
    removeFatFromRecipe(index);
    renderRecipeList();
    updateFatSelectWithFilters();
    calculate();
}

function handlePercentageChange(index, percentage) {
    updateFatPercentage(index, percentage);
    calculate();
}

function handleToggleRecipeLock(index) {
    if (state.recipeLocks.has(index)) {
        unlockFatWeight(index);
    } else {
        const settings = ui.getSettings();
        const weight = settings.recipeWeight * state.recipe[index].percentage / 100;
        lockFatWeight(index, weight);
    }
    renderRecipeList();
}

function handleRecipeWeightCellChange(index, value) {
    const weight = parseFloat(value) || 0;
    updateLockedWeight(index, weight);
    // Recalculate percentage from locked weight
    const settings = ui.getSettings();
    const recipeWeight = settings.recipeWeight;
    const newPercentage = recipeWeight > 0 ? (weight / recipeWeight) * 100 : 0;
    updateFatPercentage(index, newPercentage);
    calculate();
}

function handleRecipeWeightSettingChange() {
    const settings = ui.getSettings();
    const newRecipeWeight = settings.recipeWeight;

    // Recalculate percentages for locked fats (their weight stays fixed)
    if (state.recipeLocks.size > 0 && newRecipeWeight > 0) {
        const newRecipe = [...state.recipe];
        let changed = false;
        for (const lockedIndex of state.recipeLocks) {
            const fat = newRecipe[lockedIndex];
            if (fat?.lockedWeight != null) {
                const newPercentage = (fat.lockedWeight / newRecipeWeight) * 100;
                newRecipe[lockedIndex] = { ...fat, percentage: newPercentage };
                changed = true;
            }
        }
        if (changed) {
            state.recipe = newRecipe;
        }
    }

    renderRecipeList();
    calculate();
}

function handleStartOver() {
    // Check if there's anything to clear
    const hasData = state.recipe.length > 0 ||
        state.recipeAdditives.length > 0 ||
        state.yoloRecipe.length > 0 ||
        state.propertiesRecipe.length > 0 ||
        state.cupboardFats.length > 0 ||
        state.excludedFats.length > 0;

    if (!hasData) return;

    const confirmed = confirm('This will clear all fats, additives, and settings. Continue?');
    if (!confirmed) return;

    // Clear all state
    clearRecipe();
    clearYoloRecipe();
    clearPropertiesRecipe();
    clearCupboardFats();
    state.recipeAdditives = [];
    state.excludedFats = [];
    lastTargetProfile = null;

    // Reset settings to defaults
    const lyeType = $(ELEMENT_IDS.lyeType);
    const superfat = $(ELEMENT_IDS.superfat);
    const waterRatio = $(ELEMENT_IDS.waterRatio);
    const unit = $(ELEMENT_IDS.unit);
    const recipeWeight = $(ELEMENT_IDS.recipeWeight);
    if (lyeType) lyeType.value = 'NaOH';
    if (superfat) superfat.value = '5';
    if (waterRatio) waterRatio.value = '2';
    if (unit) unit.value = 'g';
    if (recipeWeight) recipeWeight.value = String(DEFAULTS.BASE_RECIPE_WEIGHT);
    previousUnit = 'g';

    // Reset dietary filters
    const filterAnimal = $(ELEMENT_IDS.filterAnimalBased);
    const filterSourcing = $(ELEMENT_IDS.filterSourcingConcerns);
    const filterAllergens = $(ELEMENT_IDS.filterCommonAllergens);
    const includeExotic = $(ELEMENT_IDS.includeExoticFats);
    if (filterAnimal) filterAnimal.checked = false;
    if (filterSourcing) filterSourcing.checked = false;
    if (filterAllergens) filterAllergens.checked = false;
    if (includeExotic) includeExotic.checked = false;

    // Update UI
    renderRecipeList();
    renderYoloRecipe();
    renderAdditivesList();
    updateExclusionUI();
    ui.hideProfileResults();

    // Reset button texts
    const generateBtn = $(ELEMENT_IDS.generateRecipeBtn);
    const yoloBtn = $(ELEMENT_IDS.yoloBtn);
    if (generateBtn) generateBtn.textContent = 'Generate';
    if (yoloBtn) yoloBtn.textContent = 'Surprise me!';

    calculate();
}

function handleResetSettings() {
    // Reset settings to defaults
    const lyeType = $(ELEMENT_IDS.lyeType);
    const superfat = $(ELEMENT_IDS.superfat);
    const waterRatio = $(ELEMENT_IDS.waterRatio);
    const unit = $(ELEMENT_IDS.unit);
    const recipeWeight = $(ELEMENT_IDS.recipeWeight);
    if (lyeType) lyeType.value = 'NaOH';
    if (superfat) superfat.value = '5';
    if (waterRatio) waterRatio.value = '2';
    if (unit) unit.value = 'g';
    if (recipeWeight) recipeWeight.value = String(DEFAULTS.BASE_RECIPE_WEIGHT);
    previousUnit = 'g';

    // Reset dietary filters
    const filterAnimal = $(ELEMENT_IDS.filterAnimalBased);
    const filterSourcing = $(ELEMENT_IDS.filterSourcingConcerns);
    const filterAllergens = $(ELEMENT_IDS.filterCommonAllergens);
    const includeExotic = $(ELEMENT_IDS.includeExoticFats);
    if (filterAnimal) filterAnimal.checked = false;
    if (filterSourcing) filterSourcing.checked = false;
    if (filterAllergens) filterAllergens.checked = false;
    if (includeExotic) includeExotic.checked = false;

    // Clear exclusions
    state.excludedFats = [];
    updateExclusionUI();
    updateFatSelectWithFilters();
    calculate();
}

function handleResetFats() {
    // Clear fats for the current mode
    clearModeData(currentBuildMode);
}

function handleResetAdditives() {
    state.recipeAdditives = [];
    renderAdditivesList();
    calculate();
}

function handleResetFilters() {
    // Clear dietary filter checkboxes
    const filterAnimal = $(ELEMENT_IDS.filterAnimalBased);
    const filterSourcing = $(ELEMENT_IDS.filterSourcingConcerns);
    const filterAllergens = $(ELEMENT_IDS.filterCommonAllergens);
    const includeExotic = $(ELEMENT_IDS.includeExoticFats);
    if (filterAnimal) filterAnimal.checked = false;
    if (filterSourcing) filterSourcing.checked = false;
    if (filterAllergens) filterAllergens.checked = false;
    if (includeExotic) includeExotic.checked = false;

    // Clear excluded fats list
    state.excludedFats = [];

    // Update UI
    updateExclusionUI();
    updateFatSelectWithFilters();
}

function handleUnitChange() {
    const unitSelect = $(ELEMENT_IDS.unit);
    const recipeWeightInput = $(ELEMENT_IDS.recipeWeight);
    const newUnit = unitSelect?.value || 'metric';

    // Convert recipe weight if unit changed
    if (recipeWeightInput && previousUnit !== newUnit) {
        const currentWeight = parseFloat(recipeWeightInput.value) || 0;
        let convertedWeight;
        let conversionFactor = 1;

        if (previousUnit === 'metric' && newUnit === 'imperial') {
            // Grams to ounces
            conversionFactor = 1 / VOLUME.G_PER_OZ;
        } else if (previousUnit === 'imperial' && newUnit === 'metric') {
            // Ounces to grams
            conversionFactor = VOLUME.G_PER_OZ;
        }

        convertedWeight = currentWeight * conversionFactor;

        // Round to reasonable precision
        recipeWeightInput.value = newUnit === 'imperial'
            ? convertedWeight.toFixed(1)
            : Math.round(convertedWeight);

        // Convert locked weights in recipe items
        if (conversionFactor !== 1 && state.recipeLocks.size > 0) {
            const newRecipe = [...state.recipe];
            let changed = false;
            for (const lockedIndex of state.recipeLocks) {
                const fat = newRecipe[lockedIndex];
                if (fat?.lockedWeight != null) {
                    newRecipe[lockedIndex] = { ...fat, lockedWeight: fat.lockedWeight * conversionFactor };
                    changed = true;
                }
            }
            if (changed) {
                state.recipe = newRecipe;
            }
        }
    }

    previousUnit = newUnit;
    renderRecipeList();
    renderAdditivesList();
    calculate();
}

function handleAddExclusion() {
    const select = $(ELEMENT_IDS.excludeIngredientSelect);
    if (select.value) {
        addExclusion(select.value);
        updateExclusionUI();
        updateFatSelectWithFilters();
        updateAdditiveSelect();
    }
}

function handleRemoveExclusion(id) {
    removeExclusion(id);
    updateExclusionUI();
    updateFatSelectWithFilters();
    updateAdditiveSelect();
}

function updateExclusionUI() {
    const excludeSelect = $(ELEMENT_IDS.excludeIngredientSelect);
    const allDatabases = getAllIngredientDatabases();
    ui.populateExcludeIngredientSelect(excludeSelect, allDatabases, state.excludedFats);
    ui.renderExcludedIngredients(state.excludedFats, allDatabases, handleRemoveExclusion);
    excludeSelect.value = '';
}

/**
 * Get all ingredient databases for exclusion filtering
 * @returns {Object} Object containing all ingredient databases
 */
function getAllIngredientDatabases() {
    return {
        fats: state.fatsDatabase,
        fragrances: state.fragrancesDatabase,
        colourants: state.colourantsDatabase,
        soapPerformance: state.soapPerformanceDatabase,
        skinCare: state.skinCareDatabase
    };
}

// ============================================
// Additive Event Handlers
// ============================================

let currentAdditiveCategory = ADDITIVE_CATEGORIES.FRAGRANCE;

/**
 * Mapping from category to state database property
 */
const ADDITIVE_DATABASES = {
    [ADDITIVE_CATEGORIES.FRAGRANCE]: 'fragrancesDatabase',
    [ADDITIVE_CATEGORIES.COLOURANT]: 'colourantsDatabase',
    [ADDITIVE_CATEGORIES.SOAP_PERFORMANCE]: 'soapPerformanceDatabase',
    [ADDITIVE_CATEGORIES.SKIN_CARE]: 'skinCareDatabase'
};

/**
 * Get the database for a specific additive category
 * @param {string} category - The category (fragrance, colourant, soap-performance, skin-care)
 * @returns {Object} The appropriate database
 */
function getAdditiveDatabaseForCategory(category) {
    const dbName = ADDITIVE_DATABASES[category];
    return dbName ? state[dbName] : {};
}

/**
 * Get combined database for looking up any additive by ID
 * @returns {Object} Combined database of all additives
 */
function getAllAdditivesDatabase() {
    return {
        ...state.fragrancesDatabase,
        ...state.colourantsDatabase,
        ...state.soapPerformanceDatabase,
        ...state.skinCareDatabase
    };
}

function handleAddAdditive() {
    const select = $(ELEMENT_IDS.additiveSelect);
    const additiveId = select.value;

    if (!additiveId) return;
    if (!addAdditiveToRecipe(additiveId)) {
        toast.warning(UI_MESSAGES.ADDITIVE_ALREADY_EXISTS);
        return;
    }

    updateAdditiveSelect();
    calculate();
    select.value = '';
}

function handleRemoveAdditive(index) {
    removeAdditiveFromRecipe(index);
    updateAdditiveSelect();
    calculate();
}

function handleAdditiveWeightChange(index, weight) {
    updateAdditiveWeight(index, weight);
    calculate();
}

function switchAdditiveCategory(category) {
    currentAdditiveCategory = category;
    updateTabStates('.additive-tab', 'category', category);
    updateAdditiveSelect();
}

function updateAdditiveSelect() {
    const select = $(ELEMENT_IDS.additiveSelect);
    if (!select) return;

    const existingIds = state.recipeAdditives.map(a => a.id);
    const database = getAdditiveDatabaseForCategory(currentAdditiveCategory);
    const filterFn = createDietaryFilterFn();
    ui.populateAdditiveSelect(select, database, existingIds, filterFn);
}

// ============================================
// Dietary Filters
// ============================================

/**
 * Get the current dietary filter selections from the UI
 * @returns {Object} {animalBased, sourcingConcerns, commonAllergens, includeExoticFats}
 */
function getDietaryFilters() {
    return {
        animalBased: $(ELEMENT_IDS.filterAnimalBased)?.checked || false,
        sourcingConcerns: $(ELEMENT_IDS.filterSourcingConcerns)?.checked || false,
        commonAllergens: $(ELEMENT_IDS.filterCommonAllergens)?.checked || false,
        includeExoticFats: $(ELEMENT_IDS.includeExoticFats)?.checked || false
    };
}

/**
 * Check if an ingredient has significant ethical concerns
 * Significant = any social/political concerns, or 2+ environmental concerns
 * @param {Object} data - Ingredient data object
 * @returns {boolean} True if significant concerns exist
 */
function hasSignificantEthicalConcerns(data) {
    const concerns = data.ethicalConcerns;
    if (!concerns) return false;

    const environmental = concerns.environmental || [];
    const social = concerns.social || [];
    const political = concerns.political || [];

    // Any social or political concerns are significant
    if (social.length > 0 || political.length > 0) return true;
    // Multiple environmental concerns are significant
    if (environmental.length >= 2) return true;

    return false;
}

/**
 * Create a filter function based on current dietary filter settings and manual exclusions
 * Applies to all ingredient types (fats, colourants, fragrances, etc.)
 * @returns {Function|null} Filter function or null if no filters active
 */
function createDietaryFilterFn() {
    const filters = getDietaryFilters();
    const manualExclusions = new Set(state.excludedFats);
    const hasFilters = filters.animalBased || filters.sourcingConcerns || filters.commonAllergens;
    const hasExclusions = manualExclusions.size > 0;
    // Exotic fats are excluded by default (unless includeExoticFats is checked)
    const excludeExotic = !filters.includeExoticFats;

    if (!hasFilters && !hasExclusions && !excludeExotic) {
        return null;
    }

    return (id, data) => {
        // Check manual exclusions first
        if (manualExclusions.has(id)) return false;

        // Check dietary filters
        const dietary = data.dietary || {};
        if (filters.animalBased && dietary.animalBased === true) return false;
        if (filters.sourcingConcerns && hasSignificantEthicalConcerns(data)) return false;
        if (filters.commonAllergens && dietary.commonAllergen === true) return false;
        // Exotic fats: exclude when NOT checked (opposite of other filters)
        if (excludeExotic && dietary.isExotic === true) return false;
        return true;
    };
}

/**
 * Repopulate fat select dropdown with current dietary filters applied
 */
function updateFatSelectWithFilters() {
    const filterFn = createDietaryFilterFn();
    const existingIds = state.recipe.map(f => f.id);
    ui.populateFatSelect($(ELEMENT_IDS.fatSelect), state.fatsDatabase, existingIds, filterFn);

    // Also update exclude ingredient select
    const allDatabases = getAllIngredientDatabases();
    ui.populateExcludeIngredientSelect($(ELEMENT_IDS.excludeIngredientSelect), allDatabases, state.excludedFats);
}

/**
 * Get combined exclusions from manual exclusions and dietary filters
 * @returns {Array} Array of fat IDs to exclude
 */
function getCombinedExclusions() {
    const dietaryFilters = getDietaryFilters();
    const dietaryExclusions = optimizer.getDietaryExclusions(state.fatsDatabase, dietaryFilters);
    return [...state.excludedFats, ...state.suggestionExcludedFats, ...dietaryExclusions];
}

// ============================================
// Profile Builder
// ============================================

// Store last target profile for re-rendering
let lastTargetProfile = null;

function handleGenerateFromProfile() {
    const propertyTargets = ui.getPropertyTargets();

    const validationError = optimizer.validatePropertyTargets(propertyTargets);
    if (validationError) {
        toast.error(validationError);
        return;
    }

    const targetProfile = optimizer.propertiesToFattyAcidTargets(propertyTargets);

    if (Object.keys(targetProfile).length === 0) {
        toast.info(UI_MESSAGES.ENTER_PROPERTY_TARGET);
        return;
    }

    lastTargetProfile = targetProfile;

    const lockedFats = getPropertiesLockedFats();
    const excludedFats = getCombinedExclusions();
    const options = ui.getProfileBuilderOptions(excludedFats);
    options.lockedFats = lockedFats;

    const result = optimizer.findFatsForProfile(targetProfile, state.fatsDatabase, options);

    if (result.recipe.length === 0) {
        toast.warning(UI_MESSAGES.NO_FAT_COMBINATION);
        return;
    }

    // Store recipe in state and preserve locks for locked fats
    const newLockedIndices = new Set();
    lockedFats.forEach(lockedFat => {
        const newIndex = result.recipe.findIndex(f => f.id === lockedFat.id);
        if (newIndex !== -1) {
            newLockedIndices.add(newIndex);
        }
    });
    setPropertiesRecipe(result.recipe, newLockedIndices);

    renderPropertiesResults(result, targetProfile);

    // Change button text to "Re-roll" after first generation
    const generateBtn = $(ELEMENT_IDS.generateRecipeBtn);
    if (generateBtn) generateBtn.textContent = 'Re-roll';
}

function renderPropertiesResults(result, targetProfile) {
    ui.renderProfileResults(result, targetProfile, state.fatsDatabase, state.propertiesLockedIndices, {
        onUseRecipe: handleUseGeneratedRecipe,
        onFatInfo: createFatInfoHandler(() => state.propertiesRecipe),
        onToggleLock: handleTogglePropertiesLock
    });
}

function handleTogglePropertiesLock(index) {
    togglePropertiesLock(index);
    // Re-render with updated locks
    if (state.propertiesRecipe.length > 0 && lastTargetProfile) {
        // Reconstruct result object for re-render
        const result = {
            recipe: state.propertiesRecipe,
            matchQuality: 100, // Preserve current display
            achieved: {}
        };
        renderPropertiesResults(result, lastTargetProfile);
    }
}

function handleUseGeneratedRecipe(generatedRecipe) {
    // Transfer percentages directly to main recipe
    state.recipe = generatedRecipe.map(fat => ({
        id: fat.id,
        percentage: fat.percentage
    }));
    state.recipeLocks = new Set();

    switchBuildMode('fats', true); // Skip warning - intentionally transferring recipe
    renderRecipeList();
    updateFatSelectWithFilters();
    calculate();

    $(ELEMENT_IDS.recipeFats).scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// Tab/Mode Switching
// ============================================

let currentBuildMode = 'fats';
let previousUnit = 'g'; // Track for unit conversion

function updateTabStates(tabSelector, dataAttr, activeValue) {
    document.querySelectorAll(tabSelector).forEach(tab => {
        const isActive = tab.dataset[dataAttr] === activeValue;
        tab.classList.toggle('active', isActive);
        // Update ARIA selected state for accessibility
        if (tab.hasAttribute('role') && tab.getAttribute('role') === 'tab') {
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        }
    });
}

/**
 * Check if a mode has data that would be lost on switch
 * @param {string} mode - Mode to check
 * @returns {boolean} True if mode has data
 */
function modeHasData(mode) {
    switch (mode) {
        case 'fats':
            return state.recipe.length > 0;
        case 'properties':
            return state.propertiesRecipe.length > 0;
        case 'yolo':
            return state.yoloRecipe.length > 0;
        case 'cupboard':
            return state.cupboardFats.length > 0 || state.cupboardSuggestions.length > 0;
        default:
            return false;
    }
}

/**
 * Clear data for a mode
 * @param {string} mode - Mode to clear
 */
function clearModeData(mode) {
    switch (mode) {
        case 'fats':
            clearRecipe();
            renderRecipeList();
            updateFatSelectWithFilters();
            break;
        case 'properties':
            clearPropertiesRecipe();
            lastTargetProfile = null;
            ui.hideProfileResults();
            // Reset button text
            const generateBtn = $(ELEMENT_IDS.generateRecipeBtn);
            if (generateBtn) generateBtn.textContent = 'Generate';
            break;
        case 'yolo':
            clearYoloRecipe();
            clearSuggestionExclusions();
            renderYoloRecipe();
            // Reset button text
            const yoloBtn = $(ELEMENT_IDS.yoloBtn);
            if (yoloBtn) yoloBtn.textContent = 'Surprise me!';
            break;
        case 'cupboard':
            clearCupboardFats();
            clearSuggestionExclusions();
            renderCupboardFatsList();
            renderCupboardSuggestionsList();
            // Reset select options
            const cupboardSelect = $(ELEMENT_IDS.cupboardFatSelect);
            if (cupboardSelect) {
                ui.populateCupboardFatSelect(cupboardSelect, state.fatsDatabase, []);
            }
            // Reset button text
            const cupboardBtn = $(ELEMENT_IDS.cupboardCleanerBtn);
            if (cupboardBtn) cupboardBtn.textContent = 'Get suggestions';
            break;
    }
    calculate();
}

function switchBuildMode(mode, skipWarning = false) {
    // If switching to same mode, do nothing
    if (mode === currentBuildMode) return;

    // Check if current mode has data that would be lost
    if (!skipWarning && modeHasData(currentBuildMode)) {
        const confirmed = confirm('Switching modes will clear your current entries. Continue?');
        if (!confirmed) return;
        clearModeData(currentBuildMode);
    }

    // Reset Generate button text when leaving properties mode
    if (currentBuildMode === 'properties') {
        const generateBtn = $(ELEMENT_IDS.generateRecipeBtn);
        if (generateBtn) generateBtn.textContent = 'Generate';
    }

    currentBuildMode = mode;
    updateTabStates('.build-mode-tab', 'mode', mode);

    // Show/hide mode panels
    $(ELEMENT_IDS.selectFatsMode).classList.toggle('hidden', mode !== 'fats');
    $(ELEMENT_IDS.specifyPropertiesMode).classList.toggle('hidden', mode !== 'properties');
    $(ELEMENT_IDS.yoloMode)?.classList.toggle('hidden', mode !== 'yolo');
    $(ELEMENT_IDS.cupboardCleanerMode)?.classList.toggle('hidden', mode !== 'cupboard');

    // Show/hide mode descriptions
    $('fatsDescription')?.classList.toggle('hidden', mode !== 'fats');
    $('propertiesDescription')?.classList.toggle('hidden', mode !== 'properties');
    $('yoloDescription')?.classList.toggle('hidden', mode !== 'yolo');
    $('cupboardDescription')?.classList.toggle('hidden', mode !== 'cupboard');

    ui.hideProfileResults();

    // Update properties display for the new mode
    updatePropertiesForMode(mode);
}

/**
 * Update properties display based on current mode's data
 * @param {string} mode - Build mode
 */
function updatePropertiesForMode(mode) {
    switch (mode) {
        case 'fats':
        case 'properties':
            // Use main recipe (convert percentages to weights for calculation)
            if (state.recipe.length > 0) {
                const recipeAsWeights = state.recipe.map(f => ({
                    id: f.id,
                    weight: f.percentage  // Use percentage as weight (total=100%)
                }));
                updatePropertiesFromFats(recipeAsWeights);
            } else {
                updatePropertiesFromFats([]);
            }
            break;
        case 'yolo':
            // Use YOLO recipe (convert percentages to weights)
            if (state.yoloRecipe.length > 0) {
                const yoloFatsAsWeights = state.yoloRecipe.map(f => ({
                    id: f.id,
                    weight: f.percentage
                }));
                updatePropertiesFromFats(yoloFatsAsWeights);
            } else {
                updatePropertiesFromFats([]);
            }
            break;
        case 'cupboard':
            // Use cupboard fats + suggestions (already weight-based)
            updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions]);
            break;
    }
}

// ============================================
// Setup Functions
// ============================================

function setupSettingsListeners() {
    $(ELEMENT_IDS.lyeType).addEventListener('change', calculate);
    $(ELEMENT_IDS.superfat).addEventListener('input', calculate);
    $(ELEMENT_IDS.waterRatio).addEventListener('input', calculate);
    $(ELEMENT_IDS.unit).addEventListener('change', handleUnitChange);
    $(ELEMENT_IDS.recipeWeight)?.addEventListener('input', handleRecipeWeightSettingChange);

    // Dietary filter checkboxes - update all ingredient selects when toggled
    const handleDietaryFilterChange = () => {
        updateFatSelectWithFilters();
        updateAdditiveSelect();
    };
    $(ELEMENT_IDS.filterAnimalBased)?.addEventListener('change', handleDietaryFilterChange);
    $(ELEMENT_IDS.filterSourcingConcerns)?.addEventListener('change', handleDietaryFilterChange);
    $(ELEMENT_IDS.filterCommonAllergens)?.addEventListener('change', handleDietaryFilterChange);
    $(ELEMENT_IDS.includeExoticFats)?.addEventListener('change', handleDietaryFilterChange);
}

function setupRecipeListeners() {
    $(ELEMENT_IDS.addFatBtn)?.addEventListener('click', handleAddFat);
    $(ELEMENT_IDS.startOverBtn)?.addEventListener('click', handleStartOver);
    $(ELEMENT_IDS.resetSettingsBtn)?.addEventListener('click', handleResetSettings);
    $(ELEMENT_IDS.resetFatsBtn)?.addEventListener('click', handleResetFats);
    $(ELEMENT_IDS.resetAdditivesBtn)?.addEventListener('click', handleResetAdditives);
    $(ELEMENT_IDS.resetFiltersBtn)?.addEventListener('click', handleResetFilters);
    $(ELEMENT_IDS.useFatsBtn)?.addEventListener('click', handleUseFats);
}

/**
 * Handle "Use these fats" button in Select fats mode
 * Scrolls to the additives section for the next step
 */
function handleUseFats() {
    if (state.recipe.length === 0) {
        toast.info(UI_MESSAGES.ADD_FAT_FIRST);
        return;
    }
    // Scroll to additives section as the next logical step
    const additivesSection = $(ELEMENT_IDS.additivesSubcontainer);
    if (additivesSection) {
        additivesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function setupPanelHandlers() {
    let lastFocusedElement = null;

    const closeAllPanels = () => {
        ui.closeAllInfoPanels();
        // Return focus to the element that opened the panel
        if (lastFocusedElement) {
            lastFocusedElement.focus();
            lastFocusedElement = null;
        }
    };

    document.querySelectorAll('.close-panel').forEach(btn => {
        btn.addEventListener('click', closeAllPanels);
    });
    $(ELEMENT_IDS.panelOverlay).addEventListener('click', closeAllPanels);

    // Close panels with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const openPanel = document.querySelector('.info-panel.open');
            if (openPanel) {
                closeAllPanels();
            }
        }
    });

    const showGlossaryTerm = (term, triggerElement) => {
        if (triggerElement) lastFocusedElement = triggerElement;
        ui.showGlossaryInfo(term, state.glossaryData, state.recipe, state.fatsDatabase, state.sourcesData, showGlossaryTerm);
        // Move focus to the panel
        const panel = $('glossaryPanel');
        if (panel) {
            const closeBtn = panel.querySelector('.close-panel');
            if (closeBtn) closeBtn.focus();
        }
    };

    // Helper for keyboard activation (Enter/Space)
    const handleKeyboardActivation = (e, callback) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            callback();
        }
    };

    document.querySelectorAll('.info-link').forEach(link => {
        const handler = () => showGlossaryTerm(link.dataset.term, link);
        link.addEventListener('click', handler);
        link.addEventListener('keydown', (e) => handleKeyboardActivation(e, handler));
    });

    document.querySelectorAll('.fa-link').forEach(link => {
        const handler = () => {
            lastFocusedElement = link;
            ui.showFattyAcidInfo(link.dataset.acid, state.fattyAcidsData, state.recipe, state.fatsDatabase, state.sourcesData);
            // Move focus to the panel
            const panel = $('fattyAcidPanel');
            if (panel) {
                const closeBtn = panel.querySelector('.close-panel');
                if (closeBtn) closeBtn.focus();
            }
        };
        link.addEventListener('click', handler);
        link.addEventListener('keydown', (e) => handleKeyboardActivation(e, handler));
    });

    // Event delegation for dynamically rendered fa-links (e.g., in final recipe)
    document.addEventListener('click', (e) => {
        const faLink = e.target.closest('.fa-link');
        if (faLink && faLink.dataset.acid) {
            lastFocusedElement = faLink;
            ui.showFattyAcidInfo(faLink.dataset.acid, state.fattyAcidsData, state.recipe, state.fatsDatabase, state.sourcesData);
            const panel = $('fattyAcidPanel');
            if (panel) {
                const closeBtn = panel.querySelector('.close-panel');
                if (closeBtn) closeBtn.focus();
            }
        }
    });
}

function setupBuildModeHandlers() {
    // Click handlers for build mode tabs
    document.querySelectorAll('.build-mode-tab').forEach(tab => {
        tab.addEventListener('click', () => switchBuildMode(tab.dataset.mode));
    });

    // Arrow key navigation for build mode tabs (WCAG accessibility)
    const buildModeTablist = document.querySelector('.build-mode-tabs[role="tablist"]');
    if (buildModeTablist) {
        enableTabArrowNavigation(buildModeTablist, (tab) => {
            switchBuildMode(tab.dataset.mode);
        });
    }

    $(ELEMENT_IDS.generateRecipeBtn)?.addEventListener('click', handleGenerateFromProfile);
    $(ELEMENT_IDS.yoloBtn)?.addEventListener('click', handleYoloGenerate);
    $(ELEMENT_IDS.useYoloRecipeBtn)?.addEventListener('click', handleUseYoloRecipe);
}

function handleYoloGenerate() {
    const lockedFats = getYoloLockedFats();
    const excludedFats = getCombinedExclusions();

    const result = optimizer.generateRandomRecipe(state.fatsDatabase, {
        excludeFats: excludedFats,
        lockedFats,
        minFats: DEFAULTS.YOLO_MIN_FATS,
        maxFats: DEFAULTS.YOLO_MAX_FATS
    });

    // Only fail if not enough fats available (exclusions too restrictive)
    if (!result) {
        toast.warning(UI_MESSAGES.YOLO_GENERATION_FAILED);
        return;
    }

    // Store in YOLO state - locked fats are at the start of the recipe array
    // Preserve locks for the locked fats (they're at indices 0 to lockedFats.length-1)
    const newLockedIndices = new Set();
    for (let i = 0; i < lockedFats.length; i++) {
        newLockedIndices.add(i);
    }
    setYoloRecipe(result.recipe, newLockedIndices);

    // Render the YOLO recipe list
    renderYoloRecipe();

    // Change button text to "Re-roll" after first generation
    const yoloBtn = $(ELEMENT_IDS.yoloBtn);
    if (yoloBtn) yoloBtn.textContent = 'Re-roll';
}

/**
 * Render the YOLO recipe fat list
 */
function renderYoloRecipe() {
    const container = $(ELEMENT_IDS.yoloRecipeFats);
    const useAction = $(ELEMENT_IDS.useYoloRecipeAction);
    if (!container) return;

    if (state.yoloRecipe.length === 0) {
        container.innerHTML = '';
        setVisibility(useAction, false);
        // Clear properties display
        updatePropertiesFromFats([]);
        return;
    }

    // Update properties display - convert percentages to weights for calculation
    const yoloFatsAsWeights = state.yoloRecipe.map(f => ({
        id: f.id,
        weight: f.percentage // Use percentage as weight (total=100)
    }));
    updatePropertiesFromFats(yoloFatsAsWeights);

    // Show the "Use This Recipe" action
    setVisibility(useAction, true);

    // Render rows using shared component
    container.innerHTML = state.yoloRecipe.map((item, index) => {
        const fat = state.fatsDatabase[item.id];
        return renderItemRow({
            id: item.id,
            name: fat?.name || item.id,
            percentage: item.percentage,
            isLocked: state.yoloLockedIndices.has(index)
        }, index, {
            showWeight: false,
            showPercentage: true,
            lockableField: 'percentage',
            showExcludeButton: true,
            itemType: 'fat'
        });
    }).join('');

    // Store callbacks on container for dynamic lookup
    container._callbacks = {
        onToggleLock: (index) => {
            toggleYoloLock(index);
            renderYoloRecipe();
        },
        onRemove: (index) => {
            removeYoloFat(index);
            renderYoloRecipe();
        },
        onExclude: (fatId) => {
            addSuggestionExclusion(fatId);
            // Find and remove this fat from the current YOLO recipe
            const index = state.yoloRecipe.findIndex(f => f.id === fatId);
            if (index !== -1) {
                removeYoloFat(index);
            }
            renderYoloRecipe();
        },
        onInfo: createFatInfoHandler(() => state.yoloRecipe)
    };

    // Only attach event handlers once per container
    if (!container.dataset.handlersAttached) {
        attachRowEventHandlers(container, container._callbacks, 'fat');
        container.dataset.handlersAttached = 'true';
    }
}

/**
 * Handle "Use This Recipe" button click from YOLO mode
 */
function handleUseYoloRecipe() {
    if (state.yoloRecipe.length === 0) return;

    // Transfer percentages directly to main recipe
    state.recipe = state.yoloRecipe.map(fat => ({
        id: fat.id,
        percentage: fat.percentage
    }));
    state.recipeLocks = new Set();

    // Clear YOLO state since we're transferring the recipe
    clearYoloRecipe();

    switchBuildMode('fats', true); // Skip warning - intentionally transferring recipe
    renderRecipeList();
    updateFatSelectWithFilters();
    calculate();

    $(ELEMENT_IDS.recipeFats).scrollIntoView({ behavior: 'smooth' });
}

// ============================================
// Cupboard Cleaner Handlers
// ============================================

function setupCupboardCleanerHandlers() {
    const cupboardSelect = $(ELEMENT_IDS.cupboardFatSelect);
    if (cupboardSelect) {
        ui.populateCupboardFatSelect(cupboardSelect, state.fatsDatabase, state.cupboardFats.map(f => f.id));
    }

    $(ELEMENT_IDS.addCupboardFatBtn)?.addEventListener('click', handleAddCupboardFat);
    $(ELEMENT_IDS.cupboardCleanerBtn)?.addEventListener('click', handleGetCupboardSuggestions);
    $(ELEMENT_IDS.useCupboardBtn)?.addEventListener('click', handleUseCupboardRecipe);
    $(ELEMENT_IDS.allowRatioSuggestions)?.addEventListener('change', handleRatioModeToggle);

    // Render initial state if cupboard has fats from localStorage
    if (state.cupboardFats.length > 0) {
        renderCupboardFatsList();
    }
    if (state.cupboardSuggestions.length > 0) {
        renderCupboardSuggestionsList();
    }
}

function handleAddCupboardFat() {
    const select = $(ELEMENT_IDS.cupboardFatSelect);
    const fatId = select?.value;
    if (!fatId) return;

    if (!addCupboardFat(fatId)) {
        toast.info(UI_MESSAGES.FAT_ALREADY_EXISTS);
        return;
    }

    // Reset select and update options
    select.value = '';
    ui.populateCupboardFatSelect(select, state.fatsDatabase, state.cupboardFats.map(f => f.id));

    // Re-render the fat list
    renderCupboardFatsList();
}

function handleCupboardWeightChange(index, value) {
    updateCupboardFatWeight(index, value);
    updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions]);
}

function handleRemoveCupboardFat(index) {
    removeCupboardFat(index);

    const select = $(ELEMENT_IDS.cupboardFatSelect);
    if (select) {
        ui.populateCupboardFatSelect(select, state.fatsDatabase, state.cupboardFats.map(f => f.id));
    }

    // Re-render the fat list and update preview
    renderCupboardFatsList();
}

function handleGetCupboardSuggestions() {
    if (state.cupboardFats.length === 0) {
        toast.info(UI_MESSAGES.NO_CUPBOARD_FATS);
        return;
    }

    const excludedFats = getCombinedExclusions();

    const result = optimizer.suggestFatsForCupboard(state.cupboardFats, state.fatsDatabase, {
        excludeFats: excludedFats,
        maxSuggestions: 3,
        allowRatioAdjustments: state.allowRatioMode
    });

    if (result.allInRange && result.suggestions.length === 0) {
        toast.success(UI_MESSAGES.CUPBOARD_PROPERTIES_OK);
        updatePropertiesFromFats(state.cupboardFats);
        return;
    }

    if (result.suggestions.length === 0) {
        toast.warning(UI_MESSAGES.CUPBOARD_SUGGESTION_FAILED);
        return;
    }

    setCupboardSuggestions(result.suggestions);
    renderCupboardSuggestionsList();
    updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions]);

    // Show the "Use" button
    setVisibility($(ELEMENT_IDS.useCupboardAction), true);

    // Change button text to "Re-roll" after first generation
    const cupboardBtn = $(ELEMENT_IDS.cupboardCleanerBtn);
    if (cupboardBtn) cupboardBtn.textContent = 'Re-roll';
}

function handleRemoveCupboardSuggestion(index) {
    removeCupboardSuggestion(index);
    renderCupboardSuggestionsList();
    updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions]);
}

function handleCupboardSuggestionWeightChange(index, value) {
    updateCupboardSuggestionWeight(index, value);
    updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions]);
}

function handleUseCupboardRecipe() {
    if (state.cupboardFats.length === 0) return;

    // Combine cupboard fats and suggestions, then convert weights to percentages
    const allFats = [
        ...state.cupboardFats.map(f => ({ id: f.id, weight: f.weight })),
        ...state.cupboardSuggestions.map(s => ({ id: s.id, weight: s.weight }))
    ];
    const totalWeight = allFats.reduce((sum, f) => sum + f.weight, 0);

    state.recipe = allFats.map(f => ({
        id: f.id,
        percentage: totalWeight > 0 ? Math.round((f.weight / totalWeight) * 1000) / 10 : 0
    }));
    state.recipeLocks = new Set();

    // Clear cupboard state since we're transferring the recipe
    clearCupboardFats();

    switchBuildMode('fats', true); // Skip warning - intentionally transferring recipe
    renderRecipeList();
    updateFatSelectWithFilters();
    calculate();

    $(ELEMENT_IDS.recipeFats).scrollIntoView({ behavior: 'smooth' });
}

function handleRatioModeToggle() {
    const checkbox = $(ELEMENT_IDS.allowRatioSuggestions);
    setAllowRatioMode(checkbox?.checked || false);
}

function handleToggleCupboardLock(index) {
    toggleCupboardLock(index);
    renderCupboardFatsList();
}

function renderCupboardFatsList() {
    const container = $(ELEMENT_IDS.cupboardFats);
    if (!container) return;

    const settings = ui.getSettings();

    ui.renderCupboardFats(container, state.cupboardFats, state.fatsDatabase, getWeightLabel(settings.unit), {
        onWeightChange: handleCupboardWeightChange,
        onRemove: handleRemoveCupboardFat,
        onInfo: createFatInfoHandler(() => state.cupboardFats)
    });

    updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions]);
}

function renderCupboardSuggestionsList() {
    const container = $(ELEMENT_IDS.cupboardSuggestions);
    if (!container) return;

    const settings = ui.getSettings();

    ui.renderCupboardSuggestions(
        container,
        state.cupboardSuggestions,
        state.fatsDatabase,
        getWeightLabel(settings.unit),
        {
            onWeightChange: handleCupboardSuggestionWeightChange,
            onRemove: handleRemoveCupboardSuggestion,
            onExclude: (fatId) => {
                addSuggestionExclusion(fatId);
                // Find and remove this fat from the current suggestions
                const index = state.cupboardSuggestions.findIndex(f => f.id === fatId);
                if (index !== -1) {
                    removeCupboardSuggestion(index);
                }
                renderCupboardSuggestionsList();
                updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions]);
            },
            onInfo: createFatInfoHandler(() => state.cupboardSuggestions)
        }
    );

    // Show/hide use button
    const useAction = $(ELEMENT_IDS.useCupboardAction);
    if (useAction) {
        useAction.classList.toggle(CSS_CLASSES.hidden, state.cupboardSuggestions.length === 0);
    }
}

/**
 * Update qualitative properties display from any fat array (weights)
 * Used by both main recipe and cupboard mode
 */
function updatePropertiesFromFats(fats) {
    if (!fats || fats.length === 0) {
        // Clear properties to zero
        applyPropertyUpdates(Object.fromEntries(PROPERTY_KEYS.map(k => [k, 0])));
        return;
    }

    const fa = calc.calculateFattyAcids(fats, state.fatsDatabase);
    const properties = calc.calculateProperties(fa);
    const iodine = calc.calculateIodine(fats, state.fatsDatabase);
    const ins = calc.calculateINS(fats, state.fatsDatabase);

    applyPropertyUpdates({ ...properties, iodine, ins });
}

function setupExclusionHandlers() {
    const excludeSelect = $(ELEMENT_IDS.excludeIngredientSelect);
    if (excludeSelect) {
        const allDatabases = getAllIngredientDatabases();
        ui.populateExcludeIngredientSelect(excludeSelect, allDatabases, state.excludedFats);
        ui.renderExcludedIngredients(state.excludedFats, allDatabases, handleRemoveExclusion);
    }

    $(ELEMENT_IDS.addExclusionBtn)?.addEventListener('click', handleAddExclusion);
}

function setupAdditiveHandlers() {
    // Click handlers for additive tabs
    document.querySelectorAll('.additive-tab').forEach(tab => {
        tab.addEventListener('click', () => switchAdditiveCategory(tab.dataset.category));
    });

    // Arrow key navigation for additive tabs (WCAG accessibility)
    const additiveTablist = document.querySelector('.additive-tabs[role="tablist"]');
    if (additiveTablist) {
        enableTabArrowNavigation(additiveTablist, (tab) => {
            switchAdditiveCategory(tab.dataset.category);
        });
    }

    // Add button
    $(ELEMENT_IDS.addAdditiveBtn)?.addEventListener('click', handleAddAdditive);

    // Initialize select with default category
    updateAdditiveSelect();
}

// ============================================
// Final Recipe Handlers
// ============================================

function handleCreateRecipe() {
    // Check if in YOLO mode with a recipe - auto-transfer to main recipe
    const activeTab = document.querySelector('.build-mode-tab.active');
    if (activeTab?.dataset.mode === 'yolo' && state.yoloRecipe.length > 0) {
        // Transfer YOLO percentages directly
        state.recipe = state.yoloRecipe.map(fat => ({
            id: fat.id,
            percentage: fat.percentage
        }));
    }

    if (state.recipe.length === 0) {
        toast.info(UI_MESSAGES.ADD_FAT_FIRST);
        return;
    }

    const settings = ui.getSettings();

    // Convert percentages to actual weights using recipe weight setting
    const recipeWithWeights = state.recipe.map(fat => ({
        id: fat.id,
        weight: Math.round(settings.recipeWeight * fat.percentage / 100)
    }));

    const lyeAmount = calc.calculateLye(recipeWithWeights, state.fatsDatabase, settings.lyeType, settings.superfat);
    const waterAmount = calc.calculateWater(lyeAmount, settings.waterRatio);

    // Calculate fatty acids and properties for the final recipe
    const fattyAcids = calc.calculateFattyAcids(recipeWithWeights, state.fatsDatabase);
    const iodine = calc.calculateIodine(recipeWithWeights, state.fatsDatabase);
    const ins = calc.calculateINS(recipeWithWeights, state.fatsDatabase);
    const properties = calc.calculateProperties(fattyAcids);

    // Generate recipe notes including additive warnings
    const baseNotes = calc.getRecipeNotes({ ...properties, iodine, ins }, fattyAcids, recipeWithWeights);
    const additiveWarnings = renderAdditivesList();
    const notes = mergeAdditiveWarningsIntoNotes(baseNotes, additiveWarnings);

    const container = $(ELEMENT_IDS.finalRecipeContent);
    ui.renderFinalRecipe(container, {
        recipe: recipeWithWeights,
        recipeAdditives: state.recipeAdditives,
        fatsDatabase: state.fatsDatabase,
        additivesDatabase: getAllAdditivesDatabase(),
        lyeAmount,
        waterAmount,
        lyeType: settings.lyeType,
        processType: settings.processType,
        superfat: settings.superfat,
        waterRatio: settings.waterRatio,
        unit: getWeightLabel(settings.unit),
        unitSystem: settings.unit,
        fattyAcids,
        properties: { ...properties, iodine, ins },
        notes,
        formulas: state.formulasData,
        sources: state.sourcesData
    });

    ui.showFinalRecipe();
}

function setupFinalRecipeHandlers() {
    $(ELEMENT_IDS.createRecipeBtn)?.addEventListener('click', handleCreateRecipe);
}

function setupCollapsibleSections() {
    // Native <details>/<summary> handles toggle behaviour
    // This function is kept as a placeholder for any future animation hooks
}

// ============================================
// Initialization
// ============================================

async function init() {
    await loadData();

    // Restore saved state before rendering
    restoreState();

    // Sync previousUnit with restored/default unit value
    previousUnit = $(ELEMENT_IDS.unit)?.value || 'metric';

    updateFatSelectWithFilters();
    ui.initHelpPopup(state.glossaryData, state.tooltipsData, (term) => {
        ui.showGlossaryInfo(term, state.glossaryData, state.recipe, state.fatsDatabase, state.sourcesData, (t) => {
            ui.showGlossaryInfo(t, state.glossaryData, state.recipe, state.fatsDatabase, state.sourcesData);
        });
    });
    ui.populatePropertyRanges(PROPERTY_RANGES);

    setupSettingsListeners();
    setupRecipeListeners();
    setupPanelHandlers();
    setupBuildModeHandlers();
    setupExclusionHandlers();
    setupAdditiveHandlers();
    setupCupboardCleanerHandlers();
    setupFinalRecipeHandlers();
    setupCollapsibleSections();

    // Auto-save on state changes
    state.subscribeAll(saveState);

    renderRecipeList();
    calculate();

    // Handle ?show= URL parameter for deep linking from references page
    handleShowParameter();
}

/**
 * Handle ?show= URL parameter to display info panels for fats/additives
 */
function handleShowParameter() {
    const params = new URLSearchParams(window.location.search);
    const showParam = params.get('show');
    if (!showParam) return;

    const [type, ...idParts] = showParam.split('-');
    const id = idParts.join('-');

    if (type === 'fat' && state.fatsDatabase[id]) {
        ui.showFatInfo(id, state.fatsDatabase, state.fattyAcidsData, state.sourcesData, (acidKey) => {
            ui.showGlossaryInfo(acidKey, state.glossaryData, state.recipe, state.fatsDatabase, state.sourcesData);
        });
    } else if (type === 'additive') {
        const allAdditives = getAllAdditivesDatabase();
        if (allAdditives[id]) {
            ui.showAdditiveInfo(id, allAdditives, state.sourcesData);
        }
    }

    // Clean URL without reloading
    window.history.replaceState({}, '', window.location.pathname);
}

document.addEventListener('DOMContentLoaded', init);
