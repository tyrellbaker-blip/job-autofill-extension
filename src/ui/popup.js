/**
 * Popup UI functionality
 * Handles form-based profile editing, saving, and triggering autofill
 */

import { saveProfile, loadProfile } from '../util/storage.js';
import { deriveKey, encryptJson } from '../util/crypto.js';

let educationCount = 0;

/**
 * Creates an education entry form
 */
function createEducationEntry(data = {}) {
  const id = educationCount++;
  const div = document.createElement('div');
  div.className = 'education-entry';
  div.dataset.id = id;

  div.innerHTML = `
    <button class="remove-button" data-id="${id}">Remove</button>
    <div class="section">
      <label>Degree:</label>
      <input type="text" class="edu-degree" placeholder="Bachelor of Science" value="${data.degree || ''}">
    </div>
    <div class="section">
      <label>Major/Field of Study:</label>
      <input type="text" class="edu-major" placeholder="Computer Science" value="${data.major || ''}">
    </div>
    <div class="section">
      <label>Institution:</label>
      <input type="text" class="edu-institution" placeholder="Stanford University" value="${data.institution || ''}">
    </div>
    <div class="section">
      <label>Graduation Date:</label>
      <input type="text" class="edu-graduation" placeholder="2020-06 or June 2020" value="${data.graduation_date || ''}">
    </div>
  `;

  div.querySelector('.remove-button').addEventListener('click', () => {
    div.remove();
  });

  return div;
}

/**
 * Populates form from profile data
 */
function populateForm(profile) {
  const identity = profile.identity || {};
  const address = profile.address || {};
  const workAuth = profile.work_auth || {};
  const education = profile.education || [];
  const links = identity.links || [];

  // Personal info
  document.getElementById('first_name').value = identity.first_name || '';
  document.getElementById('last_name').value = identity.last_name || '';
  document.getElementById('email').value = identity.email || '';
  document.getElementById('phone').value = identity.phone || '';

  // Links
  const linkedin = links.find(l => l.type === 'linkedin');
  const github = links.find(l => l.type === 'github');
  document.getElementById('linkedin').value = linkedin?.url || '';
  document.getElementById('github').value = github?.url || '';

  // Address
  document.getElementById('address_line1').value = address.line1 || '';
  document.getElementById('address_line2').value = address.line2 || '';
  document.getElementById('city').value = address.city || '';
  document.getElementById('state').value = address.state || '';
  document.getElementById('postal_code').value = address.postal_code || '';
  document.getElementById('country').value = address.country || '';

  // Work authorization
  document.getElementById('work_authorized').value =
    workAuth.authorized === true ? 'yes' : workAuth.authorized === false ? 'no' : '';
  document.getElementById('needs_sponsorship').value =
    workAuth.needs_sponsorship === true ? 'yes' : workAuth.needs_sponsorship === false ? 'no' : '';

  // Education
  const container = document.getElementById('education-container');
  container.innerHTML = '';
  if (education.length > 0) {
    education.forEach(edu => {
      container.appendChild(createEducationEntry(edu));
    });
  } else {
    // Add one empty education entry by default
    container.appendChild(createEducationEntry());
  }
}

/**
 * Collects form data into profile object
 */
