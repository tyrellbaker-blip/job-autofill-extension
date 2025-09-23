import { vi } from 'vitest';

// Mock modules before importing
vi.mock('../src/util/storage.js', () => ({
  saveProfile: vi.fn(),
  loadProfile: vi.fn()
}));

vi.mock('../src/util/crypto.js', () => ({
  deriveKey: vi.fn(),
  encryptJson: vi.fn(),
  decryptJson: vi.fn()
}));

import { saveProfile, loadProfile } from '../src/util/storage.js';
import { deriveKey, encryptJson } from '../src/util/crypto.js';
import { init, setupEventListeners } from '../src/ui/popup.js';

// Mock DOM elements
function setupDOM() {
  document.body.innerHTML = `
    <input type="password" id="pass" />
    <textarea id="profile"></textarea>
    <button id="save">Save</button>
    <button id="fill">Fill This Page</button>
    <div id="status"></div>
  `;
}

describe('Popup functionality', () => {
  beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();

    // Reset status
    const status = document.getElementById('status');
    if (status) status.textContent = '';
  });

  describe('Initialization', () => {
    it('should load existing profile on init', async () => {
      const testProfile = { name: 'John Doe', email: 'john@example.com' };
      loadProfile.mockResolvedValue(testProfile);

      await init();

      const profileTextarea = document.getElementById('profile');
      expect(loadProfile).toHaveBeenCalled();
      expect(profileTextarea.value).toBe(JSON.stringify(testProfile, null, 2));
    });

    it('should handle empty profile on init', async () => {
      loadProfile.mockResolvedValue(null);

      await init();

      const profileTextarea = document.getElementById('profile');
      expect(profileTextarea.value).toBe('');
    });

    it('should handle init errors gracefully', async () => {
      loadProfile.mockRejectedValue(new Error('Storage error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation();

      await init();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Save functionality', () => {
    beforeEach(() => {
      // Set up event listeners
      setupEventListeners();
    });

    it('should save unencrypted profile', async () => {
      const testProfile = { name: 'John Doe', email: 'john@example.com' };

      const profileTextarea = document.getElementById('profile');
      const saveButton = document.getElementById('save');
      const status = document.getElementById('status');

      profileTextarea.value = JSON.stringify(testProfile);
      saveProfile.mockResolvedValue();

      saveButton.click();

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(saveProfile).toHaveBeenCalledWith(testProfile);
      expect(status.textContent).toBe('Saved.');
    });

    it('should save encrypted profile with passphrase', async () => {
      const testProfile = { name: 'John Doe', email: 'john@example.com' };
      const mockKey = { type: 'secret' };
      const encryptedData = { iv: [1, 2, 3], ct: [4, 5, 6] };

      const passInput = document.getElementById('pass');
      const profileTextarea = document.getElementById('profile');
      const saveButton = document.getElementById('save');
      const status = document.getElementById('status');

      passInput.value = 'test-password';
      profileTextarea.value = JSON.stringify(testProfile);

      deriveKey.mockResolvedValue(mockKey);
      encryptJson.mockResolvedValue(encryptedData);
      saveProfile.mockResolvedValue();

      saveButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(deriveKey).toHaveBeenCalledWith('test-password');
      expect(encryptJson).toHaveBeenCalledWith(testProfile, mockKey);
      expect(saveProfile).toHaveBeenCalledWith({ _enc: true, ...encryptedData });
      expect(status.textContent).toBe('Saved.');
    });

    it('should handle empty profile', async () => {
      const profileTextarea = document.getElementById('profile');
      const saveButton = document.getElementById('save');
      const status = document.getElementById('status');

      profileTextarea.value = '';
      saveProfile.mockResolvedValue();

      saveButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(saveProfile).toHaveBeenCalledWith({});
      expect(status.textContent).toBe('Saved.');
    });

    it('should handle invalid JSON', async () => {
      const profileTextarea = document.getElementById('profile');
      const saveButton = document.getElementById('save');
      const status = document.getElementById('status');

      profileTextarea.value = '{ invalid json }';

      saveButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(saveProfile).not.toHaveBeenCalled();
      expect(status.textContent).toBe('Invalid JSON.');
    });

    it('should handle save errors', async () => {
      const testProfile = { name: 'John Doe' };

      const profileTextarea = document.getElementById('profile');
      const saveButton = document.getElementById('save');
      const status = document.getElementById('status');

      profileTextarea.value = JSON.stringify(testProfile);
      saveProfile.mockRejectedValue(new Error('Storage full'));

      saveButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(status.textContent).toBe('Invalid JSON.');
    });
  });

  describe('Fill functionality', () => {
    beforeEach(() => {
      setupEventListeners();
    });

    it('should execute content script and send message', async () => {
      const mockTab = { id: 123, url: 'http://localhost:8000/test.html' };

      global.chrome.tabs.query.mockResolvedValue([mockTab]);
      global.chrome.scripting.executeScript.mockResolvedValue();
      global.chrome.tabs.sendMessage.mockResolvedValue();

      const passInput = document.getElementById('pass');
      const fillButton = document.getElementById('fill');

      passInput.value = 'test-pass';

      fillButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(global.chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true
      });

      expect(global.chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        files: ['src/content/content-bundle.js']
      });

      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(123, {
        type: 'AUTOFILL_REQUEST',
        passphrase: 'test-pass'
      });
    });

    it('should handle empty passphrase', async () => {
      const mockTab = { id: 123 };

      global.chrome.tabs.query.mockResolvedValue([mockTab]);
      global.chrome.scripting.executeScript.mockResolvedValue();
      global.chrome.tabs.sendMessage.mockResolvedValue();

      const fillButton = document.getElementById('fill');

      fillButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(global.chrome.tabs.sendMessage).toHaveBeenCalledWith(123, {
        type: 'AUTOFILL_REQUEST',
        passphrase: ''
      });
    });

    it('should handle tab query errors', async () => {
      global.chrome.tabs.query.mockRejectedValue(new Error('No active tab'));

      const fillButton = document.getElementById('fill');

      fillButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(global.chrome.scripting.executeScript).not.toHaveBeenCalled();
      expect(global.chrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });
});