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
  // This allows the compiled main.js to load the compiled shared code
  const Module = require('module');
  const originalResolveFilename = Module._resolveFilename;
  const fs = require('fs') as typeof import('fs');
  
  Module._resolveFilename = function(request: string, parent: typeof Module, isMain: boolean, options: typeof Module._resolveFilename extends (request: string, parent: typeof Module, isMain: boolean, options?: any) => any ? any : never) {
    // If requesting @sheetpilot/shared, redirect to compiled output
    if (request.startsWith('@sheetpilot/shared')) {
      const subpath = request.replace('@sheetpilot/shared', '') || '/index';
      // Remove leading slash if present
      const cleanSubpath = subpath.startsWith('/') ? subpath.slice(1) : subpath;
      // Resolve to compiled output directory
      const compiledDir = pathModule.resolve(
        params.backendDirname,
        '..', '..', '..', '..', 'build', 'dist', 'shared'
      );
      // Try with .js extension first
      let compiledPath = pathModule.join(compiledDir, cleanSubpath + '.js');
      if (fs.existsSync(compiledPath)) {
        return compiledPath;
      }
      // Try as directory with index.js
      compiledPath = pathModule.join(compiledDir, cleanSubpath, 'index.js');
      if (fs.existsSync(compiledPath)) {
        return compiledPath;
      }
    }
    
    // Try original resolution first
    let resolvedPath: string;
    try {
      resolvedPath = originalResolveFilename.call(this, request, parent, isMain, options);
    } catch (err: unknown) {
      // If resolution fails and it's @sheetpilot/shared, the compiled file might not exist
      // In that case, we need to ensure the shared code is compiled
      if (request.startsWith('@sheetpilot/shared')) {
        const subpath = request.replace('@sheetpilot/shared', '') || '/index';
        const cleanSubpath = subpath.startsWith('/') ? subpath.slice(1) : subpath;
        const compiledDir = pathModule.resolve(
          params.backendDirname,
          '..', '..', '..', '..', 'build', 'dist', 'shared'
        );
        const compiledPath = pathModule.join(compiledDir, cleanSubpath + '.js');
        // If compiled file doesn't exist, we need to compile it or use source with a loader
        // For now, try to use the source file directly (will require TypeScript execution)
        const sourceDir = pathModule.resolve(
          params.backendDirname,
          '..', '..', '..', '..', 'app', 'shared'
        );
        const sourcePath = pathModule.join(sourceDir, cleanSubpath + '.ts');
        if (fs.existsSync(sourcePath)) {
          // Use source file - this will fail unless there's a TypeScript loader
          // But it's better than nothing for now
          return sourcePath;
        }
      }
      throw err;
    }
    
    // If resolved path is a .ts file in app/shared, redirect to compiled output
    // Use normalized paths for cross-platform compatibility
    const normalizedResolvedPath = pathModule.normalize(resolvedPath);
    const sharedSourceDir = pathModule.normalize(
      pathModule.resolve(params.backendDirname, '..', '..', '..', '..', 'app', 'shared')
    );
    if (normalizedResolvedPath.startsWith(sharedSourceDir) && normalizedResolvedPath.endsWith('.ts')) {
      const relativePath = pathModule.relative(sharedSourceDir, normalizedResolvedPath);
      const compiledPath = pathModule.resolve(
        params.backendDirname,
        '..', '..', '..', '..', 'build', 'dist', 'shared',
        relativePath.replace(/\.ts$/, '.js')
      );
      if (fs.existsSync(compiledPath)) {
        return compiledPath;
      }
      // If compiled file doesn't exist, log a warning but still return the resolved path
      // This will cause an error, but it's better than silently failing
      console.warn(`[Module Resolution] Compiled file not found for ${request}, expected at ${compiledPath}`);
    }
    
    return resolvedPath;
  };
}


