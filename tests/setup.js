import { vi } from 'vitest';

// Set up Chrome extension API mocks
global.chrome = {
  storage: {
    local: {
      set: vi.fn(),
      get: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    }
  },
  tabs: {
    query: vi.fn(),
    sendMessage: vi.fn()
  },
  scripting: {
    executeScript: vi.fn()
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  }
};

// Set up crypto API mocks
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: vi.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
    subtle: {
      importKey: vi.fn(),
      deriveKey: vi.fn(),
      encrypt: vi.fn(),
      decrypt: vi.fn()
    }
  }
});

// Global mocks are defined in individual test files where needed

// Note: Adapter modules are not mocked here to allow adapter tests to run
// Individual test files can mock them if needed