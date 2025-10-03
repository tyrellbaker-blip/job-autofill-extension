// Auto-generated bundle - do not edit directly
// Wrapped in block scope to avoid global pollution
{

// ============================================
// File: util/crypto.js
// ============================================
/**
 * Crypto utilities for profile encryption
 * Uses Web Crypto API with PBKDF2 and AES-GCM
 */

const SALT = 'autofill-extension-v1'; // Consistent salt for key derivation
const ITERATIONS = 100000;
const KEY_LENGTH = 256;

/**
 * Derives a cryptographic key from a passphrase using PBKDF2
 * @param {string} passphrase - User passphrase
 * @returns {Promise<CryptoKey>} Derived AES-GCM key
 */
async function deriveKey(passphrase) {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  // Import the passphrase as a key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive the actual encryption key
  const saltBytes = encoder.encode(SALT);
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: KEY_LENGTH
    },
    false,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Encrypts JSON data using AES-GCM
 * @param {Object} data - JSON data to encrypt
 * @param {CryptoKey} key - Encryption key
 * @returns {Promise<{iv: number[], ct: number[]}>} Encrypted data with IV
 */
async function encryptJson(data, key) {
  const encoder = new TextEncoder();
  const jsonString = JSON.stringify(data);
  const plaintext = encoder.encode(jsonString);

  // Generate random IV
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // Encrypt the data
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    plaintext
  );

  // Return IV and ciphertext as arrays
  return {
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ciphertext))
  };
}

/**
 * Decrypts encrypted data back to JSON
 * @param {{iv: number[], ct: number[]}} payload - Encrypted data with IV
 * @param {CryptoKey} key - Decryption key
 * @returns {Promise<Object>} Decrypted JSON object
 */
async function decryptJson(payload, key) {
  const iv = new Uint8Array(payload.iv);
  const ciphertext = new Uint8Array(payload.ct);

  // Decrypt the data
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    ciphertext
  );

  // Convert back to JSON
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(plaintext);
  return JSON.parse(jsonString);
}

// ============================================
// File: util/storage.js
// ============================================
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
async function saveProfile(profile) {
  await chrome.storage.local.set({
    [PROFILE_KEY]: profile
  });
}

/**
 * Loads a profile from Chrome storage
 * @returns {Promise<Object|null>} Profile data or null if not found
 */
async function loadProfile() {
  const result = await chrome.storage.local.get(PROFILE_KEY);

  // Return null if no profile exists or value is undefined/null
  if (!result || result[PROFILE_KEY] === undefined || result[PROFILE_KEY] === null) {
    return null;
  }

  return result[PROFILE_KEY];
}

// ============================================
// File: core/selectMatcher.js
// ============================================
/**
 * Intelligent select/dropdown option matching
 * Handles country codes, phone types, and generic fuzzy matching
 */

/**
 * Country code mappings - maps various formats to standard codes
 */
const COUNTRY_MAPPINGS = {
  'US': ['USA', 'United States', 'United States of America', 'US', 'U.S.', 'U.S.A.', 'America', '+1'],
  'CA': ['Canada', 'CA', 'CAN', '+1'],
  'GB': ['United Kingdom', 'UK', 'Great Britain', 'GB', 'GBR', 'England', '+44'],
  'IN': ['India', 'IN', 'IND', '+91'],
  'AU': ['Australia', 'AU', 'AUS', '+61'],
  'DE': ['Germany', 'DE', 'DEU', 'Deutschland', '+49'],
  'FR': ['France', 'FR', 'FRA', '+33'],
  'JP': ['Japan', 'JP', 'JPN', '+81'],
  'CN': ['China', 'CN', 'CHN', 'PRC', '+86'],
  'BR': ['Brazil', 'BR', 'BRA', '+55'],
  'MX': ['Mexico', 'MX', 'MEX', '+52'],
  'ES': ['Spain', 'ES', 'ESP', 'España', '+34'],
  'IT': ['Italy', 'IT', 'ITA', 'Italia', '+39'],
  'NL': ['Netherlands', 'NL', 'NLD', 'Holland', '+31'],
  'SE': ['Sweden', 'SE', 'SWE', '+46'],
  'NO': ['Norway', 'NO', 'NOR', '+47'],
  'DK': ['Denmark', 'DK', 'DNK', '+45'],
  'FI': ['Finland', 'FI', 'FIN', '+358'],
  'PL': ['Poland', 'PL', 'POL', '+48'],
  'IE': ['Ireland', 'IE', 'IRL', '+353'],
  'NZ': ['New Zealand', 'NZ', 'NZL', '+64'],
  'SG': ['Singapore', 'SG', 'SGP', '+65'],
  'KR': ['South Korea', 'Korea', 'KR', 'KOR', 'Republic of Korea', '+82'],
  'ZA': ['South Africa', 'ZA', 'ZAF', '+27']
};

/**
 * Phone type mappings
 */
const PHONE_TYPE_MAPPINGS = {
  'mobile': ['mobile', 'cell', 'cellular', 'cell phone', 'mobile phone', 'personal'],
  'home': ['home', 'house', 'residence', 'residential'],
  'work': ['work', 'office', 'business'],
  'other': ['other', 'alternate', 'alternative']
};

