# Job Application Autofill Extension

A Chrome extension for automatically filling job application forms across multiple portals with intelligent dropdown matching and encryption support.

## Features

- **Smart Form Filling**: Automatically fills job applications on Greenhouse, Workday, Lever, Taleo, and unknown portals
- **Intelligent Dropdown Matching**: Fuzzy matches country codes, states, phone types, and boolean values
- **User-Friendly UI**: Form-based interface - no JSON editing required
- **Secure Storage**: Optional AES-GCM encryption with PBKDF2 key derivation
- **Comprehensive Field Support**: Name, email, phone, address, work authorization, education, professional links

## Quick Start

```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Load in Chrome
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select this project folder
```

## Usage

1. Click the extension icon in Chrome
2. Fill out your profile in the form
3. Click "Save Profile"
4. Navigate to any job application page
5. Click "Fill This Page"

## Supported Portals

- **Greenhouse** - Full field support
- **Workday** - data-automation-id based
- **Lever** - Standard name-based
- **Taleo** - ID-based selectors
- **Generic** - Heuristic matching for unknown sites

## Development

```bash
# Run tests
npm test

# Build bundle
npm run build

# Lint code
npm run lint
```

## Architecture

```
src/
├── core/           # Core logic (selectMatcher, storage)
├── content/        # Content scripts & adapters
├── ui/             # Popup interface
├── bg/             # Service worker
└── util/           # Crypto & storage utilities
```

## License

MIT License
