import { vi, describe, it, expect, beforeEach } from 'vitest';
import { mapFields, fill } from '../src/content/adapters/greenhouse.js';

// Mock DOM elements
class MockElement {
  constructor(name, type = 'input', tagName = 'INPUT') {
    this.tagName = tagName;
    this.name = name;
    this.type = type;
    this.value = '';
    this.events = [];
    this.focused = false;
    this.selectedIndex = -1;
    this.options = [];
  }

  focus() {
    this.focused = true;
  }

  dispatchEvent(event) {
    this.events.push(event);
  }
}

class MockDocument {
  constructor() {
    this.elements = new Map();
  }

  addElement(selector, element) {
    this.elements.set(selector, element);
  }

  querySelector(selector) {
    return this.elements.get(selector) || null;
  }

  querySelectorAll(selector) {
    const results = [];
    for (const [sel, el] of this.elements.entries()) {
      if (sel.includes(selector) || selector === '*') {
        results.push(el);
      }
    }
    return results;
  }
}

describe('Greenhouse Adapter - Expanded Fields', () => {
  let mockDoc;

  beforeEach(() => {
    mockDoc = new MockDocument();
  });

  describe('mapFields - Full Field Set', () => {
    it('should map name fields (first, last, full)', () => {
      const firstNameInput = new MockElement('first_name');
      const lastNameInput = new MockElement('last_name');
      const fullNameInput = new MockElement('applicant.name');

      mockDoc.addElement("input[name='first_name']", firstNameInput);
      mockDoc.addElement("input[name='last_name']", lastNameInput);
      mockDoc.addElement("input[name='applicant.name']", fullNameInput);

      const fieldMap = mapFields(mockDoc);

      expect(fieldMap.first_name).toBe(firstNameInput);
      expect(fieldMap.last_name).toBe(lastNameInput);
      expect(fieldMap.full_name).toBe(fullNameInput);
    });

    it('should map address fields', () => {
      const line1 = new MockElement('address_line1');
      const line2 = new MockElement('address_line2');
      const city = new MockElement('city');
      const state = new MockElement('state');
      const postalCode = new MockElement('zip');
      const country = new MockElement('country');

      mockDoc.addElement("input[name='address_line1']", line1);
      mockDoc.addElement("input[name='address_line2']", line2);
      mockDoc.addElement("input[name='city']", city);
      mockDoc.addElement("input[name='state']", state);
      mockDoc.addElement("input[name='zip']", postalCode);
      mockDoc.addElement("input[name='country']", country);

      const fieldMap = mapFields(mockDoc);

      expect(fieldMap.address_line1).toBe(line1);
      expect(fieldMap.address_line2).toBe(line2);
      expect(fieldMap.city).toBe(city);
      expect(fieldMap.state).toBe(state);
      expect(fieldMap.postal_code).toBe(postalCode);
      expect(fieldMap.country).toBe(country);
    });

    it('should map GitHub link', () => {
      const github = new MockElement('urls[GitHub]');
      mockDoc.addElement("input[name*='urls[GitHub]']", github);

      const fieldMap = mapFields(mockDoc);

      expect(fieldMap.github).toBe(github);
    });

    it('should map work authorization fields', () => {
      const authorized = new MockElement('work_authorized', 'select', 'SELECT');
      const sponsorship = new MockElement('need_sponsorship', 'select', 'SELECT');

      mockDoc.addElement("select[name='work_authorized']", authorized);
      mockDoc.addElement("select[name='need_sponsorship']", sponsorship);

      const fieldMap = mapFields(mockDoc);

      expect(fieldMap.work_authorized).toBe(authorized);
      expect(fieldMap.needs_sponsorship).toBe(sponsorship);
    });

    it('should map education fields', () => {
      const degree = new MockElement('education[degree]');
      const major = new MockElement('education[major]');
      const institution = new MockElement('education[school]');
      const gradDate = new MockElement('education[graduation_date]');

      mockDoc.addElement("input[name*='education[degree]']", degree);
      mockDoc.addElement("input[name*='education[major]']", major);
      mockDoc.addElement("input[name*='education[school]']", institution);
      mockDoc.addElement("input[name*='education[graduation_date]']", gradDate);

      const fieldMap = mapFields(mockDoc);

      expect(fieldMap.degree).toBe(degree);
      expect(fieldMap.major).toBe(major);
      expect(fieldMap.institution).toBe(institution);
      expect(fieldMap.graduation_date).toBe(gradDate);
    });
  });

  describe('fill - Full Profile', () => {
    it('should fill all fields from complete profile', () => {
      const profile = {
        identity: {
          first_name: 'Jane',
          last_name: 'Smith',
          full_name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '555-1234',
          links: [
            { type: 'linkedin', url: 'https://linkedin.com/in/janesmith' },
            { type: 'github', url: 'https://github.com/janesmith' }
          ]
        },
        address: {
          line1: '123 Main St',
          line2: 'Apt 4B',
          city: 'San Francisco',
          state: 'CA',
          postal_code: '94102',
          country: 'USA'
        },
        work_auth: {
          authorized: true,
          needs_sponsorship: false
        },
        education: [
          {
            degree: 'BS Computer Science',
            major: 'Computer Science',
            institution: 'Stanford University',
            graduation_date: '2020-06'
          }
        ]
      };

      const fieldMap = {
        first_name: new MockElement('first_name'),
        last_name: new MockElement('last_name'),
        email: new MockElement('email'),
        phone: new MockElement('phone'),
        linkedin: new MockElement('linkedin'),
        github: new MockElement('github'),
        address_line1: new MockElement('address_line1'),
        address_line2: new MockElement('address_line2'),
        city: new MockElement('city'),
        state: new MockElement('state'),
        postal_code: new MockElement('zip'),
        country: new MockElement('country'),
        work_authorized: new MockElement('work_authorized', 'select', 'SELECT'),
        needs_sponsorship: new MockElement('need_sponsorship', 'select', 'SELECT'),
        degree: new MockElement('degree'),
        major: new MockElement('major'),
        institution: new MockElement('institution'),
        graduation_date: new MockElement('graduation_date')
      };

      fill(mockDoc, profile, fieldMap);

      expect(fieldMap.first_name.value).toBe('Jane');
      expect(fieldMap.last_name.value).toBe('Smith');
      expect(fieldMap.email.value).toBe('jane@example.com');
      expect(fieldMap.phone.value).toBe('555-1234');
      expect(fieldMap.linkedin.value).toBe('https://linkedin.com/in/janesmith');
      expect(fieldMap.github.value).toBe('https://github.com/janesmith');
      expect(fieldMap.address_line1.value).toBe('123 Main St');
      expect(fieldMap.address_line2.value).toBe('Apt 4B');
      expect(fieldMap.city.value).toBe('San Francisco');
      expect(fieldMap.state.value).toBe('CA');
      expect(fieldMap.postal_code.value).toBe('94102');
      expect(fieldMap.country.value).toBe('USA');
      expect(fieldMap.work_authorized.value).toBe('yes');
      expect(fieldMap.needs_sponsorship.value).toBe('no');
      expect(fieldMap.degree.value).toBe('BS Computer Science');
      expect(fieldMap.major.value).toBe('Computer Science');
      expect(fieldMap.institution.value).toBe('Stanford University');
      expect(fieldMap.graduation_date.value).toBe('2020-06');
    });

    it('should handle multiple education entries by using most recent', () => {
      const profile = {
        education: [
          {
            degree: 'BS',
            institution: 'University A',
            graduation_date: '2015-05'
          },
          {
            degree: 'MS',
            institution: 'University B',
            graduation_date: '2020-06'
          },
          {
            degree: 'PhD',
            institution: 'University C',
            graduation_date: '2023-05'
          }
        ]
      };

      const fieldMap = {
        degree: new MockElement('degree'),
        institution: new MockElement('institution'),
        graduation_date: new MockElement('graduation_date')
      };

      fill(mockDoc, profile, fieldMap);

      // Should use the most recent (2023)
      expect(fieldMap.degree.value).toBe('PhD');
      expect(fieldMap.institution.value).toBe('University C');
      expect(fieldMap.graduation_date.value).toBe('2023-05');
    });

    it('should extract LinkedIn and GitHub from links array', () => {
      const profile = {
        identity: {
          links: [
            { type: 'portfolio', url: 'https://example.com' },
            { type: 'linkedin', url: 'https://linkedin.com/in/user' },
            { type: 'github', url: 'https://github.com/user' },
            { type: 'website', url: 'https://personal.com' }
          ]
        }
      };

      const fieldMap = {
        linkedin: new MockElement('linkedin'),
        github: new MockElement('github')
      };

      fill(mockDoc, profile, fieldMap);

      expect(fieldMap.linkedin.value).toBe('https://linkedin.com/in/user');
      expect(fieldMap.github.value).toBe('https://github.com/user');
    });

    it('should handle partial profiles gracefully', () => {
      const profile = {
        identity: {
          email: 'test@example.com'
        }
      };

      const fieldMap = {
        first_name: new MockElement('first_name'),
        email: new MockElement('email'),
        city: new MockElement('city')
      };

      fill(mockDoc, profile, fieldMap);

      expect(fieldMap.first_name.value).toBe('');
      expect(fieldMap.email.value).toBe('test@example.com');
      expect(fieldMap.city.value).toBe('');
    });
  });
});
