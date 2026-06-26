import { describe, it, expect } from 'vitest';
import {
    calculateLye,
    calculateWater,
    calculateFattyAcids,
    calculateFattyAcidsFromPercentages,
    calculateIodine,
    calculateINS,
    calculateProperties,
    calculateVolume,
    getRecipeNotes,
    getFatSoapProperties,
    calculateAdditiveAmount,
    checkAdditiveWarnings,
    calculateAdditivesTotal,
    calculateAdditiveVolume
} from './calculator.js';
import { FATS, FATTY_ACIDS_DATA } from '../../tests/fixtures.js';

describe('calculateLye', () => {
    it('multiplies fat weight by SAP value for NaOH', () => {
        const recipe = [{ id: 'coconut', weight: 1000 }];
        expect(calculateLye(recipe, FATS, 'NaOH', 0)).toBeCloseTo(178, 5);
    });

    it('uses the KOH SAP value when lyeType is KOH', () => {
        const recipe = [{ id: 'coconut', weight: 1000 }];
        expect(calculateLye(recipe, FATS, 'KOH', 0)).toBeCloseTo(250, 5);
    });

    it('reduces lye by the superfat percentage', () => {
        const recipe = [{ id: 'coconut', weight: 1000 }];
        expect(calculateLye(recipe, FATS, 'NaOH', 5)).toBeCloseTo(178 * 0.95, 5);
    });

    it('sums SAP across multiple fats', () => {
        const recipe = [
            { id: 'coconut', weight: 500 },
            { id: 'olive', weight: 500 }
        ];
        expect(calculateLye(recipe, FATS, 'NaOH', 0)).toBeCloseTo(500 * 0.178 + 500 * 0.134, 5);
    });

    it('treats unknown fats as zero SAP', () => {
        const recipe = [{ id: 'does-not-exist', weight: 1000 }];
        expect(calculateLye(recipe, FATS, 'NaOH', 0)).toBe(0);
    });
});

describe('calculateWater', () => {
    it('multiplies lye by the water ratio', () => {
        expect(calculateWater(100, 2)).toBe(200);
        expect(calculateWater(100, 0)).toBe(0);
    });
});

describe('calculateFattyAcids', () => {
    it('returns the single fat profile unchanged for a one-fat recipe', () => {
        const fa = calculateFattyAcids([{ id: 'olive', weight: 100 }], FATS);
        expect(fa.oleic).toBeCloseTo(69, 5);
        expect(fa.linoleic).toBeCloseTo(12, 5);
    });

    it('weights by relative weight in a multi-fat recipe', () => {
        const fa = calculateFattyAcids(
            [{ id: 'olive', weight: 50 }, { id: 'coconut', weight: 50 }],
            FATS
        );
        expect(fa.oleic).toBeCloseTo((69 + 8) / 2, 5);
        expect(fa.lauric).toBeCloseTo(48 / 2, 5);
    });

    it('returns an all-zero profile for an empty recipe', () => {
        const fa = calculateFattyAcids([], FATS);
        expect(fa.oleic).toBe(0);
        expect(fa.lauric).toBe(0);
    });

    it('agrees with the percentage variant when values are proportional', () => {
        const byWeight = calculateFattyAcids([{ id: 'olive', weight: 30 }, { id: 'coconut', weight: 70 }], FATS);
        const byPercent = calculateFattyAcidsFromPercentages([{ id: 'olive', percentage: 30 }, { id: 'coconut', percentage: 70 }], FATS);
        expect(byWeight.oleic).toBeCloseTo(byPercent.oleic, 9);
    });
});

describe('calculateIodine / calculateINS', () => {
    it('computes a weight-weighted average iodine value', () => {
        const recipe = [{ id: 'coconut', weight: 50 }, { id: 'olive', weight: 50 }];
        expect(calculateIodine(recipe, FATS)).toBeCloseTo((10 + 84) / 2, 5);
    });

    it('computes a weight-weighted average INS value', () => {
        const recipe = [{ id: 'coconut', weight: 50 }, { id: 'olive', weight: 50 }];
        expect(calculateINS(recipe, FATS)).toBeCloseTo((258 + 105) / 2, 5);
    });

    it('returns zero for an empty recipe', () => {
        expect(calculateIodine([], FATS)).toBe(0);
        expect(calculateINS([], FATS)).toBe(0);
    });
});

