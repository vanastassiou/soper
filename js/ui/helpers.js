/**
 * DOM utility functions for the soap recipe builder UI
 * Provides safe element access, batch updates, and event delegation
 */

// ============================================
// Element Access
// ============================================

/**
 * Get element by ID with optional warning
 * @param {string} id - Element ID
 * @param {boolean} warn - Whether to warn if not found (default: false)
 * @returns {HTMLElement|null} Element or null
 */
export function $(id, warn = false) {
    const el = document.getElementById(id);
    if (!el && warn) {
        console.warn(`Element not found: ${id}`);
    }
    return el;
}

/**
 * Get element by ID, throw if not found
 * @param {string} id - Element ID
 * @returns {HTMLElement} Element
 * @throws {Error} If element not found
 */
export function $required(id) {
    const el = document.getElementById(id);
    if (!el) {
        throw new Error(`Required element not found: ${id}`);
    }
    return el;
}

// ============================================
// Batch Updates
// ============================================

/**
 * Batch update text content with formatting
 * @param {Array<[string, number, number]>} updates - Array of [elementId, value, decimals] tuples
 */
export function batchUpdateNumbers(updates) {
    updates.forEach(([id, value, decimals = 2]) => {
        const el = $(id);
        if (el) {
            el.textContent = value.toFixed(decimals);
        }
    });
}

/**
 * Toggle a class on an element
 * @param {string} id - Element ID
 * @param {string} className - Class to toggle
 * @param {boolean} force - Force add (true) or remove (false)
 */
export function toggleClass(id, className, force) {
    const el = $(id);
    if (el) {
        el.classList.toggle(className, force);
    }
}

/**
 * Add/remove 'hidden' class (by element ID)
 * @param {string} id - Element ID
 * @param {boolean} hidden - Whether to hide
 */
export function setHidden(id, hidden) {
    toggleClass(id, 'hidden', hidden);
}

/**
 * Set visibility of an element (add/remove 'hidden' class)
 * @param {HTMLElement|null} element - Element to show/hide
 * @param {boolean} isVisible - Whether element should be visible
 */
export function setVisibility(element, isVisible) {
    if (element) {
        element.classList.toggle('hidden', !isVisible);
    }
}

/**
 * Add/remove 'open' class (for panels)
 * @param {string} id - Element ID
 * @param {boolean} open - Whether to open
 */
export function setOpen(id, open) {
    toggleClass(id, 'open', open);
}

// Note: openPanel/closePanel moved to panelManager.js for enhanced focus management

// ============================================
// Event Delegation
// ============================================

/**
 * Set up an AbortController for a container element
 * Aborts any previous controller and returns a new signal
 * @param {HTMLElement} container - Container element
 * @returns {AbortSignal} Signal for the new AbortController
 */
export function setupAbortSignal(container) {
    container._abortController?.abort();
    container._abortController = new AbortController();
    return container._abortController.signal;
}

/**
 * Set up event delegation on a container
 * @param {HTMLElement} container - Container element
 * @param {string} selector - CSS selector for target elements
 * @param {string} eventType - Event type (e.g., 'click', 'input')
 * @param {Function} handler - Event handler (receives event and matched element)
 * @param {Object} [options] - addEventListener options (e.g., { signal } for cleanup)
 */
export function delegate(container, selector, eventType, handler, options) {
    container.addEventListener(eventType, (e) => {
        const target = e.target.closest(selector);
        if (target && container.contains(target)) {
            handler(e, target);
        }
    }, options);
}

/**
 * Create keyboard activation handler for Enter/Space
 * Use with both 'click' and 'keydown' events for accessible buttons
 * @param {Function} callback - Function to call on activation
 * @returns {Function} Event handler
 */
export function onActivate(callback) {
    return (e) => {
        if (e.type === 'click' || e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            callback(e);
        }
    };
}

// ============================================
// Section Display Helpers
// ============================================

/**
 * Conditionally show/hide a section with content.
 *
 * @param {HTMLElement} element - Section element whose display is toggled.
 * @param {string|null} content - HTML content (null/empty hides section).
 * @param {HTMLElement} [contentTarget] - Element to receive `innerHTML`.
 *   Defaults to `element` (legacy single-element behaviour).
 */
export function showSection(element, content, contentTarget = element) {
    if (!element) return;
    if (content) {
        if (contentTarget) contentTarget.innerHTML = content;
        element.style.display = 'block';
    } else {
        element.style.display = 'none';
    }
}

