import { Color, Texture, LinearFilter } from 'three'
import { defineWorkerModule } from 'troika-worker-utils'
import { fontResolverWorkerModule } from "./FontResolver.js";
import { createTypesetter } from './Typesetter.js'
import { generateSDF, warmUpSDFCanvas, resizeWebGLCanvasWithoutClearing } from './SDFGenerator.js'
import bidiFactory from 'bidi-js'


const CONFIG = {
  defaultFontURL: null,
  unicodeFontsURL: null,
  sdfGlyphSize: 64,
  sdfMargin: 1 / 16,
  sdfExponent: 9,
  textureWidth: 2048,
}
const tempColor = /*#__PURE__*/new Color()
let hasRequested = false

function now() {
  return (self.performance || Date).now()
}

/**
 * Customizes the text builder configuration. This must be called prior to the first font processing
 * request, and applies to all fonts.
 *
 * @param {String} config.defaultFontURL - The URL of the default font to use for text processing
 *                 requests, in case none is specified or the specifiede font fails to load or parse.
 *                 Defaults to "Roboto Regular" from Google Fonts.
 * @param {String} config.unicodeFontsURL - A custom location for the fallback unicode-font-resolver
 *                 data and font files, if you don't want to use the default CDN. See
 *                 https://github.com/lojjic/unicode-font-resolver for details. It can also be
 *                 configured per text instance, but this lets you do it once globally.
 * @param {Number} config.sdfGlyphSize - The default size of each glyph's SDF (signed distance field)
 *                 texture used for rendering. Must be a power-of-two number, and applies to all fonts,
 *                 but note that this can also be overridden per call to `getTextRenderInfo()`.
 *                 Larger sizes can improve the quality of glyph rendering by increasing the sharpness
 *                 of corners and preventing loss of very thin lines, at the expense of memory. Defaults
 *                 to 64 which is generally a good balance of size and quality.
 * @param {Number} config.sdfExponent - The exponent used when encoding the SDF values. A higher exponent
 *                 shifts the encoded 8-bit values to achieve higher precision/accuracy at texels nearer
 *                 the glyph's path, with lower precision further away. Defaults to 9.
 * @param {Number} config.sdfMargin - How much space to reserve in the SDF as margin outside the glyph's
 *                 path, as a percentage of the SDF width. A larger margin increases the quality of
 *                 extruded glyph outlines, but decreases the precision available for the glyph itself.
 *                 Defaults to 1/16th of the glyph size.
 * @param {Number} config.textureWidth - The width of the SDF texture; must be a power of 2. Defaults to
 *                 2048 which is a safe maximum texture dimension according to the stats at
 *                 https://webglstats.com/webgl/parameter/MAX_TEXTURE_SIZE and should allow for a
 *                 reasonably large number of glyphs (default glyph size of 64^2 and safe texture size of
 *                 2048^2, times 4 channels, allows for 4096 glyphs.) This can be increased if you need to
 *                 increase the glyph size and/or have an extraordinary number of glyphs.
 */
function configureTextBuilder(config) {
  if (hasRequested) {
    console.warn('configureTextBuilder called after first font request; will be ignored.')
  } else {
    assign(CONFIG, config)
  }
}

/**
 * Repository for all font SDF atlas textures and their glyph mappings. There is a separate atlas for
 * each sdfGlyphSize. Each atlas has a single Texture that holds all glyphs for all fonts.
 *
 *   {
 *     [sdfGlyphSize]: {
 *       glyphCount: number,
 *       sdfGlyphSize: number,
 *       sdfTexture: Texture,
 *       sdfCanvas: HTMLCanvasElement,
 *       contextLost: boolean,
 *       glyphsByFont: Map<fontURL, Map<glyphID, {path, atlasIndex, sdfViewBox}>>
 *     }
 *   }
 */
const atlases = Object.create(null)

