/**
 * Shared rendering utilities for how-it-works SPA
 */

import { resolveReferences } from '../../../../js/lib/references.js';

/**
 * Render references HTML block
 * @param {Array} references - Reference identifiers
 * @param {Object} sourcesData - Sources database
 * @returns {string} HTML string
 */
export function renderReferencesHtml(references, sourcesData) {
    if (!references || references.length === 0) return '';
    const refs = resolveReferences(references, sourcesData);
    return `
        <div class="entry-references">
            <span class="references-label">References:</span>
            ${refs.map(ref => `
                <a href="${ref.url}" target="_blank" rel="noopener noreferrer" class="reference-link">${ref.source}</a>
            `).join('')}
        </div>
    `;
}

/**
 * Render related glossary links
 * @param {Array} related - Related term keys
 * @param {Object} glossary - Glossary database
 * @param {Object} options - Rendering options
 * @param {string} options.linkPrefix - URL prefix for links (default: '#glossary')
 * @param {boolean} options.filterDomain - Filter by calculator domain (default: true)
 * @param {boolean} options.dataAttr - Add data-term attribute (default: false)
 * @returns {string} HTML string
 */
export function renderRelatedLinks(related, glossary, options = {}) {
    const { linkPrefix = '#glossary', filterDomain = true, dataAttr = false } = options;
    const validRelated = related?.filter(r =>
        glossary[r] && (!filterDomain || glossary[r].domain?.includes('calculator'))
    );
    if (!validRelated?.length) return '';

    return `
        <div class="entry-related">
            <span class="entry-related-label">Related:</span>
            ${validRelated.map(r =>
                `<a href="${linkPrefix}/${r}" class="entry-related-link"${dataAttr ? ` data-term="${r}"` : ''}>${glossary[r].name}</a>`
            ).join('')}
        </div>
    `;
}

/**
 * Render collapsible details section
 * @param {string} toggleLabel - Label when collapsed
 * @param {string} hideLabel - Label when expanded
 * @param {string} content - HTML content inside details
 * @returns {string} HTML string
 */
export function renderDetails(toggleLabel, hideLabel, content) {
    if (!content) return '';
    return `
        <details class="entry-details">
            <summary>
                <span class="details-toggle">${toggleLabel}</span>
                <span class="details-hide">${hideLabel}</span>
            </summary>
            <div class="entry-details-content">${content}</div>
        </details>
    `;
}

/**
 * Render empty state message if entries array is empty
 * @param {HTMLElement} container - Container element
 * @param {Array} entries - Entries array to check
 * @param {string} message - Message to display if empty
 * @returns {boolean} True if empty state was rendered
 */
export function renderEmptyState(container, entries, message) {
    if (entries.length === 0) {
        container.innerHTML = `<p class="no-results">${message}</p>`;
        return true;
    }
    return false;
}

/**
 * Format details text with proper HTML structure
 * Converts bullet points (•) to <ul><li> and paragraphs to <p>
 * @param {string} text - Raw details text with \n separators
 * @returns {string} Formatted HTML
 */
export function formatDetailsText(text) {
    if (!text) return '';

    const paragraphs = text.split(/\n\n+/);
    const result = [];

    for (const para of paragraphs) {
        const lines = para.split('\n');
        const bulletLines = lines.filter(l => l.trim().startsWith('•'));

        if (bulletLines.length > 0 && bulletLines.length === lines.length) {
            // All lines are bullets - render as list
            const items = lines.map(l => `<li>${l.trim().slice(1).trim()}</li>`).join('');
            result.push(`<ul>${items}</ul>`);
        } else if (bulletLines.length > 0) {
            // Mixed content - split into text and list parts
            let currentList = [];
            let currentText = [];

            for (const line of lines) {
                if (line.trim().startsWith('•')) {
                    if (currentText.length > 0) {
                        result.push(`<p>${currentText.join(' ')}</p>`);
                        currentText = [];
                    }
                    currentList.push(`<li>${line.trim().slice(1).trim()}</li>`);
                } else {
                    if (currentList.length > 0) {
                        result.push(`<ul>${currentList.join('')}</ul>`);
                        currentList = [];
                    }
                    currentText.push(line.trim());
                }
            }

            if (currentList.length > 0) {
                result.push(`<ul>${currentList.join('')}</ul>`);
            }
            if (currentText.length > 0) {
                result.push(`<p>${currentText.join(' ')}</p>`);
            }
        } else {
            // No bullets - regular paragraph
            result.push(`<p>${para.replace(/\n/g, ' ')}</p>`);
        }
    }

    return result.join('');
}

