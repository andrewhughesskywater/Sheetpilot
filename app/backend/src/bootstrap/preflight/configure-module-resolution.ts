import * as pathModule from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export function configureBackendNodeModuleResolution(params: {
  packagedLike: boolean;
  isSmoke: boolean;
  backendDirname: string;
}): void {
  // Add backend node_modules to module resolution path (dev and packaged-like)
  // Keep logic aligned with previous behavior in backend/src/main.ts
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
}


