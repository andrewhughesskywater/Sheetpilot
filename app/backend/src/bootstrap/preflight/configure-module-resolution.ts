export function configureBackendNodeModuleResolution(params: {
  packagedLike: boolean;
  isSmoke: boolean;
  backendDirname: string;
}): void {
  // Add backend node_modules to module resolution path (dev and packaged-like)
  // Keep logic aligned with previous behavior in backend/src/main.ts
  const pathModule = require('path') as typeof import('path');
  const modulePaths: string[] = [];

  if (params.packagedLike && !params.isSmoke) {
    // Packaged paths (ASAR and ASAR unpacked)
    modulePaths.push(
      pathModule.join(process.resourcesPath, 'app.asar', 'app', 'backend', 'node_modules'),
      pathModule.join(process.resourcesPath, 'app.asar.unpacked', 'app', 'backend', 'node_modules')
    );
  } else {
    // Development or smoke path: use project node_modules directly
    modulePaths.push(
      pathModule.resolve(params.backendDirname, '..', '..', '..', '..', 'app', 'backend', 'node_modules')
    );
  }

  const currentPath = process.env['NODE_PATH'] || '';
  const combined = [...modulePaths, currentPath].filter(Boolean).join(pathModule.delimiter);
  process.env['NODE_PATH'] = combined;
  require('module').Module._initPaths();

  // Override module resolution for @sheetpilot/shared to use compiled output
  const Module = require('module');
  type ResolveFilenameOptions = { paths?: string[] };
  type ResolveFilename = (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: ResolveFilenameOptions
  ) => string;
  const originalResolveFilename = Module._resolveFilename as unknown as ResolveFilename;
  const fs = require('fs') as typeof import('fs');

  /**
   * Resolves compiled directory path
   */
  function getCompiledDir(subdir: 'backend' | 'shared'): string {
    const parts =
      subdir === 'backend'
        ? ['build', 'dist', 'backend', 'src']
        : ['build', 'dist', 'shared'];
    return pathModule.resolve(params.backendDirname, '..', '..', '..', '..', ...parts);
  }

  /**
   * Resolves @/ alias to compiled path
   */
  function resolveAtPathAlias(subpath: string): string | null {
    const compiledDir = getCompiledDir('backend');
    let targetPath: string;

    if (subpath === 'bootstrap') {
      targetPath = pathModule.join(compiledDir, 'bootstrap', 'index.js');
    } else if (subpath === 'ipc') {
      targetPath = pathModule.join(compiledDir, 'ipc', 'index.js');
    } else if (subpath === 'repositories') {
      targetPath = pathModule.join(compiledDir, 'repositories', 'index.js');
    } else if (subpath === 'middleware') {
      targetPath = pathModule.join(compiledDir, 'middleware', 'index.js');
    } else if (subpath === 'preload') {
      targetPath = pathModule.join(compiledDir, 'preload', 'index.js');
    } else {
      targetPath = pathModule.join(compiledDir, `${subpath}.js`);
    }

    if (fs.existsSync(targetPath)) {
      return targetPath;
    }

    const indexPath = pathModule.join(compiledDir, subpath, 'index.js');
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }

    return null;
  }

  /**
   * Resolves @sheetpilot/shared alias to compiled path
   */
  function resolveSheetpilotAlias(request: string): string | null {
    const subpath = request.replace('@sheetpilot/shared', '') || '/index';
    const cleanSubpath = subpath.startsWith('/') ? subpath.slice(1) : subpath;
    const compiledDir = getCompiledDir('shared');

    let compiledPath = pathModule.join(compiledDir, `${cleanSubpath}.js`);
    if (fs.existsSync(compiledPath)) {
      return compiledPath;
    }

    compiledPath = pathModule.join(compiledDir, cleanSubpath, 'index.js');
    if (fs.existsSync(compiledPath)) {
      return compiledPath;
    }

    return null;
  }

  /**
   * Handles fallback resolution for @/ alias after original resolution fails
   */
  function handleAtPathFallback(subpath: string): string | null {
    const resolved = resolveAtPathAlias(subpath);
    if (!resolved) {
      const compiledDir = getCompiledDir('backend');
      console.warn(
        `[Module Resolution] Compiled file not found for @/${subpath}, checked at ${compiledDir}`
      );
    }
    return resolved;
  }

  /**
   * Handles fallback for @sheetpilot/shared after original resolution fails
   */
  function handleSheetpilotFallback(request: string): string | null {
    const subpath = request.replace('@sheetpilot/shared', '') || '/index';
    const cleanSubpath = subpath.startsWith('/') ? subpath.slice(1) : subpath;
    const sourceDir = pathModule.resolve(params.backendDirname, '..', '..', '..', '..', 'app', 'shared');
    const sourcePath = pathModule.join(sourceDir, `${cleanSubpath}.ts`);

    if (fs.existsSync(sourcePath)) {
      return sourcePath;
    }
    return null;
  }

  /**
   * Redirects backend source .ts files to compiled output
   */
  function redirectBackendSource(resolvedPath: string): string | null {
    const normalizedPath = pathModule.normalize(resolvedPath);
    const backendSourceDir = pathModule.normalize(
      pathModule.resolve(params.backendDirname, '..', '..', '..', '..', 'app', 'backend', 'src')
    );

    if (!normalizedPath.startsWith(backendSourceDir) || !normalizedPath.endsWith('.ts')) {
      return null;
    }

    const relativePath = pathModule.relative(backendSourceDir, normalizedPath);
    const compiledPath = pathModule.resolve(
      getCompiledDir('backend'),
      relativePath.replace(/\.ts$/, '.js')
    );

    if (fs.existsSync(compiledPath)) {
      return compiledPath;
    }

    console.warn(`[Module Resolution] Compiled file not found for backend source, expected at ${compiledPath}`);
    return null;
  }

  /**
   * Redirects shared source .ts files to compiled output
   */
  function redirectSharedSource(resolvedPath: string): string | null {
    const normalizedPath = pathModule.normalize(resolvedPath);
    const sharedSourceDir = pathModule.normalize(
      pathModule.resolve(params.backendDirname, '..', '..', '..', '..', 'app', 'shared')
    );

    if (!normalizedPath.startsWith(sharedSourceDir) || !normalizedPath.endsWith('.ts')) {
      return null;
    }

    const relativePath = pathModule.relative(sharedSourceDir, normalizedPath);
    const compiledPath = pathModule.resolve(
      getCompiledDir('shared'),
      relativePath.replace(/\.ts$/, '.js')
    );

    if (fs.existsSync(compiledPath)) {
      return compiledPath;
    }

    console.warn(`[Module Resolution] Compiled file not found for shared source, expected at ${compiledPath}`);
    return null;
  }

  Module._resolveFilename = function (
    request: string,
    parent: unknown,
    isMain: boolean,
    options?: ResolveFilenameOptions
  ): string {
    // Handle @/ aliases
    if (request.startsWith('@/')) {
      const subpath = request.replace('@/', '');
      const resolved = resolveAtPathAlias(subpath);
      if (resolved) {
        return resolved;
      }
    }

    // Handle @sheetpilot/shared aliases
    if (request.startsWith('@sheetpilot/shared')) {
      const resolved = resolveSheetpilotAlias(request);
      if (resolved) {
        return resolved;
      }
    }

    // Try original resolution
    let resolvedPath: string;
    try {
      resolvedPath = originalResolveFilename.call(this, request, parent, isMain, options);
    } catch (err: unknown) {
      // Fallback for @/ aliases
      if (request.startsWith('@/')) {
        const subpath = request.replace('@/', '');
        const fallback = handleAtPathFallback(subpath);
        if (fallback) {
          return fallback;
        }
      }

      // Fallback for @sheetpilot/shared
      if (request.startsWith('@sheetpilot/shared')) {
        const fallback = handleSheetpilotFallback(request);
        if (fallback) {
          return fallback;
        }
      }

      throw err;
    }

    // Redirect backend source files
    const backendRedirect = redirectBackendSource(resolvedPath);
    if (backendRedirect) {
      return backendRedirect;
    }

    // Redirect shared source files
    const sharedRedirect = redirectSharedSource(resolvedPath);
    if (sharedRedirect) {
      return sharedRedirect;
    }

    return resolvedPath;
  };
}
