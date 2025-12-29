import { defineConfig } from 'eslint/config';

import { baseConfig } from '@blaaah/eslint-config/base';

export default defineConfig(
  {
    ignores: ['dist/**'],
  },
  baseConfig
);
