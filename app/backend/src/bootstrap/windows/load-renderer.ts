import { loadRendererDev } from './load-renderer-dev';
import { loadRendererProd } from './load-renderer-prod';
import type { RendererLoadParams } from './load-renderer.types';

export async function loadRenderer(params: RendererLoadParams): Promise<void> {
  if (params.isDev) {
    await loadRendererDev(params);
    return;
  }

  await loadRendererProd(params);
}


