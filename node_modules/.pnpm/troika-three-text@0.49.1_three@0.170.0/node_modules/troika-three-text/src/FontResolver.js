import fontParser from "./FontParser.js";
import unicodeFontResolverClientFactory from "../libs/unicode-font-resolver-client.factory.js";
import { defineWorkerModule } from "troika-worker-utils";

/**
 * @typedef {string | {src:string, label?:string, unicodeRange?:string, lang?:string}} UserFont
 */

/**
 * @typedef {ClientOptions} FontResolverOptions
 * @property {Array<UserFont>|UserFont} [fonts]
 * @property {'normal'|'italic'} [style]
 * @property {'normal'|'bold'|number} [style]
 * @property {string} [unicodeFontsURL]
 */

/**
 * @typedef {Object} FontResolverResult
 * @property {Uint8Array} chars
 * @property {Array<ParsedFont & {src:string}>} fonts
 */

/**
 * @typedef {function} FontResolver
 * @param {string} text
 * @param {(FontResolverResult) => void} callback
 * @param {FontResolverOptions} [options]
 */

/**
 * Factory for the FontResolver function.
 * @param {FontParser} fontParser
 * @param {{getFontsForString: function, CodePointSet: function}} unicodeFontResolverClient
 * @return {FontResolver}
 */
