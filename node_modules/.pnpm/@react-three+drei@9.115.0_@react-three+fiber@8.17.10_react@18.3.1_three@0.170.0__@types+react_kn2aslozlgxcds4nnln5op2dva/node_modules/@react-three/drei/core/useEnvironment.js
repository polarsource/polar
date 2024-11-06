import { useThree, useLoader } from '@react-three/fiber';
import { CubeReflectionMapping, EquirectangularReflectionMapping, CubeTextureLoader } from 'three';
import { RGBELoader, EXRLoader } from 'three-stdlib';
import { HDRJPGLoader, GainMapLoader } from '@monogrid/gainmap-js';
import { presetsObj } from '../helpers/environment-assets.js';
import { sRGBEncoding, LinearEncoding } from '../helpers/deprecated.js';
import { useLayoutEffect } from 'react';

const CUBEMAP_ROOT = 'https://raw.githack.com/pmndrs/drei-assets/456060a26bbeb8fdf79326f224b6d99b8bcce736/hdri/';
const isArray = arr => Array.isArray(arr);
const defaultFiles = ['/px.png', '/nx.png', '/py.png', '/ny.png', '/pz.png', '/nz.png'];
function useEnvironment({
  files = defaultFiles,
  path = '',
  preset = undefined,
  encoding = undefined,
  extensions
} = {}) {
  let loader = null;
  let multiFile = false;
  if (preset) {
    validatePreset(preset);
    files = presetsObj[preset];
    path = CUBEMAP_ROOT;
  }

  // Everything else
  multiFile = isArray(files);
  const {
    extension,
    isCubemap
  } = getExtension(files);
  loader = getLoader(extension);
  if (!loader) throw new Error('useEnvironment: Unrecognized file extension: ' + files);
  const gl = useThree(state => state.gl);
  useLayoutEffect(() => {
    // Only required for gainmap
    if (extension !== 'webp' && extension !== 'jpg' && extension !== 'jpeg') return;
    function clearGainmapTexture() {
      useLoader.clear(
      // @ts-expect-error
      loader, multiFile ? [files] : files);
    }
    gl.domElement.addEventListener('webglcontextlost', clearGainmapTexture, {
      once: true
    });
  }, [files, gl.domElement]);
  const loaderResult = useLoader(
  // @ts-expect-error
  loader, multiFile ? [files] : files, loader => {
    // Gainmap requires a renderer
    if (extension === 'webp' || extension === 'jpg' || extension === 'jpeg') {
      loader.setRenderer(gl);
    }
    loader.setPath == null || loader.setPath(path);
    if (extensions) extensions(loader);
  });
  let texture = multiFile ?
  // @ts-ignore
  loaderResult[0] : loaderResult;
  if (extension === 'jpg' || extension === 'jpeg' || extension === 'webp') {
    var _renderTarget;
    texture = (_renderTarget = texture.renderTarget) == null ? void 0 : _renderTarget.texture;
  }
  texture.mapping = isCubemap ? CubeReflectionMapping : EquirectangularReflectionMapping;
  if ('colorSpace' in texture) texture.colorSpace = (encoding !== null && encoding !== void 0 ? encoding : isCubemap) ? 'srgb' : 'srgb-linear';else texture.encoding = (encoding !== null && encoding !== void 0 ? encoding : isCubemap) ? sRGBEncoding : LinearEncoding;
  return texture;
}
const preloadDefaultOptions = {
  files: defaultFiles,
  path: '',
  preset: undefined,
  extensions: undefined
};
useEnvironment.preload = preloadOptions => {
  const options = {
    ...preloadDefaultOptions,
    ...preloadOptions
  };
  let {
    files,
    path = ''
  } = options;
  const {
    preset,
    extensions
  } = options;
  if (preset) {
    validatePreset(preset);
    files = presetsObj[preset];
    path = CUBEMAP_ROOT;
  }
  const {
    extension
  } = getExtension(files);
  if (extension === 'webp' || extension === 'jpg' || extension === 'jpeg') {
    throw new Error('useEnvironment: Preloading gainmaps is not supported');
  }
  const loader = getLoader(extension);
  if (!loader) throw new Error('useEnvironment: Unrecognized file extension: ' + files);
  useLoader.preload(
  // @ts-expect-error
  loader, isArray(files) ? [files] : files, loader => {
    loader.setPath == null || loader.setPath(path);
    if (extensions) extensions(loader);
  });
};
const clearDefaultOptins = {
  files: defaultFiles,
  preset: undefined
};
useEnvironment.clear = clearOptions => {
  const options = {
    ...clearDefaultOptins,
    ...clearOptions
  };
  let {
    files
  } = options;
  const {
    preset
  } = options;
  if (preset) {
    validatePreset(preset);
    files = presetsObj[preset];
  }
  const {
    extension
  } = getExtension(files);
  const loader = getLoader(extension);
  if (!loader) throw new Error('useEnvironment: Unrecognized file extension: ' + files);
  useLoader.clear(
  // @ts-expect-error
  loader, isArray(files) ? [files] : files);
};
function validatePreset(preset) {
  if (!(preset in presetsObj)) throw new Error('Preset must be one of: ' + Object.keys(presetsObj).join(', '));
}
function getExtension(files) {
  var _firstEntry$split$pop;
  const isCubemap = isArray(files) && files.length === 6;
  const isGainmap = isArray(files) && files.length === 3 && files.some(file => file.endsWith('json'));
  const firstEntry = isArray(files) ? files[0] : files;

  // Everything else
  const extension = isCubemap ? 'cube' : isGainmap ? 'webp' : firstEntry.startsWith('data:application/exr') ? 'exr' : firstEntry.startsWith('data:application/hdr') ? 'hdr' : firstEntry.startsWith('data:image/jpeg') ? 'jpg' : (_firstEntry$split$pop = firstEntry.split('.').pop()) == null || (_firstEntry$split$pop = _firstEntry$split$pop.split('?')) == null || (_firstEntry$split$pop = _firstEntry$split$pop.shift()) == null ? void 0 : _firstEntry$split$pop.toLowerCase();
  return {
    extension,
    isCubemap,
    isGainmap
  };
}
function getLoader(extension) {
  const loader = extension === 'cube' ? CubeTextureLoader : extension === 'hdr' ? RGBELoader : extension === 'exr' ? EXRLoader : extension === 'jpg' || extension === 'jpeg' ? HDRJPGLoader : extension === 'webp' ? GainMapLoader : null;
  return loader;
}

export { useEnvironment };
