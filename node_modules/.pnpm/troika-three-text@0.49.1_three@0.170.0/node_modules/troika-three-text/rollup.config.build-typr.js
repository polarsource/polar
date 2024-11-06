// This build file creates a static version of the Typr.ts library used for
// processing fonts. It's isolated within a "factory" function wrapper so it can
// easily be marshalled into a web worker.


import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'


const {LERNA_ROOT_PATH} = process.env
if (!LERNA_ROOT_PATH) {
  throw new Error("Please execute `npm run build-typr` from the repository root.")
}


const OUTPUT_TEMPLATE = `
/*!
Custom build of Typr.ts (https://github.com/fredli74/Typr.ts) for use in Troika text rendering.
Original MIT license applies: https://github.com/fredli74/Typr.ts/blob/master/LICENSE
*/

export default function() {
  // Trick it into being able to run in a web worker
  if (typeof window === 'undefined') {
    self.window = self
  }

  $$CONTENT$$

  return TyprExports.Typr
}
`

const [banner, footer] = OUTPUT_TEMPLATE.split('$$CONTENT$$')


export default {
  input: LERNA_ROOT_PATH + '/node_modules/@lojjic/typr/dist/Typr.js',
  plugins: [
    nodeResolve(),
    commonjs(),
    {
      name: 'custom',
      transform(source, id) {
        // Quiet the console.warn statements added in the Typr.ts fork
        source = source.replace(/console\.warn/g, 'console.debug')

        // Replace some unneeded property assignments with unused stub vars so they get pruned out
        // SVG fonts are unsupported by browsers anyway
        removeMethodAssignment('Typr.SVG')
        removeMethodAssignment('Typr.SVG.parse')
        removeMethodAssignment('Typr.SVG.toPath')
        removeMethodAssignment('Typr.SVG._toPath')
        removeMethodAssignment('Typr.SVG._tokens')
        removeMethodAssignment('Typr.SVG._toksToPath')
        removeMethodAssignment('Typr.SVG._reps')
        removeMethodAssignment('Typr.U.pathToSVG')
        removeMethodAssignment('Typr.U.pathToContext')

        // We provide our own implementation for stringToGlyphs that fixes joining-type shaping
        // and improves performance, so don't need the original
        removeMethodAssignment('Typr.U.stringToGlyphs')
        removeMethodAssignment('Typr.U._getWPfeature')
        // Same for position adjustments to support mark anchoring
        removeMethodAssignment('Typr.U.getPairAdjustment')

        return source

        function removeMethodAssignment(name) {
          const re = new RegExp(`(${name}\\s*=)`)
          source = source.replace(re, `var prunable${Math.round(Math.random()*1e12)}=`)
        }
      }
    },
    terser({
      ecma: 5
    })
  ],
  output: {
    format: 'iife',
    exports: 'named',
    name: 'TyprExports',
    file: 'libs/typr.factory.js',
    banner,
    footer
  }
}