export function createFontResolver(fontParser, unicodeFontResolverClient) {
  /**
   * @type {Record<string, ParsedFont>}
   */
  const parsedFonts = Object.create(null)

  /**
   * @type {Record<string, Array<(ParsedFont) => void>>}
   */
  const loadingFonts = Object.create(null)

  /**
   * Load a given font url
   */
  function doLoadFont(url, callback) {
    const onError = err => {
      console.error(`Failure loading font ${url}`, err)
    }
    try {
      const request = new XMLHttpRequest()
      request.open('get', url, true)
      request.responseType = 'arraybuffer'
      request.onload = function () {
        if (request.status >= 400) {
          onError(new Error(request.statusText))
        }
        else if (request.status > 0) {
          try {
            const fontObj = fontParser(request.response)
            fontObj.src = url;
            callback(fontObj)
          } catch (e) {
            onError(e)
          }
        }
      }
      request.onerror = onError
      request.send()
    } catch(err) {
      onError(err)
    }
  }


  /**
   * Load a given font url if needed, invoking a callback when it's loaded. If already
   * loaded, the callback will be called synchronously.
   * @param {string} fontUrl
   * @param {(font: ParsedFont) => void} callback
   */
  function loadFont(fontUrl, callback) {
    let font = parsedFonts[fontUrl]
    if (font) {
      callback(font)
    } else if (loadingFonts[fontUrl]) {
      loadingFonts[fontUrl].push(callback)
    } else {
      loadingFonts[fontUrl] = [callback]
      doLoadFont(fontUrl, fontObj => {
        fontObj.src = fontUrl
        parsedFonts[fontUrl] = fontObj
        loadingFonts[fontUrl].forEach(cb => cb(fontObj))
        delete loadingFonts[fontUrl];
      })
    }
  }

  /**
   * For a given string of text, determine which fonts are required to fully render it and
   * ensure those fonts are loaded.
   */
  return function (text, callback, {
    lang,
    fonts: userFonts = [],
    style = 'normal',
    weight = 'normal',
    unicodeFontsURL
  } = {}) {
    const charResolutions = new Uint8Array(text.length);
    const fontResolutions = [];
    if (!text.length) {
      allDone()
    }

    const fontIndices = new Map();
    const fallbackRanges = [] // [[start, end], ...]

    if (style !== 'italic') style = 'normal'
    if (typeof weight !== 'number') {
      weight = weight === 'bold' ? 700 : 400
    }

    if (userFonts && !Array.isArray(userFonts)) {
      userFonts = [userFonts]
    }
    userFonts = userFonts.slice()
      // filter by language
      .filter(def => !def.lang || def.lang.test(lang))
      // switch order for easier iteration
      .reverse()
    if (userFonts.length) {
      const UNKNOWN = 0
      const RESOLVED = 1
      const NEEDS_FALLBACK = 2
      let prevCharResult = UNKNOWN

      ;(function resolveUserFonts (startIndex = 0) {
        for (let i = startIndex, iLen = text.length; i < iLen; i++) {
          const codePoint = text.codePointAt(i)
          // Carry previous character's result forward if:
          // - it resolved to a font that also covers this character
          // - this character is whitespace
          if (
            (prevCharResult === RESOLVED && fontResolutions[charResolutions[i - 1]].supportsCodePoint(codePoint)) ||
            /\s/.test(text[i])
          ) {
            charResolutions[i] = charResolutions[i - 1]
            if (prevCharResult === NEEDS_FALLBACK) {
              fallbackRanges[fallbackRanges.length - 1][1] = i
            }
          }  else {
            for (let j = charResolutions[i], jLen = userFonts.length; j <= jLen; j++) {
              if (j === jLen) {
                // none of the user fonts matched; needs fallback
                const range = prevCharResult === NEEDS_FALLBACK ?
                  fallbackRanges[fallbackRanges.length - 1] :
                  (fallbackRanges[fallbackRanges.length] = [i, i])
                range[1] = i;
                prevCharResult = NEEDS_FALLBACK;
              } else {
                charResolutions[i] = j;
                const { src, unicodeRange } = userFonts[j];
                // filter by optional explicit unicode ranges
                if (!unicodeRange || isCodeInRanges(codePoint, unicodeRange)) {
                  const fontObj = parsedFonts[src];
                  // font not yet loaded, load it and resume
                  if (!fontObj) {
                    loadFont(src, () => {
                      resolveUserFonts(i);
                    });
                    return;
                  }
                  // if the font actually contains a glyph for this char, lock it in
                  if (fontObj.supportsCodePoint(codePoint)) {
                    let fontIndex = fontIndices.get(fontObj);
                    if (typeof fontIndex !== 'number') {
                      fontIndex = fontResolutions.length;
                      fontResolutions.push(fontObj);
                      fontIndices.set(fontObj, fontIndex);
                    }
                    charResolutions[i] = fontIndex;
                    prevCharResult = RESOLVED;
                    break;
                  }
                }
              }
            }
          }

          if (codePoint > 0xffff && i + 1 < iLen) {
            charResolutions[i + 1] = charResolutions[i]
            i++
            if (prevCharResult === NEEDS_FALLBACK) {
              fallbackRanges[fallbackRanges.length - 1][1] = i
            }
          }
        }
        resolveFallbacks();
      })();
    } else {
      fallbackRanges.push([0, text.length - 1])
      resolveFallbacks();
    }

    function resolveFallbacks() {
      if (fallbackRanges.length) {
        // Combine all fallback substrings into a single string for querying
        const fallbackString = fallbackRanges.map(range => text.substring(range[0], range[1] + 1)).join('\n')
        unicodeFontResolverClient.getFontsForString(fallbackString, {
          lang: lang || undefined,
          style,
          weight,
          dataUrl: unicodeFontsURL
        }).then(({fontUrls, chars}) => {
          // Extract results and put them back in the main array
          const fontIndexOffset = fontResolutions.length
          let charIdx = 0;
          fallbackRanges.forEach(range => {
            for (let i = 0, endIdx = range[1] - range[0]; i <= endIdx; i++) {
              charResolutions[range[0] + i] = chars[charIdx++] + fontIndexOffset
            }
            charIdx++ //skip segment separator
          })

          // Load and parse the fallback fonts - avoiding Promise here to prevent polyfills in the worker
          let loadedCount = 0;
          fontUrls.forEach((url, i) => {
            loadFont(url, fontObj => {
              fontResolutions[i + fontIndexOffset] = fontObj
              if (++loadedCount === fontUrls.length) {
                allDone();
              }
            })
          })
        });
      } else {
        allDone();
      }
    }

    function allDone() {
      callback({
        chars: charResolutions,
        fonts: fontResolutions
      })
    }

    function isCodeInRanges(code, ranges) {
      // todo optimize search - CodePointSet from unicode-font-resolver?
      for (let k = 0; k < ranges.length; k++) {
        const [start, end = start] = ranges[k]
        if (start <= code && code <= end) {
          return true
        }
      }
      return false
    }
  }
}

export const fontResolverWorkerModule = /*#__PURE__*/defineWorkerModule({
  name: 'FontResolver',
  dependencies: [
    createFontResolver,
    fontParser,
    unicodeFontResolverClientFactory,
  ],
  init(createFontResolver, fontParser, unicodeFontResolverClientFactory) {
    return createFontResolver(fontParser, unicodeFontResolverClientFactory());
  }
})
