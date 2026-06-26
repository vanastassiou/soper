/**
 * Shared helpers for the info panels (fat, glossary, fatty-acid, additive).
 *
 * These small renderers were duplicated inline across the four show*Info
 * functions. Extracting them keeps each panel module focused on its own data
 * shape while sharing the common header / list-item / references scaffolding.
 */

import { ELEMENT_IDS } from '../../lib/constants.js';
import { resolveReferences } from '../../lib/references.js';
import { $ } from '../helpers.js';
import { closeCurrentPanel, openPanel } from '../panelManager.js';

/**
 * Set textContent on a group of panel header fields keyed by element ID.
 * Used by fat, glossary, additive, and fatty-acid info panels to populate
 * the name / type / description slots without repeating $().textContent.
 * @param {Object<string, string>} fields - Map of element ID to text content
 */
export function setPanelHeader(fields) {
    for (const [id, value] of Object.entries(fields)) {
        $(id).textContent = value;
    }
}

/**
 * Render a single panel-list row: label on the left, value on the right.
 * @param {string} label
 * @param {string|number} value
 * @returns {string} HTML
 */
export function panelListItem(label, value) {
    return `
        <div class="panel-list-item">
            <span class="panel-list-name">${label}</span>
            <span class="panel-list-value">${value}</span>
        </div>
    `;
}

/**
 * Render the four standard soap properties (Hardness, Degreasing, Lather, Moisturizing).
 * Used by both the fat-info and fatty-acid panels.
 * @param {{hardness: string, degreasing: string, lather: string, moisturizing: string}} props
 * @returns {string} HTML
 */
export function renderSoapProperties(props) {
    return [
        ['Hardness', props.hardness],
        ['Degreasing', props.degreasing],
        ['Lather', props.lather],
        ['Moisturizing', props.moisturizing]
    ].map(([label, value]) => `
        <div class="panel-prop-item"><span class="panel-prop-label">${label}</span><span class="panel-prop-value">${value}</span></div>
    `).join('');
}

/**
 * Render references section into a panel
 * @param {HTMLElement} panel - The panel element to append references to
 * @param {Array} references - Array of {sourceId, section, url}
 * @param {Object} sourcesData - Sources database for resolving sourceIds
 */
function renderReferences(panel, references, sourcesData) {
    // Remove existing references section if present
    const existing = panel.querySelector('.panel-references-section');
    if (existing) existing.remove();

    if (!references || references.length === 0) return;

    const resolved = resolveReferences(references, sourcesData);
    const section = document.createElement('div');
    section.className = 'panel-content-section panel-references-section';
    section.innerHTML = `
        <h4 class="panel-section-title">References</h4>
        <div class="panel-references">
            ${resolved.map(ref => `
                <div class="reference-item">
                    <a href="${ref.url}" target="_blank" rel="noopener noreferrer">${ref.source}</a>
                    <span class="reference-section">${ref.section}</span>
                </div>
            `).join('')}
        </div>
    `;
    panel.appendChild(section);
}

/**
 * Render references into a panel by ID, then open it.
 * Used by the four show*Info functions to share the closing dance.
 * @param {string} panelId - Element ID of the panel
 * @param {Array} references - Array of {sourceId, section, url}
 * @param {Object} sourcesData - Sources database for resolving sourceIds
 */
export function openInfoPanel(panelId, references, sourcesData) {
    renderReferences($(panelId), references, sourcesData);
    openPanel(panelId, ELEMENT_IDS.panelOverlay);
}

/**
 * Close all info panels - uses panelManager to close current panel.
 * Since only one panel can be open at a time, this closes whichever is open.
 */
export function closeAllInfoPanels() {
    closeCurrentPanel();
}
