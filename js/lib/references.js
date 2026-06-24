/**
 * Reference resolution utilities
 * Joins normalized references with source definitions at runtime
 */

/**
 * Resolve a reference by joining with sources data
 * @param {Object} reference - Reference object with sourceId
 * @param {Object} sources - Sources database
 * @returns {Object} Enriched reference with source details
 */
export function resolveReference(reference, sources) {
    const source = sources[reference.sourceId];
    if (!source) {
        console.warn(`Unknown source ID: ${reference.sourceId}`);
        return {
            ...reference,
            source: reference.sourceId,
            sourceDescription: 'Source not found'
        };
    }
    return {
        source: source.name,
        sourceDescription: source.description,
        baseUrl: source.baseUrl,
        publisher: source.publisher,
        fundedBy: source.fundedBy,
        section: reference.section,
        url: reference.url,
        note: reference.note
    };
}

/**
 * Resolve all references in an array
 * @param {Array} references - Array of reference objects
 * @param {Object} sources - Sources database
 * @returns {Array} Enriched references
 */
export function resolveReferences(references, sources) {
    if (!references || !Array.isArray(references)) return [];
    return references.map(ref => resolveReference(ref, sources));
}

/**
 * Enrich an item with resolved references
 * @param {Object} item - Data item with references property
 * @param {Object} sources - Sources database
 * @returns {Object} Item with enriched references
 */
export function enrichWithReferences(item, sources) {
    if (!item.references) return item;
    return {
        ...item,
        resolvedReferences: resolveReferences(item.references, sources)
    };
}

/**
 * Render a list of references as the standard entry-card footer.
 * Returns an empty string if there are no references.
 */
export function renderReferencesHtml(references, sources) {
    if (!references || references.length === 0) return '';
    const refs = resolveReferences(references, sources);
    return `
        <div class="entry-references">
            <span class="references-label">References:</span>
            ${refs.map(ref => `
                <a href="${ref.url}" target="_blank" rel="noopener noreferrer" class="reference-link">${ref.source}</a>
            `).join('')}
        </div>
    `;
}
