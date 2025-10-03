import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import {
  saveDocument,
  getDocument,
  listDocuments,
  deleteDocument,
  computeSha256
} from '../src/core/storage/documentStore.js';

// Mock IndexedDB
let mockDatabase = new Map();
let mockObjectStores = new Map();

class MockIDBRequest {
  constructor(result, error = null) {
    this.result = result;
    this.error = error;
    this.onsuccess = null;
    this.onerror = null;

    setTimeout(() => {
      if (error) {
        this.onerror?.({ target: this });
      } else {
        this.onsuccess?.({ target: this });
      }
    }, 0);
  }
}

class MockIDBObjectStore {
  constructor(name) {
    this.name = name;
    if (!mockObjectStores.has(name)) {
      mockObjectStores.set(name, new Map());
    }
  }

  put(value) {
    const store = mockObjectStores.get(this.name);
    store.set(value.id, value);
    return new MockIDBRequest(value.id);
  }

  get(id) {
    const store = mockObjectStores.get(this.name);
    return new MockIDBRequest(store.get(id));
  }

  getAll() {
    const store = mockObjectStores.get(this.name);
    return new MockIDBRequest(Array.from(store.values()));
  }

  delete(id) {
    const store = mockObjectStores.get(this.name);
    const existed = store.has(id);
    store.delete(id);
    return new MockIDBRequest(existed ? undefined : null);
  }
}

class MockIDBTransaction {
  constructor(storeNames) {
    this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
  }

  objectStore(name) {
    return new MockIDBObjectStore(name);
  }
}

class MockIDBDatabase {
  constructor() {
    this.objectStoreNames = {
      contains: (name) => mockObjectStores.has(name)
    };
  }

  transaction(storeNames, mode) {
    return new MockIDBTransaction(storeNames);
  }

  createObjectStore(name, options) {
    mockObjectStores.set(name, new Map());
    return new MockIDBObjectStore(name);
  }
}

global.indexedDB = {
  open: (name, version) => {
    const request = new MockIDBRequest(mockDatabase.get(name) || new MockIDBDatabase());
    request.onupgradeneeded = null;

    setTimeout(() => {
      if (!mockDatabase.has(name) && request.onupgradeneeded) {
        const db = new MockIDBDatabase();
        mockDatabase.set(name, db);
        request.result = db;
        request.onupgradeneeded({ target: request });
      }
    }, 0);

    return request;
  }
};

