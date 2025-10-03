/**
 * Taleo adapter for job application autofill
 * Taleo uses ID-based selectors and iframe forms
 */

/**
 * Maps Taleo form fields to profile fields
 * @param {Document} doc - Document object
 * @returns {Object} Field mapping
 */
export function mapFields(doc) {
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
export function fill(doc, profile, fieldMap) {
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
