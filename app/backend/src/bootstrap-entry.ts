/**
 * @fileoverview Bootstrap Entry Point
 *
 * This file must be the entry point to set up module resolution BEFORE any @/ imports are resolved.
 * It configures path alias resolution, then loads the actual main.ts file.
 *
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

// Set up module resolution FIRST, before any @/ imports are resolved
const pathModule = require('path');
const Module = require('module');
const fs = require('fs');

// Calculate paths relative to this file's location
// When compiled, this file is at build/dist/backend/src/bootstrap-entry.js
// So __dirname is build/dist/backend/src
const backendDirname = __dirname;
const buildDistBackendSrc = backendDirname; // Already in the compiled location
const buildDistShared = pathModule.resolve(backendDirname, '..', '..', 'shared');

// Determine if packaged (check if running from ASAR)
const packagedLike =
  process.resourcesPath !== undefined && (__filename.includes('.asar') || process.resourcesPath.includes('.asar'));
const isSmoke = process.env['ELECTRON_IS_SMOKE'] === '1';

// Add backend node_modules to module resolution path
const modulePaths: string[] = [];
if (packagedLike && !isSmoke) {
  modulePaths.push(
    pathModule.join(process.resourcesPath, 'app.asar', 'app', 'backend', 'node_modules'),
    pathModule.join(process.resourcesPath, 'app.asar.unpacked', 'app', 'backend', 'node_modules')
  );
} else {
  // In dev mode, go up from build/dist/backend/src to project root, then to app/backend/node_modules
  modulePaths.push(pathModule.resolve(backendDirname, '..', '..', '..', '..', 'app', 'backend', 'node_modules'));
}

const currentPath = process.env['NODE_PATH'] || '';
const combined = [...modulePaths, currentPath].filter(Boolean).join(pathModule.delimiter);
process.env['NODE_PATH'] = combined;
Module._initPaths();

/**
 * Resolves @/ alias paths to their compiled locations
 */
function resolveAtPathAlias(subpath: string, buildDistBackendSrc: string): string | null {
  // Handle specific aliases that map to index files
  let targetPath: string;
  if (subpath === 'bootstrap') {
    targetPath = pathModule.join(buildDistBackendSrc, 'bootstrap', 'index.js');
  } else if (subpath === 'ipc') {
    targetPath = pathModule.join(buildDistBackendSrc, 'ipc', 'index.js');
  } else if (subpath === 'repositories') {
    targetPath = pathModule.join(buildDistBackendSrc, 'repositories', 'index.js');
  } else if (subpath === 'middleware') {
    targetPath = pathModule.join(buildDistBackendSrc, 'middleware', 'index.js');
  } else if (subpath === 'preload') {
    targetPath = pathModule.join(buildDistBackendSrc, 'preload', 'index.js');
  } else {
    // Handle subpaths like @/bootstrap/env, @/ipc/handlers, etc.
    targetPath = pathModule.join(buildDistBackendSrc, `${subpath}.js`);
  }

  if (fs.existsSync(targetPath)) {
    return targetPath;
  }

  // Try as directory with index.js
  const indexPath = pathModule.join(buildDistBackendSrc, subpath, 'index.js');
  if (fs.existsSync(indexPath)) {
    return indexPath;
  }

  return null;
}

/**
 * Resolves @sheetpilot/shared alias paths
 */
function resolveSheetpilotSharedAlias(request: string, buildDistShared: string): string | null {
  const subpath = request.replace('@sheetpilot/shared', '') || '/index';
  const cleanSubpath = subpath.startsWith('/') ? subpath.slice(1) : subpath;

  // Try with .js extension first
  let compiledPath = pathModule.join(buildDistShared, `${cleanSubpath}.js`);
  if (fs.existsSync(compiledPath)) {
    return compiledPath;
  }

  // Try as directory with index.js
  compiledPath = pathModule.join(buildDistShared, cleanSubpath, 'index.js');
  if (fs.existsSync(compiledPath)) {
    return compiledPath;
  }

  return null;
}

/**
 * Attempts to resolve a @/ import after original resolution failed
 */
