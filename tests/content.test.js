import { vi } from 'vitest';

// Mock modules before importing
vi.mock('../src/util/storage.js', () => ({
  loadProfile: vi.fn()
}));

vi.mock('../src/util/crypto.js', () => ({
  deriveKey: vi.fn(),
  decryptJson: vi.fn()
}));

vi.mock('../src/content/detectors.js', () => ({
  detectPortal: vi.fn()
}));

vi.mock('../src/content/adapters/baseAdapter.js', () => ({
  getAdapter: vi.fn()
}));

vi.mock('../src/content/filler.js', () => ({
  genericFill: vi.fn()
}));

import { loadProfile } from '../src/util/storage.js';
import { deriveKey, decryptJson } from '../src/util/crypto.js';
import { detectPortal } from '../src/content/detectors.js';
import { getAdapter } from '../src/content/adapters/baseAdapter.js';
import { genericFill } from '../src/content/filler.js';

describe('Content Script', () => {
  let messageListener;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock location.hostname
    Object.defineProperty(window, 'location', {
      value: { hostname: 'test.greenhouse.io' },
      writable: true
    });

    // Capture the message listener when the content script is imported
    global.chrome.runtime.onMessage.addListener = vi.fn((callback) => {
      messageListener = callback;
    });
  });

  describe('Profile loading', () => {
    it('should load unencrypted profile', async () => {
      const testProfile = { name: 'John Doe', email: 'john@example.com' };
      loadProfile.mockResolvedValue(testProfile);

      // Import content script to set up listener
      await import('../src/content/content.js');

      // Simulate message
      const message = { type: 'AUTOFILL_REQUEST', passphrase: '' };
      await messageListener(message);

      expect(loadProfile).toHaveBeenCalled();
    });

    it('should decrypt encrypted profile with passphrase', async () => {
      const encryptedProfile = { _enc: true, iv: [1, 2, 3], ct: [4, 5, 6] };
      const decryptedProfile = { name: 'John Doe', email: 'john@example.com' };
      const mockKey = { type: 'secret' };

      loadProfile.mockResolvedValue(encryptedProfile);
      deriveKey.mockResolvedValue(mockKey);
      decryptJson.mockResolvedValue(decryptedProfile);

      await import('../src/content/content.js');

      const message = { type: 'AUTOFILL_REQUEST', passphrase: 'test-password' };
      await messageListener(message);

      expect(loadProfile).toHaveBeenCalled();
      expect(deriveKey).toHaveBeenCalledWith('test-password');
      expect(decryptJson).toHaveBeenCalledWith(encryptedProfile, mockKey);
    });

    it('should return null for encrypted profile without passphrase', async () => {
      const encryptedProfile = { _enc: true, iv: [1, 2, 3], ct: [4, 5, 6] };
      loadProfile.mockResolvedValue(encryptedProfile);

      await import('../src/content/content.js');

      const message = { type: 'AUTOFILL_REQUEST', passphrase: '' };
      await messageListener(message);

      expect(loadProfile).toHaveBeenCalled();
      expect(deriveKey).not.toHaveBeenCalled();
      expect(decryptJson).not.toHaveBeenCalled();
    });

    it('should handle no stored profile', async () => {
      loadProfile.mockResolvedValue(null);

      await import('../src/content/content.js');

      const message = { type: 'AUTOFILL_REQUEST', passphrase: '' };
      await messageListener(message);

      expect(loadProfile).toHaveBeenCalled();
      expect(detectPortal).not.toHaveBeenCalled();
    });
  });

  describe('Autofill workflow', () => {
    const testProfile = { name: 'John Doe', email: 'john@example.com' };

    beforeEach(() => {
      loadProfile.mockResolvedValue(testProfile);
    });

    it('should use adapter when portal is detected', async () => {
      const mockAdapter = {
        mapFields: vi.fn().mockReturnValue({
          name: document.createElement('input'),
          email: document.createElement('input')
        }),
        fill: vi.fn()
      };

      detectPortal.mockReturnValue('greenhouse');
      getAdapter.mockReturnValue(mockAdapter);

      await import('../src/content/content.js');

      const message = { type: 'AUTOFILL_REQUEST', passphrase: '' };
      await messageListener(message);

      expect(detectPortal).toHaveBeenCalledWith('test.greenhouse.io', document);
      expect(getAdapter).toHaveBeenCalledWith('greenhouse');
      expect(mockAdapter.mapFields).toHaveBeenCalledWith(document);
      expect(mockAdapter.fill).toHaveBeenCalledWith(
        document,
        testProfile,
        expect.any(Object)
      );
      expect(genericFill).not.toHaveBeenCalled();
    });

    it('should use generic fill when no adapter mapping', async () => {
      const mockAdapter = {
        mapFields: vi.fn().mockReturnValue(null),
        fill: vi.fn()
      };

      detectPortal.mockReturnValue('greenhouse');
      getAdapter.mockReturnValue(mockAdapter);

      await import('../src/content/content.js');

      const message = { type: 'AUTOFILL_REQUEST', passphrase: '' };
      await messageListener(message);

      expect(mockAdapter.mapFields).toHaveBeenCalledWith(document);
      expect(mockAdapter.fill).not.toHaveBeenCalled();
      expect(genericFill).toHaveBeenCalledWith(document, testProfile);
    });

    it('should use generic fill when no adapter found', async () => {
      detectPortal.mockReturnValue(null);
      getAdapter.mockReturnValue(null);

      await import('../src/content/content.js');

      const message = { type: 'AUTOFILL_REQUEST', passphrase: '' };
      await messageListener(message);

      expect(detectPortal).toHaveBeenCalledWith('test.greenhouse.io', document);
      expect(getAdapter).toHaveBeenCalledWith(null);
      expect(genericFill).toHaveBeenCalledWith(document, testProfile);
    });

    it('should use generic fill when adapter has no mapFields method', async () => {
      const mockAdapter = { fill: vi.fn() };

      detectPortal.mockReturnValue('greenhouse');
      getAdapter.mockReturnValue(mockAdapter);

      await import('../src/content/content.js');

      const message = { type: 'AUTOFILL_REQUEST', passphrase: '' };
      await messageListener(message);

      expect(genericFill).toHaveBeenCalledWith(document, testProfile);
    });
  });

  describe('Message handling', () => {
    it('should ignore non-autofill messages', async () => {
      await import('../src/content/content.js');

      const message = { type: 'OTHER_MESSAGE' };
      await messageListener(message);

      expect(loadProfile).not.toHaveBeenCalled();
    });

    it('should ignore malformed messages', async () => {
      await import('../src/content/content.js');

      await messageListener(null);
      await messageListener(undefined);
      await messageListener({});

      expect(loadProfile).not.toHaveBeenCalled();
    });

    it('should handle missing passphrase', async () => {
      const testProfile = { name: 'John Doe' };
      loadProfile.mockResolvedValue(testProfile);

      await import('../src/content/content.js');

      const message = { type: 'AUTOFILL_REQUEST' };
      await messageListener(message);

      expect(loadProfile).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle profile loading errors', async () => {
      loadProfile.mockRejectedValue(new Error('Storage error'));

      await import('../src/content/content.js');

      const message = { type: 'AUTOFILL_REQUEST', passphrase: '' };

      // Should not throw
      await expect(messageListener(message)).resolves.toBeUndefined();
    });

    it('should handle decryption errors', async () => {
      const encryptedProfile = { _enc: true, iv: [1, 2, 3], ct: [4, 5, 6] };
      loadProfile.mockResolvedValue(encryptedProfile);
      deriveKey.mockRejectedValue(new Error('Decryption failed'));

      await import('../src/content/content.js');

      const message = { type: 'AUTOFILL_REQUEST', passphrase: 'wrong-password' };

      await expect(messageListener(message)).resolves.toBeUndefined();
    });

    it('should handle portal detection errors', async () => {
      const testProfile = { name: 'John Doe' };
      loadProfile.mockResolvedValue(testProfile);
      detectPortal.mockImplementation(() => {
        throw new Error('Detection failed');
      });

      await import('../src/content/content.js');

      const message = { type: 'AUTOFILL_REQUEST', passphrase: '' };

      await expect(messageListener(message)).resolves.toBeUndefined();
    });
  });
});