/**
 * Workday adapter for job application autofill
 * Workday uses unique form structures with data attributes
 */

/**
 * Maps Workday form fields to profile fields
 * @param {Document} doc - Document object
 * @returns {Object} Field mapping
 */
export function mapFields(doc) {
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
