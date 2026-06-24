/**
 * Category-filter scaffolding shared across soapmaking pages.
 * Wires `.page-filter` buttons to the URL hash and invokes onChange.
 */

export function setupCategoryFilters({ validCategories, onChange }) {
    const getCategoryFromHash = () => {
        const hash = window.location.hash.slice(1);
        return validCategories.includes(hash) ? hash : 'all';
    };

    const updateButtonState = (category) => {
        document.querySelectorAll('.page-filter').forEach(btn => {
            const isActive = btn.dataset.category === category;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    };

    const setCategory = (category) => {
        updateButtonState(category);
        onChange(category);
    };

    document.querySelectorAll('.page-filter').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;
            window.location.hash = category === 'all' ? '' : category;
        });
    });

    window.addEventListener('hashchange', () => setCategory(getCategoryFromHash()));
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) setCategory(getCategoryFromHash());
    });

    const initial = getCategoryFromHash();
    updateButtonState(initial);
    return initial;
}