function retryAtPathResolution(subpath: string, buildDistBackendSrc: string): string | null {
  const resolvedPath = resolveAtPathAlias(subpath, buildDistBackendSrc);
  if (resolvedPath) {
    return resolvedPath;
  }

  console.warn(
    `[Module Resolution] Compiled file not found for @/${subpath}, checked standard locations`
  );
  return null;
}

/**
 * Checks if a resolved path is from backend source and redirects to compiled
 */
function redirectBackendSourceToCompiled(
  resolvedPath: string,
  backendSourceDir: string,
  buildDistBackendSrc: string
): string | null {
  const normalizedResolved = pathModule.normalize(resolvedPath);
  if (!normalizedResolved.startsWith(backendSourceDir) || !normalizedResolved.endsWith('.ts')) {
    return null;
  }

  const relativePath = pathModule.relative(backendSourceDir, normalizedResolved);
  const compiledPath = pathModule.resolve(buildDistBackendSrc, relativePath.replace(/\.ts$/, '.js'));
  if (fs.existsSync(compiledPath)) {
    return compiledPath;
  }

  console.warn(`[Module Resolution] Compiled file not found for backend source, expected at ${compiledPath}`);
  return null;
}

/**
 * Checks if a resolved path is from shared source and redirects to compiled
 */
function redirectSharedSourceToCompiled(
  resolvedPath: string,
  sharedSourceDir: string,
  buildDistShared: string
): string | null {
  const normalizedResolved = pathModule.normalize(resolvedPath);
  if (!normalizedResolved.startsWith(sharedSourceDir) || !normalizedResolved.endsWith('.ts')) {
    return null;
  }

  const relativePath = pathModule.relative(sharedSourceDir, normalizedResolved);
  const compiledPath = pathModule.resolve(buildDistShared, relativePath.replace(/\.ts$/, '.js'));
  if (fs.existsSync(compiledPath)) {
    return compiledPath;
  }

  console.warn(`[Module Resolution] Compiled file not found for shared source, expected at ${compiledPath}`);
  return null;
}

// Override module resolution for @/ and @sheetpilot/shared aliases
type ResolveFilenameOptions = { paths?: string[] };
type ResolveFilename = (request: string, parent: unknown, isMain: boolean, options?: ResolveFilenameOptions) => string;
const originalResolveFilename = Module._resolveFilename as unknown as ResolveFilename;

Module._resolveFilename = function (
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: ResolveFilenameOptions
): string {
  // Handle @/ aliases
  if (request.startsWith('@/')) {
    const subpath = request.replace('@/', '');
    const resolved = resolveAtPathAlias(subpath, buildDistBackendSrc);
    if (resolved) {
      return resolved;
    }
  }

  // Handle @sheetpilot/shared aliases
  if (request.startsWith('@sheetpilot/shared')) {
    const resolved = resolveSheetpilotSharedAlias(request, buildDistShared);
    if (resolved) {
      return resolved;
    }
  }

  // Try original resolution
  let resolvedPath: string;
  try {
    resolvedPath = originalResolveFilename.call(this, request, parent, isMain, options);
  } catch (err: unknown) {
    // If resolution fails and it's a @/ alias, try fallback
    if (request.startsWith('@/')) {
      const subpath = request.replace('@/', '');
      const fallback = retryAtPathResolution(subpath, buildDistBackendSrc);
      if (fallback) {
        return fallback;
      }
    }
    throw err;
  }

  // Redirect backend source .ts files to compiled output
  const backendSourceDir = pathModule.normalize(
    pathModule.resolve(backendDirname, '..', '..', '..', '..', 'app', 'backend', 'src')
  );
  const backendCompiled = redirectBackendSourceToCompiled(resolvedPath, backendSourceDir, buildDistBackendSrc);
  if (backendCompiled) {
    return backendCompiled;
  }

  // Redirect shared source .ts files to compiled output
  const sharedSourceDir = pathModule.normalize(
    pathModule.resolve(backendDirname, '..', '..', '..', '..', 'app', 'shared')
  );
  const sharedCompiled = redirectSharedSourceToCompiled(resolvedPath, sharedSourceDir, buildDistShared);
  if (sharedCompiled) {
    return sharedCompiled;
  }

  return resolvedPath;
};

// Now that module resolution is set up, require the actual main.ts
require('./main');
