/**
 * Fat info panel renderer.
 */

import { ELEMENT_IDS } from '../../lib/constants.js';
import { getFatSoapProperties } from '../../core/calculator.js';
import { $, delegate, onActivate } from '../helpers.js';
import { setPanelHeader, panelListItem, renderSoapProperties, openInfoPanel } from './shared.js';

/**
 * Show fat info panel
 * @param {string} fatId - Fat id (kebab-case key)
 * @param {Object} fatsDatabase - Fat database
 * @param {Object} fattyAcidsData - Fatty acid data with soapProperties
 * @param {Object} sourcesData - Sources database for resolving references
 * @param {Function} onFattyAcidClick - Callback when fatty acid is clicked
 */
export function showFatInfo(fatId, fatsDatabase, fattyAcidsData, sourcesData, onFattyAcidClick) {
    if (!fatId || !fatsDatabase[fatId]) return;

    const fat = fatsDatabase[fatId];

    setPanelHeader({
        fatPanelName: fat.name,
        fatPanelType: fat.type || 'fat',
        fatPanelDescription: fat.description
    });

    // Details: SAP and usage as list items with labels
    const sap = fat.details?.sap || fat.sap;
    const usage = fat.details?.usage || fat.usage;

    $('fatPanelDetails').innerHTML =
        panelListItem('NaOH SAP', sap.naoh)
        + panelListItem('KOH SAP', sap.koh)
        + panelListItem('Recommended usage', `${usage.min}–${usage.max}%`);

    // Details: soap properties
    const soapProps = getFatSoapProperties(fat, fattyAcidsData);
    $('fatPanelProperties').innerHTML = soapProps ? renderSoapProperties(soapProps) : '';

    // Fatty acid composition
    const faContainer = $('fatPanelFattyAcids');
    const fattyAcids = fat.details?.fattyAcids || fat.fattyAcids;
    faContainer.innerHTML = Object.entries(fattyAcids)
        .filter(([_, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => `
            <div class="panel-list-item">
                <button type="button" class="panel-list-name panel-list-name--link" data-acid="${name}">${name}</button>
                <span class="panel-list-value">${value}%</span>
            </div>
        `).join('');

    if (onFattyAcidClick) {
        delegate(faContainer, '.panel-list-name--link', 'click', (_e, el) => {
            onFattyAcidClick(el.dataset.acid);
        });
        delegate(faContainer, '.panel-list-name--link', 'keydown', onActivate((e) => {
            const el = e.target.closest('.panel-list-name--link');
            if (el) onFattyAcidClick(el.dataset.acid);
        }));
    }

    openInfoPanel(ELEMENT_IDS.fatInfoPanel, fat.references, sourcesData);
}
