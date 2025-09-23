import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/AccountBalance.tsx'],
  format: ['cjs', 'esm'],
  dts: true,
  minify: true,
  external: ['react', 'react-dom', '@mui/icons-material', 'lucide-react', '@heroicons/react'],
})