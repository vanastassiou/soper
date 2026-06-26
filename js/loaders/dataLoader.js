/**
 * Data loading and validation.
 *
 * Fetches every JSON data file and its schema, populates the reactive state,
 * and validates strictly against the schemas. Isolated from main.js so the
 * composition root stays focused on wiring (ARCHITECTURE_RISKS Risk 2).
 */

import * as validation from '../lib/validation.js';
import { state } from '../state/state.js';

/**
 * Load all data files and schemas into state, then validate strictly.
 * On failure, replaces the page body with a visible error and rethrows.
 * @returns {Promise<void>}
 */
export async function loadData() {
    try {
        // Additive databases (4 separate files by category)
        const additiveFiles = ['fragrances', 'colourants', 'soap-performance', 'skin-care'];

        const [fatsResponse, glossaryResponse, fattyAcidsResponse, tooltipsResponse, sourcesResponse, formulasResponse,
               ...additiveResponses] = await Promise.all([
            fetch('./data/fats.json'),
            fetch('./data/glossary.json'),
            fetch('./data/fatty-acids.json'),
            fetch('./data/tooltips.json'),
            fetch('./data/sources.json'),
            fetch('./data/formulas.json'),
            ...additiveFiles.map(f => fetch(`./data/${f}.json`))
        ]);

        const [fatsSchemaResponse, glossarySchemaResponse, fattyAcidsSchemaResponse, tooltipsSchemaResponse, sourcesSchemaResponse, formulasSchemaResponse,
               commonDefinitionsSchemaResponse, ...additiveSchemaResponses] = await Promise.all([
            fetch('./data/schemas/fats.schema.json'),
            fetch('./data/schemas/glossary.schema.json'),
            fetch('./data/schemas/fatty-acids.schema.json'),
            fetch('./data/schemas/tooltips.schema.json'),
            fetch('./data/schemas/sources.schema.json'),
            fetch('./data/schemas/formulas.schema.json'),
            fetch('./data/schemas/common-definitions.schema.json'),
            ...additiveFiles.map(f => fetch(`./data/schemas/${f}.schema.json`))
        ]);

        state.fatsDatabase = await fatsResponse.json();
        state.glossaryData = await glossaryResponse.json();
        state.fattyAcidsData = await fattyAcidsResponse.json();
        state.tooltipsData = await tooltipsResponse.json();
        state.sourcesData = await sourcesResponse.json();
        state.formulasData = await formulasResponse.json();

        // Load additive databases into state
        const additiveData = await Promise.all(additiveResponses.map(r => r.json()));
        state.fragrancesDatabase = additiveData[0];
        state.colourantsDatabase = additiveData[1];
        state.soapPerformanceDatabase = additiveData[2];
        state.skinCareDatabase = additiveData[3];

        const additiveSchemas = await Promise.all(additiveSchemaResponses.map(r => r.json()));
        const schemas = {
            fats: await fatsSchemaResponse.json(),
            glossary: await glossarySchemaResponse.json(),
            fattyAcids: await fattyAcidsSchemaResponse.json(),
            tooltips: await tooltipsSchemaResponse.json(),
            sources: await sourcesSchemaResponse.json(),
            formulas: await formulasSchemaResponse.json(),
            commonDefinitions: await commonDefinitionsSchemaResponse.json(),
            fragrances: additiveSchemas[0],
            colourants: additiveSchemas[1],
            soapPerformance: additiveSchemas[2],
            skinCare: additiveSchemas[3]
        };

        validation.initValidation(schemas);
        validation.validateAllStrict({
            fats: state.fatsDatabase,
            glossary: state.glossaryData,
            fattyAcids: state.fattyAcidsData,
            tooltips: state.tooltipsData,
            sources: state.sourcesData,
            formulas: state.formulasData,
            fragrances: state.fragrancesDatabase,
            colourants: state.colourantsDatabase,
            soapPerformance: state.soapPerformanceDatabase,
            skinCare: state.skinCareDatabase
        });
    } catch (error) {
        console.error('Error loading or validating data:', error);
        document.body.innerHTML = `
            <div style="color: #ff6b6b; padding: 40px; font-family: monospace; background: #1a1a2e;">
                <h1 style="color: #ff6b6b;">Data Loading Error</h1>
                <pre style="white-space: pre-wrap; margin-top: 20px;">${error.message}</pre>
            </div>
        `;
        throw error;
    }
}
