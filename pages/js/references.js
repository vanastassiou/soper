/**
 * References page functionality
 * Aggregates citations from all data files and displays grouped by publication
 */

import { $ } from '../../js/ui/helpers.js';

let publicationIndex = {};
let sourcesData = {};

/**
 * Load all data sources and build the publication index
 */
async function loadReferences() {
    try {
        const [
            fatsRes, fragrancesRes, colourantsRes, soapPerformanceRes, skinCareRes,
            equipmentRes, processesRes, formulasRes, fattyAcidsRes, glossaryRes, sourcesRes
        ] = await Promise.all([
            fetch('../data/fats.json'),
            fetch('../data/fragrances.json'),
            fetch('../data/colourants.json'),
            fetch('../data/soap-performance.json'),
            fetch('../data/skin-care.json'),
            fetch('../data/equipment.json'),
            fetch('../data/processes.json'),
            fetch('../data/formulas.json'),
            fetch('../data/fatty-acids.json'),
            fetch('../data/glossary.json'),
            fetch('../data/sources.json')
        ]);

        const [
            fats, fragrances, colourants, soapPerformance, skinCare,
            equipment, processes, formulas, fattyAcids, glossary, sources
        ] = await Promise.all([
            fatsRes.json(),
            fragrancesRes.json(),
            colourantsRes.json(),
            soapPerformanceRes.json(),
            skinCareRes.json(),
            equipmentRes.json(),
            processesRes.json(),
            formulasRes.json(),
            fattyAcidsRes.json(),
            glossaryRes.json(),
            sourcesRes.json()
        ]);

        // Store sources data for resolution
        sourcesData = sources;

        // Extract references from each data source
        const allRefs = [
            ...extractReferences(fats, 'fat'),
            ...extractReferences(fragrances, 'additive'),
            ...extractReferences(colourants, 'additive'),
            ...extractReferences(soapPerformance, 'additive'),
            ...extractReferences(skinCare, 'additive'),
            ...extractReferences(equipment, 'equipment'),
            ...extractReferences(processes, 'process'),
            ...extractReferences(formulas, 'formula'),
            ...extractReferences(fattyAcids, 'fatty-acid'),
            ...extractReferences(glossary, 'glossary')
        ];

        // Build inverted index grouped by publication
        publicationIndex = buildPublicationIndex(allRefs);

        renderReferences();
    } catch (error) {
        console.error('Failed to load references:', error);
        $('referencesList').innerHTML = '<p class="error">Failed to load references.</p>';
    }
}

/**
 * Extract references from a data object
 * All files now use `references` array format with sourceId
 */
function extractReferences(data, type) {
    const refs = [];

    for (const [id, item] of Object.entries(data)) {
        if (!item.references || !Array.isArray(item.references)) continue;

        for (const ref of item.references) {
            refs.push({
                sourceId: ref.sourceId,
                section: ref.section || null,
                url: ref.url || null,
                note: ref.note || null,
                citedBy: {
                    type,
                    id,
                    name: item.name || item.term || id
                }
            });
        }
    }

    return refs;
}

/**
 * Resolve a sourceId to its full source information
 */
function resolveSource(sourceId) {
    const source = sourcesData[sourceId];
    if (!source) {
        console.warn(`Unknown source ID: ${sourceId}`);
        return {
            name: sourceId,
            description: 'Source not found'
        };
    }
    return source;
}

/**
 * Build inverted index: sourceId → citations
 */
function buildPublicationIndex(allRefs) {
    const index = {};

    for (const ref of allRefs) {
        const sourceId = ref.sourceId;

        if (!index[sourceId]) {
            const source = resolveSource(sourceId);
            index[sourceId] = {
                name: source.name,
                description: source.description,
                baseUrl: source.baseUrl,
                publisher: source.publisher,
                fundedBy: source.fundedBy,
                citations: []
            };
        }

        // Check if this exact citation (same section/url) already exists
        let existingCitation = index[sourceId].citations.find(c =>
            c.section === ref.section && c.url === ref.url
        );

        if (existingCitation) {
            // Add to existing citation's citedBy list
            existingCitation.citedBy.push(ref.citedBy);
        } else {
            // Create new citation entry
            index[sourceId].citations.push({
                section: ref.section,
                url: ref.url,
                note: ref.note,
                citedBy: [ref.citedBy]
            });
        }
    }

    return index;
}

/**
 * Get link URL for a cited item
 */
function getCitedByLink(item) {
    switch (item.type) {
        case 'formula':
            return `how-it-works/#algorithms/${item.id}`;
        case 'glossary':
            return `soapmaking/glossary.html#${item.id}`;
        case 'fatty-acid':
            return `how-it-works/#glossary/${item.id}`;
        case 'fat':
            return `soapmaking/ingredients.html#${item.id}`;
        case 'additive':
            return `../index.html?show=additive-${item.id}`;
        case 'equipment':
            return `soapmaking/equipment.html#${item.id}`;
        case 'process':
            return `soapmaking/processes.html#${item.id}`;
        default:
            return null;
    }
}

/**
 * Render the references list
 */
function renderReferences() {
    const container = $('referencesList');

    // Sort publications alphabetically by name
    const sortedPublications = Object.entries(publicationIndex)
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (sortedPublications.length === 0) {
        container.innerHTML = '<p class="no-results">No references found.</p>';
        return;
    }

    container.innerHTML = sortedPublications.map(([sourceId, pub]) => `
        <article class="entry-card" data-key="${sourceId}">
            <header class="entry-header">
                ${pub.baseUrl ? `
                    <a href="${escapeHtml(pub.baseUrl)}" target="_blank" rel="noopener" class="entry-title entry-title-link">${escapeHtml(pub.name)} <span class="external-icon" aria-hidden="true">↗</span></a>
                ` : `
                    <h2 class="entry-title">${escapeHtml(pub.name)}</h2>
                `}
            </header>
            ${pub.description ? `
                <p class="entry-desc">${escapeHtml(pub.description)}</p>
            ` : ''}
            ${pub.publisher || pub.fundedBy ? `
                <div class="entry-meta">
                    ${pub.publisher ? `<div><span class="entry-meta-label">Publisher:</span> ${escapeHtml(pub.publisher)}</div>` : ''}
                    ${pub.fundedBy ? `<div><span class="entry-meta-label">Funded by:</span> ${escapeHtml(pub.fundedBy)}</div>` : ''}
                </div>
            ` : ''}
            <details class="entry-details citations-details">
                <summary>
                    <span class="details-toggle">${pub.citations.length} citation${pub.citations.length !== 1 ? 's' : ''}</span>
                    <span class="details-hide">Hide citations</span>
                </summary>
                <div class="entry-details-content citations-content">
                    ${pub.citations.map(citation => `
                        <div class="citation-item">
                            ${citation.section ? (citation.url ? `
                                <a href="${escapeHtml(citation.url)}" target="_blank" rel="noopener" class="citation-title">
                                    ${escapeHtml(citation.section)} <span class="external-icon" aria-hidden="true">↗</span>
                                </a>
                            ` : `
                                <div class="citation-title">${escapeHtml(citation.section)}</div>
                            `) : ''}
                            ${citation.note ? `
                                <div class="citation-note">${escapeHtml(citation.note)}</div>
                            ` : ''}
                            <div class="cited-by">
                                <span class="cited-by-label">Cited by:</span>
                                ${citation.citedBy.map(item => {
                                    const link = getCitedByLink(item);
                                    return `<a href="${link}" class="cited-by-link">${escapeHtml(item.name)}</a>`;
                                }).join(', ')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </details>
        </article>
    `).join('');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize
loadReferences();
