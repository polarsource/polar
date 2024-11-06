import _extends from '@babel/runtime/helpers/esm/extends';
import * as THREE from 'three';
import * as React from 'react';
import { extend, useThree, useLoader, useFrame } from '@react-three/fiber';
import { shaderMaterial } from './shaderMaterial.js';

const SplatMaterial = /* @__PURE__ */shaderMaterial({
  alphaTest: 0,
  viewport: /* @__PURE__ */new THREE.Vector2(1980, 1080),
  focal: 1000.0,
  centerAndScaleTexture: null,
  covAndColorTexture: null
}, /*glsl*/`
    precision highp sampler2D;
    precision highp usampler2D;
    out vec4 vColor;
    out vec3 vPosition;
    uniform vec2 resolution;
    uniform vec2 viewport;
    uniform float focal;
    attribute uint splatIndex;
    uniform sampler2D centerAndScaleTexture;
    uniform usampler2D covAndColorTexture;    

    vec2 unpackInt16(in uint value) {
      int v = int(value);
      int v0 = v >> 16;
      int v1 = (v & 0xFFFF);
      if((v & 0x8000) != 0)
        v1 |= 0xFFFF0000;
      return vec2(float(v1), float(v0));
    }

    void main () {
      ivec2 texSize = textureSize(centerAndScaleTexture, 0);
      ivec2 texPos = ivec2(splatIndex%uint(texSize.x), splatIndex/uint(texSize.x));
      vec4 centerAndScaleData = texelFetch(centerAndScaleTexture, texPos, 0);
      vec4 center = vec4(centerAndScaleData.xyz, 1);
      vec4 camspace = modelViewMatrix * center;
      vec4 pos2d = projectionMatrix * camspace;

      float bounds = 1.2 * pos2d.w;
      if (pos2d.z < -pos2d.w || pos2d.x < -bounds || pos2d.x > bounds
        || pos2d.y < -bounds || pos2d.y > bounds) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        return;
      }

      uvec4 covAndColorData = texelFetch(covAndColorTexture, texPos, 0);
      vec2 cov3D_M11_M12 = unpackInt16(covAndColorData.x) * centerAndScaleData.w;
      vec2 cov3D_M13_M22 = unpackInt16(covAndColorData.y) * centerAndScaleData.w;
      vec2 cov3D_M23_M33 = unpackInt16(covAndColorData.z) * centerAndScaleData.w;
      mat3 Vrk = mat3(
        cov3D_M11_M12.x, cov3D_M11_M12.y, cov3D_M13_M22.x,
        cov3D_M11_M12.y, cov3D_M13_M22.y, cov3D_M23_M33.x,
        cov3D_M13_M22.x, cov3D_M23_M33.x, cov3D_M23_M33.y
      );

      mat3 J = mat3(
        focal / camspace.z, 0., -(focal * camspace.x) / (camspace.z * camspace.z),
        0., focal / camspace.z, -(focal * camspace.y) / (camspace.z * camspace.z),
        0., 0., 0.
      );

      mat3 W = transpose(mat3(modelViewMatrix));
      mat3 T = W * J;
      mat3 cov = transpose(T) * Vrk * T;
      vec2 vCenter = vec2(pos2d) / pos2d.w;
      float diagonal1 = cov[0][0] + 0.3;
      float offDiagonal = cov[0][1];
      float diagonal2 = cov[1][1] + 0.3;
      float mid = 0.5 * (diagonal1 + diagonal2);
      float radius = length(vec2((diagonal1 - diagonal2) / 2.0, offDiagonal));
      float lambda1 = mid + radius;
      float lambda2 = max(mid - radius, 0.1);
      vec2 diagonalVector = normalize(vec2(offDiagonal, lambda1 - diagonal1));
      vec2 v1 = min(sqrt(2.0 * lambda1), 1024.0) * diagonalVector;
      vec2 v2 = min(sqrt(2.0 * lambda2), 1024.0) * vec2(diagonalVector.y, -diagonalVector.x);
      uint colorUint = covAndColorData.w;
      vColor = vec4(
        float(colorUint & uint(0xFF)) / 255.0,
        float((colorUint >> uint(8)) & uint(0xFF)) / 255.0,
        float((colorUint >> uint(16)) & uint(0xFF)) / 255.0,
        float(colorUint >> uint(24)) / 255.0
      );
      vPosition = position;

      gl_Position = vec4(
        vCenter 
          + position.x * v2 / viewport * 2.0 
          + position.y * v1 / viewport * 2.0, pos2d.z / pos2d.w, 1.0);
    }
    `, /*glsl*/`
    #include <alphatest_pars_fragment>
    #include <alphahash_pars_fragment>
    in vec4 vColor;
    in vec3 vPosition;
    void main () {
      float A = -dot(vPosition.xy, vPosition.xy);
      if (A < -4.0) discard;
      float B = exp(A) * vColor.a;
      vec4 diffuseColor = vec4(vColor.rgb, B);
      #include <alphatest_fragment>
      #include <alphahash_fragment>
      gl_FragColor = diffuseColor;
      #include <tonemapping_fragment>
      #include <${parseInt(THREE.REVISION.replace(/\D+/g, '')) >= 154 ? 'colorspace_fragment' : 'encodings_fragment'}>
    }
  `);
