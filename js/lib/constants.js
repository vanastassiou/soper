/**
 * Centralized constants for the soap recipe builder
 * Single source of truth for IDs, mappings, and thresholds
 */

// ============================================
// Element IDs
// ============================================

export const ELEMENT_IDS = {
    // Settings
    lyeType: 'lyeType',
    processType: 'processType',
    superfat: 'superfat',
    waterRatio: 'waterRatio',
    recipeWeight: 'recipeWeight',

    // Fat selection
    fatSelect: 'fatSelect',
    addFatBtn: 'addFatBtn',
    startOverBtn: 'startOverBtn',
    resetSettingsBtn: 'resetSettingsBtn',
    resetFatsBtn: 'resetFatsBtn',
    resetAdditivesBtn: 'resetAdditivesBtn',
    resetFiltersBtn: 'resetFiltersBtn',
    recipeFats: 'recipeFats',

    // Panels
    fatInfoPanel: 'fatInfoPanel',
    glossaryPanel: 'glossaryPanel',
    fattyAcidPanel: 'fattyAcidPanel',
    panelOverlay: 'panelOverlay',

    // Fat panel elements
    fatPanelName: 'fatPanelName',
    fatPanelDescription: 'fatPanelDescription',
    fatPanelProperties: 'fatPanelProperties',
    fatPanelFattyAcids: 'fatPanelFattyAcids',

    // Glossary panel elements
    glossaryList: 'glossaryList',
    glossaryPanelName: 'glossaryPanelName',
    glossaryPanelCategory: 'glossaryPanelCategory',
    glossaryPanelDesc: 'glossaryPanelDesc',
    glossaryPanelDetails: 'glossaryPanelDetails',
    glossaryPanelContributors: 'glossaryPanelContributors',
    glossaryPanelRelated: 'glossaryPanelRelated',

    // Fatty acid panel elements
    faName: 'faName',
    faChemistry: 'faChemistry',
    faOccurrence: 'faOccurrence',

    // Additive panel elements
    additivePanelName: 'additivePanelName',
    additivePanelCategory: 'additivePanelCategory',
    additivePanelDescription: 'additivePanelDescription',
    additivePanelUsage: 'additivePanelUsage',
    additivePanelSafety: 'additivePanelSafety',
    additivePanelExtra: 'additivePanelExtra',

    // Build modes
    selectFatsMode: 'selectFatsMode',
    specifyPropertiesMode: 'specifyPropertiesMode',
    yoloMode: 'yoloMode',
    yoloBtn: 'yoloBtn',
    yoloRecipeFats: 'yoloRecipeFats',
    useFatsAction: 'useFatsAction',
    useFatsBtn: 'useFatsBtn',
    useYoloRecipeBtn: 'useYoloRecipeBtn',
    useYoloRecipeAction: 'useYoloRecipeAction',

    // Profile builder
    generateRecipeBtn: 'generateRecipeBtn',
    profileResults: 'profileResults',
    suggestedRecipe: 'suggestedRecipe',
    achievedComparison: 'achievedComparison',
    matchBarFill: 'matchBarFill',
    matchPercent: 'matchPercent',
    useRecipeBtn: 'useRecipeBtn',
    maxFats: 'maxFats',
    includeCastor: 'includeCastor',

    // Exclusions
    excludeFatsSection: 'excludeFatsSection',
    excludeIngredientSelect: 'excludeIngredientSelect',
    addExclusionBtn: 'addExclusionBtn',
    excludedIngredientsList: 'excludedIngredientsList',

    // Cupboard cleaner mode
    cupboardCleanerMode: 'cupboardCleanerMode',
    cupboardFats: 'cupboardFats',
    cupboardSuggestions: 'cupboardSuggestions',
    cupboardCleanerBtn: 'cupboardCleanerBtn',
    useCupboardBtn: 'useCupboardBtn',
    useCupboardAction: 'useCupboardAction',
    allowRatioSuggestions: 'allowRatioSuggestions',
    cupboardFatSelect: 'cupboardFatSelect',
    addCupboardFatBtn: 'addCupboardFatBtn',

    // Dietary filters / Exclusions
    filtersSection: 'filtersSection',
    dietaryFiltersSection: 'dietaryFiltersSection',
    filterAnimalBased: 'filterAnimalBased',
    filterSourcingConcerns: 'filterSourcingConcerns',
    filterCommonAllergens: 'filterCommonAllergens',
    includeExoticFats: 'includeExoticFats',

    // Additives
    additivesSubcontainer: 'additivesSubcontainer',
    additiveSelect: 'additiveSelect',
    addAdditiveBtn: 'addAdditiveBtn',
    recipeAdditives: 'recipeAdditives',
    additivesTotal: 'additivesTotal',
    additivesUnit: 'additivesUnit',
    additiveInfoPanel: 'additiveInfoPanel',

    // Final recipe
    createRecipeBtn: 'createRecipeBtn',
    finalRecipeCard: 'finalRecipeCard',
    finalRecipeContent: 'finalRecipeContent'
};

