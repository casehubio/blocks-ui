import { defineConfig } from 'vite';
import { resolve } from 'path';

const projectRoot = resolve(__dirname, '..');

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '@casehubio/agent-avatar-2d': resolve(projectRoot, 'packages/agent-avatar-2d/src/index.ts'),
      '@casehubio/avatar-step': resolve(projectRoot, 'components/avatar-step/src/index.ts'),
      '@casehubio/blocks-ui-core': resolve(projectRoot, 'packages/blocks-ui-core/src/index.ts'),
      '@casehubio/blocks-ui-agent-profile-panel': resolve(projectRoot, 'components/agent-profile-panel/src/index.ts'),
      '@casehubio/agent-catalog': resolve(projectRoot, 'components/agent-catalog/src/index.ts'),
    },
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
  server: {
    port: 5199,
  },
});
