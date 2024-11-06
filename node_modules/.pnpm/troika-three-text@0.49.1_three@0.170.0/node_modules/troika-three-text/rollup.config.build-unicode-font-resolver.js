import nodeResolve from 'rollup-plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import { version } from '@unicode-font-resolver/client/package.json'
import buble from "rollup-plugin-buble";


const {LERNA_ROOT_PATH} = process.env
if (!LERNA_ROOT_PATH) {
  throw new Error("Please execute `npm run build-unicode-font-resolver` from the repository root.")
}


const OUTPUT_TEMPLATE = `
/*!
Custom bundle of @unicode-font-resolver/client v${version} (https://github.com/lojjic/unicode-font-resolver)
for use in Troika text rendering. 
Original MIT license applies
*/

export default function() {
  $$CONTENT$$

  return client
}
`

const [banner, footer] = OUTPUT_TEMPLATE.split('$$CONTENT$$')


export default {
  input: LERNA_ROOT_PATH + '/node_modules/@unicode-font-resolver/client/dist/client.esm.js',
  // input: LERNA_ROOT_PATH + '/../unicode-font-resolver/packages/client/dist/client.esm.js',
  plugins: [
    nodeResolve(),
    buble({
      transforms: {
        unicodeRegExp: false
      }
    }),
    terser({
      ecma: 5
    })
  ],
  output: {
    format: 'iife',
    name: 'client',
    file: 'libs/unicode-font-resolver-client.factory.js',
    banner,
    footer
  }
}
