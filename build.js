#!/usr/bin/env node
/**
 * Simple build script to bundle content script for Chrome extension
 * Combines all content script modules into a single file
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'src');
const contentDir = path.join(srcDir, 'content');
const utilDir = path.join(srcDir, 'util');

// Read all necessary files
const files = [
  // Utils first (dependencies)
  path.join(utilDir, 'crypto.js'),
  path.join(utilDir, 'storage.js'),

  // Core modules
  path.join(srcDir, 'core', 'selectMatcher.js'),

  // Content script modules
  path.join(contentDir, 'detectors.js'),
  path.join(contentDir, 'filler.js'),
  path.join(contentDir, 'adapters', 'greenhouse.js'),
  path.join(contentDir, 'adapters', 'workday.js'),
  path.join(contentDir, 'adapters', 'lever.js'),
  path.join(contentDir, 'adapters', 'taleo.js'),
  path.join(contentDir, 'adapters', 'baseAdapter.js'),

  // Main content script last
  path.join(contentDir, 'content.js')
];

let bundle = '// Auto-generated bundle - do not edit directly\n';
bundle += '// Wrapped in block scope to avoid global pollution\n';
bundle += '{\n';

// Track adapter functions
const adapterFiles = ['greenhouse', 'workday', 'lever', 'taleo'];
const adapterFunctions = {};

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf-8');
    const fileName = path.basename(file, '.js');

    // Remove import statements
    content = content.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');

    // For adapter files, track their functions
    if (adapterFiles.includes(fileName)) {
      // Rename functions to be unique per adapter
      content = content.replace(/function mapFields\(/g, `function ${fileName}MapFields(`);
      content = content.replace(/function fill\(/g, `function ${fileName}Fill(`);
      adapterFunctions[fileName] = { mapFields: `${fileName}MapFields`, fill: `${fileName}Fill` };
    }

    // Remove export keywords but keep the declarations
    content = content.replace(/^export\s+/gm, '');

    bundle += `\n// ============================================\n`;
    bundle += `// File: ${path.relative(srcDir, file)}\n`;
    bundle += `// ============================================\n`;
    bundle += content;
    bundle += '\n';
  } else {
    console.warn(`Warning: File not found: ${file}`);
  }
});

// Create adapter registry
bundle += '\n// Create adapter registry\n';
bundle += 'const adapters = {\n';
for (const [name, funcs] of Object.entries(adapterFunctions)) {
  bundle += `  ${name}: { mapFields: ${funcs.mapFields}, fill: ${funcs.fill} },\n`;
}
bundle += '};\n\n';

// Redefine getAdapter to use the registry
bundle += '// Override getAdapter to use our registry\n';
bundle += 'function getAdapter(portalName) {\n';
bundle += '  if (!portalName) return null;\n';
bundle += '  return adapters[portalName] || null;\n';
bundle += '}\n';

bundle += '\n}\n';

// Write bundle
const outputPath = path.join(contentDir, 'content-bundle.js');
fs.writeFileSync(outputPath, bundle);

console.log(`✓ Bundle created: ${outputPath}`);
console.log(`✓ Size: ${(bundle.length / 1024).toFixed(2)} KB`);
