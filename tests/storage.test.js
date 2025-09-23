import { vi } from 'vitest';
import { saveProfile, loadProfile } from '../src/util/storage.js';

describe('Storage utilities', () => {
  const testProfile = {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '555-0123'
  };

  const encryptedProfile = {
    _enc: true,
    iv: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    ct: [65, 66, 67, 68]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveProfile', () => {
    it('should save profile to chrome storage', async () => {
      global.chrome.storage.local.set.mockResolvedValue();

      await saveProfile(testProfile);

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        'autofill_profile_v1': testProfile
      });
    });

    it('should save encrypted profile to chrome storage', async () => {
      global.chrome.storage.local.set.mockResolvedValue();

      await saveProfile(encryptedProfile);

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        'autofill_profile_v1': encryptedProfile
      });
    });

    it('should handle storage errors', async () => {
      const storageError = new Error('Storage quota exceeded');
      global.chrome.storage.local.set.mockRejectedValue(storageError);

      await expect(saveProfile(testProfile)).rejects.toThrow('Storage quota exceeded');
    });

    it('should save empty profile', async () => {
      global.chrome.storage.local.set.mockResolvedValue();

      await saveProfile({});

      expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
        'autofill_profile_v1': {}
      });
    });
  });

  describe('loadProfile', () => {
    it('should load profile from chrome storage', async () => {
      global.chrome.storage.local.get.mockResolvedValue({
        'autofill_profile_v1': testProfile
      });

      const result = await loadProfile();

      expect(global.chrome.storage.local.get).toHaveBeenCalledWith('autofill_profile_v1');
      expect(result).toEqual(testProfile);
    });

    it('should load encrypted profile from chrome storage', async () => {
      global.chrome.storage.local.get.mockResolvedValue({
        'autofill_profile_v1': encryptedProfile
      });

      const result = await loadProfile();

      expect(global.chrome.storage.local.get).toHaveBeenCalledWith('autofill_profile_v1');
      expect(result).toEqual(encryptedProfile);
    });

    it('should return null when no profile exists', async () => {
      global.chrome.storage.local.get.mockResolvedValue({});

      const result = await loadProfile();

      expect(global.chrome.storage.local.get).toHaveBeenCalledWith('autofill_profile_v1');
      expect(result).toBeNull();
    });

    it('should return null when storage returns undefined', async () => {
      global.chrome.storage.local.get.mockResolvedValue({
        'autofill_profile_v1': undefined
      });

      const result = await loadProfile();

      expect(result).toBeNull();
    });

    it('should handle storage errors', async () => {
      const storageError = new Error('Storage access denied');
      global.chrome.storage.local.get.mockRejectedValue(storageError);

      await expect(loadProfile()).rejects.toThrow('Storage access denied');
    });

    it('should handle corrupted storage data', async () => {
      global.chrome.storage.local.get.mockResolvedValue({
        'autofill_profile_v1': null
      });

      const result = await loadProfile();

      expect(result).toBeNull();
    });
  });

  describe('Storage integration', () => {
    it('should save and load profile correctly', async () => {
      global.chrome.storage.local.set.mockResolvedValue();
      global.chrome.storage.local.get.mockResolvedValue({
        'autofill_profile_v1': testProfile
      });

      await saveProfile(testProfile);
      const loaded = await loadProfile();

      expect(loaded).toEqual(testProfile);
    });

    it('should handle multiple save/load operations', async () => {
      global.chrome.storage.local.set.mockResolvedValue();

      const profile1 = { name: 'John' };
      const profile2 = { name: 'Jane' };

      global.chrome.storage.local.get
        .mockResolvedValueOnce({ 'autofill_profile_v1': profile1 })
        .mockResolvedValueOnce({ 'autofill_profile_v1': profile2 });

      await saveProfile(profile1);
      const loaded1 = await loadProfile();

      await saveProfile(profile2);
      const loaded2 = await loadProfile();

      expect(loaded1).toEqual(profile1);
      expect(loaded2).toEqual(profile2);
    });
  });
});