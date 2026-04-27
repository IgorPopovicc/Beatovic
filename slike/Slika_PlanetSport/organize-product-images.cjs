#!/usr/bin/env node
'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

const TARGET_DIR = __dirname;
const UNRECOGNIZED_FOLDER = '_unrecognized';
const MANIFEST_FOLDER = '_organize-manifests';

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.avif',
]);

const IMAGE_SUFFIX_WORDS = [
  'front',
  'back',
  'left',
  'right',
  'side',
  'top',
  'bottom',
  'detail',
  'details',
  'main',
  'primary',
  'hero',
  'alt',
  'alternate',
  'thumb',
  'thumbnail',
  'zoom',
  'model',
  'packshot',
  'lifestyle',
  'gallery',
  'image',
  'img',
  'photo',
  'foto',
  'slika',
];

const IMAGE_SUFFIX_PATTERN = IMAGE_SUFFIX_WORDS.join('|');

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.undoManifest) {
    await undoFromManifest(options);
    return;
  }

  await organizeImages(options);
}

function parseArgs(argv) {
  const options = {
    dryRun: true,
    help: false,
    undoManifest: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--apply') {
      options.dryRun = false;
    } else if (arg === '--undo') {
      const manifest = argv[i + 1];
      if (!manifest || manifest.startsWith('--')) {
        throw new Error('Missing manifest path after --undo.');
      }
      options.undoManifest = manifest;
      i += 1;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node organize-product-images.cjs
      Dry run. Prints what would be moved. This is the default.

  node organize-product-images.cjs --apply
      Creates product folders and moves images for real.

  node organize-product-images.cjs --undo _organize-manifests/<manifest>.json
      Dry run for undoing a previous real move.

  node organize-product-images.cjs --undo _organize-manifests/<manifest>.json --apply
      Moves files from the manifest back to their original top-level names.

Notes:
  - Only image files directly inside this folder are organized.
  - Existing files are never overwritten; conflicting names get a safe suffix.
  - Real moves write a manifest in ${MANIFEST_FOLDER}/ so the operation can be reviewed or undone.
`.trim());
}

async function organizeImages(options) {
  const entries = await fs.readdir(TARGET_DIR, { withFileTypes: true });
  const imageFiles = entries
    .filter((entry) => entry.isFile() && isImageFile(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const items = imageFiles.map((fileName) => {
    const sku = detectSku(fileName);
    return {
      fileName,
      sku,
      folderName: sku || UNRECOGNIZED_FOLDER,
    };
  });

  const groups = groupBy(items, (item) => item.folderName);
  const moves = await buildMovePlan(groups);
  const report = buildReport(items, groups, moves);

  printMovePlan(options, groups, moves, report);

  if (options.dryRun) {
    console.log('\nDry run only. Run with --apply when the plan looks correct.');
    return;
  }

  const manifestPath = await writeManifest('planned', moves);

  const completedMoves = [];
  for (const move of moves) {
    await fs.mkdir(move.destinationDirAbs, { recursive: true });
    await fs.rename(move.sourceAbs, move.destinationAbs);
    completedMoves.push(move);
  }

  await writeManifest('completed', completedMoves, manifestPath);

  console.log(`\nDone. Manifest written to ${toRelativeLog(manifestPath)}`);
}

async function buildMovePlan(groups) {
  const destinationState = new Map();
  const moves = [];

  for (const folderName of [...groups.keys()].sort()) {
    const destinationDirAbs = path.join(TARGET_DIR, folderName);
    destinationState.set(folderName, await readExistingNames(destinationDirAbs));
  }

  for (const folderName of [...groups.keys()].sort()) {
    const state = destinationState.get(folderName);
    const destinationDirAbs = path.join(TARGET_DIR, folderName);
    const groupItems = groups
      .get(folderName)
      .slice()
      .sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));

    for (const item of groupItems) {
      const sourceAbs = path.join(TARGET_DIR, item.fileName);
      const safeName = getAvailableFileName(item.fileName, state.usedNames);
      state.usedNames.add(canonicalName(safeName.fileName));

      moves.push({
        sourceAbs,
        sourceRelative: item.fileName,
        destinationDirAbs,
        destinationDirExists: state.exists,
        destinationAbs: path.join(destinationDirAbs, safeName.fileName),
        destinationRelative: path.join(folderName, safeName.fileName),
        requestedDestinationRelative: path.join(folderName, item.fileName),
        folderName,
        sku: item.sku,
        conflict: safeName.conflict,
      });
    }
  }

  return moves;
}

async function readExistingNames(destinationDirAbs) {
  try {
    const entries = await fs.readdir(destinationDirAbs, { withFileTypes: true });
    return {
      exists: true,
      usedNames: new Set(entries.map((entry) => canonicalName(entry.name))),
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        exists: false,
        usedNames: new Set(),
      };
    }

    throw error;
  }
}

function getAvailableFileName(fileName, usedNames) {
  if (!usedNames.has(canonicalName(fileName))) {
    return { fileName, conflict: false };
  }

  const parsed = path.parse(fileName);
  for (let index = 1; index < 10000; index += 1) {
    const candidate = `${parsed.name}__conflict-${index}${parsed.ext}`;
    if (!usedNames.has(canonicalName(candidate))) {
      return { fileName: candidate, conflict: true };
    }
  }

  throw new Error(`Could not find a safe filename for ${fileName}.`);
}

function detectSku(fileName) {
  const rawBaseName = path.basename(fileName, path.extname(fileName));
  const normalizedBaseName = normalizeBaseName(rawBaseName);
  const withoutImageSuffix = stripImageSuffixes(normalizedBaseName);

  // First try the cleaned name. If that fails, try the original normalized name.
  const strongCandidate =
    extractStrongSku(withoutImageSuffix) || extractStrongSku(normalizedBaseName);
  if (strongCandidate) {
    return sanitizePathSegment(strongCandidate.toUpperCase());
  }

  // Last resort: keep a stable cleaned name only if it contains a digit.
  const fallback = fallbackSku(withoutImageSuffix);
  return fallback ? sanitizePathSegment(fallback.toUpperCase()) : null;
}

function normalizeBaseName(baseName) {
  return baseName
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[()[\]{}]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
}

function stripImageSuffixes(baseName) {
  let value = baseName;

  // Remove gallery/view suffixes while preserving SKU parts like FQ0908-002.
  for (let index = 0; index < 5; index += 1) {
    const before = value;

    value = value
      .replace(new RegExp(`[-_\\s]+(?:${IMAGE_SUFFIX_PATTERN})\\d*$`, 'i'), '')
      .replace(/[_\s]+\d{1,2}$/i, '')
      .replace(/-\d{1,2}$/i, '')
      .replace(/[-_\s]+(?:copy|kopija)\d*$/i, '')
      .replace(/^[-_.]+|[-_.]+$/g, '');

    if (value === before) {
      break;
    }
  }

  return value;
}

function extractStrongSku(value) {
  const normalized = value.toUpperCase();
  const candidates = [];

  collectMatches(candidates, normalized, /[A-Z]{1,6}\d[A-Z0-9]*(?:-[A-Z0-9]{2,8})*/g, 20);
  collectMatches(candidates, normalized, /\d{5,}/g, 10);

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.index - a.index;
  });

  return candidates[0].value;
}

function collectMatches(candidates, value, pattern, baseScore) {
  let match;
  while ((match = pattern.exec(value)) !== null) {
    const candidate = sanitizePathSegment(match[0]);
    if (!candidate || !/\d/.test(candidate) || candidate.length < 4) {
      continue;
    }

    candidates.push({
      value: candidate,
      index: match.index,
      score: baseScore + candidate.length + (candidate.includes('-') ? 5 : 0),
    });
  }
}

function fallbackSku(value) {
  const clean = sanitizePathSegment(value);
  if (!clean || !/\d/.test(clean) || clean.length < 4) {
    return null;
  }

  return clean;
}

function sanitizePathSegment(value) {
  return value
    .normalize('NFKC')
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 128);
}

function buildReport(items, groups, moves) {
  const productFolders = [...groups.keys()].filter((folderName) => folderName !== UNRECOGNIZED_FOLDER);
  const unrecognizedCount = items.filter((item) => item.folderName === UNRECOGNIZED_FOLDER).length;
  const conflicts = moves.filter((move) => move.conflict);
  const multiImageProducts = productFolders.filter((folderName) => groups.get(folderName).length > 1);
  const productFoldersToCreate = new Set(
    moves
      .filter((move) => move.folderName !== UNRECOGNIZED_FOLDER && !move.destinationDirExists)
      .map((move) => move.folderName)
  );

  return {
    processedCount: items.length,
    detectedProductCount: productFolders.length,
    productFoldersToCreateCount: productFoldersToCreate.size,
    unrecognizedCount,
    conflictCount: conflicts.length,
    conflicts,
    multiImageProductCount: multiImageProducts.length,
  };
}

function printMovePlan(options, groups, moves, report) {
  const mode = options.dryRun ? 'DRY RUN' : 'APPLY';

  console.log(`Mode: ${mode}`);
  console.log(`Folder: ${TARGET_DIR}`);
  console.log(
    'SKU rule: remove image suffixes like _1, _2, -front, then use the strongest SKU-looking token.'
  );

  if (moves.length === 0) {
    console.log('\nNo image files found directly inside this folder.');
    printReport(options, report);
    return;
  }

  for (const folderName of [...groups.keys()].sort()) {
    const groupMoves = moves.filter((move) => move.folderName === folderName);
    const label = folderName === UNRECOGNIZED_FOLDER ? '_unrecognized' : `SKU ${folderName}`;

    console.log(`\n${label} (${groupMoves.length} image${groupMoves.length === 1 ? '' : 's'}):`);
    for (const move of groupMoves) {
      const conflictNote = move.conflict
        ? ` (renamed to avoid conflict with ${toLogPath(move.requestedDestinationRelative)})`
        : '';
      console.log(
        `  ${options.dryRun ? 'would move' : 'move'} ${move.sourceRelative} -> ${toLogPath(
          move.destinationRelative
        )}${conflictNote}`
      );
    }
  }

  printReport(options, report);
}

function printReport(options, report) {
  const createdLabel = options.dryRun ? 'Product folders that would be created' : 'Product folders created';

  console.log('\nReport:');
  console.log(`  Image files processed: ${report.processedCount}`);
  console.log(`  Products detected: ${report.detectedProductCount}`);
  console.log(`  ${createdLabel}: ${report.productFoldersToCreateCount}`);
  console.log(`  Images moved into _unrecognized: ${report.unrecognizedCount}`);
  console.log(`  Products with multiple images: ${report.multiImageProductCount}`);
  console.log(`  Filename conflicts requiring safe rename: ${report.conflictCount}`);

  if (report.conflicts.length > 0) {
    console.log('\nConflicts:');
    for (const conflict of report.conflicts) {
      console.log(
        `  ${conflict.sourceRelative}: ${toLogPath(
          conflict.requestedDestinationRelative
        )} already exists, using ${toLogPath(conflict.destinationRelative)}`
      );
    }
  }
}

async function writeManifest(status, moves, existingManifestPath) {
  const manifestDir = path.join(TARGET_DIR, MANIFEST_FOLDER);
  await fs.mkdir(manifestDir, { recursive: true });

  const manifestPath =
    existingManifestPath ||
    path.join(manifestDir, `organize-images-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

  const manifest = {
    version: 1,
    status,
    createdAt: new Date().toISOString(),
    targetDir: TARGET_DIR,
    moves: moves.map((move) => ({
      sku: move.sku,
      sourceRelative: move.sourceRelative,
      destinationRelative: toLogPath(move.destinationRelative),
      requestedDestinationRelative: toLogPath(move.requestedDestinationRelative),
      destinationDirExists: move.destinationDirExists,
      conflict: move.conflict,
    })),
  };

  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifestPath;
}

async function undoFromManifest(options) {
  const manifestPath = resolveInsideTarget(options.undoManifest);
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

  if (!Array.isArray(manifest.moves)) {
    throw new Error('Manifest does not contain a moves array.');
  }

  const undoMoves = [];
  const rootState = await readExistingNames(TARGET_DIR);
  const usedOriginalNames = new Set(rootState.usedNames);

  for (const move of manifest.moves.slice().reverse()) {
    const currentAbs = resolveInsideTarget(move.destinationRelative);
    const originalAbs = resolveInsideTarget(move.sourceRelative);
    const originalDir = path.dirname(originalAbs);
    const safeOriginal = getAvailableUndoPath(originalAbs, usedOriginalNames);

    usedOriginalNames.add(canonicalName(path.basename(safeOriginal)));

    undoMoves.push({
      currentAbs,
      originalAbs: safeOriginal,
      originalDir,
      currentRelative: toLogPath(move.destinationRelative),
      originalRelative: toRelativeLog(safeOriginal),
      conflict: safeOriginal !== originalAbs,
    });
  }

  console.log(`Mode: ${options.dryRun ? 'DRY RUN UNDO' : 'APPLY UNDO'}`);
  console.log(`Manifest: ${toRelativeLog(manifestPath)}`);

  let undoableCount = 0;
  for (const move of undoMoves) {
    const exists = await pathExists(move.currentAbs);
    if (!exists) {
      console.log(`  skip missing ${move.currentRelative}`);
      continue;
    }

    undoableCount += 1;
    const conflictNote = move.conflict ? ' (renamed to avoid overwriting an existing root file)' : '';
    console.log(`  ${options.dryRun ? 'would move' : 'move'} ${move.currentRelative} -> ${move.originalRelative}${conflictNote}`);

    if (!options.dryRun) {
      await fs.mkdir(move.originalDir, { recursive: true });
      await fs.rename(move.currentAbs, move.originalAbs);
    }
  }

  console.log('\nUndo report:');
  console.log(`  Manifest entries: ${manifest.moves.length}`);
  console.log(`  Files ${options.dryRun ? 'that can be moved back' : 'moved back'}: ${undoableCount}`);

  if (options.dryRun) {
    console.log('\nDry run only. Add --apply to perform this undo.');
  }
}

function getAvailableUndoPath(originalAbs, usedOriginalNames) {
  const originalName = path.basename(originalAbs);
  const usedNames = new Set(usedOriginalNames);

  return path.join(path.dirname(originalAbs), getAvailableFileName(originalName, usedNames).fileName);
}

function resolveInsideTarget(inputPath) {
  const resolved = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(TARGET_DIR, inputPath);

  const relative = path.relative(TARGET_DIR, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Path must stay inside ${TARGET_DIR}: ${inputPath}`);
  }

  return resolved;
}

function groupBy(items, getKey) {
  const groups = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(item);
  }
  return groups;
}

function isImageFile(fileName) {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function canonicalName(fileName) {
  return fileName.toLowerCase();
}

async function pathExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

function toRelativeLog(absPath) {
  return toLogPath(path.relative(TARGET_DIR, absPath));
}

function toLogPath(value) {
  return value.split(path.sep).join('/');
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