// ============================================
// Fatty acid constants
// ============================================

export const FATTY_ACID_KEYS = [
    'caprylic', 'capric', 'lauric', 'myristic', 'palmitic', 'palmitoleic',
    'stearic', 'oleic', 'linoleic', 'linolenic', 'arachidic', 'behenic',
    'erucic', 'ricinoleic'
];

export const FATTY_ACID_NAMES = {
    caprylic: 'Caprylic',
    capric: 'Capric',
    lauric: 'Lauric',
    myristic: 'Myristic',
    palmitic: 'Palmitic',
    palmitoleic: 'Palmitoleic',
    stearic: 'Stearic',
    oleic: 'Oleic',
    linoleic: 'Linoleic',
    linolenic: 'Linolenic',
    arachidic: 'Arachidic',
    behenic: 'Behenic',
    erucic: 'Erucic',
    ricinoleic: 'Ricinoleic'
};

// ============================================
// Property constants
// ============================================

export const PROPERTY_KEYS = [
    'hardness', 'degreasing', 'moisturizing', 'lather-volume', 'lather-density', 'iodine', 'ins'
];

export const PROPERTY_NAMES = {
    hardness: 'Hardness',
    degreasing: 'Grease removing',
    moisturizing: 'Skin conditioning',
    'lather-volume': 'Lather volume',
    'lather-density': 'Lather density',
    iodine: 'Iodine value',
    ins: 'INS'
};

// Property element ID mappings (for DOM lookups)
export const PROPERTY_ELEMENT_IDS = {
    prop: {
        hardness: 'propHardness',
        degreasing: 'propDegreasing',
        moisturizing: 'propMoisturizing',
        'lather-volume': 'propLatherVolume',
        'lather-density': 'propLatherDensity',
        iodine: 'propIodine',
        ins: 'propIns'
    },
    range: {
        hardness: 'rangeHardness',
        degreasing: 'rangeDegreasing',
        moisturizing: 'rangeMoisturizing',
        'lather-volume': 'rangeLatherVolume',
        'lather-density': 'rangeLatherDensity',
        iodine: 'rangeIodine',
        ins: 'rangeIns'
    },
    target: {
        hardness: 'targetHardness',
        degreasing: 'targetDegreasing',
        moisturizing: 'targetMoisturizing',
        'lather-volume': 'targetLatherVolume',
        'lather-density': 'targetLatherDensity'
    }
};

// Which fatty acids contribute to each soap property
export const PROPERTY_FATTY_ACIDS = {
    hardness: ['caprylic', 'capric', 'lauric', 'myristic', 'palmitic', 'stearic', 'arachidic', 'behenic'],
    degreasing: ['caprylic', 'capric', 'lauric', 'myristic'],
    moisturizing: ['palmitoleic', 'oleic', 'ricinoleic', 'linoleic', 'linolenic', 'erucic'],
    'lather-volume': ['lauric', 'myristic', 'ricinoleic'],
    'lather-density': ['palmitic', 'stearic', 'ricinoleic']
};

// Recommended ranges for soap properties
export const PROPERTY_RANGES = {
    hardness: { min: 29, max: 54 },
    degreasing: { min: 12, max: 22 },
    moisturizing: { min: 44, max: 69 },
    'lather-volume': { min: 14, max: 46 },
    'lather-density': { min: 16, max: 48 },
    iodine: { min: 41, max: 70 },
    ins: { min: 136, max: 165 }
};

// ============================================
// Calculation thresholds
// ============================================