/**
 * @typedef {object} TroikaTextRenderInfo - Format of the result from `getTextRenderInfo`.
 * @property {TypesetParams} parameters - The normalized input arguments to the render call.
 * @property {Texture} sdfTexture - The SDF atlas texture.
 * @property {number} sdfGlyphSize - The size of each glyph's SDF; see `configureTextBuilder`.
 * @property {number} sdfExponent - The exponent used in encoding the SDF's values; see `configureTextBuilder`.
 * @property {Float32Array} glyphBounds - List of [minX, minY, maxX, maxY] quad bounds for each glyph.
 * @property {Float32Array} glyphAtlasIndices - List holding each glyph's index in the SDF atlas.
 * @property {Uint8Array} [glyphColors] - List holding each glyph's [r, g, b] color, if `colorRanges` was supplied.
 * @property {Float32Array} [caretPositions] - A list of caret positions for all characters in the string; each is
 *           four elements: the starting X, the ending X, the bottom Y, and the top Y for the caret.
 * @property {number} [caretHeight] - An appropriate height for all selection carets.
 * @property {number} ascender - The font's ascender metric.
 * @property {number} descender - The font's descender metric.
 * @property {number} capHeight - The font's cap height metric, based on the height of Latin capital letters.
 * @property {number} xHeight - The font's x height metric, based on the height of Latin lowercase letters.
 * @property {number} lineHeight - The final computed lineHeight measurement.
 * @property {number} topBaseline - The y position of the top line's baseline.
 * @property {Array<number>} blockBounds - The total [minX, minY, maxX, maxY] rect of the whole text block;
 *           this can include extra vertical space beyond the visible glyphs due to lineHeight, and is
 *           equivalent to the dimensions of a block-level text element in CSS.
 * @property {Array<number>} visibleBounds - The total [minX, minY, maxX, maxY] rect of the whole text block;
 *           unlike `blockBounds` this is tightly wrapped to the visible glyph paths.
 * @property {Array<object>} chunkedBounds - List of bounding rects for each consecutive set of N glyphs,
 *           in the format `{start:N, end:N, rect:[minX, minY, maxX, maxY]}`.
 * @property {object} timings - Timing info for various parts of the rendering logic including SDF
 *           generation, typesetting, etc.
 * @frozen
 */

/**
 * @callback getTextRenderInfo~callback
 * @param {TroikaTextRenderInfo} textRenderInfo
 */

/**
 * Main entry point for requesting the data needed to render a text string with given font parameters.
 * This is an asynchronous call, performing most of the logic in a web worker thread.
 * @param {TypesetParams} args
 * @param {getTextRenderInfo~callback} callback
 */
