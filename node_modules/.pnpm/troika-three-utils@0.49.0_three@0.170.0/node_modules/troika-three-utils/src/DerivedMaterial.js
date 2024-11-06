import { voidMainRegExp } from './voidMainRegExp.js'
import { expandShaderIncludes } from './expandShaderIncludes.js'
import { MeshDepthMaterial, MeshDistanceMaterial, RGBADepthPacking, UniformsUtils } from 'three'
import { generateUUID } from './generateUUID.js'

// Local assign polyfill to avoid importing troika-core
const assign = Object.assign || function(/*target, ...sources*/) {
  let target = arguments[0]
  for (let i = 1, len = arguments.length; i < len; i++) {
    let source = arguments[i]
    if (source) {
      for (let prop in source) {
        if (Object.prototype.hasOwnProperty.call(source, prop)) {
          target[prop] = source[prop]
        }
      }
    }
  }
  return target
}


const epoch = Date.now()
const CONSTRUCTOR_CACHE = new WeakMap()
const SHADER_UPGRADE_CACHE = new Map()

// Material ids must be integers, but we can't access the increment from Three's `Material` module,
// so let's choose a sufficiently large starting value that should theoretically never collide.
let materialInstanceId = 1e10

/**
 * A utility for creating a custom shader material derived from another material's
 * shaders. This allows you to inject custom shader logic and transforms into the
 * builtin ThreeJS materials without having to recreate them from scratch.
 *
 * @param {THREE.Material} baseMaterial - the original material to derive from
 *
 * @param {Object} options - How the base material should be modified.
 * @param {Object} options.defines - Custom `defines` for the material
 * @param {Object} options.extensions - Custom `extensions` for the material, e.g. `{derivatives: true}`
 * @param {Object} options.uniforms - Custom `uniforms` for use in the modified shader. These can
 *        be accessed and manipulated via the resulting material's `uniforms` property, just like
 *        in a ShaderMaterial. You do not need to repeat the base material's own uniforms here.
 * @param {String} options.timeUniform - If specified, a uniform of this name will be injected into
 *        both shaders, and it will automatically be updated on each render frame with a number of
 *        elapsed milliseconds. The "zero" epoch time is not significant so don't rely on this as a
 *        true calendar time.
 * @param {String} options.vertexDefs - Custom GLSL code to inject into the vertex shader's top-level
 *        definitions, above the `void main()` function.
 * @param {String} options.vertexMainIntro - Custom GLSL code to inject at the top of the vertex
 *        shader's `void main` function.
 * @param {String} options.vertexMainOutro - Custom GLSL code to inject at the end of the vertex
 *        shader's `void main` function.
 * @param {String} options.vertexTransform - Custom GLSL code to manipulate the `position`, `normal`,
 *        and/or `uv` vertex attributes. This code will be wrapped within a standalone function with
 *        those attributes exposed by their normal names as read/write values.
 * @param {String} options.fragmentDefs - Custom GLSL code to inject into the fragment shader's top-level
 *        definitions, above the `void main()` function.
 * @param {String} options.fragmentMainIntro - Custom GLSL code to inject at the top of the fragment
 *        shader's `void main` function.
 * @param {String} options.fragmentMainOutro - Custom GLSL code to inject at the end of the fragment
 *        shader's `void main` function. You can manipulate `gl_FragColor` here but keep in mind it goes
 *        after any of ThreeJS's color postprocessing shader chunks (tonemapping, fog, etc.), so if you
 *        want those to apply to your changes use `fragmentColorTransform` instead.
 * @param {String} options.fragmentColorTransform - Custom GLSL code to manipulate the `gl_FragColor`
 *        output value. Will be injected near the end of the `void main` function, but before any
 *        of ThreeJS's color postprocessing shader chunks (tonemapping, fog, etc.), and before the
 *        `fragmentMainOutro`.
 * @param {function<{vertexShader,fragmentShader}>:{vertexShader,fragmentShader}} options.customRewriter - A function
 *        for performing custom rewrites of the full shader code. Useful if you need to do something
 *        special that's not covered by the other builtin options. This function will be executed before
 *        any other transforms are applied.
 * @param {boolean} options.chained - Set to `true` to prototype-chain the derived material to the base
 *        material, rather than the default behavior of copying it. This allows the derived material to
 *        automatically pick up changes made to the base material and its properties. This can be useful
 *        where the derived material is hidden from the user as an implementation detail, allowing them
 *        to work with the original material like normal. But it can result in unexpected behavior if not
 *        handled carefully.
 *
 * @return {THREE.Material}
 *
 * The returned material will also have two new methods, `getDepthMaterial()` and `getDistanceMaterial()`,
 * which can be called to get a variant of the derived material for use in shadow casting. If the
 * target mesh is expected to cast shadows, then you can assign these to the mesh's `customDepthMaterial`
 * (for directional and spot lights) and/or `customDistanceMaterial` (for point lights) properties to
 * allow the cast shadow to honor your derived shader's vertex transforms and discarded fragments. These
 * will also set a custom `#define IS_DEPTH_MATERIAL` or `#define IS_DISTANCE_MATERIAL` that you can look
 * for in your derived shaders with `#ifdef` to customize their behavior for the depth or distance
 * scenarios, e.g. skipping antialiasing or expensive shader logic.
 */