/**
 * Boolean value mappings (yes/no, true/false, etc.)
 */
const BOOLEAN_MAPPINGS = {
  true: ['yes', 'y', 'true', '1', 'authorized', 'eligible', 'approved'],
  false: ['no', 'n', 'false', '0', 'not authorized', 'ineligible', 'not approved']
};

/**
 * Normalizes a string for comparison
 */
function normalize(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Finds the best matching option in a select element
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {string} targetValue - The value to match
 * @param {Object} mappings - Optional custom mappings
 * @returns {string|null} The value of the best matching option
 */
function findMatchingOption(selectElement, targetValue, mappings = null) {
  if (!selectElement || !targetValue) return null;

  const options = Array.from(selectElement.options);
  const normalizedTarget = normalize(targetValue);

  // Try exact match first (value or text)
  for (const option of options) {
    if (normalize(option.value) === normalizedTarget ||
        normalize(option.text) === normalizedTarget) {
      return option.value;
    }
  }

  // Try with mappings if provided
  if (mappings) {
    for (const [key, variants] of Object.entries(mappings)) {
      const normalizedVariants = variants.map(v => normalize(v));
      if (normalizedVariants.includes(normalizedTarget)) {
        // Now find this key in the select options
        for (const option of options) {
          const normalizedOptionValue = normalize(option.value);
          const normalizedOptionText = normalize(option.text);

          if (normalizedVariants.includes(normalizedOptionValue) ||
              normalizedVariants.includes(normalizedOptionText)) {
            return option.value;
          }
        }
      }
    }
  }

  // Try partial match (contains)
  for (const option of options) {
    const normalizedValue = normalize(option.value);
    const normalizedText = normalize(option.text);

    if (normalizedValue.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedValue) ||
        normalizedText.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedText)) {
      return option.value;
    }
  }

  return null;
}

/**
 * Matches a country value to a select option
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {string} country - Country string (e.g., "USA", "United States", "US")
 * @returns {string|null} The value of the matching option
 */
function matchCountry(selectElement, country) {
  if (!selectElement || !country) return null;

  // First try direct matching
  const directMatch = findMatchingOption(selectElement, country);
  if (directMatch) return directMatch;

  // Try with country mappings
  return findMatchingOption(selectElement, country, COUNTRY_MAPPINGS);
}

/**
 * Matches a phone type to a select option
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {string} phoneType - Phone type (e.g., "mobile", "home", "work")
 * @returns {string|null} The value of the matching option
 */
function matchPhoneType(selectElement, phoneType = 'mobile') {
  if (!selectElement) return null;

  return findMatchingOption(selectElement, phoneType, PHONE_TYPE_MAPPINGS);
}

/**
 * Matches a boolean value to a select option
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {boolean} value - Boolean value
 * @returns {string|null} The value of the matching option
 */
function matchBoolean(selectElement, value) {
  if (!selectElement || value === undefined || value === null) return null;

  return findMatchingOption(selectElement, value ? 'yes' : 'no', BOOLEAN_MAPPINGS);
}

/**
 * Matches a state/province to a select option
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {string} state - State/province (e.g., "CA", "California")
 * @returns {string|null} The value of the matching option
 */
function matchState(selectElement, state) {
  if (!selectElement || !state) return null;

  const options = Array.from(selectElement.options);
  const normalizedState = normalize(state);

  // Try exact match
  for (const option of options) {
    if (normalize(option.value) === normalizedState ||
        normalize(option.text) === normalizedState) {
      return option.value;
    }
  }

  // If state is 2 letters, try matching abbreviation
  if (state.length === 2) {
    const stateUpper = state.toUpperCase();
    for (const option of options) {
      if (option.value.toUpperCase() === stateUpper) {
        return option.value;
      }
      // Check if option text starts with the state code in parentheses
      if (option.text.includes(`(${stateUpper})`)) {
        return option.value;
      }
    }
  }

  // Try partial match
  for (const option of options) {
    const normalizedText = normalize(option.text);
    if (normalizedText.includes(normalizedState) || normalizedState.includes(normalizedText)) {
      return option.value;
    }
  }

  return null;
}

/**
 * Smart select filler - automatically detects type and matches appropriately
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {string} value - The value to set
 * @param {Object} context - Context hints (e.g., {type: 'country', phoneType: 'mobile'})
 * @returns {boolean} Whether the fill was successful
 */
function smartFillSelect(selectElement, value, context = {}) {
  if (!selectElement || !value) return false;

  let matchedValue = null;

  // Determine what type of select this is based on context or field attributes
  const name = (selectElement.name || '').toLowerCase();
  const id = (selectElement.id || '').toLowerCase();
  const label = selectElement.getAttribute('aria-label')?.toLowerCase() || '';
  const allText = `${name} ${id} ${label}`;

  // Context-based matching
  if (context.type === 'country') {
    matchedValue = matchCountry(selectElement, value);
  } else if (context.type === 'phoneType') {
    matchedValue = matchPhoneType(selectElement, value);
  } else if (context.type === 'boolean' || typeof value === 'boolean') {
    matchedValue = matchBoolean(selectElement, value);
  } else if (context.type === 'state') {
    matchedValue = matchState(selectElement, value);
  }
  // Auto-detect based on field name
  else if (allText.includes('country')) {
    matchedValue = matchCountry(selectElement, value);
  } else if (allText.includes('phone') && allText.includes('type')) {
    matchedValue = matchPhoneType(selectElement, value);
  } else if (allText.includes('state') || allText.includes('province') || allText.includes('region')) {
    matchedValue = matchState(selectElement, value);
  } else {
    // Generic matching
    matchedValue = findMatchingOption(selectElement, value);
  }

  // Set the value if we found a match
  if (matchedValue !== null) {
    selectElement.value = matchedValue;
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    selectElement.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }

  return false;
}


