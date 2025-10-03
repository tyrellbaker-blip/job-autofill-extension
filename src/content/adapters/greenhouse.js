/**
 * Greenhouse adapter for job application autofill
 * Supports full profile schema including address, work auth, and education
 */

/**
 * Maps Greenhouse form fields to profile fields
 * @param {Document} doc - Document object
 * @returns {Object} Field mapping
 */
export function mapFields(doc) {
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
export function fill(doc, profile, fieldMap) {
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