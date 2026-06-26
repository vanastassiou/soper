/**
 * Shared JSDoc type definitions for the pure data layer.
 *
 * These describe the JSON-loaded data shapes (validated at runtime by ajv) so
 * the type checker can enforce the contracts the function JSDoc already implies.
 * This module has no runtime exports; import the types with
 * `@typedef {import('../lib/types.js').Fat} Fat`.
 */

/**
 * Fatty acid composition or contribution, keyed by acid name (e.g. 'lauric').
 * @typedef {Object<string, number>} FattyAcids
 */

/**
 * Calculated soap property values, keyed by property (e.g. 'hardness').
 * @typedef {Object<string, number>} PropertyValues
 */

/**
 * Target fatty acid (or property) values. Values may be empty strings when a
 * target is left unspecified in the UI, hence number | string.
 * @typedef {Object<string, (number|string)>} TargetProfile
 */

/**
 * A single fat as stored in fats.json. Supports both the legacy flat shape and
 * the newer nested `details` shape; most fields are optional accordingly.
 * @typedef {Object} Fat
 * @property {string} [id] - Database key, attached when the fat is spread into a list
 * @property {string} [name]
 * @property {string} [type]
 * @property {string} [description]
 * @property {Object<string, number>} [sap] - {naoh, koh}
 * @property {Object<string, number>} [usage] - {min, max}
 * @property {FattyAcids} [fattyAcids]
 * @property {Object<string, any>} [details] - Nested {sap, usage, fattyAcids, iodine, ins, density}
 * @property {Object<string, any>} [dietary]
 * @property {Object<string, any>} [ethicalConcerns]
 * @property {Array<any>} [references]
 * @property {number} [iodine]
 * @property {number} [ins]
 * @property {number} [density]
 * @property {number} [score] - Assigned by optimizer scoring passes
 */

/**
 * A fats database keyed by fat id.
 * @typedef {Object<string, Fat>} FatsDatabase
 */

/**
 * A fat with its database id guaranteed present (as produced by spreading a
 * `[id, data]` entry). Used by the optimizer's scoring/selection passes.
 * @typedef {Fat & {id: string}} ScoredFat
 */

/**
 * A recipe entry. Select Fats / profile modes use `percentage`; cupboard and
 * additive flows use `weight`. Both are optional on the general shape.
 * @typedef {Object} RecipeItem
 * @property {string} id
 * @property {number} [weight]
 * @property {number} [percentage]
 */

/**
 * A weight-based recipe/additive entry.
 * @typedef {Object} WeightItem
 * @property {string} id
 * @property {number} weight
 */

/**
 * A percentage-based recipe entry.
 * @typedef {Object} PercentItem
 * @property {string} id
 * @property {number} percentage
 */

export {};
