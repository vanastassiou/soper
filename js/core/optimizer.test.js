import { describe, it, expect } from 'vitest';
import {
    getDietaryExclusions,
    calculateProfileError,
    optimizeWeights,
    findFatsForProfile,
    propertiesToFattyAcidTargets,
    validatePropertyTargets,
    generateRandomRecipe,
    suggestFatsForCupboard
} from './optimizer.js';
import { calculateFattyAcidsFromPercentages, calculateProperties } from './calculator.js';
import { allPropertiesInRange } from '../lib/constants.js';
import { FATS } from '../../tests/fixtures.js';

/** Assert a recipe's percentages sum to 100 (within rounding tolerance). */
function expectSumsTo100(recipe) {
    const total = recipe.reduce((s, r) => s + r.percentage, 0);
    expect(total).toBeCloseTo(100, 6);
}

describe('getDietaryExclusions', () => {
    it('excludes animal-based fats when the filter is on', () => {
        const excluded = getDietaryExclusions(FATS, { animalBased: true, includeExoticFats: true });
        expect(excluded.has('tallow')).toBe(true);
        expect(excluded.has('olive')).toBe(false);
    });

    it('excludes exotic fats unless includeExoticFats is set', () => {
        expect(getDietaryExclusions(FATS, {}).has('sunflower')).toBe(true);
        expect(getDietaryExclusions(FATS, { includeExoticFats: true }).has('sunflower')).toBe(false);
    });

    it('excludes fats with significant sourcing concerns', () => {
        const excluded = getDietaryExclusions(FATS, { sourcingConcerns: true, includeExoticFats: true });
        // palm has two environmental concerns -> significant
        expect(excluded.has('palm')).toBe(true);
    });

    it('returns an empty set when no filters are active and exotic is allowed', () => {
        expect(getDietaryExclusions(FATS, { includeExoticFats: true }).size).toBe(0);
    });
});

describe('calculateProfileError', () => {
    it('is zero when the current profile matches the target', () => {
        expect(calculateProfileError({ oleic: 50, lauric: 20 }, { oleic: 50, lauric: 20 })).toBe(0);
    });

    it('sums squared differences over targeted acids only', () => {
        // (50-40)^2 + (20-25)^2 = 100 + 25 = 125; palmitic untargeted -> ignored
        const err = calculateProfileError({ oleic: 40, lauric: 25, palmitic: 99 }, { oleic: 50, lauric: 20 });
        expect(err).toBe(125);
    });

    it('treats missing current acids as zero', () => {
        expect(calculateProfileError({}, { oleic: 10 })).toBe(100);
    });

    it('ignores empty-string targets', () => {
        expect(calculateProfileError({ oleic: 40 }, { oleic: '', lauric: '' })).toBe(0);
    });
});

describe('optimizeWeights', () => {
    it('returns an empty recipe for no fats', () => {
        expect(optimizeWeights([], { oleic: 50 }, FATS)).toEqual([]);
    });

    it('assigns 100% to a single fat', () => {
        expect(optimizeWeights(['olive'], { oleic: 50 }, FATS)).toEqual([{ id: 'olive', percentage: 100 }]);
    });

    it('produces percentages that sum to 100 and respect constraints', () => {
        const recipe = optimizeWeights(['olive', 'coconut', 'palm'], { oleic: 40, lauric: 15 }, FATS);
        expect(recipe).toHaveLength(3);
        const total = recipe.reduce((s, r) => s + r.percentage, 0);
        expect(total).toBe(100);
        for (const r of recipe) {
            expect(r.percentage).toBeGreaterThanOrEqual(5);
            expect(r.percentage).toBeLessThanOrEqual(80);
        }
    });

    it('reduces profile error versus an equal split for a reachable target', () => {
        const ids = ['olive', 'coconut'];
        const target = { oleic: 60, lauric: 5 };
        const equal = ids.map(id => ({ id, percentage: 50 }));
        const equalErr = calculateProfileError(calculateFattyAcidsFromPercentages(equal, FATS), target);
        const optimized = optimizeWeights(ids, target, FATS);
        const optErr = calculateProfileError(calculateFattyAcidsFromPercentages(optimized, FATS), target);
        expect(optErr).toBeLessThanOrEqual(equalErr);
    });
});

