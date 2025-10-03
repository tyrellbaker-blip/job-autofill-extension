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
export function genericFill(doc, profile) {
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