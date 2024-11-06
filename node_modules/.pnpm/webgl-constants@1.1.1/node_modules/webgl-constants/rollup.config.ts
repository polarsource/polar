// Vendor
import commonjsPlugin from 'rollup-plugin-commonjs';
import filesizePlugin from 'rollup-plugin-filesize';
import resolvePlugin from 'rollup-plugin-node-resolve';
import { terser as terserPlugin } from 'rollup-plugin-terser';
import typescriptPlugin from 'rollup-plugin-typescript2';

// Package
// @ts-ignore: JSON is imported without any issue, TSLint still raises issues
import pkg from './package.json';

const input = './src/index.ts';
const name = 'WebGLConstants';

const plugins = ({ isUMD = false, isCJS = false, isES = false }) => [
  resolvePlugin(),
  (isUMD || isCJS) && commonjsPlugin(),
  typescriptPlugin({
    typescript: require('typescript'),
    useTsconfigDeclarationDir: true,
  }),
  !isES && !process.env.ROLLUP_WATCH && terserPlugin(),
  !isES && !process.env.ROLLUP_WATCH && filesizePlugin(),
];

export default [
  {
    input,
    output: [
      {
        exports: 'named',
        file: pkg.browser,
        format: 'umd',
        name,
      },
    ],
    plugins: plugins({ isUMD: true }),
    watch: {
      include: 'src/**',
    },
  },
  {
    input,
    output: [
      {
        exports: 'named',
        file: pkg.main,
        format: 'cjs',
      },
    ],
    plugins: plugins({ isCJS: true }),
    watch: {
      include: 'src/**',
    },
  },
  {
    input,
    output: [
      {
        file: pkg.module,
        format: 'es',
        name,
      },
    ],
    plugins: plugins({ isES: true }),
    watch: {
      include: 'src/**',
    },
  },
];
