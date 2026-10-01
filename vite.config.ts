import { defineConfig } from 'vite';
import { resolve } from 'path';

const avatarSrc = resolve(__dirname, 'packages/agent-avatar-2d/src/index.ts');
const avatarStepSrc = resolve(__dirname, 'components/avatar-step/src/index.ts');
const catalogSrc = resolve(__dirname, 'components/agent-catalog/src/index.ts');
const profilePanelSrc = resolve(__dirname, 'components/agent-profile-panel/src/index.ts');

export default defineConfig({
  resolve: {
    alias: [
      { find: '@casehubio/agent-avatar-2d', replacement: avatarSrc },
      { find: '@casehubio/avatar-step', replacement: avatarStepSrc },
      { find: '@casehubio/agent-catalog', replacement: catalogSrc },
      { find: '@casehubio/blocks-ui-agent-profile-panel', replacement: profilePanelSrc },
    ],
    dedupe: ['@casehubio/agent-avatar-2d', 'lit', '@lit/reactive-element'],
  },
  optimizeDeps: {
    exclude: ['@casehubio/agent-avatar-2d', '@casehubio/avatar-step', '@casehubio/agent-catalog', '@casehubio/blocks-ui-agent-profile-panel'],
  },
  esbuild: {
    target: 'es2022',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
});