describe('Document Storage', () => {
  beforeEach(() => {
    mockDatabase.clear();
    mockObjectStores.clear();
  });

  describe('computeSha256', () => {
    it('should compute SHA-256 hash of file bytes', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);

      // Mock crypto.subtle.digest
      const mockHash = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
      global.crypto.subtle.digest = vi.fn().mockResolvedValue(mockHash.buffer);

      const hash = await computeSha256(bytes);

      expect(global.crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', bytes);
      expect(hash).toBe('12345678');
    });

    it('should return consistent hash for same input', async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      const mockHash = new Uint8Array([0xab, 0xcd]);
      global.crypto.subtle.digest = vi.fn().mockResolvedValue(mockHash.buffer);

      const hash1 = await computeSha256(bytes);
      const hash2 = await computeSha256(bytes);

      expect(hash1).toBe(hash2);
    });
  });

  describe('saveDocument', () => {
    it('should save a document to IndexedDB', async () => {
      const docData = {
        id: 'doc-1',
        label: 'Resume - Software Engineer',
        version: '1.0',
        mime: 'application/pdf',
        bytes: new Uint8Array([1, 2, 3]),
        tags: ['tech', 'senior']
      };

      const mockHash = new Uint8Array([0xab, 0xcd]);
      global.crypto.subtle.digest = vi.fn().mockResolvedValue(mockHash.buffer);

      const docRef = await saveDocument(docData);

      expect(docRef).toMatchObject({
        id: 'doc-1',
        label: 'Resume - Software Engineer',
        version: '1.0',
        mime: 'application/pdf',
        sha256: 'abcd',
        tags: ['tech', 'senior']
      });
      expect(docRef.created_at).toBeDefined();
      expect(docRef.updated_at).toBeDefined();
    });

    it('should auto-generate ID if not provided', async () => {
      const docData = {
        label: 'Cover Letter',
        version: '1.0',
        mime: 'application/pdf',
        bytes: new Uint8Array([1, 2, 3])
      };

      global.crypto.subtle.digest = vi.fn().mockResolvedValue(new Uint8Array([0x12]).buffer);

      const docRef = await saveDocument(docData);

      expect(docRef.id).toBeDefined();
      expect(docRef.id.length).toBeGreaterThan(0);
    });

    it('should update existing document with same ID', async () => {
      const docData1 = {
        id: 'doc-1',
        label: 'Resume v1',
        version: '1.0',
        mime: 'application/pdf',
        bytes: new Uint8Array([1, 2, 3])
      };

      const docData2 = {
        id: 'doc-1',
        label: 'Resume v2',
        version: '2.0',
        mime: 'application/pdf',
        bytes: new Uint8Array([4, 5, 6])
      };

      global.crypto.subtle.digest = vi.fn().mockResolvedValue(new Uint8Array([0x12]).buffer);

      await saveDocument(docData1);
      const docRef2 = await saveDocument(docData2);

      expect(docRef2.label).toBe('Resume v2');
      expect(docRef2.version).toBe('2.0');
    });
  });

  describe('getDocument', () => {
    it('should retrieve a document by ID', async () => {
      const docData = {
        id: 'doc-1',
        label: 'Resume',
        version: '1.0',
        mime: 'application/pdf',
        bytes: new Uint8Array([1, 2, 3])
      };

      global.crypto.subtle.digest = vi.fn().mockResolvedValue(new Uint8Array([0xab]).buffer);

      await saveDocument(docData);
      const retrieved = await getDocument('doc-1');

      expect(retrieved).toMatchObject({
        id: 'doc-1',
        label: 'Resume',
        mime: 'application/pdf'
      });
      expect(retrieved.bytes).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('should return null for non-existent document', async () => {
      const retrieved = await getDocument('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('listDocuments', () => {
    it('should list all documents', async () => {
      const doc1 = {
        id: 'doc-1',
        label: 'Resume',
        version: '1.0',
        mime: 'application/pdf',
        bytes: new Uint8Array([1])
      };

      const doc2 = {
        id: 'doc-2',
        label: 'Cover Letter',
        version: '1.0',
        mime: 'application/pdf',
        bytes: new Uint8Array([2])
      };

      global.crypto.subtle.digest = vi.fn().mockResolvedValue(new Uint8Array([0x12]).buffer);

      await saveDocument(doc1);
      await saveDocument(doc2);

      const docs = await listDocuments();

      expect(docs).toHaveLength(2);
      expect(docs.map(d => d.id)).toContain('doc-1');
      expect(docs.map(d => d.id)).toContain('doc-2');
    });

    it('should return empty array when no documents exist', async () => {
      const docs = await listDocuments();
      expect(docs).toEqual([]);
    });
  });

  describe('deleteDocument', () => {
    it('should delete a document by ID', async () => {
      const docData = {
        id: 'doc-1',
        label: 'Resume',
        version: '1.0',
        mime: 'application/pdf',
        bytes: new Uint8Array([1, 2, 3])
      };

      global.crypto.subtle.digest = vi.fn().mockResolvedValue(new Uint8Array([0xab]).buffer);

      await saveDocument(docData);
      await deleteDocument('doc-1');

      const retrieved = await getDocument('doc-1');
      expect(retrieved).toBeNull();
    });

    it('should not throw when deleting non-existent document', async () => {
      await expect(deleteDocument('non-existent')).resolves.not.toThrow();
    });
  });

  describe('Deduplication', () => {
    it('should detect duplicate by SHA-256', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      const mockHash = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      global.crypto.subtle.digest = vi.fn().mockResolvedValue(mockHash.buffer);

      const doc1 = {
        id: 'doc-1',
        label: 'Resume v1',
        version: '1.0',
        mime: 'application/pdf',
        bytes: bytes
      };

      const doc2 = {
        id: 'doc-2',
        label: 'Resume v2',
        version: '2.0',
        mime: 'application/pdf',
        bytes: bytes
      };

      const ref1 = await saveDocument(doc1);
      const ref2 = await saveDocument(doc2);

      // Both should have the same SHA-256
      expect(ref1.sha256).toBe(ref2.sha256);
      expect(ref1.sha256).toBe('deadbeef');
    });
  });
});