function getTextRenderInfo(args, callback) {
  hasRequested = true
  args = assign({}, args)
  const totalStart = now()

  // Convert relative URL to absolute so it can be resolved in the worker, and add fallbacks.
  // In the future we'll allow args.font to be a list with unicode ranges too.
  const { defaultFontURL } = CONFIG
  const fonts = [];
  if (defaultFontURL) {
    fonts.push({label: 'default', src: toAbsoluteURL(defaultFontURL)})
  }
  if (args.font) {
    fonts.push({label: 'user', src: toAbsoluteURL(args.font)})
  }
  args.font = fonts

  // Normalize text to a string
  args.text = '' + args.text

  args.sdfGlyphSize = args.sdfGlyphSize || CONFIG.sdfGlyphSize
  args.unicodeFontsURL = args.unicodeFontsURL || CONFIG.unicodeFontsURL

  // Normalize colors
  if (args.colorRanges != null) {
    let colors = {}
    for (let key in args.colorRanges) {
      if (args.colorRanges.hasOwnProperty(key)) {
        let val = args.colorRanges[key]
        if (typeof val !== 'number') {
          val = tempColor.set(val).getHex()
        }
        colors[key] = val
      }
    }
    args.colorRanges = colors
  }

  Object.freeze(args)

  // Init the atlas if needed
  const {textureWidth, sdfExponent} = CONFIG
  const {sdfGlyphSize} = args
  const glyphsPerRow = (textureWidth / sdfGlyphSize * 4)
  let atlas = atlases[sdfGlyphSize]
  if (!atlas) {
    const canvas = document.createElement('canvas')
    canvas.width = textureWidth
    canvas.height = sdfGlyphSize * 256 / glyphsPerRow // start tall enough to fit 256 glyphs
    atlas = atlases[sdfGlyphSize] = {
      glyphCount: 0,
      sdfGlyphSize,
      sdfCanvas: canvas,
      sdfTexture: new Texture(
        canvas,
        undefined,
        undefined,
        undefined,
        LinearFilter,
        LinearFilter
      ),
      contextLost: false,
      glyphsByFont: new Map()
    }
    atlas.sdfTexture.generateMipmaps = false
    initContextLossHandling(atlas)
  }

  const {sdfTexture, sdfCanvas} = atlas

  // Issue request to the typesetting engine in the worker
  typesetInWorker(args).then(result => {
    const {glyphIds, glyphFontIndices, fontData, glyphPositions, fontSize, timings} = result
    const neededSDFs = []
    const glyphBounds = new Float32Array(glyphIds.length * 4)
    let boundsIdx = 0
    let positionsIdx = 0
    const quadsStart = now()

    const fontGlyphMaps = fontData.map(font => {
      let map = atlas.glyphsByFont.get(font.src)
      if (!map) {
        atlas.glyphsByFont.set(font.src, map = new Map())
      }
      return map
    })

    glyphIds.forEach((glyphId, i) => {
      const fontIndex = glyphFontIndices[i]
      const {src: fontSrc, unitsPerEm} = fontData[fontIndex]
      let glyphInfo = fontGlyphMaps[fontIndex].get(glyphId)

      // If this is a glyphId not seen before, add it to the atlas
      if (!glyphInfo) {
        const {path, pathBounds} = result.glyphData[fontSrc][glyphId]

        // Margin around path edges in SDF, based on a percentage of the glyph's max dimension.
        // Note we add an extra 0.5 px over the configured value because the outer 0.5 doesn't contain
        // useful interpolated values and will be ignored anyway.
        const fontUnitsMargin = Math.max(pathBounds[2] - pathBounds[0], pathBounds[3] - pathBounds[1])
          / sdfGlyphSize * (CONFIG.sdfMargin * sdfGlyphSize + 0.5)

        const atlasIndex = atlas.glyphCount++
        const sdfViewBox = [
          pathBounds[0] - fontUnitsMargin,
          pathBounds[1] - fontUnitsMargin,
          pathBounds[2] + fontUnitsMargin,
          pathBounds[3] + fontUnitsMargin,
        ]
        fontGlyphMaps[fontIndex].set(glyphId, (glyphInfo = { path, atlasIndex, sdfViewBox }))

        // Collect those that need SDF generation
        neededSDFs.push(glyphInfo)
      }

      // Calculate bounds for renderable quads
      // TODO can we get this back off the main thread?
      const {sdfViewBox} = glyphInfo
      const posX = glyphPositions[positionsIdx++]
      const posY = glyphPositions[positionsIdx++]
      const fontSizeMult = fontSize / unitsPerEm
      glyphBounds[boundsIdx++] = posX + sdfViewBox[0] * fontSizeMult
      glyphBounds[boundsIdx++] = posY + sdfViewBox[1] * fontSizeMult
      glyphBounds[boundsIdx++] = posX + sdfViewBox[2] * fontSizeMult
      glyphBounds[boundsIdx++] = posY + sdfViewBox[3] * fontSizeMult

      // Convert glyphId to SDF index for the shader
      glyphIds[i] = glyphInfo.atlasIndex
    })
    timings.quads = (timings.quads || 0) + (now() - quadsStart)

    const sdfStart = now()
    timings.sdf = {}

    // Grow the texture height by power of 2 if needed
    const currentHeight = sdfCanvas.height
    const neededRows = Math.ceil(atlas.glyphCount / glyphsPerRow)
    const neededHeight = Math.pow(2, Math.ceil(Math.log2(neededRows * sdfGlyphSize)))
    if (neededHeight > currentHeight) {
      // Since resizing the canvas clears its render buffer, it needs special handling to copy the old contents over
      console.info(`Increasing SDF texture size ${currentHeight}->${neededHeight}`)
      resizeWebGLCanvasWithoutClearing(sdfCanvas, textureWidth, neededHeight)
      // As of Three r136 textures cannot be resized once they're allocated on the GPU, we must dispose to reallocate it
      sdfTexture.dispose()
    }

    Promise.all(neededSDFs.map(glyphInfo =>
      generateGlyphSDF(glyphInfo, atlas, args.gpuAccelerateSDF).then(({timing}) => {
        timings.sdf[glyphInfo.atlasIndex] = timing
      })
    )).then(() => {
      if (neededSDFs.length && !atlas.contextLost) {
        safariPre15Workaround(atlas)
        sdfTexture.needsUpdate = true
      }
      timings.sdfTotal = now() - sdfStart
      timings.total = now() - totalStart
      // console.log(`SDF - ${timings.sdfTotal}, Total - ${timings.total - timings.fontLoad}`)

      // Invoke callback with the text layout arrays and updated texture
      callback(Object.freeze({
        parameters: args,
        sdfTexture,
        sdfGlyphSize,
        sdfExponent,
        glyphBounds,
        glyphAtlasIndices: glyphIds,
        glyphColors: result.glyphColors,
        caretPositions: result.caretPositions,
        chunkedBounds: result.chunkedBounds,
        ascender: result.ascender,
        descender: result.descender,
        lineHeight: result.lineHeight,
        capHeight: result.capHeight,
        xHeight: result.xHeight,
        topBaseline: result.topBaseline,
        blockBounds: result.blockBounds,
        visibleBounds: result.visibleBounds,
        timings: result.timings,
      }))
    })
  })

  // While the typesetting request is being handled, go ahead and make sure the atlas canvas context is
  // "warmed up"; the first request will be the longest due to shader program compilation so this gets
  // a head start on that process before SDFs actually start getting processed.
  Promise.resolve().then(() => {
    if (!atlas.contextLost) {
      warmUpSDFCanvas(sdfCanvas)
    }
  })
}

