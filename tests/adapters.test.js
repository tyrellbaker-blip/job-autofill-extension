import { mapFields as greenhouseMapFields, fill as greenhouseFill } from '../src/content/adapters/greenhouse.js';

// Mock DOM elements for testing
class MockElement {
  constructor(name, type = 'input') {
    this.tagName = type.toUpperCase();
    this.name = name;
    this.value = '';
    this.events = [];
    this.focused = false;
  }

  focus() {
    this.focused = true;
  }

  dispatchEvent(event) {
    this.events.push(event);
  }

  querySelector(selector) {
    return null; // Default implementation
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
}

describe('Greenhouse Adapter', () => {
  let mockDoc;

  beforeEach(() => {
    mockDoc = new MockDocument();
  });

  describe('mapFields', () => {
    it('should map all greenhouse fields correctly', () => {
      const nameInput = new MockElement('applicant.name');
      const emailInput = new MockElement('email');
      const phoneInput = new MockElement('phone');
      const linkedinInput = new MockElement('urls[LinkedIn]');

      mockDoc.addElement("input[name='applicant.name']", nameInput);
      mockDoc.addElement("input[name='email']", emailInput);
      mockDoc.addElement("input[name='phone']", phoneInput);
      mockDoc.addElement("input[name*='urls[LinkedIn]']", linkedinInput);

      const fieldMap = greenhouseMapFields(mockDoc);

      expect(fieldMap.full_name).toBe(nameInput);
      expect(fieldMap.email).toBe(emailInput);
      expect(fieldMap.phone).toBe(phoneInput);
      expect(fieldMap.linkedin).toBe(linkedinInput);
    });

    it('should handle missing fields gracefully', () => {
      const fieldMap = greenhouseMapFields(mockDoc);

      expect(fieldMap.full_name).toBeNull();
      expect(fieldMap.email).toBeNull();
      expect(fieldMap.phone).toBeNull();
      expect(fieldMap.linkedin).toBeNull();
    });

    it('should map partial fields', () => {
      const emailInput = new MockElement('email');
      mockDoc.addElement("input[name='email']", emailInput);

      const fieldMap = greenhouseMapFields(mockDoc);

      expect(fieldMap.full_name).toBeNull();
      expect(fieldMap.email).toBe(emailInput);
      expect(fieldMap.phone).toBeNull();
      expect(fieldMap.linkedin).toBeNull();
    });
  });

  describe('fill', () => {
    let fieldMap;
    let profile;

    beforeEach(() => {
      fieldMap = {
        full_name: new MockElement('applicant.name'),
        email: new MockElement('email'),
        phone: new MockElement('phone'),
        linkedin: new MockElement('urls[LinkedIn]')
      };

      profile = {
        full_name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '555-0123',
        linkedin: 'https://linkedin.com/in/johndoe'
      };
    });

    it('should fill all fields with profile data', () => {
      greenhouseFill(mockDoc, profile, fieldMap);

      expect(fieldMap.full_name.value).toBe('John Doe');
      expect(fieldMap.full_name.focused).toBe(true);
      expect(fieldMap.full_name.events).toHaveLength(2);

      expect(fieldMap.email.value).toBe('john.doe@example.com');
      expect(fieldMap.email.focused).toBe(true);

      expect(fieldMap.phone.value).toBe('555-0123');
      expect(fieldMap.phone.focused).toBe(true);

      expect(fieldMap.linkedin.value).toBe('https://linkedin.com/in/johndoe');
      expect(fieldMap.linkedin.focused).toBe(true);
    });

    it('should skip fields that are not in the map', () => {
      fieldMap.full_name = null;

      greenhouseFill(mockDoc, profile, fieldMap);

      expect(fieldMap.email.value).toBe('john.doe@example.com');
      expect(fieldMap.phone.value).toBe('555-0123');
      expect(fieldMap.linkedin.value).toBe('https://linkedin.com/in/johndoe');
    });

    it('should skip fields that are not in the profile', () => {
      profile.full_name = undefined;
      profile.linkedin = null;

      greenhouseFill(mockDoc, profile, fieldMap);

      expect(fieldMap.full_name.value).toBe('');
      expect(fieldMap.full_name.focused).toBe(false);

      expect(fieldMap.email.value).toBe('john.doe@example.com');
      expect(fieldMap.phone.value).toBe('555-0123');

      expect(fieldMap.linkedin.value).toBe('');
      expect(fieldMap.linkedin.focused).toBe(false);
    });

    it('should trigger input and change events', () => {
      greenhouseFill(mockDoc, profile, fieldMap);

      fieldMap.full_name.events.forEach((event, index) => {
        if (index === 0) {
          expect(event.type).toBe('input');
          expect(event.bubbles).toBe(true);
        } else {
          expect(event.type).toBe('change');
          expect(event.bubbles).toBe(true);
        }
      });
    });

    it('should handle empty profile gracefully', () => {
      const emptyProfile = {};

      greenhouseFill(mockDoc, emptyProfile, fieldMap);

      expect(fieldMap.full_name.value).toBe('');
      expect(fieldMap.email.value).toBe('');
      expect(fieldMap.phone.value).toBe('');
      expect(fieldMap.linkedin.value).toBe('');
    });

    it('should handle partial profile data', () => {
      const partialProfile = {
        email: 'john@example.com',
        phone: '555-0123'
      };

      greenhouseFill(mockDoc, partialProfile, fieldMap);

      expect(fieldMap.full_name.value).toBe('');
      expect(fieldMap.email.value).toBe('john@example.com');
      expect(fieldMap.phone.value).toBe('555-0123');
      expect(fieldMap.linkedin.value).toBe('');
    });
  });

  describe('Integration tests', () => {
    it('should map and fill fields in a complete workflow', () => {
      const nameInput = new MockElement('applicant.name');
      const emailInput = new MockElement('email');

      mockDoc.addElement("input[name='applicant.name']", nameInput);
      mockDoc.addElement("input[name='email']", emailInput);

      const profile = {
        full_name: 'Jane Smith',
        email: 'jane@example.com'
      };

      const fieldMap = greenhouseMapFields(mockDoc);
      greenhouseFill(mockDoc, profile, fieldMap);

      expect(fieldMap.full_name.value).toBe('Jane Smith');
      expect(fieldMap.email.value).toBe('jane@example.com');
      expect(fieldMap.full_name.events).toHaveLength(2);
      expect(fieldMap.email.events).toHaveLength(2);
    });
  });
});