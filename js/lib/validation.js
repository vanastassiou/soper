/**
 * JSON Schema validation for data files
 * Uses Ajv loaded from CDN
 */

/** @type {any} */
let ajvInstance = null;
/** @type {Object<string, any>} */
let validators = {};

/**
 * Initialize Ajv and compile schemas
 * @param {Object<string, any>} schemas - Schema objects including commonDefinitions for shared refs
 */
export function initValidation(schemas) {
    // Ajv is loaded as a global via a classic <script> tag (see index.html).
    const Ajv = /** @type {any} */ (globalThis).Ajv;
    if (typeof Ajv === 'undefined') {
        throw new Error('Ajv library not loaded. Ensure CDN script is included before this module.');
    }

    ajvInstance = new Ajv({ allErrors: true, strict: false });

    // Register common definitions schema first for cross-file $ref support
    if (schemas.commonDefinitions) {
        ajvInstance.addSchema(schemas.commonDefinitions, 'common-definitions.schema.json');
    }

    validators = {
        fats: ajvInstance.compile(schemas.fats),
        glossary: ajvInstance.compile(schemas.glossary),
        fattyAcids: ajvInstance.compile(schemas.fattyAcids),
        tooltips: ajvInstance.compile(schemas.tooltips),
        sources: ajvInstance.compile(schemas.sources),
        formulas: ajvInstance.compile(schemas.formulas),
        fragrances: ajvInstance.compile(schemas.fragrances),
        colourants: ajvInstance.compile(schemas.colourants),
        soapPerformance: ajvInstance.compile(schemas.soapPerformance),
        skinCare: ajvInstance.compile(schemas.skinCare)
    };
}

/**
 * Validate data against schema
 * @param {string} schemaName - Schema name (e.g., 'fats', 'glossary', 'fragrances')
 * @param {Object<string, any>} data - Data to validate
 * @returns {{valid: boolean, errors: (Array<any>|null)}}
 */
export function validate(schemaName, data) {
    const validator = validators[schemaName];
    if (!validator) {
        throw new Error(`Unknown schema: ${schemaName}`);
    }

    const valid = validator(data);
    return {
        valid,
        errors: valid ? null : validator.errors
    };
}

/**
 * Format validation errors for display
 * @param {Array<any>} errors - Ajv error array
 * @returns {string} Human-readable error message
 */
export function formatErrors(errors) {
    return errors.map(err => {
        const path = err.instancePath || 'root';
        return `  ${path}: ${err.message}`;
    }).join('\n');
}

/**
 * Validate all data files and throw on failure (strict mode)
 * @param {Object<string, any>} data - All data objects to validate against their schemas
 * @throws {Error} If any validation fails
 */
export function validateAllStrict(data) {
    /** @type {Object<string, {valid: boolean, errors: (Array<any>|null)}>} */
    const results = {};
    for (const [name, dataset] of Object.entries(data)) {
        results[name] = validate(name, dataset);
    }

    const failures = Object.entries(results)
        .filter(([_, result]) => !result.valid);

    if (failures.length > 0) {
        const messages = failures.map(([name, result]) =>
            `${name}.json validation failed:\n${formatErrors(result.errors || [])}`
        );
        throw new Error(`Data validation failed:\n\n${messages.join('\n\n')}`);
    }

    console.log('All data files validated successfully');
}
