# gainmap-js
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FMONOGRID%2Fgainmap-js.svg?type=shield)](https://app.fossa.com/projects/git%2Bgithub.com%2FMONOGRID%2Fgainmap-js?ref=badge_shield)

A Javascript (TypeScript) Encoder/Decoder Implementation of Adobe's Gain Map Technology for storing HDR Images using an SDR Image + a "Gain map"

> :warning: This library **is primarily intended** for encoding and decoding gain map images for the [three.js](https://github.com/mrdoob/three.js/) 3D Library
>
> It can be used for general encode/decode of gain maps but it depends on the three.js library which, in itself, is quite heavy if you only use it to encode/decode gain maps.

## Live Demo

https://monogrid.github.io/gainmap-js/

Compares loading:
 1. a `JPEG` file with embedded gain map data
 2. a `webp` sdr file + a `webp` gain map + metadata JSON
 3. a comparable size `.hdr` file for comparison

## [Free online encoder](https://gainmap-creator.monogrid.com)

Use it to convert `.hdr` and `.exr` files into gain maps. It's free and the whole process happens in your browser.

## Installing
```bash
$ npm install @monogrid/gainmap-js three
```

## What is a Gain map?

[See here](https://gregbenzphotography.com/hdr-images/jpg-hdr-gain-maps-in-adobe-camera-raw/) for a detailed explanation, here are some relevant parts:

> A gain map is a single file with a second pseudo-image embedded in it to create an optimized result for a specific monitor. It can be used to generate the HDR version (which looks dramatically better where supported), the SDR version (without tone mapping to ensures great quality), or anything in between (to better support less capable HDR displays).

> Gain maps are not a new type of file, but rather a technology which can be embedded into a variety of image formats. There are reference specs already for the JPG, AVIF, JXL, and HEIF file formats. JPG is especially notable as it could not properly support HDR without gain maps and it offers a very useful bridge to the future (i.e. highly compatible with today’s software).

> A gain map includes:
>
> * A **base (default) image**. This can be an SDR or an HDR image (JPG gain maps are always encoded with SDR as the base). If the browser or viewing software does not understand gain maps, it will just the treat file as if it were just the base image.
> * The **gain map**. This is a secondary “image” embedded in the file. It is not a real image, but rather contains data to convert each pixel from the base image into the other (SDR or HDR) version of the image.
>* Gain map **metadata**. This tells the browser how the gain map is encoded as well as critical information to optimize rendering on any display.

Please note that Google [is adopting the gain map technology in Android 14](https://support.google.com/photos/answer/14159275) but its naming of the technology refers to it as **Ultra HDR Image Format** and a JPEG file with embedded gain map is [apparently called JPEGR](https://github.com/google/libultrahdr/blob/3a3a752a5da0b2304b1b6de0ef383bbe41256a67/lib/jpegr.h#L28C16-L28C21) in their terminology, we call it `HDRJPEG` for the moment.

## API

Refer to the [WIKI](https://github.com/MONOGRID/gainmap-js/wiki) for detailed documentation about the API.

## Examples

### Decoding

The main use case of this library is to decode a JPEG file that contains gain map data
and use it instead of a traditional `.exr` or `.hdr` image.


### Using a single JPEG with embedded Gain map Metadata

This approach lets you load a single file with an embedded Gain Map.

The advantage is to have a single file to load.

The disadvantages are:
 * No WEBP compression
 * The JPEG cannot be manipulated in Photoshop, GIMP, or any other software that does not support the gain map technology (no photo editing software supports it at the time of writing 06-11-2023).
 * Photo sharing websites and/or services (i.e. sharing with Slack) will likely strip the Gain map metadata and the HDR information will be lost, leaving you with only the SDR Representation.

```ts
import { HDRJPGLoader } from '@monogrid/gainmap-js'
import {
  EquirectangularReflectionMapping,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer
} from 'three'

const renderer = new WebGLRenderer()

const loader = new HDRJPGLoader(renderer)

const result = await loader.loadAsync('gainmap.jpeg')
// `result` can be used to populate a Texture

const scene = new Scene()
const mesh = new Mesh(
  new PlaneGeometry(),
  new MeshBasicMaterial({ map: result.renderTarget.texture })
)
scene.add(mesh)
renderer.render(scene, new PerspectiveCamera())

// Starting from three.js r159
// `result.renderTarget.texture` can
// also be used as Equirectangular scene background
//
// it was previously needed to convert it
// to a DataTexture with `result.toDataTexture()`
scene.background = result.renderTarget.texture
scene.background.mapping = EquirectangularReflectionMapping

// result must be manually disposed
// when you are done using it
result.dispose()
```

### Using separate files

Using separate files will get rid of the limitations of using a single JPEG file but it will force to use three separate files

1. An SDR Representation file
2. A Gainmap file
3. A JSON containing the gainmap metadata used for decoding


```ts
import { GainMapLoader } from '@monogrid/gainmap-js'
import {
  EquirectangularReflectionMapping,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer
} from 'three'

const renderer = new WebGLRenderer()

const loader = new GainMapLoader(renderer)

const result = await loader.loadAsync(['sdr.jpeg', 'gainmap.jpeg', 'metadata.json'])
// `result` can be used to populate a Texture

const scene = new Scene()
const mesh = new Mesh(
  new PlaneGeometry(),
  new MeshBasicMaterial({ map: result.renderTarget.texture })
)
scene.add(mesh)
renderer.render(scene, new PerspectiveCamera())

// Starting from three.js r159
// `result.renderTarget.texture` can
// also be used as Equirectangular scene background
//
// it was previously needed to convert it
// to a DataTexture with `result.toDataTexture()`
scene.background = result.renderTarget.texture
scene.background.mapping = EquirectangularReflectionMapping

// result must be manually disposed
// when you are done using it
result.dispose()
```

### Encoding

Encoding a Gain map starting from an EXR file.

This is generally not useful in a `three.js` site but this library exposes methods
that allow to encode an `.exr` or `hdr` file into a `jpeg` with an embedded gain map.

```ts
import { compress, encode, findTextureMinMax } from '@monogrid/gainmap-js/encode'
import { encodeJPEGMetadata } from '@monogrid/gainmap-js/libultrahdr'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'

// load an HDR file
const loader = new EXRLoader()
const image = await loader.loadAsync('image.exr')

// find RAW RGB Max value of a texture
const textureMax = findTextureMinMax(image)

// Encode the gainmap
const encodingResult = encode({
  image,
  // this will encode the full HDR range
  maxContentBoost: Math.max.apply(this, textureMax)
})

// obtain the RAW RGBA SDR buffer and create an ImageData
const sdrImageData = new ImageData(encodingResult.sdr.toArray(), encodingResult.sdr.width, encodingResult.sdr.height)
// obtain the RAW RGBA Gain map buffer and create an ImageData
const gainMapImageData = new ImageData(encodingResult.gainMap.toArray(), encodingResult.gainMap.width, encodingResult.gainMap.height)

// parallel compress the RAW buffers into the specified mimeType
const mimeType = 'image/jpeg'
const quality = 0.9

const [sdr, gainMap] = await Promise.all([
  compress({
    source: sdrImageData,
    mimeType,
    quality,
    flipY: true // output needs to be flipped
  }),
  compress({
    source: gainMapImageData,
    mimeType,
    quality,
    flipY: true // output needs to be flipped
  })
])

// obtain the metadata which will be embedded into
// and XMP tag inside the final JPEG file
const metadata = encodingResult.getMetadata()

// embed the compressed images + metadata into a single
// JPEG file
const jpeg = await encodeJPEGMetadata({
  ...encodingResult,
  ...metadata,
  sdr,
  gainMap
})

// `jpeg` will be an `Uint8Array` which can be saved somewhere

// encoder must be manually disposed
// when no longer needed
encodingResult.gainMap.dispose()
encodingResult.sdr.dispose()

```

## Libultrahdr in Vite

If you import `@monogrid/gainmap-js/libultrahdr`
You will need to exclude it from Vite optimizations.

```js
// vite.config.js

module.exports = defineConfig({
  ...
  optimizeDeps: {
    exclude: ['@monogrid/gainmap-js/libultrahdr']
  },
  ...
})
```


## Building with full encoding support (libultrahdr-wasm)

Clone the repository with git submodules recursively:
```bash
$ git clone --recurse-submodules git@github.com:MONOGRID/gainmap-js.git
```

Proceed to build the libultrahdr-wasm module following the [documentation found here](https://github.com/MONOGRID/libultrahdr-wasm#building), here's a quick summary

```bash
$ cd gainmap-js/libultrahdr-wasm/
```
Create a meson "cross compile config" named em.txt and place the following content inside:
```ini
[binaries]
c = 'emcc'
cpp = 'em++'
ar = 'emar'
nm = 'emnm'

[host_machine]
system = 'emscripten'
cpu_family = 'wasm32'
cpu = 'wasm32'
endian = 'little'
```
Then execute

```bash
$ meson setup build --cross-file=em.txt
$ meson compile -C build
```

After compiling the WASM, head back to the main repository

```bash
$ cd ..
$ npm i
$ npm run build
```

## Building with no encoding support (requires no wasm)

> :warning: Building the library with decode only capabilities will not allow to run playwright e2e tests with `npm run test`
> this method should only be used by people who would like to customize the "decoding" part of the library but are unable to build the WASM module for some reason (emscripten can be tricky sometimes, I've been there)

Clone the repository normally:
```bash
$ git clone git@github.com:MONOGRID/gainmap-js.git
$ cd gainmap-js
$ npm i
```

build with
```bash
$ npm run build --config rollup.config.decodeonly.mjs
```


## References

* [Adobe Gainmap Specification](https://helpx.adobe.com/camera-raw/using/gain-map.html)
* [Ultra HDR Image Format v1.0](https://developer.android.com/guide/topics/media/platform/hdr-image-format)


## License
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2FMONOGRID%2Fgainmap-js.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2FMONOGRID%2Fgainmap-js?ref=badge_large)
