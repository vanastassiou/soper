/**
 * Properties view - Property glossary terms with related formulas
 */

import { renderEntryCard } from '../../../../js/lib/cards.js';
import { renderReferencesHtml, renderRelatedLinks, renderEmptyState, formatDetailsText } from '../shared/render.js';

export function renderProperties(data, container) {
    const { glossary, formulas, sources } = data;

    // Get property terms from glossary (calculator domain, property type)
    const propertyTerms = Object.entries(glossary)
        .filter(([_, d]) => d.domain?.includes('calculator') && d.type === 'property')
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (renderEmptyState(container, propertyTerms, 'No properties found.')) return;

    container.innerHTML = propertyTerms.map(([key, d]) => {
        // Find related formula if exists
        const relatedFormula = Object.entries(formulas).find(([fKey, fData]) =>
            fData.related?.includes(key) || fKey.includes(key)
        );

        return renderEntryCard({
            key,
            name: d.name,
            description: d.description,
            modifier: '--property',
            extraContent: `
                ${d.details ? `
                    <div class="property-details">
                        ${formatDetailsText(d.details)}
                    </div>
                ` : ''}

                ${relatedFormula ? `
                    <div class="property-formula">
                        <h3 class="entry-subheading">How it's calculated</h3>
                        <div class="formula-equation">
                            <code>${relatedFormula[1].formula}</code>
                        </div>
                        <p class="formula-explanation">${relatedFormula[1].userFriendly}</p>
                        <a href="#algorithms/${relatedFormula[0]}" class="formula-link">See full formula details →</a>
                    </div>
                ` : ''}

                ${renderRelatedLinks(d.related, glossary)}
                ${renderReferencesHtml(d.references, sources)}
            `
        });
    }).join('');
}
