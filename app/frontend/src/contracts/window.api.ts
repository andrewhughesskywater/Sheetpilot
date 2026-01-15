/**
 * @fileoverview Window API - General utilities
 */

export {};

declare global {
  interface Window {
    /**
     * General API utilities
     */
    api?: {
      /** Test IPC communication */
      ping: (msg: string) => Promise<string>;
    };
  }
}
