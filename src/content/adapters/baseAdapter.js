/**
 * Base adapter functionality
 * Provides adapter registry and retrieval
 */

import * as greenhouse from './greenhouse.js';
import * as workday from './workday.js';
import * as lever from './lever.js';
import * as taleo from './taleo.js';

// Note: When bundled, these imports are removed and we manually construct adapter objects
// This file is designed to work both as ES module and when bundled

/**
 * Gets an adapter by name
 * @param {string|null} portalName - Name of the portal
 * @returns {Object|null} Adapter module or null
 */
export function getAdapter(portalName) {
  if (!portalName) {
    return null;
  }

  // When bundled, adapter functions are in scope
  // Create adapter objects on-the-fly
  const adapters = {
    greenhouse: typeof greenhouse !== 'undefined' ? greenhouse : {
      mapFields: typeof mapFields !== 'undefined' ? mapFields : null,
      fill: typeof fill !== 'undefined' ? fill : null
    },
    workday: typeof workday !== 'undefined' ? workday : null,
    lever: typeof lever !== 'undefined' ? lever : null,
    taleo: typeof taleo !== 'undefined' ? taleo : null
  };

  return adapters[portalName] || null;
}