// Volume calculation constants
export const VOLUME = {
    NAOH_DENSITY: 2.13,        // g/mL for solid NaOH
    WATER_DENSITY: 1.0,        // g/mL
    DEFAULT_FAT_DENSITY: 0.91, // fallback g/mL
    SAPONIFICATION_REDUCTION: 0.95,  // ~5% volume reduction during saponification
    UNCERTAINTY_MIN: 0.88,     // -12% volume uncertainty
    UNCERTAINTY_MAX: 1.12      // +12% volume uncertainty
};

// Profile builder thresholds
export const PROFILE = {
    MIN_FAT_PERCENT: 5,
    MAX_FAT_PERCENT: 80,
    DEFAULT_MAX_FATS: 5,
    OPTIMIZER_ITERATIONS: 100,
    OPTIMIZER_STEP_SIZE: 2,
    CONVERGENCE_THRESHOLD: 0.01,
    MATCH_QUALITY_FACTOR: 3      // 100 - avgDeviation * this factor
};

// Match quality status thresholds (for UI display)
export const MATCH_THRESHOLDS = {
    OFF: 5,    // absDiff > 5 = 'off' status
    CLOSE: 3   // absDiff > 3 = 'close' status, else 'good'
};

// Recipe note thresholds
export const NOTE_THRESHOLDS = {
    HIGH_DEGREASING: 20,
    LOW_DEGREASING: 10,
    HIGH_POLYUNSATURATED: 15,
    HIGH_LINOLENIC: 5,
    LOW_LATHER_VOLUME: 20,
    HIGH_MOISTURIZING: 65,
    LOW_HARDNESS: 35
};

// Default values for recipe items
export const DEFAULTS = {
    FAT_WEIGHT: 100,              // Default weight when adding a fat
    ADDITIVE_WEIGHT: 10,          // Default weight when adding an additive
    BASE_RECIPE_WEIGHT: 500,      // Default recipe weight in grams
    YOLO_MIN_FATS: 3,             // Minimum fats in YOLO recipe
    YOLO_MAX_FATS: 5              // Maximum fats in YOLO recipe
};

// Calculation thresholds
export const CALCULATION = {
    DOMINANT_FATTY_ACID_THRESHOLD: 10  // Minimum % for a fatty acid to be considered dominant
};

// Property-to-fatty-acid conversion assumptions
export const PROPERTY_CONVERSION = {
    // Degreasing split between lauric and myristic
    DEGREASING_LAURIC_RATIO: 0.7,
    DEGREASING_MYRISTIC_RATIO: 0.3,
    // Hardness remaining split between palmitic and stearic
    HARDNESS_PALMITIC_RATIO: 0.6,
    HARDNESS_STEARIC_RATIO: 0.4,
    // Moisturizing distribution
    MOISTURIZING_OLEIC_RATIO: 0.8,
    MOISTURIZING_RICINOLEIC_RATIO: 0.05,
    MOISTURIZING_LINOLEIC_RATIO: 0.12,
    MOISTURIZING_LINOLENIC_RATIO: 0.03
};

// ============================================
// UI constants
// ============================================

export const UI_ICONS = {
    LOCK: '🔒',
    UNLOCK: '🔓',
    REMOVE: '❌',
    EXCLUDE: '🚫'
};

export const NOTE_TYPES = {
    WARNING: 'warning',
    INFO: 'info',
    SUCCESS: 'success'
};

export const NOTE_ICONS = {
    SOFT_BAR: '🪶',
    HARD_BAR: '🧱',
    HIGH_CLEANSING: '🧼',
    LOW_CLEANSING: '🧴',
    SHELF_STABILITY: '⚠️',
    LINOLENIC: '🕐',
    LOW_LATHER: '🫧',
    CONDITIONING_BALANCE: '💧',
    TIP: '💡',
    GOOD: '✓'
};

export const TIMING = {
    HIGHLIGHT_DURATION: 2000
};

export const SPECIAL_FATS = {
    CASTOR: 'castor-oil'
};

export const BUILD_MODES = {
    FATS: 'fats',
    PROFILE: 'profile',
    YOLO: 'yolo',
    CUPBOARD: 'cupboard'
};

// Additive categories for UI tabs
export const ADDITIVE_CATEGORIES = {
    FRAGRANCE: 'fragrance',
    COLOURANT: 'colourant',
    SOAP_PERFORMANCE: 'soap-performance',
    SKIN_CARE: 'skin-care'
};