export function createDerivedMaterial(baseMaterial, options) {
  // Generate a key that is unique to the content of these `options`. We'll use this
  // throughout for caching and for generating the upgraded shader code. This increases
  // the likelihood that the resulting shaders will line up across multiple calls so
  // their GL programs can be shared and cached.
  const optionsKey = getKeyForOptions(options)

  // First check to see if we've already derived from this baseMaterial using this
  // unique set of options, and if so reuse the constructor to avoid some allocations.
  let ctorsByDerivation = CONSTRUCTOR_CACHE.get(baseMaterial)
  if (!ctorsByDerivation) {
    CONSTRUCTOR_CACHE.set(baseMaterial, (ctorsByDerivation = Object.create(null)))
  }
  if (ctorsByDerivation[optionsKey]) {
    return new ctorsByDerivation[optionsKey]()
  }

  const privateBeforeCompileProp = `_onBeforeCompile${optionsKey}`

  // Private onBeforeCompile handler that injects the modified shaders and uniforms when
  // the renderer switches to this material's program
  const onBeforeCompile = function (shaderInfo, renderer) {
    baseMaterial.onBeforeCompile.call(this, shaderInfo, renderer)

    // Upgrade the shaders, caching the result by incoming source code
    const cacheKey = this.customProgramCacheKey() + '|' + shaderInfo.vertexShader + '|' + shaderInfo.fragmentShader
    let upgradedShaders = SHADER_UPGRADE_CACHE[cacheKey]
    if (!upgradedShaders) {
      const upgraded = upgradeShaders(this, shaderInfo, options, optionsKey)
      upgradedShaders = SHADER_UPGRADE_CACHE[cacheKey] = upgraded
    }

    // Inject upgraded shaders and uniforms into the program
    shaderInfo.vertexShader = upgradedShaders.vertexShader
    shaderInfo.fragmentShader = upgradedShaders.fragmentShader
    assign(shaderInfo.uniforms, this.uniforms)

    // Inject auto-updating time uniform if requested
    if (options.timeUniform) {
      shaderInfo.uniforms[options.timeUniform] = {
        get value() {return Date.now() - epoch}
      }
    }

    // Users can still add their own handlers on top of ours
    if (this[privateBeforeCompileProp]) {
      this[privateBeforeCompileProp](shaderInfo)
    }
  }

  const DerivedMaterial = function DerivedMaterial() {
    return derive(options.chained ? baseMaterial : baseMaterial.clone())
  }

  const derive = function(base) {
    // Prototype chain to the base material
    const derived = Object.create(base, descriptor)

    // Store the baseMaterial for reference; this is always the original even when cloning
    Object.defineProperty(derived, 'baseMaterial', { value: baseMaterial })

    // Needs its own ids
    Object.defineProperty(derived, 'id', { value: materialInstanceId++ })
    derived.uuid = generateUUID()

    // Merge uniforms, defines, and extensions
    derived.uniforms = assign({}, base.uniforms, options.uniforms)
    derived.defines = assign({}, base.defines, options.defines)
    derived.defines[`TROIKA_DERIVED_MATERIAL_${optionsKey}`] = '' //force a program change from the base material
    derived.extensions = assign({}, base.extensions, options.extensions)

    // Don't inherit EventDispatcher listeners
    derived._listeners = undefined

    return derived
  }

  const descriptor = {
    constructor: {value: DerivedMaterial},
    isDerivedMaterial: {value: true},

    customProgramCacheKey: {
      writable: true,
      configurable: true,
      value: function () {
        return baseMaterial.customProgramCacheKey() + '|' + optionsKey
      }
    },

    onBeforeCompile: {
      get() {
        return onBeforeCompile
      },
      set(fn) {
        this[privateBeforeCompileProp] = fn
      }
    },

    copy: {
      writable: true,
      configurable: true,
      value: function (source) {
        baseMaterial.copy.call(this, source)
        if (!baseMaterial.isShaderMaterial && !baseMaterial.isDerivedMaterial) {
          assign(this.extensions, source.extensions)
          assign(this.defines, source.defines)
          assign(this.uniforms, UniformsUtils.clone(source.uniforms))
        }
        return this
      }
    },

    clone: {
      writable: true,
      configurable: true,
      value: function () {
        const newBase = new baseMaterial.constructor()
        return derive(newBase).copy(this)
      }
    },

    /**
     * Utility to get a MeshDepthMaterial that will honor this derived material's vertex
     * transformations and discarded fragments.
     */
    getDepthMaterial: {
      writable: true,
      configurable: true,
      value: function() {
        let depthMaterial = this._depthMaterial
        if (!depthMaterial) {
          depthMaterial = this._depthMaterial = createDerivedMaterial(
            baseMaterial.isDerivedMaterial
              ? baseMaterial.getDepthMaterial()
              : new MeshDepthMaterial({ depthPacking: RGBADepthPacking }),
            options
          )
          depthMaterial.defines.IS_DEPTH_MATERIAL = ''
          depthMaterial.uniforms = this.uniforms //automatically recieve same uniform values
        }
        return depthMaterial
      }
    },

    /**
     * Utility to get a MeshDistanceMaterial that will honor this derived material's vertex
     * transformations and discarded fragments.
     */
    getDistanceMaterial: {
      writable: true,
      configurable: true,
      value: function() {
        let distanceMaterial = this._distanceMaterial
        if (!distanceMaterial) {
          distanceMaterial = this._distanceMaterial = createDerivedMaterial(
            baseMaterial.isDerivedMaterial
              ? baseMaterial.getDistanceMaterial()
              : new MeshDistanceMaterial(),
            options
          )
          distanceMaterial.defines.IS_DISTANCE_MATERIAL = ''
          distanceMaterial.uniforms = this.uniforms //automatically recieve same uniform values
        }
        return distanceMaterial
      }
    },

    dispose: {
      writable: true,
      configurable: true,
      value() {
        const {_depthMaterial, _distanceMaterial} = this
        if (_depthMaterial) _depthMaterial.dispose()
        if (_distanceMaterial) _distanceMaterial.dispose()
        baseMaterial.dispose.call(this)
      }
    }
  }

  ctorsByDerivation[optionsKey] = DerivedMaterial
  return new DerivedMaterial()
}