// ============================================
// File: content/detectors.js
// ============================================
/**
 * Portal detection utilities
 * Detects which job application portal is being used
 */

/**
 * Detects the job portal based on hostname and DOM
 * @param {string} hostname - Current page hostname
 * @param {Document} doc - Document object
 * @returns {string|null} Portal name or null if unknown
 */
function detectPortal(hostname, doc) {
  // Greenhouse detection
  if (hostname.includes('greenhouse.io') || hostname.includes('greenhouse')) {
    return 'greenhouse';
  }

  // Workday detection
  if (hostname.includes('workday') || hostname.includes('myworkdayjobs')) {
    return 'workday';
  }

  // Lever detection
  if (hostname.includes('lever.co') || hostname.includes('jobs.lever')) {
    return 'lever';
  }

  // Taleo detection
  if (hostname.includes('taleo.net') || hostname.includes('taleo')) {
    return 'taleo';
  }

  return null;
}

// ============================================
// File: content/filler.js
// ============================================
/**
 * Generic filler for unknown portals
 * Uses comprehensive heuristics to find and fill form fields
 */

// Import select matcher - will be bundled
// import { smartFillSelect } from '../core/selectMatcher.js';

/**
 * Helper to get label text for an input element
 */
function getLabelText(element) {
  // Try label[for=id]
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.textContent.toLowerCase();
  }

  // Try nearest parent label
  const parentLabel = element.closest('label');
  if (parentLabel) return parentLabel.textContent.toLowerCase();

  // Try aria-label
  if (element.getAttribute('aria-label')) {
    return element.getAttribute('aria-label').toLowerCase();
  }

  return '';
}

/**
 * Helper to check if text matches a pattern
 */
function matchesPattern(text, includes, excludes = []) {
  const lowerText = text.toLowerCase();
  const hasInclude = includes.some(pattern => lowerText.includes(pattern));
  const hasExclude = excludes.some(pattern => lowerText.includes(pattern));
  return hasInclude && !hasExclude;
}

/**
 * Generic fill function for unknown portals
 * @param {Document} doc - Document object
 * @param {Object} profile - Profile data (new schema format)
 */
