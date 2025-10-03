/**
 * Lever adapter for job application autofill
 * Lever forms use standard name attributes
 */

/**
 * Maps Lever form fields to profile fields
 * @param {Document} doc - Document object
 * @returns {Object} Field mapping
 */
export function mapFields(doc) {
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
export function fill(doc, profile, fieldMap) {
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
