/**
 * IndexedDB document storage for resumes and cover letters
 * Stores binary document blobs with metadata
 */

const DB_NAME = 'autofill-documents';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

/**
 * Opens the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

/**
 * Computes SHA-256 hash of byte array
 * @param {Uint8Array} bytes - File bytes
 * @returns {Promise<string>} Hex-encoded hash
 */
export async function computeSha256(bytes) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a unique ID
 * @returns {string}
 */
function generateId() {
  return `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Saves a document to IndexedDB
 * @param {Object} docData - Document data
 * @param {string} [docData.id] - Document ID (auto-generated if not provided)
 * @param {string} docData.label - Human-readable label
 * @param {string} docData.version - Version string
 * @param {string} docData.mime - MIME type
 * @param {Uint8Array} docData.bytes - File bytes
 * @param {string[]} [docData.tags] - Optional tags
 * @param {number} [docData.pages] - Optional page count
 * @returns {Promise<Object>} DocRef metadata
 */
export async function saveDocument(docData) {
  const id = docData.id || generateId();
  const sha256 = await computeSha256(docData.bytes);
  const now = new Date().toISOString();

  const document = {
    id,
    label: docData.label,
    version: docData.version,
    mime: docData.mime,
    sha256,
    bytes: docData.bytes,
    tags: docData.tags || [],
    pages: docData.pages,
    created_at: docData.created_at || now,
    updated_at: now
  };

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(document);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Return DocRef (without bytes)
      const { bytes, ...docRef } = document;
      resolve(docRef);
    };
  });
}

/**
 * Retrieves a document by ID
 * @param {string} id - Document ID
 * @returns {Promise<Object|null>} Document with bytes or null if not found
 */
export async function getDocument(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      resolve(request.result || null);
    };
  });
}

/**
 * Lists all documents (without bytes)
 * @returns {Promise<Object[]>} Array of DocRef metadata
 */
export async function listDocuments() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Return DocRefs without bytes
      const docs = request.result.map(doc => {
        const { bytes, ...docRef } = doc;
        return docRef;
      });
      resolve(docs);
    };
  });
}

/**
 * Deletes a document by ID
 * @param {string} id - Document ID
 * @returns {Promise<void>}
 */
export async function deleteDocument(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}