function generateGlyphSDF({path, atlasIndex, sdfViewBox}, {sdfGlyphSize, sdfCanvas, contextLost}, useGPU) {
  if (contextLost) {
    // If the context is lost there's nothing we can do, just quit silently and let it
    // get regenerated when the context is restored
    return Promise.resolve({timing: -1})
  }
  const {textureWidth, sdfExponent} = CONFIG
  const maxDist = Math.max(sdfViewBox[2] - sdfViewBox[0], sdfViewBox[3] - sdfViewBox[1])
  const squareIndex = Math.floor(atlasIndex / 4)
  const x = squareIndex % (textureWidth / sdfGlyphSize) * sdfGlyphSize
  const y = Math.floor(squareIndex / (textureWidth / sdfGlyphSize)) * sdfGlyphSize
  const channel = atlasIndex % 4
  return generateSDF(sdfGlyphSize, sdfGlyphSize, path, sdfViewBox, maxDist, sdfExponent, sdfCanvas, x, y, channel, useGPU)
}

function initContextLossHandling(atlas) {
  const canvas = atlas.sdfCanvas

  /*
  // Begin context loss simulation
  if (!window.WebGLDebugUtils) {
    let script = document.getElementById('WebGLDebugUtilsScript')
    if (!script) {
      script = document.createElement('script')
      script.id = 'WebGLDebugUtils'
      document.head.appendChild(script)
      script.src = 'https://cdn.jsdelivr.net/gh/KhronosGroup/WebGLDeveloperTools@b42e702/src/debug/webgl-debug.js'
    }
    script.addEventListener('load', () => {
      initContextLossHandling(atlas)
    })
    return
  }
  window.WebGLDebugUtils.makeLostContextSimulatingCanvas(canvas)
  canvas.loseContextInNCalls(500)
  canvas.addEventListener('webglcontextrestored', (event) => {
    canvas.loseContextInNCalls(5000)
  })
  // End context loss simulation
  */

  canvas.addEventListener('webglcontextlost', (event) => {
    console.log('Context Lost', event)
    event.preventDefault()
    atlas.contextLost = true
  })
  canvas.addEventListener('webglcontextrestored', (event) => {
    console.log('Context Restored', event)
    atlas.contextLost = false
    // Regenerate all glyphs into the restored canvas:
    const promises = []
    atlas.glyphsByFont.forEach(glyphMap => {
      glyphMap.forEach(glyph => {
        promises.push(generateGlyphSDF(glyph, atlas, true))
      })
    })
    Promise.all(promises).then(() => {
      safariPre15Workaround(atlas)
      atlas.sdfTexture.needsUpdate = true
    })
  })
}