// Additive warning severity (reuses NOTE_TYPES for consistency)
export const ADDITIVE_WARNING_TYPES = {
    DANGER: 'danger',     // Exceeds max safe concentration
    WARNING: 'warning',   // Exceeds IFRA limit
    INFO: 'info'          // Above recommended max
};

// ============================================
// CSS classes
// ============================================

export const CSS_CLASSES = {
    hidden: 'hidden',
    active: 'active',
    open: 'open',
    locked: 'locked',
    inRange: 'in-range',
    outRange: 'out-range',
    // Match status
    good: 'good',
    close: 'close',
    off: 'off',
    // Selectors used in JS
    additiveTabs: 'additive-tab',
    buildModeTabs: 'build-mode-tab',
    buildExclusions: 'build-exclusions',
    closePanel: 'close-panel',
    infoPanelOpen: 'info-panel.open',
    infoLink: 'info-link',
    faLink: 'fa-link',
    itemRow: 'item-row',
    helpTip: 'help-tip',
    rangeTip: 'range-tip',
    glossaryTooltip: 'glossary-tooltip',
    relatedTerm: 'related-term',
    suggestedFat: 'suggested-fat',
    excludedFatTag: 'excluded-fat-tag',
    additiveEmpty: 'additive-empty',
    emptyState: 'empty-state',
    noResults: 'no-results',
    highlight: 'highlight',
    pageFilter: 'page-filter'
};

// ============================================
// User-facing messages
// ============================================

export const UI_MESSAGES = {
    FAT_ALREADY_EXISTS: 'This fat is already in your recipe',
    ADDITIVE_ALREADY_EXISTS: 'This additive is already in your recipe',
    ENTER_PROPERTY_TARGET: 'Enter at least one property target',
    NO_FAT_COMBINATION: 'Could not find a suitable fat combination',
    ADD_FAT_FIRST: 'Add at least one fat to create a recipe',
    NO_FATS_ADDED: 'No fats selected',
    NO_ADDITIVES_ADDED: 'No additives selected',
    YOLO_GENERATION_FAILED: 'Could not generate a valid recipe. Try removing some exclusions.',
    // Cupboard cleaner messages
    NO_CUPBOARD_FATS: 'Add fats you have on hand',
    CUPBOARD_SUGGESTION_FAILED: 'Could not find fats to improve properties',
    CUPBOARD_PROPERTIES_OK: 'Properties are already within recommended ranges'
};

// ============================================
// Data attributes
// ============================================

export const DATA_ATTRS = {
    index: 'index',
    action: 'action',
    fat: 'fat',
    additive: 'additive',
    acid: 'acid',
    term: 'term',
    mode: 'mode',
    category: 'category',
    key: 'key',
    rangeTip: 'range-tip'
};

// ============================================
// Utility
// ============================================

/**
 * Create a fresh fatty acids object initialized to zeros
 * @returns {Object<string, number>} Fatty acid object with all values set to 0
 */
export function initFattyAcids() {
    return Object.fromEntries(FATTY_ACID_KEYS.map(acid => [acid, 0]));
}

/**
 * Check if a value is a valid target (not null, undefined, or empty string)
 * @param {*} value - Value to check
 * @returns {boolean} True if value is valid
 */
export function isValidTarget(value) {
    return value !== null && value !== undefined && value !== '';
}

/**
 * Check if a value is within a range
 * @param {number} value - Value to check
 * @param {number} min - Minimum of range
 * @param {number} max - Maximum of range
 * @returns {boolean} True if value is within range (inclusive)
 */
export function isInRange(value, min, max) {
    return value >= min && value <= max;
}

/**
 * Check if all specified properties are within their recommended ranges
 * @param {Object<string, number>} properties - Property values object
 * @param {Array<string>} propertyKeys - Keys to check (defaults to main soap properties)
 * @returns {boolean} True if all properties are in range
 */
export function allPropertiesInRange(properties, propertyKeys = ['hardness', 'degreasing', 'moisturizing', 'lather-volume', 'lather-density']) {
    const ranges = /** @type {Object<string, {min: number, max: number}>} */ (PROPERTY_RANGES);
    return propertyKeys.every(key => {
        const range = ranges[key];
        return range && isInRange(properties[key], range.min, range.max);
    });
}
