/**
 * Main application entry point
 * Orchestrates state, data loading, and event binding
 */

import * as calc from './core/calculator.js';
import * as optimizer from './core/optimizer.js';
import { DEFAULTS, ELEMENT_IDS, getWeightLabel, PROPERTY_KEYS, PROPERTY_RANGES, UI_MESSAGES, VOLUME } from './lib/constants.js';
import * as validation from './lib/validation.js';
import {
    addExclusion, clearRecipe,
    clearYoloRecipe, clearCupboardFats, clearPropertiesRecipe,
    removeExclusion, restoreState, saveState,
    state,
    // Suggestion exclusion functions
    clearSuggestionExclusions
} from './state/state.js';
import { toast } from './ui/components/toast.js';
import { $, enableTabArrowNavigation } from './ui/helpers.js';
import { updatePropertiesFromFats } from './ui/properties.js';
import * as ui from './ui/ui.js';
import {
    initCupboard,
    renderCupboardFatsList,
    renderCupboardSuggestionsList,
    resetCupboardMode
} from './features/cupboard/index.js';
import {
    initYolo,
    renderYoloRecipe,
    resetYoloMode
} from './features/yolo/index.js';
import {
    hideProfileResults,
    initProfileBuilder,
    resetProfileBuilder
} from './features/profileBuilder/index.js';
import {
    getAllAdditivesDatabase,
    initAdditives,
    mergeAdditiveWarningsIntoNotes,
    renderAdditivesList,
    updateAdditiveSelect
} from './features/additives/index.js';
import {
    calculate,
    handleRecipeWeightSettingChange,
    initSelectFats,
    renderRecipeList
} from './features/selectFats/index.js';
import { populateFatSelect } from './features/selectFats/render.js';

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
// Cross-feature reset and orchestration
// ============================================

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
    resetYoloMode();
    renderAdditivesList();
    updateExclusionUI();
    hideProfileResults();
    resetProfileBuilder();

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
    populateFatSelect($(ELEMENT_IDS.fatSelect), state.fatsDatabase, existingIds, filterFn);

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
            hideProfileResults();
            resetProfileBuilder();
            break;
        case 'yolo':
            clearYoloRecipe();
            clearSuggestionExclusions();
            resetYoloMode();
            break;
        case 'cupboard':
            clearCupboardFats();
            clearSuggestionExclusions();
            resetCupboardMode();
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

    // Reset Profile Builder button text when leaving properties mode
    if (currentBuildMode === 'properties') {
        resetProfileBuilder();
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

    hideProfileResults();

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
                updatePropertiesFromFats(recipeAsWeights, state.fatsDatabase);
            } else {
                updatePropertiesFromFats([], state.fatsDatabase);
            }
            break;
        case 'yolo':
            // Use YOLO recipe (convert percentages to weights)
            if (state.yoloRecipe.length > 0) {
                const yoloFatsAsWeights = state.yoloRecipe.map(f => ({
                    id: f.id,
                    weight: f.percentage
                }));
                updatePropertiesFromFats(yoloFatsAsWeights, state.fatsDatabase);
            } else {
                updatePropertiesFromFats([], state.fatsDatabase);
            }
            break;
        case 'cupboard':
            // Use cupboard fats + suggestions (already weight-based)
            updatePropertiesFromFats([...state.cupboardFats, ...state.cupboardSuggestions], state.fatsDatabase);
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
    $(ELEMENT_IDS.startOverBtn)?.addEventListener('click', handleStartOver);
    $(ELEMENT_IDS.resetSettingsBtn)?.addEventListener('click', handleResetSettings);
    $(ELEMENT_IDS.resetFatsBtn)?.addEventListener('click', handleResetFats);
    $(ELEMENT_IDS.resetAdditivesBtn)?.addEventListener('click', handleResetAdditives);
    $(ELEMENT_IDS.resetFiltersBtn)?.addEventListener('click', handleResetFilters);
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
    initAdditives({
        createDietaryFilterFn,
        updateTabStates,
        recalculate: calculate
    });
    initSelectFats({
        createFatInfoHandler,
        updateFatSelectWithFilters,
        renderAdditivesList
    });

    const transferRecipeToSelectFats = (recipe) => {
        state.recipe = recipe;
        switchBuildMode('fats', true);
        renderRecipeList();
        updateFatSelectWithFilters();
        calculate();
        $(ELEMENT_IDS.recipeFats).scrollIntoView({ behavior: 'smooth' });
    };

    initCupboard({
        createFatInfoHandler,
        getCombinedExclusions,
        onTransferRecipe: transferRecipeToSelectFats
    });
    initYolo({
        createFatInfoHandler,
        getCombinedExclusions,
        onTransferRecipe: transferRecipeToSelectFats
    });
    initProfileBuilder({
        createFatInfoHandler,
        getCombinedExclusions,
        onTransferRecipe: transferRecipeToSelectFats
    });
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
