import { describe, it, expect, vi } from 'vitest';
import {
    resolveReference,
    resolveReferences,
    enrichWithReferences,
    renderReferencesHtml
} from './references.js';

const SOURCES = {
    'src-1': { name: 'Soap Science', description: 'A reference text', baseUrl: 'https://example.com', publisher: 'Pub', fundedBy: 'None' }
};

describe('resolveReference', () => {
    it('joins a reference with its source definition', () => {
        const ref = { sourceId: 'src-1', section: 'Ch. 2', url: 'https://example.com/2', note: 'see table' };
        const resolved = resolveReference(ref, SOURCES);
        expect(resolved.source).toBe('Soap Science');
        expect(resolved.section).toBe('Ch. 2');
        expect(resolved.url).toBe('https://example.com/2');
        expect(resolved.note).toBe('see table');
    });

    it('falls back gracefully and warns for an unknown source id', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const resolved = resolveReference({ sourceId: 'missing' }, SOURCES);
        expect(resolved.source).toBe('missing');
        expect(resolved.sourceDescription).toBe('Source not found');
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });
});

describe('resolveReferences', () => {
    it('returns an empty array for null or non-array input', () => {
        expect(resolveReferences(null, SOURCES)).toEqual([]);
        expect(resolveReferences(undefined, SOURCES)).toEqual([]);
        expect(resolveReferences('not-an-array', SOURCES)).toEqual([]);
    });

    it('resolves each reference in the array', () => {
        const out = resolveReferences([{ sourceId: 'src-1', url: 'u' }], SOURCES);
        expect(out).toHaveLength(1);
        expect(out[0].source).toBe('Soap Science');
    });
});

describe('enrichWithReferences', () => {
    it('returns the item unchanged when it has no references', () => {
        const item = { name: 'x' };
        expect(enrichWithReferences(item, SOURCES)).toBe(item);
    });

    it('attaches resolvedReferences when references are present', () => {
        const item = { name: 'x', references: [{ sourceId: 'src-1', url: 'u' }] };
        const enriched = enrichWithReferences(item, SOURCES);
        expect(enriched.resolvedReferences).toHaveLength(1);
        expect(enriched.resolvedReferences[0].source).toBe('Soap Science');
    });
});

describe('renderReferencesHtml', () => {
    it('returns an empty string for no references', () => {
        expect(renderReferencesHtml([], SOURCES)).toBe('');
        expect(renderReferencesHtml(null, SOURCES)).toBe('');
    });

    it('renders an anchor per reference with safe link attributes', () => {
        const html = renderReferencesHtml([{ sourceId: 'src-1', url: 'https://example.com/2' }], SOURCES);
        expect(html).toContain('href="https://example.com/2"');
        expect(html).toContain('rel="noopener noreferrer"');
        expect(html).toContain('Soap Science');
    });
});
