/**
 * Glossary view - Scientific concept terms
 */

import { renderEntryCard } from '../../../../js/lib/cards.js';
import { renderReferencesHtml, renderRelatedLinks, renderDetails, renderEmptyState, formatDetailsText } from '../shared/render.js';

const HIGHLIGHT_DURATION = 2000;

export function renderGlossary(data, container, targetKey = null) {
    const { glossary, sources } = data;

    // Filter by calculator domain and concept type only
    const entries = Object.entries(glossary)
        .filter(([_, d]) => d.domain?.includes('calculator'))
        .filter(([_, d]) => d.type === 'concept')
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    if (renderEmptyState(container, entries, 'No concepts found.')) return;

    container.innerHTML = entries.map(([key, d]) => renderEntryCard({
        key,
        name: d.name,
        description: d.description,
        extraContent: `
            ${renderDetails('More details', 'Hide details', formatDetailsText(d.details))}
            ${renderRelatedLinks(d.related, glossary, { dataAttr: true })}
            ${renderReferencesHtml(d.references, sources)}
        `
    })).join('');

    // Handle related term clicks - scroll within glossary
    container.querySelectorAll('.entry-related-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const termKey = link.dataset.term;
            const entry = container.querySelector(`[data-key="${termKey}"]`);
            if (entry) {
                // Update URL without triggering full navigation
                history.pushState(null, '', `#glossary/${termKey}`);
                scrollToEntry(entry);
            }
        });
    });

    // Scroll to target if specified
    if (targetKey) {
        const entry = container.querySelector(`[data-key="${targetKey}"]`);
        if (entry) {
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => scrollToEntry(entry));
        }
    }
}

function scrollToEntry(entry) {
    entry.scrollIntoView({ behavior: 'smooth', block: 'start' });
    entry.classList.add('highlight');
    setTimeout(() => entry.classList.remove('highlight'), HIGHLIGHT_DURATION);
}
