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
export function findMatchingOption(selectElement, targetValue, mappings = null) {
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
export function matchCountry(selectElement, country) {
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
export function matchPhoneType(selectElement, phoneType = 'mobile') {
  if (!selectElement) return null;

  return findMatchingOption(selectElement, phoneType, PHONE_TYPE_MAPPINGS);
}

/**
 * Matches a boolean value to a select option
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {boolean} value - Boolean value
 * @returns {string|null} The value of the matching option
 */
export function matchBoolean(selectElement, value) {
  if (!selectElement || value === undefined || value === null) return null;

  return findMatchingOption(selectElement, value ? 'yes' : 'no', BOOLEAN_MAPPINGS);
}

/**
 * Matches a state/province to a select option
 * @param {HTMLSelectElement} selectElement - The select element
 * @param {string} state - State/province (e.g., "CA", "California")
 * @returns {string|null} The value of the matching option
 */
export function matchState(selectElement, state) {
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
export function smartFillSelect(selectElement, value, context = {}) {
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
