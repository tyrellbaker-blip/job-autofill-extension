/**
 * Crypto utilities for profile encryption
 * Uses Web Crypto API with PBKDF2 and AES-GCM
 */

const SALT = 'autofill-extension-v1'; // Consistent salt for key derivation
const ITERATIONS = 100000;
const KEY_LENGTH = 256;

/**
 * Derives a cryptographic key from a passphrase using PBKDF2
 * @param {string} passphrase - User passphrase
 * @returns {Promise<CryptoKey>} Derived AES-GCM key
 */
export async function deriveKey(passphrase) {
  const encoder = new TextEncoder();
  const passphraseBytes = encoder.encode(passphrase);

  // Import the passphrase as a key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // Derive the actual encryption key
  const saltBytes = encoder.encode(SALT);
  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: KEY_LENGTH
    },
    false,
    ['encrypt', 'decrypt']
  );

  return derivedKey;
}

/**
 * Encrypts JSON data using AES-GCM
 * @param {Object} data - JSON data to encrypt
 * @param {CryptoKey} key - Encryption key
 * @returns {Promise<{iv: number[], ct: number[]}>} Encrypted data with IV
 */
export async function encryptJson(data, key) {
  const encoder = new TextEncoder();
  const jsonString = JSON.stringify(data);
  const plaintext = encoder.encode(jsonString);

  // Generate random IV
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  // Encrypt the data
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    plaintext
  );

  // Return IV and ciphertext as arrays
  return {
    iv: Array.from(iv),
    ct: Array.from(new Uint8Array(ciphertext))
  };
}

/**
 * Decrypts encrypted data back to JSON
 * @param {{iv: number[], ct: number[]}} payload - Encrypted data with IV
 * @param {CryptoKey} key - Decryption key
 * @returns {Promise<Object>} Decrypted JSON object
 */
export async function decryptJson(payload, key) {
  const iv = new Uint8Array(payload.iv);
  const ciphertext = new Uint8Array(payload.ct);

  // Decrypt the data
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    ciphertext
  );

  // Convert back to JSON
  const decoder = new TextDecoder();
  const jsonString = decoder.decode(plaintext);
  return JSON.parse(jsonString);
}