describe('calculateProperties', () => {
    it('derives hardness from saturated fatty acids', () => {
        const fa = calculateFattyAcidsFromPercentages([{ id: 'coconut', percentage: 100 }], FATS);
        const props = calculateProperties(fa);
        // hardness = caprylic+capric+lauric+myristic+palmitic+stearic (+arachidic+behenic)
        expect(props.hardness).toBeCloseTo(8 + 7 + 48 + 19 + 9 + 3, 5);
        expect(props.degreasing).toBeCloseTo(8 + 7 + 48 + 19, 5);
    });

    it('treats missing trace fatty acids as zero', () => {
        const props = calculateProperties({ lauric: 0, myristic: 0, palmitic: 0, stearic: 0, oleic: 50, ricinoleic: 0, linoleic: 0, linolenic: 0 });
        expect(props.moisturizing).toBe(50);
        expect(props.hardness).toBe(0);
    });
});

describe('calculateVolume', () => {
    it('returns a zero range for an empty recipe', () => {
        expect(calculateVolume([], FATS, 0, 0)).toEqual({ min: 0, max: 0 });
    });

    it('produces a positive min/max range with min below max', () => {
        const recipe = [{ id: 'olive', weight: 500 }];
        const vol = calculateVolume(recipe, FATS, 70, 140);
        expect(vol.min).toBeGreaterThan(0);
        expect(vol.max).toBeGreaterThan(vol.min);
    });
});

describe('getRecipeNotes', () => {
    it('returns no notes for an empty recipe', () => {
        expect(getRecipeNotes({}, {}, [])).toEqual([]);
    });

    it('flags a soft bar when hardness is below the recommended range', () => {
        const properties = { hardness: 10, degreasing: 15, moisturizing: 60, 'lather-volume': 20, 'lather-density': 20 };
        const fa = { linoleic: 5, linolenic: 1 };
        const notes = getRecipeNotes(properties, fa, [{ id: 'olive', weight: 100 }]);
        expect(notes.some(n => /soft bar/i.test(n.text))).toBe(true);
    });

    it('warns about rancidity when polyunsaturates are high', () => {
        const properties = { hardness: 40, degreasing: 15, moisturizing: 60, 'lather-volume': 20, 'lather-density': 20 };
        const fa = { linoleic: 40, linolenic: 2 };
        const notes = getRecipeNotes(properties, fa, [{ id: 'sunflower', weight: 100 }]);
        expect(notes.some(n => /rancidity/i.test(n.text))).toBe(true);
    });
});

describe('getFatSoapProperties', () => {
    it('returns qualitative levels driven by dominant fatty acids', () => {
        const props = getFatSoapProperties(FATS.olive, FATTY_ACIDS_DATA);
        // Olive is oleic-dominant: high moisturizing, low hardness
        expect(props.moisturizing).toBe('high');
        expect(props.hardness).toBe('low');
    });

    it('returns null when no fatty acid clears the dominance threshold', () => {
        const fat = { fattyAcids: { lauric: 5, oleic: 5, palmitic: 5 } };
        expect(getFatSoapProperties(fat, FATTY_ACIDS_DATA)).toBeNull();
    });
});

describe('additive calculations', () => {
    const fragrance = { name: 'Lavender', usage: { basis: 'oil-weight', max: 5 }, safety: { maxConcentration: 10, ifraCategory9Limit: 3 }, density: 0.9 };

    it('calculates additive weight on an oil-weight basis', () => {
        expect(calculateAdditiveAmount(fragrance, 3, 1000)).toBeCloseTo(30, 5);
    });

    it('returns zero additive weight when there is no fat', () => {
        expect(calculateAdditiveAmount(fragrance, 3, 0)).toBe(0);
    });

    it('warns when usage exceeds the IFRA limit but not the max concentration', () => {
        const warnings = checkAdditiveWarnings(fragrance, 4);
        expect(warnings.some(w => /IFRA/i.test(w.message))).toBe(true);
        expect(warnings.some(w => w.type === 'danger')).toBe(false);
    });

    it('flags danger when usage exceeds the maximum safe concentration', () => {
        const warnings = checkAdditiveWarnings(fragrance, 12);
        expect(warnings.some(w => w.type === 'danger')).toBe(true);
    });

    it('totals additive weights and drops unknown ids', () => {
        const db = { lavender: fragrance };
        const { totalWeight, breakdown } = calculateAdditivesTotal(
            [{ id: 'lavender', weight: 20 }, { id: 'unknown', weight: 5 }],
            db,
            1000
        );
        expect(totalWeight).toBe(20);
        expect(breakdown).toHaveLength(1);
    });

    it('computes additive volume from density', () => {
        const db = { lavender: fragrance };
        expect(calculateAdditiveVolume([{ id: 'lavender', weight: 18 }], db)).toBeCloseTo(18 / 0.9, 5);
    });
});
