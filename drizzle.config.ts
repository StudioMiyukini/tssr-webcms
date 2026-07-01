import { defineConfig } from 'drizzle-kit';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: path.resolve(__dirname, 'cms.sqlite'),
  },
  verbose: true,
  strict: true,
});