function genericFill(doc, profile) {
  const fillField = (element, value) => {
    if (!element || value === undefined || value === null) {
      return;
    }

    element.value = value;
    element.focus();
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  const fillSelect = (element, value, context = {}) => {
    if (!element || value === undefined || value === null) {
      return false;
    }

    // Use smart select matching (inlined from selectMatcher)
    return smartFillSelect(element, value, context);
  };

  const fillBooleanField = (element, value) => {
    if (!element || value === undefined || value === null) {
      return;
    }

    if (element.tagName === 'SELECT') {
      // Use smart boolean matching
      fillSelect(element, value, { type: 'boolean' });
    } else if (element.type === 'radio' || element.type === 'checkbox') {
      element.checked = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  // Extract profile data
  const identity = profile.identity || {};
  const address = profile.address || {};
  const workAuth = profile.work_auth || {};
  const education = profile.education || [];

  const links = identity.links || [];
  const linkedinLink = links.find(l => l.type === 'linkedin')?.url;
  const githubLink = links.find(l => l.type === 'github')?.url;

  // Get most recent education
  const mostRecentEd = education.length > 0
    ? [...education].sort((a, b) => {
        const dateA = a.graduation_date || '';
        const dateB = b.graduation_date || '';
        return dateB.localeCompare(dateA);
      })[0]
    : null;

  // Find all form fields
  const inputs = doc.querySelectorAll('input, select, textarea');

  inputs.forEach(input => {
    const name = input.name || '';
    const id = input.id || '';
    const placeholder = input.placeholder || '';
    const type = input.type || '';
    const label = getLabelText(input);

    const allText = `${name} ${id} ${placeholder} ${label}`;

    // Priority 1: Semantic type matches
    if (type === 'email') {
      fillField(input, identity.email);
      return;
    }
    if (type === 'tel') {
      fillField(input, identity.phone);
      return;
    }

    // Priority 2: Exact attribute matches
    // First Name
    if (matchesPattern(allText, ['first', 'name'], ['last'])) {
      fillField(input, identity.first_name);
    }
    // Last Name
    else if (matchesPattern(allText, ['last', 'name'], ['first'])) {
      fillField(input, identity.last_name);
    }
    // Full Name (neither first nor last)
    else if (matchesPattern(allText, ['name'], ['first', 'last', 'user', 'file'])) {
      fillField(input, identity.full_name || `${identity.first_name || ''} ${identity.last_name || ''}`.trim());
    }
    // Email
    else if (matchesPattern(allText, ['email', 'e-mail'])) {
      fillField(input, identity.email);
    }
    // Phone
    else if (matchesPattern(allText, ['phone', 'mobile', 'tel'])) {
      fillField(input, identity.phone);
    }
    // LinkedIn
    else if (matchesPattern(allText, ['linkedin', 'linked-in'])) {
      fillField(input, linkedinLink);
    }
    // GitHub
    else if (matchesPattern(allText, ['github', 'git hub'])) {
      fillField(input, githubLink);
    }
    // Address Line 1
    else if (matchesPattern(allText, ['address'], ['2', 'line2', 'apt', 'suite'])) {
      fillField(input, address.line1);
    }
    // Address Line 2
    else if (matchesPattern(allText, ['address2', 'line2', 'apt', 'suite'])) {
      fillField(input, address.line2);
    }
    // City
    else if (matchesPattern(allText, ['city'])) {
      fillField(input, address.city);
    }
    // State
    else if (matchesPattern(allText, ['state', 'province', 'region'])) {
      if (input.tagName === 'SELECT') {
        fillSelect(input, address.state, { type: 'state' });
      } else {
        fillField(input, address.state);
      }
    }
    // Postal Code
    else if (matchesPattern(allText, ['zip', 'postal'])) {
      fillField(input, address.postal_code);
    }
    // Country
    else if (matchesPattern(allText, ['country'])) {
      if (input.tagName === 'SELECT') {
        fillSelect(input, address.country, { type: 'country' });
      } else {
        fillField(input, address.country);
      }
    }
    // Work Authorization
    else if (matchesPattern(allText, ['authorized', 'work authorization', 'legal']) && input.tagName === 'SELECT') {
      fillBooleanField(input, workAuth.authorized);
    }
    // Sponsorship
    else if (matchesPattern(allText, ['sponsorship', 'visa', 'require sponsorship'])) {
      fillBooleanField(input, workAuth.needs_sponsorship);
    }
    // Education - Degree
    else if (mostRecentEd && matchesPattern(allText, ['degree'])) {
      fillField(input, mostRecentEd.degree);
    }
    // Education - Major
    else if (mostRecentEd && matchesPattern(allText, ['major', 'field of study', 'study'])) {
      fillField(input, mostRecentEd.major);
    }
    // Education - Institution
    else if (mostRecentEd && matchesPattern(allText, ['school', 'university', 'college', 'institution'])) {
      fillField(input, mostRecentEd.institution);
    }
    // Education - Graduation Date
    else if (mostRecentEd && matchesPattern(allText, ['graduation', 'grad date', 'completion'])) {
      fillField(input, mostRecentEd.graduation_date);
    }
  });

  // Backward compatibility with old flat profile
  if (profile.full_name || profile.email || profile.phone) {
    inputs.forEach(input => {
      const name = (input.name || '').toLowerCase();
      const id = (input.id || '').toLowerCase();
      const placeholder = (input.placeholder || '').toLowerCase();
      const allText = `${name} ${id} ${placeholder}`;

      if (input.type === 'email' || allText.includes('email')) {
        fillField(input, profile.email);
      } else if (input.type === 'tel' || allText.includes('phone')) {
        fillField(input, profile.phone);
      } else if (allText.includes('name') && !allText.includes('user') && !allText.includes('file')) {
        fillField(input, profile.full_name || profile.name);
      }
    });
  }
}

// ============================================
// File: content/adapters/greenhouse.js
// ============================================
/**
 * Greenhouse adapter for job application autofill
 * Supports full profile schema including address, work auth, and education
 */

/**
 * Maps Greenhouse form fields to profile fields
 * @param {Document} doc - Document object
 * @returns {Object} Field mapping
 */
function greenhouseMapFields(doc) {
  return {
    // Identity fields
    first_name: doc.querySelector("input[name='first_name']"),
    last_name: doc.querySelector("input[name='last_name']"),
    full_name: doc.querySelector("input[name='applicant.name']"),
    email: doc.querySelector("input[name='email']"),
    phone: doc.querySelector("input[name='phone']"),
    linkedin: doc.querySelector("input[name*='urls[LinkedIn]']"),
    github: doc.querySelector("input[name*='urls[GitHub]']"),

    // Address fields
    address_line1: doc.querySelector("input[name='address_line1']"),
    address_line2: doc.querySelector("input[name='address_line2']"),
    city: doc.querySelector("input[name='city']"),
    state: doc.querySelector("input[name='state']"),
    postal_code: doc.querySelector("input[name='zip']"),
    country: doc.querySelector("input[name='country']"),

    // Work authorization
    work_authorized: doc.querySelector("select[name='work_authorized']"),
    needs_sponsorship: doc.querySelector("select[name='need_sponsorship']"),

    // Education (single entry - most Greenhouse forms only allow one)
    degree: doc.querySelector("input[name*='education[degree]']"),
    major: doc.querySelector("input[name*='education[major]']"),
    institution: doc.querySelector("input[name*='education[school]']"),
    graduation_date: doc.querySelector("input[name*='education[graduation_date]']")
  };
}

/**
 * Fills Greenhouse form fields with profile data
 * @param {Document} doc - Document object
 * @param {Object} profile - Profile data (new schema format)
 * @param {Object} fieldMap - Field mapping from mapFields
 */
function greenhouseFill(doc, profile, fieldMap) {
  // Helper to fill a single field
  const fillField = (element, value) => {
    if (!element || value === undefined || value === null) {
      return;
    }

    element.value = value;
    element.focus();

    // Dispatch events to trigger any form validation/handlers
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Helper to fill select with smart matching
  const fillSelect = (element, value, context = {}) => {
    if (!element || value === undefined || value === null) {
      return;
    }

    // Use smartFillSelect (will be available in bundle)
    smartFillSelect(element, value, context);
  };

  // Helper to fill boolean select (yes/no)
  const fillBooleanSelect = (element, value) => {
    if (!element || value === undefined || value === null) {
      return;
    }

    // Use smart boolean matching
    fillSelect(element, value, { type: 'boolean' });
  };

  // Extract values from new profile schema
  const identity = profile.identity || {};
  const address = profile.address || {};
  const workAuth = profile.work_auth || {};
  const education = profile.education || [];

  // Find links by type
  const links = identity.links || [];
  const linkedinLink = links.find(l => l.type === 'linkedin')?.url;
  const githubLink = links.find(l => l.type === 'github')?.url;

  // Fill identity fields
  fillField(fieldMap.first_name, identity.first_name);
  fillField(fieldMap.last_name, identity.last_name);
  fillField(fieldMap.full_name, identity.full_name);
  fillField(fieldMap.email, identity.email);
  fillField(fieldMap.phone, identity.phone);
  fillField(fieldMap.linkedin, linkedinLink);
  fillField(fieldMap.github, githubLink);

  // Fill address fields
  fillField(fieldMap.address_line1, address.line1);
  fillField(fieldMap.address_line2, address.line2);
  fillField(fieldMap.city, address.city);

  // Smart fill for dropdowns
  if (fieldMap.state?.tagName === 'SELECT') {
    fillSelect(fieldMap.state, address.state, { type: 'state' });
  } else {
    fillField(fieldMap.state, address.state);
  }

  fillField(fieldMap.postal_code, address.postal_code);

  if (fieldMap.country?.tagName === 'SELECT') {
    fillSelect(fieldMap.country, address.country, { type: 'country' });
  } else {
    fillField(fieldMap.country, address.country);
  }

  // Fill work authorization
  fillBooleanSelect(fieldMap.work_authorized, workAuth.authorized);
  fillBooleanSelect(fieldMap.needs_sponsorship, workAuth.needs_sponsorship);

  // Fill education - use most recent entry
  if (education.length > 0) {
    // Sort by graduation_date descending, use most recent
    const sortedEd = [...education].sort((a, b) => {
      const dateA = a.graduation_date || '';
      const dateB = b.graduation_date || '';
      return dateB.localeCompare(dateA);
    });

    const mostRecent = sortedEd[0];
    fillField(fieldMap.degree, mostRecent.degree);
    fillField(fieldMap.major, mostRecent.major);
    fillField(fieldMap.institution, mostRecent.institution);
    fillField(fieldMap.graduation_date, mostRecent.graduation_date);
  }

  // Backward compatibility: support old flat profile format
  // If profile has direct properties (not nested in identity), use those
  if (profile.full_name !== undefined || profile.email !== undefined || profile.phone !== undefined) {
    fillField(fieldMap.full_name, profile.full_name);
    fillField(fieldMap.email, profile.email);
    fillField(fieldMap.phone, profile.phone);
    fillField(fieldMap.linkedin, profile.linkedin);
  }
}

// ============================================
// File: content/adapters/workday.js
// ============================================
/**
 * Workday adapter for job application autofill
 * Workday uses unique form structures with data attributes
 */

/**
 * Maps Workday form fields to profile fields
 * @param {Document} doc - Document object
 * @returns {Object} Field mapping
 */
function workdayMapFields(doc) {
  return {
    // Identity fields - Workday often uses data-automation-id
    first_name: doc.querySelector("input[data-automation-id*='legalNameSection_firstName']") ||
                doc.querySelector("input[name*='firstName']"),
    last_name: doc.querySelector("input[data-automation-id*='legalNameSection_lastName']") ||
               doc.querySelector("input[name*='lastName']"),
    email: doc.querySelector("input[data-automation-id*='email']") ||
           doc.querySelector("input[type='email']"),
    phone: doc.querySelector("input[data-automation-id*='phone']") ||
           doc.querySelector("input[type='tel']"),
    linkedin: doc.querySelector("input[data-automation-id*='linkedIn']") ||
              doc.querySelector("input[name*='linkedin']"),
    github: doc.querySelector("input[data-automation-id*='github']") ||
            doc.querySelector("input[name*='github']"),

    // Address fields
    address_line1: doc.querySelector("input[data-automation-id*='addressLine1']") ||
                   doc.querySelector("input[name*='address1']"),
    address_line2: doc.querySelector("input[data-automation-id*='addressLine2']") ||
                   doc.querySelector("input[name*='address2']"),
    city: doc.querySelector("input[data-automation-id*='city']") ||
          doc.querySelector("input[name*='city']"),
    state: doc.querySelector("input[data-automation-id*='state']") ||
           doc.querySelector("select[name*='state']"),
    postal_code: doc.querySelector("input[data-automation-id*='postalCode']") ||
                 doc.querySelector("input[name*='zip']"),
    country: doc.querySelector("select[data-automation-id*='country']") ||
             doc.querySelector("select[name*='country']"),

    // Work authorization - Workday uses radio buttons or selects
    work_authorized: doc.querySelector("select[data-automation-id*='legallyAuthorized']") ||
                     doc.querySelector("input[name*='authorized'][value='yes']"),
    needs_sponsorship: doc.querySelector("select[data-automation-id*='sponsorship']") ||
                       doc.querySelector("input[name*='sponsorship'][value='yes']"),

    // Education
    degree: doc.querySelector("input[data-automation-id*='degree']") ||
            doc.querySelector("input[name*='degree']"),
    major: doc.querySelector("input[data-automation-id*='fieldOfStudy']") ||
           doc.querySelector("input[name*='major']"),
    institution: doc.querySelector("input[data-automation-id*='school']") ||
                 doc.querySelector("input[name*='school']"),
    graduation_date: doc.querySelector("input[data-automation-id*='graduationDate']") ||
                     doc.querySelector("input[name*='graduation']")
  };
}

/**
 * Fills Workday form fields with profile data
 * @param {Document} doc - Document object
 * @param {Object} profile - Profile data
 * @param {Object} fieldMap - Field mapping from mapFields
 */
function workdayFill(doc, profile, fieldMap) {
  const fillField = (element, value) => {
    if (!element || value === undefined || value === null) {
      return;
    }

    element.value = value;
    element.focus();
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  const fillSelect = (element, value, context = {}) => {
    if (!element || value === undefined || value === null) {
      return;
    }
    smartFillSelect(element, value, context);
  };

  const fillBooleanField = (element, value) => {
    if (!element || value === undefined || value === null) {
      return;
    }

    if (element.tagName === 'SELECT') {
      fillSelect(element, value, { type: 'boolean' });
    } else if (element.type === 'radio') {
      element.checked = true;
      element.focus();
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const identity = profile.identity || {};
  const address = profile.address || {};
  const workAuth = profile.work_auth || {};
  const education = profile.education || [];

  const links = identity.links || [];
  const linkedinLink = links.find(l => l.type === 'linkedin')?.url;
  const githubLink = links.find(l => l.type === 'github')?.url;

  fillField(fieldMap.first_name, identity.first_name);
  fillField(fieldMap.last_name, identity.last_name);
  fillField(fieldMap.email, identity.email);
  fillField(fieldMap.phone, identity.phone);
  fillField(fieldMap.linkedin, linkedinLink);
  fillField(fieldMap.github, githubLink);

  fillField(fieldMap.address_line1, address.line1);
  fillField(fieldMap.address_line2, address.line2);
  fillField(fieldMap.city, address.city);

  if (fieldMap.state?.tagName === 'SELECT') {
    fillSelect(fieldMap.state, address.state, { type: 'state' });
  } else {
    fillField(fieldMap.state, address.state);
  }

  fillField(fieldMap.postal_code, address.postal_code);

  if (fieldMap.country?.tagName === 'SELECT') {
    fillSelect(fieldMap.country, address.country, { type: 'country' });
  } else {
    fillField(fieldMap.country, address.country);
  }

  fillBooleanField(fieldMap.work_authorized, workAuth.authorized);
  fillBooleanField(fieldMap.needs_sponsorship, workAuth.needs_sponsorship);

  if (education.length > 0) {
    const sortedEd = [...education].sort((a, b) => {
      const dateA = a.graduation_date || '';
      const dateB = b.graduation_date || '';
      return dateB.localeCompare(dateA);
    });

    const mostRecent = sortedEd[0];
    fillField(fieldMap.degree, mostRecent.degree);
    fillField(fieldMap.major, mostRecent.major);
    fillField(fieldMap.institution, mostRecent.institution);
    fillField(fieldMap.graduation_date, mostRecent.graduation_date);
  }
}


// ============================================
// File: content/adapters/lever.js
// ============================================
/**
 * Lever adapter for job application autofill
 * Lever forms use standard name attributes
 */

/**
 * Maps Lever form fields to profile fields
 * @param {Document} doc - Document object
 * @returns {Object} Field mapping
 */
function leverMapFields(doc) {
  return {
    // Identity fields
    first_name: doc.querySelector("input[name='name']") ||
                doc.querySelector("input[name='first_name']"),
    last_name: doc.querySelector("input[name='last_name']"),
    full_name: doc.querySelector("input[name='name']"),
    email: doc.querySelector("input[name='email']") ||
           doc.querySelector("input[type='email']"),
    phone: doc.querySelector("input[name='phone']") ||
           doc.querySelector("input[type='tel']"),
    linkedin: doc.querySelector("input[name='urls[LinkedIn]']") ||
              doc.querySelector("input[name*='linkedin']"),
    github: doc.querySelector("input[name='urls[GitHub]']") ||
            doc.querySelector("input[name*='github']"),

    // Address fields
    address_line1: doc.querySelector("input[name='location']") ||
                   doc.querySelector("input[name='address']"),
    city: doc.querySelector("input[name='city']"),
    state: doc.querySelector("input[name='state']") ||
           doc.querySelector("select[name='state']"),
    postal_code: doc.querySelector("input[name='zip']") ||
                 doc.querySelector("input[name='postal_code']"),
    country: doc.querySelector("select[name='country']"),

    // Work authorization
    work_authorized: doc.querySelector("select[name='work_authorized']") ||
                     doc.querySelector("select[name='authorized_to_work']"),
    needs_sponsorship: doc.querySelector("select[name='require_sponsorship']") ||
                       doc.querySelector("select[name='sponsorship']"),

    // Education
    degree: doc.querySelector("input[name='degree']") ||
            doc.querySelector("select[name='degree']"),
    major: doc.querySelector("input[name='major']") ||
           doc.querySelector("input[name='field_of_study']"),
    institution: doc.querySelector("input[name='school']") ||
                 doc.querySelector("input[name='university']"),
    graduation_date: doc.querySelector("input[name='graduation_date']") ||
                     doc.querySelector("input[name='grad_date']")
  };
}

/**
 * Fills Lever form fields with profile data
 * @param {Document} doc - Document object
 * @param {Object} profile - Profile data
 * @param {Object} fieldMap - Field mapping from mapFields
 */
function leverFill(doc, profile, fieldMap) {
  const fillField = (element, value) => {
    if (!element || value === undefined || value === null) {
      return;
    }

    element.value = value;
    element.focus();
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  const fillSelect = (element, value, context = {}) => {
    if (!element || value === undefined || value === null) {
      return;
    }
    smartFillSelect(element, value, context);
  };

  const fillBooleanSelect = (element, value) => {
    if (!element || value === undefined || value === null) {
      return;
    }
    fillSelect(element, value, { type: 'boolean' });
  };

  const identity = profile.identity || {};
  const address = profile.address || {};
  const workAuth = profile.work_auth || {};
  const education = profile.education || [];

  const links = identity.links || [];
  const linkedinLink = links.find(l => l.type === 'linkedin')?.url;
  const githubLink = links.find(l => l.type === 'github')?.url;

  // Lever often uses a single "name" field
  fillField(fieldMap.first_name, identity.first_name);
  fillField(fieldMap.last_name, identity.last_name);
  fillField(fieldMap.full_name, identity.full_name || `${identity.first_name || ''} ${identity.last_name || ''}`.trim());
  fillField(fieldMap.email, identity.email);
  fillField(fieldMap.phone, identity.phone);
  fillField(fieldMap.linkedin, linkedinLink);
  fillField(fieldMap.github, githubLink);

  // Address - Lever sometimes has "location" as a single field
  const fullAddress = address.line1
    ? `${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.city || ''}, ${address.state || ''} ${address.postal_code || ''}`.trim()
    : '';
  fillField(fieldMap.address_line1, address.line1 || fullAddress);
  fillField(fieldMap.city, address.city);

  if (fieldMap.state?.tagName === 'SELECT') {
    fillSelect(fieldMap.state, address.state, { type: 'state' });
  } else {
    fillField(fieldMap.state, address.state);
  }

  fillField(fieldMap.postal_code, address.postal_code);

  if (fieldMap.country?.tagName === 'SELECT') {
    fillSelect(fieldMap.country, address.country, { type: 'country' });
  } else {
    fillField(fieldMap.country, address.country);
  }

  fillBooleanSelect(fieldMap.work_authorized, workAuth.authorized);
  fillBooleanSelect(fieldMap.needs_sponsorship, workAuth.needs_sponsorship);

  if (education.length > 0) {
    const sortedEd = [...education].sort((a, b) => {
      const dateA = a.graduation_date || '';
      const dateB = b.graduation_date || '';
      return dateB.localeCompare(dateA);
    });

    const mostRecent = sortedEd[0];
    fillField(fieldMap.degree, mostRecent.degree);
    fillField(fieldMap.major, mostRecent.major);
    fillField(fieldMap.institution, mostRecent.institution);
    fillField(fieldMap.graduation_date, mostRecent.graduation_date);
  }
}


// ============================================
// File: content/adapters/taleo.js
// ============================================
/**
 * Taleo adapter for job application autofill
 * Taleo uses ID-based selectors and iframe forms
 */

/**
 * Maps Taleo form fields to profile fields
 * @param {Document} doc - Document object
 * @returns {Object} Field mapping
 */
function taleoMapFields(doc) {
  return {
    // Identity fields - Taleo uses IDs
    first_name: doc.querySelector("input[id*='firstname']") ||
                doc.querySelector("input[id*='firstName']"),
    last_name: doc.querySelector("input[id*='lastname']") ||
               doc.querySelector("input[id*='lastName']"),
    email: doc.querySelector("input[id*='email']") ||
           doc.querySelector("input[type='email']"),
    phone: doc.querySelector("input[id*='phone']") ||
           doc.querySelector("input[type='tel']"),
    linkedin: doc.querySelector("input[id*='linkedin']") ||
              doc.querySelector("input[name*='linkedin']"),
    github: doc.querySelector("input[id*='github']") ||
            doc.querySelector("input[name*='github']"),

    // Address fields
    address_line1: doc.querySelector("input[id*='address1']") ||
                   doc.querySelector("input[id*='streetaddress']"),
    address_line2: doc.querySelector("input[id*='address2']"),
    city: doc.querySelector("input[id*='city']"),
    state: doc.querySelector("select[id*='state']") ||
           doc.querySelector("input[id*='state']"),
    postal_code: doc.querySelector("input[id*='zip']") ||
                 doc.querySelector("input[id*='postal']"),
    country: doc.querySelector("select[id*='country']"),

    // Work authorization
    work_authorized: doc.querySelector("select[id*='workauthorization']") ||
                     doc.querySelector("select[id*='authorized']"),
    needs_sponsorship: doc.querySelector("select[id*='sponsorship']") ||
                       doc.querySelector("select[id*='visa']"),

    // Education
    degree: doc.querySelector("select[id*='degree']") ||
            doc.querySelector("input[id*='degree']"),
    major: doc.querySelector("input[id*='major']") ||
           doc.querySelector("input[id*='fieldofstudy']"),
    institution: doc.querySelector("input[id*='school']") ||
                 doc.querySelector("input[id*='university']") ||
                 doc.querySelector("input[id*='college']"),
    graduation_date: doc.querySelector("input[id*='graduation']") ||
                     doc.querySelector("select[id*='gradyear']")
  };
}

/**
 * Fills Taleo form fields with profile data
 * @param {Document} doc - Document object
 * @param {Object} profile - Profile data
 * @param {Object} fieldMap - Field mapping from mapFields
 */
function taleoFill(doc, profile, fieldMap) {
  const fillField = (element, value) => {
    if (!element || value === undefined || value === null) {
      return;
    }

    element.value = value;
    element.focus();
    // Taleo forms need blur event for validation
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('blur', { bubbles: true }));
  };

  const fillSelect = (element, value, context = {}) => {
    if (!element || value === undefined || value === null) {
      return;
    }
    smartFillSelect(element, value, context);
  };

  const fillBooleanSelect = (element, value) => {
    if (!element || value === undefined || value === null) {
      return;
    }
    fillSelect(element, value, { type: 'boolean' });
  };

  const identity = profile.identity || {};
  const address = profile.address || {};
  const workAuth = profile.work_auth || {};
  const education = profile.education || [];

  const links = identity.links || [];
  const linkedinLink = links.find(l => l.type === 'linkedin')?.url;
  const githubLink = links.find(l => l.type === 'github')?.url;

  fillField(fieldMap.first_name, identity.first_name);
  fillField(fieldMap.last_name, identity.last_name);
  fillField(fieldMap.email, identity.email);
  fillField(fieldMap.phone, identity.phone);
  fillField(fieldMap.linkedin, linkedinLink);
  fillField(fieldMap.github, githubLink);

  fillField(fieldMap.address_line1, address.line1);
  fillField(fieldMap.address_line2, address.line2);
  fillField(fieldMap.city, address.city);

  if (fieldMap.state?.tagName === 'SELECT') {
    fillSelect(fieldMap.state, address.state, { type: 'state' });
  } else {
    fillField(fieldMap.state, address.state);
  }

  fillField(fieldMap.postal_code, address.postal_code);

  if (fieldMap.country?.tagName === 'SELECT') {
    fillSelect(fieldMap.country, address.country, { type: 'country' });
  } else {
    fillField(fieldMap.country, address.country);
  }

  fillBooleanSelect(fieldMap.work_authorized, workAuth.authorized);
  fillBooleanSelect(fieldMap.needs_sponsorship, workAuth.needs_sponsorship);

  if (education.length > 0) {
    const sortedEd = [...education].sort((a, b) => {
      const dateA = a.graduation_date || '';
      const dateB = b.graduation_date || '';
      return dateB.localeCompare(dateA);
    });

    const mostRecent = sortedEd[0];
    fillField(fieldMap.degree, mostRecent.degree);
    fillField(fieldMap.major, mostRecent.major);
    fillField(fieldMap.institution, mostRecent.institution);
    fillField(fieldMap.graduation_date, mostRecent.graduation_date);
  }
}


// ============================================
// File: content/adapters/baseAdapter.js
// ============================================
/**
 * Base adapter functionality
 * Provides adapter registry and retrieval
 */





// Note: When bundled, these imports are removed and we manually construct adapter objects
// This file is designed to work both as ES module and when bundled

/**
 * Gets an adapter by name
 * @param {string|null} portalName - Name of the portal
 * @returns {Object|null} Adapter module or null
 */
function getAdapter(portalName) {
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

// ============================================
// File: content/content.js
// ============================================
/**
 * Content script for autofill functionality
 * Listens for autofill requests and fills forms
 */






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

// Create adapter registry
const adapters = {
  greenhouse: { mapFields: greenhouseMapFields, fill: greenhouseFill },
  workday: { mapFields: workdayMapFields, fill: workdayFill },
  lever: { mapFields: leverMapFields, fill: leverFill },
  taleo: { mapFields: taleoMapFields, fill: taleoFill },
};

// Override getAdapter to use our registry
function getAdapter(portalName) {
  if (!portalName) return null;
  return adapters[portalName] || null;
}

}
