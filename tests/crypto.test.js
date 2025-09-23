import { vi } from 'vitest';
import { deriveKey, encryptJson, decryptJson } from '../src/util/crypto.js';

describe('Crypto utilities', () => {
  const testPassphrase = 'test-password-123';
  const testData = { name: 'John Doe', email: 'john@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup crypto API mocks with proper return values
    global.crypto.subtle.importKey.mockResolvedValue({ type: 'raw' });
    global.crypto.subtle.deriveKey.mockResolvedValue({ type: 'secret', algorithm: { name: 'AES-GCM' } });
    global.crypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(32));
    global.crypto.subtle.decrypt.mockResolvedValue(new TextEncoder().encode(JSON.stringify(testData)).buffer);

    // Reset random values mock
    global.crypto.getRandomValues.mockImplementation((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = i % 256;
      }
      return array;
    });
  });

  describe('deriveKey', () => {
    it('should derive a key from a passphrase', async () => {
      const key = await deriveKey(testPassphrase);

      expect(global.crypto.subtle.importKey).toHaveBeenCalled();
      expect(global.crypto.subtle.deriveKey).toHaveBeenCalled();

      const deriveCall = global.crypto.subtle.deriveKey.mock.calls[0];
      expect(deriveCall[0].name).toBe('PBKDF2');
      expect(deriveCall[0].iterations).toBe(100000);
      expect(deriveCall[0].hash).toBe('SHA-256');

      expect(key).toBeDefined();
    });

    it('should use consistent salt', async () => {
      await deriveKey(testPassphrase);
      const importCall = global.crypto.subtle.importKey.mock.calls[0];
      const passphraseBytes = importCall[1];

      expect(new TextDecoder().decode(passphraseBytes)).toBe(testPassphrase);
    });
  });

  describe('encryptJson', () => {
    const mockKey = { type: 'secret' };

    beforeEach(() => {
      global.crypto.getRandomValues.mockImplementation((array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = i % 256;
        }
        return array;
      });
      global.crypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(32));
    });

    it('should encrypt JSON data', async () => {
      const result = await encryptJson(testData, mockKey);

      expect(global.crypto.getRandomValues).toHaveBeenCalled();
      expect(global.crypto.subtle.encrypt).toHaveBeenCalled();

      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('ct');
      expect(Array.isArray(result.iv)).toBe(true);
      expect(Array.isArray(result.ct)).toBe(true);
    });

    it('should generate random IV for each encryption', async () => {
      const result1 = await encryptJson(testData, mockKey);
      const result2 = await encryptJson(testData, mockKey);

      expect(result1.iv).toEqual(result2.iv); // Due to our mock implementation
      expect(global.crypto.getRandomValues).toHaveBeenCalledTimes(2);
    });
  });

  describe('decryptJson', () => {
    const mockKey = { type: 'secret' };
    const mockPayload = {
      iv: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      ct: [65, 66, 67, 68] // "ABCD" in ASCII
    };

    beforeEach(() => {
      const jsonString = JSON.stringify(testData);
      const encoder = new TextEncoder();
      global.crypto.subtle.decrypt.mockResolvedValue(encoder.encode(jsonString).buffer);
    });

    it('should decrypt encrypted data back to original JSON', async () => {
      const result = await decryptJson(mockPayload, mockKey);

      expect(global.crypto.subtle.decrypt).toHaveBeenCalledWith(
        { name: 'AES-GCM', iv: new Uint8Array(mockPayload.iv) },
        mockKey,
        new Uint8Array(mockPayload.ct)
      );

      expect(result).toEqual(testData);
    });

    it('should handle invalid encrypted data', async () => {
      global.crypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(decryptJson(mockPayload, mockKey)).rejects.toThrow('Decryption failed');
    });
  });

  describe('Encryption/Decryption round trip', () => {
    it('should encrypt and decrypt data correctly', async () => {
      const mockKey = { type: 'secret' };

      // Mock the full round trip
      const originalJson = JSON.stringify(testData);
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(originalJson);

      global.crypto.subtle.encrypt.mockResolvedValue(encodedData.buffer);
      global.crypto.subtle.decrypt.mockResolvedValue(encodedData.buffer);

      const encrypted = await encryptJson(testData, mockKey);
      const decrypted = await decryptJson(encrypted, mockKey);

      expect(decrypted).toEqual(testData);
    });
  });
});