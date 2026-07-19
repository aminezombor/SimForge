import type { SimForgeDesktopApi } from '../shared/desktop-api';

declare global {
  interface Window {
    simforge?: SimForgeDesktopApi;
  }
}

export {};