describe('findFatsForProfile', () => {
    it('selects fats and returns a normalized recipe with a match quality', () => {
        const result = findFatsForProfile({ oleic: 50, lauric: 15, palmitic: 15 }, FATS, { maxFats: 4 });
        expect(result.recipe.length).toBeGreaterThan(0);
        expect(result.recipe.length).toBeLessThanOrEqual(4);
        expect(result.matchQuality).toBeGreaterThanOrEqual(0);
        expect(result.matchQuality).toBeLessThanOrEqual(100);
        expectSumsTo100(result.recipe);
    });

    it('honours excludeFats', () => {
        const result = findFatsForProfile({ oleic: 60 }, FATS, { maxFats: 5, excludeFats: ['olive'] });
        expect(result.recipe.some(r => r.id === 'olive')).toBe(false);
    });

    it('keeps locked fats first in the result', () => {
        const result = findFatsForProfile({ oleic: 50, lauric: 10 }, FATS, {
            maxFats: 4,
            lockedFats: [{ id: 'castor', percentage: 5 }]
        });
        expect(result.recipe[0].id).toBe('castor');
    });
});

describe('propertiesToFattyAcidTargets', () => {
    it('splits degreasing into lauric and myristic targets', () => {
        const targets = propertiesToFattyAcidTargets({ degreasing: 20 });
        expect(targets.lauric).toBe(14); // 20 * 0.7
        expect(targets.myristic).toBe(6); // 20 * 0.3
    });

    it('derives oleic from a moisturizing target', () => {
        const targets = propertiesToFattyAcidTargets({ moisturizing: 50 });
        expect(targets.oleic).toBe(40); // 50 * 0.8
    });

    it('returns an empty object when no valid targets are supplied', () => {
        expect(propertiesToFattyAcidTargets({ hardness: '' })).toEqual({});
    });
});

describe('validatePropertyTargets', () => {
    it('accepts a logically consistent set of targets', () => {
        expect(validatePropertyTargets({ hardness: 40, moisturizing: 60, degreasing: 15, 'lather-volume': 20 })).toBeNull();
    });

    it('rejects hardness + moisturizing far from 100', () => {
        expect(validatePropertyTargets({ hardness: 40, moisturizing: 20 })).toMatch(/around 100/);
    });

    it('rejects degreasing greater than hardness', () => {
        expect(validatePropertyTargets({ hardness: 30, degreasing: 40 })).toMatch(/cannot exceed Hardness/);
    });
});

describe('generateRandomRecipe', () => {
    it('returns a recipe whose percentages sum to 100', () => {
        const result = generateRandomRecipe(FATS, { minFats: 3, maxFats: 4, maxAttempts: 40 });
        expect(result).not.toBeNull();
        expectSumsTo100(result.recipe);
    });

    it('always includes locked fats', () => {
        const result = generateRandomRecipe(FATS, { lockedFats: ['castor'], minFats: 3, maxFats: 4 });
        expect(result.recipe.some(r => r.id === 'castor')).toBe(true);
    });

    it('returns null when too few fats are available to meet the minimum', () => {
        const tiny = { olive: FATS.olive };
        expect(generateRandomRecipe(tiny, { minFats: 3 })).toBeNull();
    });
});

describe('suggestFatsForCupboard', () => {
    it('returns no suggestions when the base recipe is already in range', () => {
        // A balanced base built from several fats; if in range, allInRange is true and no suggestions.
        const base = [{ id: 'palm', weight: 40 }, { id: 'coconut', weight: 25 }, { id: 'olive', weight: 35 }];
        const props = calculateProperties(calculateFattyAcidsFromPercentages(
            base.map(f => ({ id: f.id, percentage: f.weight })), FATS));
        const result = suggestFatsForCupboard(base, FATS, {});
        if (allPropertiesInRange(props)) {
            expect(result.allInRange).toBe(true);
            expect(result.suggestions).toHaveLength(0);
        } else {
            expect(result).toHaveProperty('currentProperties');
        }
    });

    it('returns empty suggestions for a zero-weight base', () => {
        const result = suggestFatsForCupboard([{ id: 'olive', weight: 0 }], FATS, {});
        expect(result.suggestions).toEqual([]);
        expect(result.allInRange).toBe(false);
    });

    it('suggested fats carry a positive percentage and weight', () => {
        const base = [{ id: 'coconut', weight: 100 }]; // very hard/degreasing, out of range
        const result = suggestFatsForCupboard(base, FATS, { maxSuggestions: 2 });
        for (const s of result.suggestions) {
            expect(s.percentage).toBeGreaterThan(0);
            expect(s.weight).toBeGreaterThanOrEqual(0);
        }
    });
});
