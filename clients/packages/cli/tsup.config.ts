import { defineConfig } from 'tsup'

export default defineConfig({
  noExternal: ['@polar-sh/cli-commands'],
})
