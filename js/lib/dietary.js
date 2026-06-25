/**
 * Shared dietary / ethical-concern predicates.
 *
 * Used by both the UI dietary filter (`js/main.js`) and the programmatic
 * ingredient filter in the optimizer (`js/core/optimizer.js`). The two used to
 * carry verbatim copies of this logic, which is a real correctness risk: a fix
 * in one place would silently diverge from the other.
 */

/**
 * Whether an ingredient's `ethicalConcerns` block is significant enough that
 * the "sourcing concerns" filter should hide it.
 *
 * Significant = any social or political concerns, or two-or-more environmental
 * concerns.
 *
 * @param {Object} item - Ingredient data object (fat, fragrance, colourant, ...)
 * @returns {boolean}
 */
export function hasSignificantEthicalConcerns(item) {
    const concerns = item?.ethicalConcerns;
    if (!concerns) return false;

    const environmental = concerns.environmental || [];
    const social = concerns.social || [];
    const political = concerns.political || [];

    if (social.length > 0 || political.length > 0) return true;
    if (environmental.length >= 2) return true;

    return false;
}
