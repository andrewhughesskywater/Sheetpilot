import type { RendererLoadParams } from './load-renderer.types';

export async function loadRendererDev(params: RendererLoadParams): Promise<void> {
  params.logger.verbose('Loading development URL with splash', { url: 'http://localhost:5173#splash' });
  await params.window.loadURL('http://localhost:5173#splash');
}
