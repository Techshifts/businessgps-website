#!/usr/bin/env node

/**
 * BusinessGPS.ai — Static Site Build Script
 *
 * Zero-dependency build tool that assembles HTML pages from shared partials.
 * Replaces <!-- #include filename.html --> markers with partial contents.
 * Adjusts relative paths based on file depth (root vs pages/).
 *
 * Usage:
 *   node build.js           — Build all HTML files
 *   node build.js --dry-run — Show what would change without writing
 *
 * Partials live in _includes/ and use these tokens:
 *   {{PATH_PREFIX}}  — "" for root files, "../" for pages/ files
 *   {{CSS_VERSION}}  — Timestamp-based cache buster
 *   {{NAV_CTA}}      — Per-page CTA from nav-items.json
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const INCLUDES_DIR = path.join(ROOT, '_includes');
const NAV_ITEMS_PATH = path.join(INCLUDES_DIR, 'nav-items.json');
const DRY_RUN = process.argv.includes('--dry-run');

// Cache buster based on build timestamp
const CSS_VERSION = Date.now().toString(36);

// Load nav items config
let navItems = {};
try {
    navItems = JSON.parse(fs.readFileSync(NAV_ITEMS_PATH, 'utf8'));
} catch (e) {
    console.warn('Warning: Could not load nav-items.json, using defaults');
}

// Cache for loaded partials
const partialCache = {};

/**
 * Load a partial file from _includes/, with caching
 */
function loadPartial(filename) {
    if (partialCache[filename]) return partialCache[filename];

    const filePath = path.join(INCLUDES_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.error(`  ERROR: Partial not found: ${filename}`);
        return `<!-- ERROR: Partial "${filename}" not found -->`;
    }

    partialCache[filename] = fs.readFileSync(filePath, 'utf8');
    return partialCache[filename];
}

/**
 * Get the path prefix for a file based on its depth from root
 */
function getPathPrefix(filePath) {
    const relPath = path.relative(ROOT, filePath);
    const depth = relPath.split(path.sep).length - 1;
    return depth > 0 ? '../'.repeat(depth) : '';
}

/**
 * Get the relative file key for nav-items.json lookup
 */
function getFileKey(filePath) {
    return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

/**
 * Build the nav CTA HTML for a specific page
 */
function buildNavCTA(filePath, pathPrefix) {
    const fileKey = getFileKey(filePath);
    const config = navItems[fileKey] || navItems['default'] || {
        cta_text: 'Try Athena',
        cta_href: `${pathPrefix}pages/athena.html`,
        cta_class: 'btn btn-primary btn-sm'
    };

    let href = config.cta_href;
    // Replace path prefix token in href if present
    href = href.replace(/\{\{PATH_PREFIX\}\}/g, pathPrefix);

    return `<li><a href="${href}" class="${config.cta_class}">${config.cta_text}</a></li>`;
}

/**
 * Process a single HTML file — find include markers, replace with partials
 */
function processFile(filePath) {
    const original = fs.readFileSync(filePath, 'utf8');
    const pathPrefix = getPathPrefix(filePath);
    const navCTA = buildNavCTA(filePath, pathPrefix);

    // Replace <!-- #include filename.html --> markers
    let processed = original.replace(
        /<!--\s*#include\s+([\w\-]+\.html)\s*-->/g,
        (match, filename) => {
            let content = loadPartial(filename);
            // Replace tokens
            content = content.replace(/\{\{PATH_PREFIX\}\}/g, pathPrefix);
            content = content.replace(/\{\{CSS_VERSION\}\}/g, CSS_VERSION);
            content = content.replace(/\{\{NAV_CTA\}\}/g, navCTA);
            return content;
        }
    );

    // Also do token replacement in the main file (for inline tokens)
    processed = processed.replace(/\{\{PATH_PREFIX\}\}/g, pathPrefix);
    processed = processed.replace(/\{\{CSS_VERSION\}\}/g, CSS_VERSION);

    if (processed !== original) {
        if (DRY_RUN) {
            console.log(`  [DRY RUN] Would update: ${path.relative(ROOT, filePath)}`);
        } else {
            fs.writeFileSync(filePath, processed, 'utf8');
            console.log(`  Updated: ${path.relative(ROOT, filePath)}`);
        }
        return true;
    }
    return false;
}

/**
 * Find all HTML files to process
 */
function findHtmlFiles() {
    const files = [];

    // Root HTML files
    fs.readdirSync(ROOT).forEach(f => {
        if (f.endsWith('.html')) {
            files.push(path.join(ROOT, f));
        }
    });

    // pages/ HTML files
    const pagesDir = path.join(ROOT, 'pages');
    if (fs.existsSync(pagesDir)) {
        fs.readdirSync(pagesDir).forEach(f => {
            if (f.endsWith('.html')) {
                files.push(path.join(pagesDir, f));
            }
        });
    }

    return files;
}

// Main
console.log('BusinessGPS.ai Build');
console.log(`  CSS version: ${CSS_VERSION}`);
console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'BUILD'}`);
console.log('');

const files = findHtmlFiles();
let updatedCount = 0;

files.forEach(f => {
    if (processFile(f)) updatedCount++;
});

console.log('');
console.log(`Done. ${updatedCount}/${files.length} files ${DRY_RUN ? 'would be ' : ''}updated.`);
