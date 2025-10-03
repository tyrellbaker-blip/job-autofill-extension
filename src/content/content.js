/**
 * Content script for autofill functionality
 * Listens for autofill requests and fills forms
 */

import { loadProfile } from '../util/storage.js';
import { deriveKey, decryptJson } from '../util/crypto.js';
import { detectPortal } from './detectors.js';
import { getAdapter } from './adapters/baseAdapter.js';
import { genericFill } from './filler.js';

/**
 * Handles autofill request messages
 */
chrome.runtime.onMessage.addListener(async (message) => {
  if (!message || message.type !== 'AUTOFILL_REQUEST') {
    return;
  }

  try {
    // Load profile from storage
    const storedProfile = await loadProfile();

    if (!storedProfile) {
      return;
    }

    let profile = storedProfile;

    // Decrypt if encrypted
    if (profile._enc === true) {
      const passphrase = message.passphrase || '';

      // Can't decrypt without passphrase
      if (!passphrase) {
        return;
      }

      const key = await deriveKey(passphrase);
      profile = await decryptJson(profile, key);
    }

    // Detect portal
    const portalName = detectPortal(window.location.hostname, document);

    // Get adapter
    const adapter = getAdapter(portalName);

    // Try to use adapter if available
    if (adapter && adapter.mapFields) {
      const fieldMap = adapter.mapFields(document);

      if (fieldMap && adapter.fill) {
        adapter.fill(document, profile, fieldMap);
        return;
      }
    }

    // Fall back to generic fill
    genericFill(document, profile);
  } catch (error) {
    // Silently handle errors (don't break the page)
    // In production, this would log to a debug system
  }
});