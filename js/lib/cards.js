/**
 * Shared card-rendering helpers used by both the main app pages
 * (pages/soapmaking/*) and the how-it-works subsite (pages/how-it-works/*).
 */

/**
 * Render an entry card.
 *
 * @param {Object} options
 * @param {string} options.key - Entry key; rendered as data-key on the article.
 * @param {string} options.name - Card title.
 * @param {string} [options.description] - Description rendered as <p class="entry-desc">.
 *   Falsy values omit the description element entirely.
 * @param {string} [options.modifier] - CSS modifier suffix appended to the card class
 *   (e.g., '--process' produces `entry-card entry-card--process`).
 * @param {Object<string, string>} [options.dataAttrs] - Additional data-* attributes
 *   keyed by suffix; e.g. `{ type: 'fat' }` produces `data-type="fat"`.
 * @param {string} [options.extraContent] - Arbitrary HTML appended inside the card,
 *   after the description.
 * @returns {string} HTML string for the card.
 */
export function renderEntryCard({
    key,
    name,
    description = '',
    modifier = '',
    dataAttrs = {},
    extraContent = ''
}) {
    const modifierClass = modifier ? ` entry-card${modifier}` : '';
    const extraData = Object.entries(dataAttrs)
        .map(([k, v]) => ` data-${k}="${v}"`)
        .join('');
    const descPart = description ? `<p class="entry-desc">${description}</p>` : '';

    return `
        <article class="entry-card${modifierClass}" data-key="${key}"${extraData}>
            <header class="entry-header">
                <h2 class="entry-title">${name}</h2>
            </header>
            ${descPart}
            ${extraContent}
        </article>
    `;
}
