/**
 * Shared test fixtures: a small, deterministic fats database.
 *
 * Values are representative of real fats (lauric-heavy coconut, oleic-heavy
 * olive, etc.) but are fixtures, not authoritative data. Tests assert on
 * relationships and invariants, not on production data values.
 */

export const FATS = {
    coconut: {
        name: 'Coconut Oil',
        type: 'oil',
        sap: { naoh: 0.178, koh: 0.25 },
        usage: { min: 5, max: 33 },
        details: { iodine: 10, ins: 258, density: 0.92 },
        fattyAcids: { lauric: 48, myristic: 19, palmitic: 9, stearic: 3, oleic: 8, linoleic: 2, caprylic: 8, capric: 7 },
        dietary: { animalBased: false }
    },
    olive: {
        name: 'Olive Oil',
        type: 'oil',
        sap: { naoh: 0.134, koh: 0.19 },
        usage: { min: 5, max: 100 },
        details: { iodine: 84, ins: 105, density: 0.91 },
        fattyAcids: { palmitic: 14, stearic: 3, oleic: 69, linoleic: 12, linolenic: 1 },
        dietary: { animalBased: false }
    },
    palm: {
        name: 'Palm Oil',
        type: 'oil',
        sap: { naoh: 0.142, koh: 0.199 },
        usage: { min: 5, max: 50 },
        details: { iodine: 53, ins: 145, density: 0.9 },
        fattyAcids: { palmitic: 44, stearic: 5, oleic: 39, linoleic: 10, myristic: 1 },
        dietary: { animalBased: false },
        ethicalConcerns: { environmental: ['deforestation', 'habitat-loss'] }
    },
    castor: {
        name: 'Castor Oil',
        type: 'oil',
        sap: { naoh: 0.128, koh: 0.18 },
        usage: { min: 2, max: 10 },
        details: { iodine: 86, ins: 95, density: 0.96 },
        fattyAcids: { ricinoleic: 90, oleic: 4, linoleic: 4, palmitic: 1, stearic: 1 },
        dietary: { animalBased: false }
    },
    tallow: {
        name: 'Beef Tallow',
        type: 'fat',
        sap: { naoh: 0.141, koh: 0.198 },
        usage: { min: 5, max: 100 },
        details: { iodine: 45, ins: 147, density: 0.9 },
        fattyAcids: { palmitic: 26, stearic: 20, oleic: 36, myristic: 3, linoleic: 3 },
        dietary: { animalBased: true, commonAllergen: false }
    },
    sunflower: {
        name: 'Sunflower Oil',
        type: 'oil',
        sap: { naoh: 0.134, koh: 0.188 },
        usage: { min: 5, max: 50 },
        details: { iodine: 133, ins: 63, density: 0.92 },
        fattyAcids: { oleic: 21, linoleic: 68, palmitic: 6, stearic: 4, linolenic: 1 },
        dietary: { animalBased: false, isExotic: true }
    }
};

/**
 * Fatty acid data with qualitative soap properties (subset used by tests).
 */
export const FATTY_ACIDS_DATA = {
    lauric: { name: 'Lauric', saturation: 'saturated', soapProperties: { hardness: 'high', degreasing: 'very high', lather: 'fluffy', moisturizing: 'very low' } },
    oleic: { name: 'Oleic', saturation: 'monounsaturated', soapProperties: { hardness: 'low', degreasing: 'low', lather: 'creamy', moisturizing: 'high' } },
    palmitic: { name: 'Palmitic', saturation: 'saturated', soapProperties: { hardness: 'high', degreasing: 'low', lather: 'stable', moisturizing: 'low' } }
};
