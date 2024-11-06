import { defineWorkerModule, terminateWorker } from 'troika-worker-utils'
import createSDFGenerator from 'webgl-sdf-generator'

const now = () => (self.performance || Date).now()

const mainThreadGenerator = /*#__PURE__*/ createSDFGenerator()

let warned

/**
 * Generate an SDF texture image for a single glyph path, placing the result into a webgl canvas at a
 * given location and channel. Utilizes the webgl-sdf-generator external package for GPU-accelerated SDF
 * generation when supported.
 */
export function generateSDF(width, height, path, viewBox, distance, exponent, canvas, x, y, channel, useWebGL = true) {
  // Allow opt-out
  if (!useWebGL) {
    return generateSDF_JS_Worker(width, height, path, viewBox, distance, exponent, canvas, x, y, channel)
  }

  // Attempt GPU-accelerated generation first
  return generateSDF_GL(width, height, path, viewBox, distance, exponent, canvas, x, y, channel).then(
    null,
    err => {
      // WebGL failed either due to a hard error or unexpected results; fall back to JS in workers
      if (!warned) {
        console.warn(`WebGL SDF generation failed, falling back to JS`, err)
        warned = true
      }
      return generateSDF_JS_Worker(width, height, path, viewBox, distance, exponent, canvas, x, y, channel)
    }
  )
}

const queue = []
const chunkTimeBudget = 5 // ms
let timer = 0

function nextChunk() {
  const start = now()
  while (queue.length && now() - start < chunkTimeBudget) {
    queue.shift()()
  }
  timer = queue.length ? setTimeout(nextChunk, 0) : 0
}

/**
 * WebGL-based implementation executed on the main thread. Requests are executed in time-bounded
 * macrotask chunks to allow render frames to execute in between.
 */
const generateSDF_GL = (...args) => {
  return new Promise((resolve, reject) => {
    queue.push(() => {
      const start = now()
      try {
        mainThreadGenerator.webgl.generateIntoCanvas(...args)
        resolve({ timing: now() - start })
      } catch (err) {
        reject(err)
      }
    })
    if (!timer) {
      timer = setTimeout(nextChunk, 0)
    }
  })
}

const threadCount = 4 // how many workers to spawn
const idleTimeout = 2000 // workers will be terminated after being idle this many milliseconds
const threads = {}
let callNum = 0

/**
 * Fallback JS-based implementation, fanned out to a number of worker threads for parallelism
 */
function generateSDF_JS_Worker(width, height, path, viewBox, distance, exponent, canvas, x, y, channel) {
  const workerId = 'TroikaTextSDFGenerator_JS_' + ((callNum++) % threadCount)
  let thread = threads[workerId]
  if (!thread) {
    thread = threads[workerId] = {
      workerModule: defineWorkerModule({
        name: workerId,
        workerId,
        dependencies: [
          createSDFGenerator,
          now
        ],
        init(_createSDFGenerator, now) {
          const generate = _createSDFGenerator().javascript.generate
          return function (...args) {
            const start = now()
            const textureData = generate(...args)
            return {
              textureData,
              timing: now() - start
            }
          }
        },
        getTransferables(result) {
          return [result.textureData.buffer]
        }
      }),
      requests: 0,
      idleTimer: null
    }
  }

  thread.requests++
  clearTimeout(thread.idleTimer)
  return thread.workerModule(width, height, path, viewBox, distance, exponent)
    .then(({ textureData, timing }) => {
      // copy result data into the canvas
      const start = now()
      // expand single-channel data into rgba
      const imageData = new Uint8Array(textureData.length * 4)
      for (let i = 0; i < textureData.length; i++) {
        imageData[i * 4 + channel] = textureData[i]
      }
      mainThreadGenerator.webglUtils.renderImageData(canvas, imageData, x, y, width, height, 1 << (3 - channel))
      timing += now() - start

      // clean up workers after a while
      if (--thread.requests === 0) {
        thread.idleTimer = setTimeout(() => { terminateWorker(workerId) }, idleTimeout)
      }
      return { timing }
    })
}

export function warmUpSDFCanvas(canvas) {
  if (!canvas._warm) {
    mainThreadGenerator.webgl.isSupported(canvas)
    canvas._warm = true
  }
}

export const resizeWebGLCanvasWithoutClearing = mainThreadGenerator.webglUtils.resizeWebGLCanvasWithoutClearing