/**
 * Preload a given font and optionally pre-generate glyph SDFs for one or more character sequences.
 * This can be useful to avoid long pauses when first showing text in a scene, by preloading the
 * needed fonts and glyphs up front along with other assets.
 *
 * @param {object} options
 * @param {string} options.font - URL of the font file to preload. If not given, the default font will
 *        be loaded.
 * @param {string|string[]} options.characters - One or more character sequences for which to pre-
 *        generate glyph SDFs. Note that this will honor ligature substitution, so you may need
 *        to specify ligature sequences in addition to their individual characters to get all
 *        possible glyphs, e.g. `["t", "h", "th"]` to get the "t" and "h" glyphs plus the "th" ligature.
 * @param {number} options.sdfGlyphSize - The size at which to prerender the SDF textures for the
 *        specified `characters`.
 * @param {function} callback - A function that will be called when the preloading is complete.
 */
function preloadFont({font, characters, sdfGlyphSize}, callback) {
  let text = Array.isArray(characters) ? characters.join('\n') : '' + characters
  getTextRenderInfo({ font, sdfGlyphSize, text }, callback)
}


// Local assign impl so we don't have to import troika-core
function assign(toObj, fromObj) {
  for (let key in fromObj) {
    if (fromObj.hasOwnProperty(key)) {
      toObj[key] = fromObj[key]
    }
  }
  return toObj
}

// Utility for making URLs absolute
let linkEl
function toAbsoluteURL(path) {
  if (!linkEl) {
    linkEl = typeof document === 'undefined' ? {} : document.createElement('a')
  }
  linkEl.href = path
  return linkEl.href
}

/**
 * Safari < v15 seems unable to use the SDF webgl canvas as a texture. This applies a workaround
 * where it reads the pixels out of that canvas and uploads them as a data texture instead, at
 * a slight performance cost.
 */
function safariPre15Workaround(atlas) {
  // Use createImageBitmap support as a proxy for Safari<15, all other mainstream browsers
  // have supported it for a long while so any false positives should be minimal.
  if (typeof createImageBitmap !== 'function') {
    console.info('Safari<15: applying SDF canvas workaround')
    const {sdfCanvas, sdfTexture} = atlas
    const {width, height} = sdfCanvas
    const gl = atlas.sdfCanvas.getContext('webgl')
    let pixels = sdfTexture.image.data
    if (!pixels || pixels.length !== width * height * 4) {
      pixels = new Uint8Array(width * height * 4)
      sdfTexture.image = {width, height, data: pixels}
      sdfTexture.flipY = false
      sdfTexture.isDataTexture = true
    }
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
  }
}

const typesetterWorkerModule = /*#__PURE__*/defineWorkerModule({
  name: 'Typesetter',
  dependencies: [
    createTypesetter,
    fontResolverWorkerModule,
    bidiFactory,
  ],
  init(createTypesetter, fontResolver, bidiFactory) {
    return createTypesetter(fontResolver, bidiFactory())
  }
})

const typesetInWorker = /*#__PURE__*/defineWorkerModule({
  name: 'Typesetter',
  dependencies: [
    typesetterWorkerModule,
  ],
  init(typesetter) {
    return function(args) {
      return new Promise(resolve => {
        typesetter.typeset(args, resolve)
      })
    }
  },
  getTransferables(result) {
    // Mark array buffers as transferable to avoid cloning during postMessage
    const transferables = []
    for (let p in result) {
      if (result[p] && result[p].buffer) {
        transferables.push(result[p].buffer)
      }
    }
    return transferables
  }
})

function dumpSDFTextures() {
  Object.keys(atlases).forEach(size => {
    const canvas = atlases[size].sdfCanvas
    const {width, height} = canvas
    console.log("%c.", `
      background: url(${canvas.toDataURL()});
      background-size: ${width}px ${height}px;
      color: transparent;
      font-size: 0;
      line-height: ${height}px;
      padding-left: ${width}px;
    `)
  })
}

export {
  configureTextBuilder,
  getTextRenderInfo,
  preloadFont,
  typesetterWorkerModule,
  dumpSDFTextures
}