function upgradeShaders(material, {vertexShader, fragmentShader}, options, key) {
  let {
    vertexDefs,
    vertexMainIntro,
    vertexMainOutro,
    vertexTransform,
    fragmentDefs,
    fragmentMainIntro,
    fragmentMainOutro,
    fragmentColorTransform,
    customRewriter,
    timeUniform
  } = options

  vertexDefs = vertexDefs || ''
  vertexMainIntro = vertexMainIntro || ''
  vertexMainOutro = vertexMainOutro || ''
  fragmentDefs = fragmentDefs || ''
  fragmentMainIntro = fragmentMainIntro || ''
  fragmentMainOutro = fragmentMainOutro || ''

  // Expand includes if needed
  if (vertexTransform || customRewriter) {
    vertexShader = expandShaderIncludes(vertexShader)
  }
  if (fragmentColorTransform || customRewriter) {
    // We need to be able to find postprocessing chunks after include expansion in order to
    // put them after the fragmentColorTransform, so mark them with comments first. Even if
    // this particular derivation doesn't have a fragmentColorTransform, other derivations may,
    // so we still mark them.
    fragmentShader = fragmentShader.replace(
      /^[ \t]*#include <((?:tonemapping|encodings|fog|premultiplied_alpha|dithering)_fragment)>/gm,
      '\n//!BEGIN_POST_CHUNK $1\n$&\n//!END_POST_CHUNK\n'
    )
    fragmentShader = expandShaderIncludes(fragmentShader)
  }

  // Apply custom rewriter function
  if (customRewriter) {
    let res = customRewriter({vertexShader, fragmentShader})
    vertexShader = res.vertexShader
    fragmentShader = res.fragmentShader
  }

  // The fragmentColorTransform needs to go before any postprocessing chunks, so extract
  // those and re-insert them into the outro in the correct place:
  if (fragmentColorTransform) {
    let postChunks = []
    fragmentShader = fragmentShader.replace(
      /^\/\/!BEGIN_POST_CHUNK[^]+?^\/\/!END_POST_CHUNK/gm, // [^]+? = non-greedy match of any chars including newlines
      match => {
        postChunks.push(match)
        return ''
      }
    )
    fragmentMainOutro = `${fragmentColorTransform}\n${postChunks.join('\n')}\n${fragmentMainOutro}`
  }

  // Inject auto-updating time uniform if requested
  if (timeUniform) {
    const code = `\nuniform float ${timeUniform};\n`
    vertexDefs = code + vertexDefs
    fragmentDefs = code + fragmentDefs
  }

  // Inject a function for the vertexTransform and rename all usages of position/normal/uv
  if (vertexTransform) {
    // Hoist these defs to the very top so they work in other function defs
    vertexShader = `vec3 troika_position_${key};
vec3 troika_normal_${key};
vec2 troika_uv_${key};
${vertexShader}
`
    vertexDefs = `${vertexDefs}
void troikaVertexTransform${key}(inout vec3 position, inout vec3 normal, inout vec2 uv) {
  ${vertexTransform}
}
`
    vertexMainIntro = `
troika_position_${key} = vec3(position);
troika_normal_${key} = vec3(normal);
troika_uv_${key} = vec2(uv);
troikaVertexTransform${key}(troika_position_${key}, troika_normal_${key}, troika_uv_${key});
${vertexMainIntro}
`
    vertexShader = vertexShader.replace(/\b(position|normal|uv)\b/g, (match, match1, index, fullStr) => {
      return /\battribute\s+vec[23]\s+$/.test(fullStr.substr(0, index)) ? match1 : `troika_${match1}_${key}`
    })

    // Three r152 introduced the MAP_UV token, replace it too if it's pointing to the main 'uv'
    // Perhaps the other textures too going forward?
    if (!(material.map && material.map.channel > 0)) {
      vertexShader = vertexShader.replace(/\bMAP_UV\b/g, `troika_uv_${key}`);
    }
  }

  // Inject defs and intro/outro snippets
  vertexShader = injectIntoShaderCode(vertexShader, key, vertexDefs, vertexMainIntro, vertexMainOutro)
  fragmentShader = injectIntoShaderCode(fragmentShader, key, fragmentDefs, fragmentMainIntro, fragmentMainOutro)

  return {
    vertexShader,
    fragmentShader
  }
}

function injectIntoShaderCode(shaderCode, id, defs, intro, outro) {
  if (intro || outro || defs) {
    shaderCode = shaderCode.replace(voidMainRegExp, `
${defs}
void troikaOrigMain${id}() {`
    )
    shaderCode += `
void main() {
  ${intro}
  troikaOrigMain${id}();
  ${outro}
}`
  }
  return shaderCode
}


function optionsJsonReplacer(key, value) {
  return key === 'uniforms' ? undefined : typeof value === 'function' ? value.toString() : value
}

let _idCtr = 0
const optionsHashesToIds = new Map()
function getKeyForOptions(options) {
  const optionsHash = JSON.stringify(options, optionsJsonReplacer)
  let id = optionsHashesToIds.get(optionsHash)
  if (id == null) {
    optionsHashesToIds.set(optionsHash, (id = ++_idCtr))
  }
  return id
}