/**
 * Populate a select element with sorted options
 * @param {HTMLSelectElement} selectElement - Select element to populate
 * @param {Object} entries - Object of {id: {name: string, ...}} entries
 * @param {Set|Array} excludeIds - IDs to exclude from options
 * @param {Function} filterFn - Optional additional filter function
 */
export function populateSelect(selectElement, entries, excludeIds = new Set(), filterFn = null) {
    // Clear existing options (keep placeholder at index 0)
    while (selectElement.options.length > 1) {
        selectElement.remove(1);
    }

    // Convert to array if needed
    const excluded = excludeIds instanceof Set ? excludeIds : new Set(excludeIds);

    // Sort entries by name and filter
    const sorted = Object.entries(entries)
        .filter(([id, data]) => !excluded.has(id) && (!filterFn || filterFn(id, data)))
        .sort((a, b) => a[1].name.localeCompare(b[1].name));

    // Add options
    sorted.forEach(([id, data]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = data.name;
        selectElement.appendChild(option);
    });
}

/**
 * Format items into a prose list with Oxford comma
 * @param {Array} items - Items to format
 * @param {Function} formatter - Function to format each item
 * @returns {string} Formatted prose list
 */
export function formatProseList(items, formatter) {
    if (items.length === 0) return '';
    const parts = items.map(formatter);
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    const last = parts.pop();
    return `${parts.join(', ')}, and ${last}`;
}

// ============================================
// Positioning
// ============================================

/**
 * Position an element relative to an anchor, keeping it within viewport
 * @param {HTMLElement} element - Element to position
 * @param {HTMLElement} anchor - Anchor element
 * @param {Object} options - {offsetY, preferBelow}
 */
export function positionNearAnchor(element, anchor, options = {}) {
    const { offsetY = 8, preferBelow = true } = options;

    const anchorRect = anchor.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    // Make visible to measure
    const originalDisplay = element.style.display;
    element.style.visibility = 'hidden';
    element.style.display = 'block';
    const elementRect = element.getBoundingClientRect();
    element.style.visibility = '';
    element.style.display = originalDisplay;

    // Calculate position
    let top = preferBelow
        ? anchorRect.bottom + scrollTop + offsetY
        : anchorRect.top + scrollTop - elementRect.height - offsetY;

    let left = anchorRect.left + scrollLeft;

    // Keep within viewport horizontally
    if (left + elementRect.width > window.innerWidth - 20) {
        left = window.innerWidth - elementRect.width - 20;
    }
    if (left < 10) left = 10;

    // Flip vertically if needed
    if (preferBelow && top + elementRect.height > window.innerHeight + scrollTop - 20) {
        top = anchorRect.top + scrollTop - elementRect.height - offsetY;
    } else if (!preferBelow && top < scrollTop + 20) {
        top = anchorRect.bottom + scrollTop + offsetY;
    }

    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
}

// ============================================
// Tab Navigation (WCAG Arrow Key Support)
// ============================================

/**
 * Enable arrow key navigation for a tab list (WCAG 2.2 recommended)
 * @param {HTMLElement} tablist - Container with role="tablist"
 * @param {Function} onTabChange - Callback when tab changes (receives tab element)
 */
export function enableTabArrowNavigation(tablist, onTabChange) {
    tablist.addEventListener('keydown', (e) => {
        const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const currentIndex = tabs.findIndex(tab => tab === document.activeElement);

        if (currentIndex === -1) return;

        let newIndex = currentIndex;

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            newIndex = (currentIndex + 1) % tabs.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        } else if (e.key === 'Home') {
            newIndex = 0;
        } else if (e.key === 'End') {
            newIndex = tabs.length - 1;
        } else {
            return; // Not a navigation key
        }

        e.preventDefault();
        tabs[newIndex].focus();

        // Optionally activate on focus (auto-activation pattern)
        if (onTabChange && newIndex !== currentIndex) {
            onTabChange(tabs[newIndex]);
        }
    });
}

// ============================================
// Form Helpers
// ============================================

/**
 * Parse float with fallback
 * @param {string} value - Value to parse
 * @param {number} fallback - Fallback value
 * @returns {number} Parsed number or fallback
 */
export function parseFloatOr(value, fallback = 0) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
}

/**
 * Parse int with fallback
 * @param {string} value - Value to parse
 * @param {number} fallback - Fallback value
 * @returns {number} Parsed number or fallback
 */
export function parseIntOr(value, fallback = 0) {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? fallback : parsed;
}