function collectFormData() {
  const profile = {
    version: '1.0.0',
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    identity: {},
    address: {},
    work_auth: {},
    education: []
  };

  // Personal info
  const firstName = document.getElementById('first_name').value.trim();
  const lastName = document.getElementById('last_name').value.trim();

  if (firstName) profile.identity.first_name = firstName;
  if (lastName) profile.identity.last_name = lastName;
  if (firstName && lastName) {
    profile.identity.full_name = `${firstName} ${lastName}`;
  }

  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  if (email) profile.identity.email = email;
  if (phone) profile.identity.phone = phone;

  // Links
  const linkedin = document.getElementById('linkedin').value.trim();
  const github = document.getElementById('github').value.trim();
  profile.identity.links = [];
  if (linkedin) profile.identity.links.push({ type: 'linkedin', url: linkedin });
  if (github) profile.identity.links.push({ type: 'github', url: github });

  // Address
  const line1 = document.getElementById('address_line1').value.trim();
  const line2 = document.getElementById('address_line2').value.trim();
  const city = document.getElementById('city').value.trim();
  const state = document.getElementById('state').value.trim();
  const postal = document.getElementById('postal_code').value.trim();
  const country = document.getElementById('country').value.trim();

  if (line1) profile.address.line1 = line1;
  if (line2) profile.address.line2 = line2;
  if (city) profile.address.city = city;
  if (state) profile.address.state = state;
  if (postal) profile.address.postal_code = postal;
  if (country) profile.address.country = country;

  // Work authorization
  const workAuth = document.getElementById('work_authorized').value;
  const sponsorship = document.getElementById('needs_sponsorship').value;
  if (workAuth === 'yes') profile.work_auth.authorized = true;
  if (workAuth === 'no') profile.work_auth.authorized = false;
  if (sponsorship === 'yes') profile.work_auth.needs_sponsorship = true;
  if (sponsorship === 'no') profile.work_auth.needs_sponsorship = false;

  // Education
  const eduEntries = document.querySelectorAll('.education-entry');
  eduEntries.forEach(entry => {
    const degree = entry.querySelector('.edu-degree').value.trim();
    const major = entry.querySelector('.edu-major').value.trim();
    const institution = entry.querySelector('.edu-institution').value.trim();
    const graduation = entry.querySelector('.edu-graduation').value.trim();

    if (degree || major || institution || graduation) {
      const edu = {};
      if (degree) edu.degree = degree;
      if (major) edu.major = major;
      if (institution) edu.institution = institution;
      if (graduation) edu.graduation_date = graduation;
      profile.education.push(edu);
    }
  });

  return profile;
}

/**
 * Initializes the popup
 */
export async function init() {
  try {
    const profile = await loadProfile();

    if (profile) {
      // Check if encrypted
      if (profile._enc) {
        // Can't populate form with encrypted data
        showStatus('Profile is encrypted. Enter passphrase and save to decrypt.', 'error');
      } else {
        populateForm(profile);
      }
    } else {
      // Add one empty education entry for new users
      document.getElementById('education-container').appendChild(createEducationEntry());
    }
  } catch (error) {
    console.error('Failed to load profile:', error);
  }
}

/**
 * Shows status message
 */
function showStatus(message, type = 'success') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = type;

  setTimeout(() => {
    status.textContent = '';
    status.className = '';
  }, 3000);
}

/**
 * Sets up event listeners
 */
export function setupEventListeners() {
  // Save button
  document.getElementById('save').addEventListener('click', async () => {
    try {
      const profileData = collectFormData();
      const passphrase = document.getElementById('pass').value;

      if (passphrase) {
        const key = await deriveKey(passphrase);
        const encrypted = await encryptJson(profileData, key);
        await saveProfile({ _enc: true, ...encrypted });
      } else {
        await saveProfile(profileData);
      }

      showStatus('Profile saved successfully!', 'success');
    } catch (error) {
      showStatus('Failed to save profile', 'error');
      console.error(error);
    }
  });

  // Fill button
  document.getElementById('fill').addEventListener('click', async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (!tab) return;

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content/content-bundle.js']
      });

      const passphrase = document.getElementById('pass').value || '';
      await chrome.tabs.sendMessage(tab.id, {
        type: 'AUTOFILL_REQUEST',
        passphrase: passphrase
      });

      showStatus('Autofill triggered!', 'success');
    } catch (error) {
      showStatus('Failed to autofill', 'error');
      console.error(error);
    }
  });

  // Add education button
  document.getElementById('add-education').addEventListener('click', () => {
    document.getElementById('education-container').appendChild(createEducationEntry());
  });

  // Export JSON
  document.getElementById('export-json').addEventListener('click', () => {
    const profileData = collectFormData();
    const json = JSON.stringify(profileData, null, 2);

    // Copy to clipboard
    navigator.clipboard.writeText(json).then(() => {
      showStatus('JSON copied to clipboard!', 'success');
    });
  });

  // Import JSON
  document.getElementById('import-json').addEventListener('click', () => {
    const json = prompt('Paste your profile JSON:');
    if (json) {
      try {
        const profile = JSON.parse(json);
        populateForm(profile);
        showStatus('JSON imported successfully!', 'success');
      } catch (error) {
        showStatus('Invalid JSON', 'error');
      }
    }
  });
}

// Initialize on load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    setupEventListeners();
  });
}
