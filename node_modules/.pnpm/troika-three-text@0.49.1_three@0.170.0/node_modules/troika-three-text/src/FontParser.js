/**
 * A factory wrapper parsing a font file using Typr.
 * Also adds support for WOFF files (not WOFF2).
 */

import typrFactory from '../libs/typr.factory.js'
import woff2otfFactory from '../libs/woff2otf.factory.js'
import { defineWorkerModule } from 'troika-worker-utils'

/**
 * @typedef ParsedFont
 * @property {number} ascender
 * @property {number} descender
 * @property {number} xHeight
 * @property {(number) => boolean} supportsCodePoint
 * @property {(text:string, fontSize:number, letterSpacing:number, callback) => number} forEachGlyph
 * @property {number} lineGap
 * @property {number} capHeight
 * @property {number} unitsPerEm
 */

/**
 * @typedef {(buffer: ArrayBuffer) => ParsedFont} FontParser
 */

/**
 * @returns {FontParser}
 */
function parserFactory(Typr, woff2otf) {
  const cmdArgLengths = {
    M: 2,
    L: 2,
    Q: 4,
    C: 6,
    Z: 0
  }

  // {joinType: "skip+step,..."}
  const joiningTypeRawData = {"C":"18g,ca,368,1kz","D":"17k,6,2,2+4,5+c,2+6,2+1,10+1,9+f,j+11,2+1,a,2,2+1,15+2,3,j+2,6+3,2+8,2,2,2+1,w+a,4+e,3+3,2,3+2,3+5,23+w,2f+4,3,2+9,2,b,2+3,3,1k+9,6+1,3+1,2+2,2+d,30g,p+y,1,1+1g,f+x,2,sd2+1d,jf3+4,f+3,2+4,2+2,b+3,42,2,4+2,2+1,2,3,t+1,9f+w,2,el+2,2+g,d+2,2l,2+1,5,3+1,2+1,2,3,6,16wm+1v","R":"17m+3,2,2,6+3,m,15+2,2+2,h+h,13,3+8,2,2,3+1,2,p+1,x,5+4,5,a,2,2,3,u,c+2,g+1,5,2+1,4+1,5j,6+1,2,b,2+2,f,2+1,1s+2,2,3+1,7,1ez0,2,2+1,4+4,b,4,3,b,42,2+2,4,3,2+1,2,o+3,ae,ep,x,2o+2,3+1,3,5+1,6","L":"x9u,jff,a,fd,jv","T":"4t,gj+33,7o+4,1+1,7c+18,2,2+1,2+1,2,21+a,2,1b+k,h,2u+6,3+5,3+1,2+3,y,2,v+q,2k+a,1n+8,a,p+3,2+8,2+2,2+4,18+2,3c+e,2+v,1k,2,5+7,5,4+6,b+1,u,1n,5+3,9,l+1,r,3+1,1m,5+1,5+1,3+2,4,v+1,4,c+1,1m,5+4,2+1,5,l+1,n+5,2,1n,3,2+3,9,8+1,c+1,v,1q,d,1f,4,1m+2,6+2,2+3,8+1,c+1,u,1n,3,7,6+1,l+1,t+1,1m+1,5+3,9,l+1,u,21,8+2,2,2j,3+6,d+7,2r,3+8,c+5,23+1,s,2,2,1k+d,2+4,2+1,6+a,2+z,a,2v+3,2+5,2+1,3+1,q+1,5+2,h+3,e,3+1,7,g,jk+2,qb+2,u+2,u+1,v+1,1t+1,2+6,9,3+a,a,1a+2,3c+1,z,3b+2,5+1,a,7+2,64+1,3,1n,2+6,2,2,3+7,7+9,3,1d+d,1,1+1,1s+3,1d,2+4,2,6,15+8,d+1,x+3,3+1,2+2,1l,2+1,4,2+2,1n+7,3+1,49+2,2+c,2+6,5,7,4+1,5j+1l,2+4,ek,3+1,r+4,1e+4,6+5,2p+c,1+3,1,1+2,1+b,2db+2,3y,2p+v,ff+3,30+1,n9x,1+2,2+9,x+1,29+1,7l,4,5,q+1,6,48+1,r+h,e,13+7,q+a,1b+2,1d,3+3,3+1,14,1w+5,3+1,3+1,d,9,1c,1g,2+2,3+1,6+1,2,17+1,9,6n,3,5,fn5,ki+f,h+f,5s,6y+2,ea,6b,46+4,1af+2,2+1,6+3,15+2,5,4m+1,fy+3,as+1,4a+a,4x,1j+e,1l+2,1e+3,3+1,1y+2,11+4,2+7,1r,d+1,1h+8,b+3,3,2o+2,3,2+1,7,4h,4+7,m+1,1m+1,4,12+6,4+4,5g+7,3+2,2,o,2d+5,2,5+1,2+1,6n+3,7+1,2+1,s+1,2e+7,3,2+1,2z,2,3+5,2,2u+2,3+3,2+4,78+8,2+1,75+1,2,5,41+3,3+1,5,x+9,15+5,3+3,9,a+5,3+2,1b+c,2+1,bb+6,2+5,2,2b+l,3+6,2+1,2+1,3f+5,4,2+1,2+6,2,21+1,4,2,9o+1,470+8,at4+4,1o+6,t5,1s+3,2a,f5l+1,2+3,43o+2,a+7,1+7,3+6,v+3,45+2,1j0+1i,5+1d,9,f,n+4,2+e,11t+6,2+g,3+6,2+1,2+4,7a+6,c6+3,15t+6,32+6,1,gzau,v+2n,3l+6n"}

  const JT_LEFT = 1, //indicates that a character joins with the subsequent character, but does not join with the preceding character.
    JT_RIGHT = 2, //indicates that a character joins with the preceding character, but does not join with the subsequent character.
    JT_DUAL = 4, //indicates that a character joins with the preceding character and joins with the subsequent character.
    JT_TRANSPARENT = 8, //indicates that the character does not join with adjacent characters and that the character must be skipped over when the shaping engine is evaluating the joining positions in a sequence of characters. When a JT_TRANSPARENT character is encountered in a sequence, the JOINING_TYPE of the preceding character passes through. Diacritical marks are frequently assigned this value.
    JT_JOIN_CAUSING = 16, //indicates that the character forces the use of joining forms with the preceding and subsequent characters. Kashidas and the Zero Width Joiner (U+200D) are both JOIN_CAUSING characters.
    JT_NON_JOINING = 32 //indicates that a character does not join with the preceding or with the subsequent character.,

  let joiningTypeMap
  function getCharJoiningType(ch) {
    if (!joiningTypeMap) {
      const m = {
        R: JT_RIGHT,
        L: JT_LEFT,
        D: JT_DUAL,
        C: JT_JOIN_CAUSING,
        U: JT_NON_JOINING,
        T: JT_TRANSPARENT
      }
      joiningTypeMap = new Map()
      for (let type in joiningTypeRawData) {
        let lastCode = 0
        joiningTypeRawData[type].split(',').forEach(range => {
          let [skip, step] = range.split('+')
          skip = parseInt(skip,36)
          step = step ? parseInt(step, 36) : 0
          joiningTypeMap.set(lastCode += skip, m[type])
          for (let i = step; i--;) {
            joiningTypeMap.set(++lastCode, m[type])
          }
        })
      }
    }
    return joiningTypeMap.get(ch) || JT_NON_JOINING
  }

  const ISOL = 1, INIT = 2, FINA = 3, MEDI = 4
  const formsToFeatures = [null, 'isol', 'init', 'fina', 'medi']

  function detectJoiningForms(str) {
    // This implements the algorithm described here:
    // https://github.com/n8willis/opentype-shaping-documents/blob/master/opentype-shaping-arabic-general.md
    const joiningForms = new Uint8Array(str.length)
    let prevJoiningType = JT_NON_JOINING
    let prevForm = ISOL
    let prevIndex = -1
    for (let i = 0; i < str.length; i++) {
      const code = str.codePointAt(i)
      let joiningType = getCharJoiningType(code) | 0
      let form = ISOL
      if (joiningType & JT_TRANSPARENT) {
        continue
      }
      if (prevJoiningType & (JT_LEFT | JT_DUAL | JT_JOIN_CAUSING)) {
        if (joiningType & (JT_RIGHT | JT_DUAL | JT_JOIN_CAUSING)) {
          form = FINA
          // isol->init, fina->medi
          if (prevForm === ISOL || prevForm === FINA) {
            joiningForms[prevIndex]++
          }
        }
        else if (joiningType & (JT_LEFT | JT_NON_JOINING)) {
          // medi->fina, init->isol
          if (prevForm === INIT || prevForm === MEDI) {
            joiningForms[prevIndex]--
          }
        }
      }
      else if (prevJoiningType & (JT_RIGHT | JT_NON_JOINING)) {
        // medi->fina, init->isol
        if (prevForm === INIT || prevForm === MEDI) {
          joiningForms[prevIndex]--
        }
      }
      prevForm = joiningForms[i] = form
      prevJoiningType = joiningType
      prevIndex = i
      if (code > 0xffff) i++
    }
    // console.log(str.split('').map(ch => ch.codePointAt(0).toString(16)))
    // console.log(str.split('').map(ch => getCharJoiningType(ch.codePointAt(0))))
    // console.log(Array.from(joiningForms).map(f => formsToFeatures[f] || 'none'))
    return joiningForms
  }

  function stringToGlyphs (font, str) {
    const glyphIds = []
    for (let i = 0; i < str.length; i++) {
      const cc = str.codePointAt(i)
      if (cc > 0xffff) i++
      glyphIds.push(Typr.U.codeToGlyph(font, cc))
    }

    const gsub = font['GSUB']
    if (gsub) {
      const {lookupList, featureList} = gsub
      let joiningForms
      const supportedFeatures = /^(rlig|liga|mset|isol|init|fina|medi|half|pres|blws|ccmp)$/
      const usedLookups = []
      featureList.forEach(feature => {
        if (supportedFeatures.test(feature.tag)) {
          for (let ti = 0; ti < feature.tab.length; ti++) {
            if (usedLookups[feature.tab[ti]]) continue
            usedLookups[feature.tab[ti]] = true
            const tab = lookupList[feature.tab[ti]]
            const isJoiningFeature = /^(isol|init|fina|medi)$/.test(feature.tag)
            if (isJoiningFeature && !joiningForms) { //lazy
              joiningForms = detectJoiningForms(str)
            }
            for (let ci = 0; ci < glyphIds.length; ci++) {
              if (!joiningForms || !isJoiningFeature || formsToFeatures[joiningForms[ci]] === feature.tag) {
                Typr.U._applySubs(glyphIds, ci, tab, lookupList)
              }
            }
          }
        }
      })
    }

    return glyphIds
  }

  // Calculate advances and x/y offsets for each glyph, e.g. kerning and mark
  // attachments. This is a more complete version of Typr.U.getPairAdjustment
  // and should become an upstream replacement eventually.
  function calcGlyphPositions(font, glyphIds) {
    const positions = new Int16Array(glyphIds.length * 3); // [offsetX, offsetY, advanceX, ...]
    let glyphIndex = 0;
    for (; glyphIndex < glyphIds.length; glyphIndex++) {
      const glyphId = glyphIds[glyphIndex]
      if (glyphId === -1) continue;

      positions[glyphIndex * 3 + 2] = font.hmtx.aWidth[glyphId]; // populate advanceX in...advance.

      const gpos = font.GPOS;
      if (gpos) {
        const llist = gpos.lookupList;
        for (let i = 0; i < llist.length; i++) {
          const lookup = llist[i];
          for (let j = 0; j < lookup.tabs.length; j++) {
            const tab = lookup.tabs[j];
            // Single char placement
            if (lookup.ltype === 1) {
              const ind = Typr._lctf.coverageIndex(tab.coverage, glyphId);
              if (ind !== -1 && tab.pos) {
                applyValueRecord(tab.pos, glyphIndex)
                break
              }
            }
            // Pairs (kerning)
            else if (lookup.ltype === 2) {
              let adj = null;
              let prevGlyphIndex = getPrevGlyphIndex()
              if (prevGlyphIndex !== -1) {
                const coverageIndex = Typr._lctf.coverageIndex(tab.coverage, glyphIds[prevGlyphIndex]);
                if (coverageIndex !== -1) {
                  if (tab.fmt === 1) {
                    const right = tab.pairsets[coverageIndex];
                    for (let k = 0; k < right.length; k++) {
                      if (right[k].gid2 === glyphId) adj = right[k];
                    }
                  } else if (tab.fmt === 2) {
                    const c1 = Typr.U._getGlyphClass(glyphIds[prevGlyphIndex], tab.classDef1);
                    const c2 = Typr.U._getGlyphClass(glyphId, tab.classDef2);
                    adj = tab.matrix[c1][c2];
                  }
                  if (adj) {
                    if (adj.val1) applyValueRecord(adj.val1, prevGlyphIndex)
                    if (adj.val2) applyValueRecord(adj.val2, glyphIndex)
                    break
                  }
                }
              }
            }
            // Mark to base
            else if (lookup.ltype === 4) {
              const markArrIndex = Typr._lctf.coverageIndex(tab.markCoverage, glyphId);
              if (markArrIndex !== -1) {
                const baseGlyphIndex = getPrevGlyphIndex(isBaseGlyph);
                const baseArrIndex = baseGlyphIndex === -1 ? -1 : Typr._lctf.coverageIndex(tab.baseCoverage, glyphIds[baseGlyphIndex])
                if (baseArrIndex !== -1) {
                  const markRecord = tab.markArray[markArrIndex];
                  const baseAnchor = tab.baseArray[baseArrIndex][markRecord.markClass];
                  positions[glyphIndex * 3] = baseAnchor.x - markRecord.x + positions[baseGlyphIndex * 3] - positions[baseGlyphIndex * 3 + 2]
                  positions[glyphIndex * 3 + 1] = baseAnchor.y - markRecord.y + positions[baseGlyphIndex * 3 + 1];
                  break;
                }
              }
            }
            // Mark to mark
            else if (lookup.ltype === 6) {
              const mark1ArrIndex = Typr._lctf.coverageIndex(tab.mark1Coverage, glyphId);
              if (mark1ArrIndex !== -1) {
                const prevGlyphIndex = getPrevGlyphIndex();
                if (prevGlyphIndex !== -1) {
                  const prevGlyphId = glyphIds[prevGlyphIndex]
                  if (getGlyphClass(font, prevGlyphId) === 3) { // only check mark glyphs
                    const mark2ArrIndex = Typr._lctf.coverageIndex(tab.mark2Coverage, prevGlyphId)
                    if (mark2ArrIndex !== -1) {
                      const mark1Record = tab.mark1Array[mark1ArrIndex];
                      const mark2Anchor = tab.mark2Array[mark2ArrIndex][mark1Record.markClass];
                      positions[glyphIndex * 3] = mark2Anchor.x - mark1Record.x + positions[prevGlyphIndex * 3] - positions[prevGlyphIndex * 3 + 2];
                      positions[glyphIndex * 3 + 1] = mark2Anchor.y - mark1Record.y + positions[prevGlyphIndex * 3 + 1];
                      break;
                    }
                  }
                }
              }
            }
          }
        }
      }
      // Check kern table if no GPOS
      else if (font.kern && !font.cff) {
        const prevGlyphIndex = getPrevGlyphIndex();
        if (prevGlyphIndex !== -1) {
          const ind1 = font.kern.glyph1.indexOf(glyphIds[prevGlyphIndex]);
          if (ind1 !== -1) {
            const ind2 = font.kern.rval[ind1].glyph2.indexOf(glyphId);
            if (ind2 !== -1) {
              positions[prevGlyphIndex * 3 + 2] += font.kern.rval[ind1].vals[ind2];
            }
          }
        }
      }
    }

    return positions;

    function getPrevGlyphIndex(filter) {
      for (let i = glyphIndex - 1; i >=0; i--) {
        if (glyphIds[i] !== -1 && (!filter || filter(glyphIds[i]))) {
          return i
        }
      }
      return -1;
    }

    function isBaseGlyph(glyphId) {
      return getGlyphClass(font, glyphId) === 1;
    }

    function applyValueRecord(source, gi) {
      for (let i = 0; i < 3; i++) {
        positions[gi * 3 + i] += source[i] || 0
      }
    }
  }

  function getGlyphClass(font, glyphId) {
    const classDef = font.GDEF && font.GDEF.glyphClassDef
    return classDef ? Typr.U._getGlyphClass(glyphId, classDef) : 0;
  }

  function firstNum(...args) {
    for (let i = 0; i < args.length; i++) {
      if (typeof args[i] === 'number') {
        return args[i]
      }
    }
  }

  /**
   * @returns ParsedFont
   */
  function wrapFontObj(typrFont) {
    const glyphMap = Object.create(null)

    const os2 = typrFont['OS/2']
    const hhea = typrFont.hhea
    const unitsPerEm = typrFont.head.unitsPerEm
    const ascender = firstNum(os2 && os2.sTypoAscender, hhea && hhea.ascender, unitsPerEm)

    /** @type ParsedFont */
    const fontObj = {
      unitsPerEm,
      ascender,
      descender: firstNum(os2 && os2.sTypoDescender, hhea && hhea.descender, 0),
      capHeight: firstNum(os2 && os2.sCapHeight, ascender),
      xHeight: firstNum(os2 && os2.sxHeight, ascender),
      lineGap: firstNum(os2 && os2.sTypoLineGap, hhea && hhea.lineGap),
      supportsCodePoint(code) {
        return Typr.U.codeToGlyph(typrFont, code) > 0
      },
      forEachGlyph(text, fontSize, letterSpacing, callback) {
        let penX = 0
        const fontScale = 1 / fontObj.unitsPerEm * fontSize

        const glyphIds = stringToGlyphs(typrFont, text)
        let charIndex = 0
        const positions = calcGlyphPositions(typrFont, glyphIds)

        glyphIds.forEach((glyphId, i) => {
          // Typr returns a glyph index per string codepoint, with -1s in place of those that
          // were omitted due to ligature substitution. So we can track original index in the
          // string via simple increment, and skip everything else when seeing a -1.
          if (glyphId !== -1) {
            let glyphObj = glyphMap[glyphId]
            if (!glyphObj) {
              const {cmds, crds} = Typr.U.glyphToPath(typrFont, glyphId)

              // Build path string
              let path = ''
              let crdsIdx = 0
              for (let i = 0, len = cmds.length; i < len; i++) {
                const numArgs = cmdArgLengths[cmds[i]]
                path += cmds[i]
                for (let j = 1; j <= numArgs; j++) {
                  path += (j > 1 ? ',' : '') + crds[crdsIdx++]
                }
              }

              // Find extents - Glyf gives this in metadata but not CFF, and Typr doesn't
              // normalize the two, so it's simplest just to iterate ourselves.
              let xMin, yMin, xMax, yMax
              if (crds.length) {
                xMin = yMin = Infinity
                xMax = yMax = -Infinity
                for (let i = 0, len = crds.length; i < len; i += 2) {
                  let x = crds[i]
                  let y = crds[i + 1]
                  if (x < xMin) xMin = x
                  if (y < yMin) yMin = y
                  if (x > xMax) xMax = x
                  if (y > yMax) yMax = y
                }
              } else {
                xMin = xMax = yMin = yMax = 0
              }

              glyphObj = glyphMap[glyphId] = {
                index: glyphId,
                advanceWidth: typrFont.hmtx.aWidth[glyphId],
                xMin,
                yMin,
                xMax,
                yMax,
                path,
              }
            }

            callback.call(
              null,
              glyphObj,
              penX + positions[i * 3] * fontScale,
              positions[i * 3 + 1] * fontScale,
              charIndex
            )

            penX += positions[i * 3 + 2] * fontScale
            if (letterSpacing) {
              penX += letterSpacing * fontSize
            }
          }
          charIndex += (text.codePointAt(charIndex) > 0xffff ? 2 : 1)
        })

        return penX
      }
    }

    return fontObj
  }

  /**
   * @type FontParser
   */
  return function parse(buffer) {
    // Look to see if we have a WOFF file and convert it if so:
    const peek = new Uint8Array(buffer, 0, 4)
    const tag = Typr._bin.readASCII(peek, 0, 4)
    if (tag === 'wOFF') {
      buffer = woff2otf(buffer)
    } else if (tag === 'wOF2') {
      throw new Error('woff2 fonts not supported')
    }
    return wrapFontObj(Typr.parse(buffer)[0])
  }
}


const workerModule = /*#__PURE__*/defineWorkerModule({
  name: 'Typr Font Parser',
  dependencies: [typrFactory, woff2otfFactory, parserFactory],
  init(typrFactory, woff2otfFactory, parserFactory) {
    const Typr = typrFactory()
    const woff2otf = woff2otfFactory()
    return parserFactory(Typr, woff2otf)
  }
})


export default workerModule
