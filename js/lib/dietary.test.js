import { describe, it, expect } from 'vitest';
import { hasSignificantEthicalConcerns } from './dietary.js';

describe('hasSignificantEthicalConcerns', () => {
    it('is false when the item has no ethicalConcerns block', () => {
        expect(hasSignificantEthicalConcerns({})).toBe(false);
        expect(hasSignificantEthicalConcerns(null)).toBe(false);
        expect(hasSignificantEthicalConcerns(undefined)).toBe(false);
    });

    it('is true for any social concern', () => {
        expect(hasSignificantEthicalConcerns({ ethicalConcerns: { social: ['labour'] } })).toBe(true);
    });

    it('is true for any political concern', () => {
        expect(hasSignificantEthicalConcerns({ ethicalConcerns: { political: ['sanctions'] } })).toBe(true);
    });

    it('needs two or more environmental concerns to be significant', () => {
        expect(hasSignificantEthicalConcerns({ ethicalConcerns: { environmental: ['water'] } })).toBe(false);
        expect(hasSignificantEthicalConcerns({ ethicalConcerns: { environmental: ['water', 'deforestation'] } })).toBe(true);
    });

    it('is false for an empty concerns block', () => {
        expect(hasSignificantEthicalConcerns({ ethicalConcerns: { environmental: [], social: [], political: [] } })).toBe(false);
    });
});
