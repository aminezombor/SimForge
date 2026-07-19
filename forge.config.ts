import path from 'node:path';
import type { ForgeConfig } from '@electron-forge/shared-types';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { flipFuses, FuseV1Options, FuseVersion } from '@electron/fuses';

function electronExecutable(buildPath: string, platform: string): string {
  const packageRoot = path.resolve(buildPath, '..', '..');
  if (platform === 'win32') return path.join(packageRoot, 'electron.exe');
  if (platform === 'darwin' || platform === 'mas') {
    return path.join(packageRoot, 'Electron.app', 'Contents', 'MacOS', 'Electron');
  }
  return path.join(packageRoot, 'electron');
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: 'SimForge',
    extraResource: [
      'sidecars',
      'blender-extension',
      'sample-data',
      '.tools/usd-runtime',
      'THIRD_PARTY_NOTICES.md',
      'LICENSE',
    ],
  },
  rebuildConfig: {},
  makers: [],
  hooks: {
    packageAfterCopy: async (_forgeConfig, buildPath, _electronVersion, platform) => {
      await flipFuses(electronExecutable(buildPath, platform), {
        version: FuseVersion.V1,
        strictlyRequireAllFuses: true,
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableCookieEncryption]: true,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
        [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
        [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
        [FuseV1Options.WasmTrapHandlers]: true,
      });
    },
  },
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
  ],
};

export default config;
