import type { App } from 'electron';

export interface RuntimeFlags {
  isSmoke: boolean;
  packagedLike: boolean;
  isDev: boolean;
}

export function getRuntimeFlags(app: App): RuntimeFlags {
  const isSmoke = process.env['SMOKE_PACKAGED'] === '1';
  const packagedLike = app.isPackaged || isSmoke;
  const isDev = process.env['NODE_ENV'] === 'development' || process.env['ELECTRON_IS_DEV'] === '1';
  return { isSmoke, packagedLike, isDev };
}
