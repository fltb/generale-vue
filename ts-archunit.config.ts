import { defineConfig } from '@nielspeter/ts-archunit'

export default defineConfig({
  rules: ['arch.rules.ts'],
  baseline: 'arch-baseline.json',
  format: 'auto',
})
