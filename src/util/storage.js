/**
 * Storage utilities for profile persistence
 * Uses Chrome storage API
 */

const PROFILE_KEY = 'autofill_profile_v1';

/**
 * Saves a profile to Chrome storage
 * @param {Object} profile - Profile data (can be encrypted or plain)
 * @returns {Promise<void>}
 */
export async function saveProfile(profile) {
  await chrome.storage.local.set({
    [PROFILE_KEY]: profile
  });
}

/**
 * Loads a profile from Chrome storage
 * @returns {Promise<Object|null>} Profile data or null if not found
 */
export async function loadProfile() {
  const result = await chrome.storage.local.get(PROFILE_KEY);

  // Return null if no profile exists or value is undefined/null
  if (!result || result[PROFILE_KEY] === undefined || result[PROFILE_KEY] === null) {
    return null;
  }

  return result[PROFILE_KEY];
}