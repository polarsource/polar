## [3.0.6](https://github.com/MONOGRID/gainmap-js/compare/v3.0.5...v3.0.6) (2024-09-03)


### Bug Fixes

* remove LogLuv following threejs removal https://github.com/mrdoob/three.js/pull/29144 ([1df2154](https://github.com/MONOGRID/gainmap-js/commit/1df2154dce59aff39439eb4974c42b55eddc862b))

## [3.0.5](https://github.com/MONOGRID/gainmap-js/compare/v3.0.4...v3.0.5) (2024-04-03)


### Bug Fixes

* **package.json:** publint fixes so that package is correctly imported in next.js ([#36](https://github.com/MONOGRID/gainmap-js/issues/36)) ([490df10](https://github.com/MONOGRID/gainmap-js/commit/490df10f401a82267595dd9e161cc6a0bbce3d94))

## [3.0.4](https://github.com/MONOGRID/gainmap-js/compare/v3.0.3...v3.0.4) (2024-04-02)


### Bug Fixes

* adds setRenderer on LoaderBase ([#34](https://github.com/MONOGRID/gainmap-js/issues/34)) ([18ad0ec](https://github.com/MONOGRID/gainmap-js/commit/18ad0eca49d95685b7f78fc4137f4aaf1338e782))

## [3.0.3](https://github.com/MONOGRID/gainmap-js/compare/v3.0.2...v3.0.3) (2024-02-09)


### Bug Fixes

* **libultrahdr-wasm:** encoding of odd sized images ([#31](https://github.com/MONOGRID/gainmap-js/issues/31)) ([efd52c3](https://github.com/MONOGRID/gainmap-js/commit/efd52c385387d2575c161e243b07369100e8e349))

## [3.0.2](https://github.com/MONOGRID/gainmap-js/compare/v3.0.1...v3.0.2) (2024-01-31)


### Bug Fixes

* **encode:** encodes a valid image when an invalid tonemapping value was provided as input ([94cec23](https://github.com/MONOGRID/gainmap-js/commit/94cec2363aa0dcb3cc46fca048c68ed7e555ebd0))

## [3.0.1](https://github.com/MONOGRID/gainmap-js/compare/v3.0.0...v3.0.1) (2023-12-03)


### Bug Fixes

* **encode:**  hdrCapacityMax correctly computed in output metadata ([f5f2215](https://github.com/MONOGRID/gainmap-js/commit/f5f22152eb236831cb9f23646445e6459be18285))
* **encode:** findTextureMinMax correctly finds min values in textures ([fd94680](https://github.com/MONOGRID/gainmap-js/commit/fd94680a76fdb04b5aa85b4210f3aec21b45a727))

# [3.0.0](https://github.com/MONOGRID/gainmap-js/compare/v2.0.7...v3.0.0) (2023-11-29)


### Bug Fixes

* **loaders:** properly catches render errors and calls onError callback ([b9bcdd1](https://github.com/MONOGRID/gainmap-js/commit/b9bcdd127576fa61c6ee92c876f4845cd80b4d34)), closes [#16](https://github.com/MONOGRID/gainmap-js/issues/16)


### Features

* **core:** disables default mipmap generation, enables user to specify renderTarget (and toDataTexture) options ([147d278](https://github.com/MONOGRID/gainmap-js/commit/147d2783224cb0a2039d762abf4e4b972b0e86da)), closes [#14](https://github.com/MONOGRID/gainmap-js/issues/14) [#15](https://github.com/MONOGRID/gainmap-js/issues/15)


### BREAKING CHANGES

* **core:** `generateMipmaps` is no longer `true` by default, both `minFilter` is  no longer `LinearMipMapLinearFilter` by default but `LinearFilter`, `wrapS` and `warpT` are no longer `RepeatWrapping` by default but `ClampToEdgeWrapping`

## [2.0.7](https://github.com/MONOGRID/gainmap-js/compare/v2.0.6...v2.0.7) (2023-11-23)


### Bug Fixes

* **core:** QuadRenderer dispose method now properly disposes of its internal resources ([#13](https://github.com/MONOGRID/gainmap-js/issues/13)) ([8e4473d](https://github.com/MONOGRID/gainmap-js/commit/8e4473da77732080de24f98dd271fecda06f9e53))
* **HDRJPGLoader:** renders (and returns) an SDR image when provided with a normal jpeg file ([#12](https://github.com/MONOGRID/gainmap-js/issues/12)) ([5222151](https://github.com/MONOGRID/gainmap-js/commit/5222151e6b5c95df79f1c4085cf36f30bd9c2dc4))

## [2.0.6](https://github.com/MONOGRID/gainmap-js/compare/v2.0.5...v2.0.6) (2023-11-20)


### Bug Fixes

* **decode:** changes usage of `NoColorSpace` to `LinearSRGBColorSpace` ([587dc03](https://github.com/MONOGRID/gainmap-js/commit/587dc0377876533b18b506516d8757e04e830c62))
* **loaders:** fixes LoadingManager `onLoad` actually waiting for gainmaps to be generated ([77170f5](https://github.com/MONOGRID/gainmap-js/commit/77170f57c5ad277d3e97d1236ab93a29106c4a99))

## [2.0.5](https://github.com/MONOGRID/gainmap-js/compare/v2.0.4...v2.0.5) (2023-11-16)


### Bug Fixes

* **jpegrloader:** rename JPEGRLoader to HDRJPEGLoader, old name kept for compatibility ([ac6e386](https://github.com/MONOGRID/gainmap-js/commit/ac6e38610886b7adec5806a7ad301bff1ec00d62))

## [2.0.4](https://github.com/MONOGRID/gainmap-js/compare/v2.0.3...v2.0.4) (2023-11-15)


### Bug Fixes

* **decode:** clamp max values in the decode shader to min/max half float ([96986be](https://github.com/MONOGRID/gainmap-js/commit/96986be23dd95825d19fac3b3de520d59d8ad936))

## [2.0.3](https://github.com/MONOGRID/gainmap-js/compare/v2.0.2...v2.0.3) (2023-11-15)


### Bug Fixes

* **gainmaploader:** fix GainMapLoader progress handler not being calculated correctly ([a8e556a](https://github.com/MONOGRID/gainmap-js/commit/a8e556ab1d465a9bd705960d175464cf8d434ea1))

## [2.0.2](https://github.com/MONOGRID/gainmap-js/compare/v2.0.1...v2.0.2) (2023-11-14)


### Bug Fixes

* **decode:** improves compatibility with browsers with no createImageBitmap ([12c7609](https://github.com/MONOGRID/gainmap-js/commit/12c7609ee815a460f95419aab328b412e759f012))
* **decoder:** fix bug when using decodeResult.renderTarget.texture as source for PMREMGenerator ([4ebb983](https://github.com/MONOGRID/gainmap-js/commit/4ebb983d5bbc7f524e4b1231f630e3714cf1f870))

## [2.0.1](https://github.com/MONOGRID/gainmap-js/compare/v2.0.0...v2.0.1) (2023-11-14)


### Bug Fixes

* **decode:** implements proper feature testing for QuadRenderer.toArray ([20109ad](https://github.com/MONOGRID/gainmap-js/commit/20109ad31977124c1169f096e8ccd36628599f89))

# [2.0.0](https://github.com/MONOGRID/gainmap-js/compare/v1.1.1...v2.0.0) (2023-11-13)


### Features

* removes libultrahdr wasm from the decoding part of the library, allows users to load JPEGR files using pure js ([#9](https://github.com/MONOGRID/gainmap-js/issues/9)) ([3ad16f9](https://github.com/MONOGRID/gainmap-js/commit/3ad16f97fec6040fdfdfb4cd5e71b1ac8e504e28))


### BREAKING CHANGES

* The encoder portion of the library has been separated and moved to `@monogrid/gainmap-js/encode`, in order to save file size on user's bundles, all encoding functions must now be imported with that path.

`JPEGRLoader` has been moved from `@monogrid/gainmap-js/libultrahdr` to `@monogrid/gainmap-js` because it now uses a pure js approach

## [1.1.1](https://github.com/MONOGRID/gainmap-js/compare/v1.1.0...v1.1.1) (2023-11-09)


### Bug Fixes

* fixes Firefox Compatibility ([1cec657](https://github.com/MONOGRID/gainmap-js/commit/1cec65708127b6fd064277f4f923fc0f65610fa2))
* **libultrahdr:** fixes circular dependency between JPEGRLoader and libultrahdr ([f30f786](https://github.com/MONOGRID/gainmap-js/commit/f30f7865fb27a601635168b8a104a9935653e758))

# [1.1.0](https://github.com/MONOGRID/gainmap-js/compare/v1.0.2...v1.1.0) (2023-11-06)


### Features

* **decode:** adds threejs loaders ([b32f02a](https://github.com/MONOGRID/gainmap-js/commit/b32f02a09d20fbd9d17b35c65cf4dba8aafc9ed5))

## [1.0.2](https://github.com/MONOGRID/gainmap-js/compare/v1.0.1...v1.0.2) (2023-11-03)


### Bug Fixes

* **release:** add publishConfig to package.json ([cffff0b](https://github.com/MONOGRID/gainmap-js/commit/cffff0b31050ab54040922748b82d97e6aa820a3))

## [1.0.1](https://github.com/MONOGRID/gainmap-js/compare/v1.0.0...v1.0.1) (2023-11-03)


### Bug Fixes

* **release:** scoped package for NPM publishing ([0e30758](https://github.com/MONOGRID/gainmap-js/commit/0e307589e51dd05e160062f2ae78fc746cbdf5aa))

# 1.0.0 (2023-11-03)

First Release
