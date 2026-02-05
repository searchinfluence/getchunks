#!/usr/bin/env node
// Build script to inject GTM ID from environment variable into HTML
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GTM_ID = process.env.GTM_ID || 'GTM-XXXXXXX';
const HTML_PATH = join(__dirname, '../public/index.html');

console.log(`Building with GTM ID: ${GTM_ID === 'GTM-XXXXXXX' ? 'PLACEHOLDER (set GTM_ID env var)' : GTM_ID}`);

try {
  let html = readFileSync(HTML_PATH, 'utf8');
  
  // Replace GTM ID in the script tag
  html = html.replace(
    /'GTM-XXXXXXX'|'GTM-[A-Z0-9]+'/g,
    `'${GTM_ID}'`
  );
  
  // Replace GTM ID in the noscript iframe src
  html = html.replace(
    /id=GTM-XXXXXXX|id=GTM-[A-Z0-9]+/g,
    `id=${GTM_ID}`
  );
  
  writeFileSync(HTML_PATH, html, 'utf8');
  console.log('✓ GTM ID injected successfully');
} catch (error) {
  console.error('Error building HTML:', error);
  process.exit(1);
}

