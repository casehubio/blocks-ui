import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npx vite --port 3000",
    port: 3000,
    reuseExistingServer: true,
    cwd: __dirname,
  },
});