function createWorker(self) {
  let matrices = null;
  let offset = 0;
  function sortSplats(view, hashed = false) {
    const vertexCount = matrices.length / 16;
    const threshold = -0.0001;
    let maxDepth = -Infinity;
    let minDepth = Infinity;
    const depthList = new Float32Array(vertexCount);
    const sizeList = new Int32Array(depthList.buffer);
    const validIndexList = new Int32Array(vertexCount);
    let validCount = 0;
    for (let i = 0; i < vertexCount; i++) {
      // Sign of depth is reversed
      const depth = view[0] * matrices[i * 16 + 12] + view[1] * matrices[i * 16 + 13] + view[2] * matrices[i * 16 + 14] + view[3];
      // Skip behind of camera and small, transparent splat
      if (hashed || depth < 0 && matrices[i * 16 + 15] > threshold * depth) {
        depthList[validCount] = depth;
        validIndexList[validCount] = i;
        validCount++;
        if (depth > maxDepth) maxDepth = depth;
        if (depth < minDepth) minDepth = depth;
      }
    }

    // This is a 16 bit single-pass counting sort
    const depthInv = (256 * 256 - 1) / (maxDepth - minDepth);
    const counts0 = new Uint32Array(256 * 256);
    for (let i = 0; i < validCount; i++) {
      sizeList[i] = (depthList[i] - minDepth) * depthInv | 0;
      counts0[sizeList[i]]++;
    }
    const starts0 = new Uint32Array(256 * 256);
    for (let i = 1; i < 256 * 256; i++) starts0[i] = starts0[i - 1] + counts0[i - 1];
    const depthIndex = new Uint32Array(validCount);
    for (let i = 0; i < validCount; i++) depthIndex[starts0[sizeList[i]]++] = validIndexList[i];
    return depthIndex;
  }
  self.onmessage = e => {
    if (e.data.method == 'push') {
      if (offset === 0) matrices = new Float32Array(e.data.length);
      const new_matrices = new Float32Array(e.data.matrices);
      matrices.set(new_matrices, offset);
      offset += new_matrices.length;
    } else if (e.data.method == 'sort') {
      if (matrices !== null) {
        const indices = sortSplats(new Float32Array(e.data.view), e.data.hashed);
        // @ts-ignore
        self.postMessage({
          indices,
          key: e.data.key
        }, [indices.buffer]);
      }
    }
  };
}
class SplatLoader extends THREE.Loader {
  constructor(...args) {
    super(...args);
    // WebGLRenderer, needs to be filled out!
    this.gl = null;
    // Default chunk size for lazy loading
    this.chunkSize = 25000;
  }
  load(url, onLoad, onProgress, onError) {
    const shared = {
      gl: this.gl,
      url: this.manager.resolveURL(url),
      worker: new Worker(URL.createObjectURL(new Blob(['(', createWorker.toString(), ')(self)'], {
        type: 'application/javascript'
      }))),
      manager: this.manager,
      update: (target, camera, hashed) => update(camera, shared, target, hashed),
      connect: target => connect(shared, target),
      loading: false,
      loaded: false,
      loadedVertexCount: 0,
      chunkSize: this.chunkSize,
      totalDownloadBytes: 0,
      numVertices: 0,
      rowLength: 3 * 4 + 3 * 4 + 4 + 4,
      maxVertexes: 0,
      bufferTextureWidth: 0,
      bufferTextureHeight: 0,
      stream: null,
      centerAndScaleData: null,
      covAndColorData: null,
      covAndColorTexture: null,
      centerAndScaleTexture: null,
      onProgress
    };
    load(shared).then(onLoad).catch(e => {
      onError == null || onError(e);
      shared.manager.itemError(shared.url);
    });
  }
}
async function load(shared) {
  shared.manager.itemStart(shared.url);
  const data = await fetch(shared.url);
  if (data.body === null) throw 'Failed to fetch file';
  let _totalDownloadBytes = data.headers.get('Content-Length');
  const totalDownloadBytes = _totalDownloadBytes ? parseInt(_totalDownloadBytes) : undefined;
  if (totalDownloadBytes == undefined) throw 'Failed to get content length';
  shared.stream = data.body.getReader();
  shared.totalDownloadBytes = totalDownloadBytes;
  shared.numVertices = Math.floor(shared.totalDownloadBytes / shared.rowLength);
  const context = shared.gl.getContext();
  let maxTextureSize = context.getParameter(context.MAX_TEXTURE_SIZE);
  shared.maxVertexes = maxTextureSize * maxTextureSize;
  if (shared.numVertices > shared.maxVertexes) shared.numVertices = shared.maxVertexes;
  shared.bufferTextureWidth = maxTextureSize;
  shared.bufferTextureHeight = Math.floor((shared.numVertices - 1) / maxTextureSize) + 1;
  shared.centerAndScaleData = new Float32Array(shared.bufferTextureWidth * shared.bufferTextureHeight * 4);
  shared.covAndColorData = new Uint32Array(shared.bufferTextureWidth * shared.bufferTextureHeight * 4);
  shared.centerAndScaleTexture = new THREE.DataTexture(shared.centerAndScaleData, shared.bufferTextureWidth, shared.bufferTextureHeight, THREE.RGBAFormat, THREE.FloatType);
  shared.centerAndScaleTexture.needsUpdate = true;
  shared.covAndColorTexture = new THREE.DataTexture(shared.covAndColorData, shared.bufferTextureWidth, shared.bufferTextureHeight, THREE.RGBAIntegerFormat, THREE.UnsignedIntType);
  shared.covAndColorTexture.internalFormat = 'RGBA32UI';
  shared.covAndColorTexture.needsUpdate = true;
  return shared;
}
async function lazyLoad(shared) {
  shared.loading = true;
  let bytesDownloaded = 0;
  let bytesProcessed = 0;
  const chunks = [];
  let lastReportedProgress = 0;
  const lengthComputable = shared.totalDownloadBytes !== 0;
  while (true) {
    try {
      const {
        value,
        done
      } = await shared.stream.read();
      if (done) break;
      bytesDownloaded += value.length;
      if (shared.totalDownloadBytes != undefined) {
        const percent = bytesDownloaded / shared.totalDownloadBytes * 100;
        if (shared.onProgress && percent - lastReportedProgress > 1) {
          const event = new ProgressEvent('progress', {
            lengthComputable,
            loaded: bytesDownloaded,
            total: shared.totalDownloadBytes
          });
          shared.onProgress(event);
          lastReportedProgress = percent;
        }
      }
      chunks.push(value);
      const bytesRemains = bytesDownloaded - bytesProcessed;
      if (shared.totalDownloadBytes != undefined && bytesRemains > shared.rowLength * shared.chunkSize) {
        let vertexCount = Math.floor(bytesRemains / shared.rowLength);
        const concatenatedChunksbuffer = new Uint8Array(bytesRemains);
        let offset = 0;
        for (const chunk of chunks) {
          concatenatedChunksbuffer.set(chunk, offset);
          offset += chunk.length;
        }
        chunks.length = 0;
        if (bytesRemains > vertexCount * shared.rowLength) {
          const extra_data = new Uint8Array(bytesRemains - vertexCount * shared.rowLength);
          extra_data.set(concatenatedChunksbuffer.subarray(bytesRemains - extra_data.length, bytesRemains), 0);
          chunks.push(extra_data);
        }
        const buffer = new Uint8Array(vertexCount * shared.rowLength);
        buffer.set(concatenatedChunksbuffer.subarray(0, buffer.byteLength), 0);
        const matrices = pushDataBuffer(shared, buffer.buffer, vertexCount);
        shared.worker.postMessage({
          method: 'push',
          src: shared.url,
          length: shared.numVertices * 16,
          matrices: matrices.buffer
        }, [matrices.buffer]);
        bytesProcessed += vertexCount * shared.rowLength;
        if (shared.onProgress) {
          const event = new ProgressEvent('progress', {
            lengthComputable,
            loaded: shared.totalDownloadBytes,
            total: shared.totalDownloadBytes
          });
          shared.onProgress(event);
        }
      }
    } catch (error) {
      console.error(error);
      break;
    }
  }
  if (bytesDownloaded - bytesProcessed > 0) {
    // Concatenate the chunks into a single Uint8Array
    let concatenatedChunks = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      concatenatedChunks.set(chunk, offset);
      offset += chunk.length;
    }
    let numVertices = Math.floor(concatenatedChunks.byteLength / shared.rowLength);
    const matrices = pushDataBuffer(shared, concatenatedChunks.buffer, numVertices);
    shared.worker.postMessage({
      method: 'push',
      src: shared.url,
      length: numVertices * 16,
      matrices: matrices.buffer
    }, [matrices.buffer]);
  }
  shared.loaded = true;
  shared.manager.itemEnd(shared.url);
}
function update(camera, shared, target, hashed) {
  camera.updateMatrixWorld();
  shared.gl.getCurrentViewport(target.viewport);
  // @ts-ignore
  target.material.viewport.x = target.viewport.z;
  // @ts-ignore
  target.material.viewport.y = target.viewport.w;
  target.material.focal = target.viewport.w / 2.0 * Math.abs(camera.projectionMatrix.elements[5]);
  if (target.ready) {
    if (hashed && target.sorted) return;
    target.ready = false;
    const view = new Float32Array([target.modelViewMatrix.elements[2], -target.modelViewMatrix.elements[6], target.modelViewMatrix.elements[10], target.modelViewMatrix.elements[14]]);
    shared.worker.postMessage({
      method: 'sort',
      src: shared.url,
      key: target.uuid,
      view: view.buffer,
      hashed
    }, [view.buffer]);
    if (hashed && shared.loaded) target.sorted = true;
  }
}
function connect(shared, target) {
  if (!shared.loading) lazyLoad(shared);
  target.ready = false;
  target.pm = new THREE.Matrix4();
  target.vm1 = new THREE.Matrix4();
  target.vm2 = new THREE.Matrix4();
  target.viewport = new THREE.Vector4();
  let splatIndexArray = new Uint32Array(shared.bufferTextureWidth * shared.bufferTextureHeight);
  const splatIndexes = new THREE.InstancedBufferAttribute(splatIndexArray, 1, false);
  splatIndexes.setUsage(THREE.DynamicDrawUsage);
  const geometry = target.geometry = new THREE.InstancedBufferGeometry();
  const positionsArray = new Float32Array(6 * 3);
  const positions = new THREE.BufferAttribute(positionsArray, 3);
  geometry.setAttribute('position', positions);
  positions.setXYZ(2, -2.0, 2.0, 0.0);
  positions.setXYZ(1, 2.0, 2.0, 0.0);
  positions.setXYZ(0, -2.0, -2.0, 0.0);
  positions.setXYZ(5, -2.0, -2.0, 0.0);
  positions.setXYZ(4, 2.0, 2.0, 0.0);
  positions.setXYZ(3, 2.0, -2.0, 0.0);
  positions.needsUpdate = true;
  geometry.setAttribute('splatIndex', splatIndexes);
  geometry.instanceCount = 1;
  function listener(e) {
    if (target && e.data.key === target.uuid) {
      let indexes = new Uint32Array(e.data.indices);
      // @ts-ignore
      geometry.attributes.splatIndex.set(indexes);
      geometry.attributes.splatIndex.needsUpdate = true;
      geometry.instanceCount = indexes.length;
      target.ready = true;
    }
  }
  shared.worker.addEventListener('message', listener);
  async function wait() {
    while (true) {
      const centerAndScaleTextureProperties = shared.gl.properties.get(shared.centerAndScaleTexture);
      const covAndColorTextureProperties = shared.gl.properties.get(shared.covAndColorTexture);
      if (centerAndScaleTextureProperties != null && centerAndScaleTextureProperties.__webglTexture && covAndColorTextureProperties != null && covAndColorTextureProperties.__webglTexture && shared.loadedVertexCount > 0) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    target.ready = true;
  }
  wait();
  return () => shared.worker.removeEventListener('message', listener);
}
function pushDataBuffer(shared, buffer, vertexCount) {
  const context = shared.gl.getContext();
  if (shared.loadedVertexCount + vertexCount > shared.maxVertexes) vertexCount = shared.maxVertexes - shared.loadedVertexCount;
  if (vertexCount <= 0) throw 'Failed to parse file';
  const u_buffer = new Uint8Array(buffer);
  const f_buffer = new Float32Array(buffer);
  const matrices = new Float32Array(vertexCount * 16);
  const covAndColorData_uint8 = new Uint8Array(shared.covAndColorData.buffer);
  const covAndColorData_int16 = new Int16Array(shared.covAndColorData.buffer);
  for (let i = 0; i < vertexCount; i++) {
    const quat = new THREE.Quaternion(-(u_buffer[32 * i + 28 + 1] - 128) / 128.0, (u_buffer[32 * i + 28 + 2] - 128) / 128.0, (u_buffer[32 * i + 28 + 3] - 128) / 128.0, -(u_buffer[32 * i + 28 + 0] - 128) / 128.0);
    quat.invert();
    const center = new THREE.Vector3(f_buffer[8 * i + 0], f_buffer[8 * i + 1], -f_buffer[8 * i + 2]);
    const scale = new THREE.Vector3(f_buffer[8 * i + 3 + 0], f_buffer[8 * i + 3 + 1], f_buffer[8 * i + 3 + 2]);
    const mtx = new THREE.Matrix4();
    mtx.makeRotationFromQuaternion(quat);
    mtx.transpose();
    mtx.scale(scale);
    const mtx_t = mtx.clone();
    mtx.transpose();
    mtx.premultiply(mtx_t);
    mtx.setPosition(center);
    const cov_indexes = [0, 1, 2, 5, 6, 10];
    let max_value = 0.0;
    for (let j = 0; j < cov_indexes.length; j++) if (Math.abs(mtx.elements[cov_indexes[j]]) > max_value) max_value = Math.abs(mtx.elements[cov_indexes[j]]);
    let destOffset = shared.loadedVertexCount * 4 + i * 4;
    shared.centerAndScaleData[destOffset + 0] = center.x;
    shared.centerAndScaleData[destOffset + 1] = -center.y;
    shared.centerAndScaleData[destOffset + 2] = center.z;
    shared.centerAndScaleData[destOffset + 3] = max_value / 32767.0;
    destOffset = shared.loadedVertexCount * 8 + i * 4 * 2;
    for (let j = 0; j < cov_indexes.length; j++) covAndColorData_int16[destOffset + j] = mtx.elements[cov_indexes[j]] * 32767.0 / max_value;

    // RGBA
    destOffset = shared.loadedVertexCount * 16 + (i * 4 + 3) * 4;
    const col = new THREE.Color(u_buffer[32 * i + 24 + 0] / 255, u_buffer[32 * i + 24 + 1] / 255, u_buffer[32 * i + 24 + 2] / 255);
    col.convertSRGBToLinear();
    covAndColorData_uint8[destOffset + 0] = col.r * 255;
    covAndColorData_uint8[destOffset + 1] = col.g * 255;
    covAndColorData_uint8[destOffset + 2] = col.b * 255;
    covAndColorData_uint8[destOffset + 3] = u_buffer[32 * i + 24 + 3];

    // Store scale and transparent to remove splat in sorting process
    mtx.elements[15] = Math.max(scale.x, scale.y, scale.z) * u_buffer[32 * i + 24 + 3] / 255.0;
    for (let j = 0; j < 16; j++) matrices[i * 16 + j] = mtx.elements[j];
  }
  while (vertexCount > 0) {
    let width = 0;
    let height = 0;
    const xoffset = shared.loadedVertexCount % shared.bufferTextureWidth;
    const yoffset = Math.floor(shared.loadedVertexCount / shared.bufferTextureWidth);
    if (shared.loadedVertexCount % shared.bufferTextureWidth != 0) {
      width = Math.min(shared.bufferTextureWidth, xoffset + vertexCount) - xoffset;
      height = 1;
    } else if (Math.floor(vertexCount / shared.bufferTextureWidth) > 0) {
      width = shared.bufferTextureWidth;
      height = Math.floor(vertexCount / shared.bufferTextureWidth);
    } else {
      width = vertexCount % shared.bufferTextureWidth;
      height = 1;
    }
    const centerAndScaleTextureProperties = shared.gl.properties.get(shared.centerAndScaleTexture);
    context.bindTexture(context.TEXTURE_2D, centerAndScaleTextureProperties.__webglTexture);
    context.texSubImage2D(context.TEXTURE_2D, 0, xoffset, yoffset, width, height, context.RGBA, context.FLOAT, shared.centerAndScaleData, shared.loadedVertexCount * 4);
    const covAndColorTextureProperties = shared.gl.properties.get(shared.covAndColorTexture);
    context.bindTexture(context.TEXTURE_2D, covAndColorTextureProperties.__webglTexture);
    context.texSubImage2D(context.TEXTURE_2D, 0, xoffset, yoffset, width, height,
    // @ts-ignore
    context.RGBA_INTEGER, context.UNSIGNED_INT, shared.covAndColorData, shared.loadedVertexCount * 4);
    shared.gl.resetState();
    shared.loadedVertexCount += width * height;
    vertexCount -= width * height;
  }
  return matrices;
}
function Splat({
  src,
  toneMapped = false,
  alphaTest = 0,
  alphaHash = false,
  chunkSize = 25000,
  ...props
}) {
  extend({
    SplatMaterial
  });
  const ref = React.useRef(null);
  const gl = useThree(state => state.gl);
  const camera = useThree(state => state.camera);

  // Shared state, globally memoized, the same url re-uses the same daza
  const shared = useLoader(SplatLoader, src, loader => {
    loader.gl = gl;
    loader.chunkSize = chunkSize;
  });

  // Listen to worker results, apply them to the target mesh
  React.useLayoutEffect(() => shared.connect(ref.current), [src]);
  // Update the worker
  useFrame(() => shared.update(ref.current, camera, alphaHash));
  return /*#__PURE__*/React.createElement("mesh", _extends({
    ref: ref,
    frustumCulled: false
  }, props), /*#__PURE__*/React.createElement("splatMaterial", {
    key: `${src}/${alphaTest}/${alphaHash}${SplatMaterial.key}`,
    transparent: !alphaHash,
    depthTest: true,
    alphaTest: alphaHash ? 0 : alphaTest,
    centerAndScaleTexture: shared.centerAndScaleTexture,
    covAndColorTexture: shared.covAndColorTexture,
    depthWrite: alphaHash ? true : alphaTest > 0,
    blending: alphaHash ? THREE.NormalBlending : THREE.CustomBlending,
    blendSrcAlpha: THREE.OneFactor,
    alphaHash: !!alphaHash,
    toneMapped: toneMapped
  }));
}

export { Splat };
