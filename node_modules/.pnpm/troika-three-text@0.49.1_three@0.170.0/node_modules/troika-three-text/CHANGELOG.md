# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [0.49.1](https://github.com/protectwise/troika/compare/v0.49.0...v0.49.1) (2024-04-09)


### Bug Fixes

* **troika-three-text:** Fix anchorY bottom-baseline. Closes [#309](https://github.com/protectwise/troika/issues/309) ([3457b03](https://github.com/protectwise/troika/commit/3457b03af5220886b4fd0534a1d44bdc5f837851))





# [0.49.0](https://github.com/protectwise/troika/compare/v0.48.1...v0.49.0) (2023-10-08)


### Bug Fixes

* support opentype ccmp substitutions (glyph compositions) ([1e358b2](https://github.com/protectwise/troika/commit/1e358b23971914cd1a4d55e936dfe035dced57c1))


### Features

* add support for positioning of diacritic marks (e.g. Thai) ([301c34c](https://github.com/protectwise/troika/commit/301c34c3341b83eb95afc308bd796bcccb2f5ccd))





## [0.48.1](https://github.com/protectwise/troika/compare/v0.48.0...v0.48.1) (2023-10-02)


### Bug Fixes

* improve font resolution in CJK ([8d9ac64](https://github.com/protectwise/troika/commit/8d9ac641215c198cdaf1f55185814e061f8d0d6e))
* korean/japanese fonts now resolve correctly ([207a5e0](https://github.com/protectwise/troika/commit/207a5e03d8881ce26e71827b77baea6c2e39aa04))





# [0.48.0](https://github.com/protectwise/troika/compare/v0.47.2...v0.48.0) (2023-09-09)


### Features

* **troika-three-text:** add fallback font loading for full Unicode support ([#279](https://github.com/protectwise/troika/issues/279)) ([6fb8061](https://github.com/protectwise/troika/commit/6fb806145f79d7a36e79a35a006b4601535b3827)), closes [#13](https://github.com/protectwise/troika/issues/13) [#65](https://github.com/protectwise/troika/issues/65)







## [0.47.2](https://github.com/protectwise/troika/compare/v0.47.1...v0.47.2) (2023-05-15)

**Note:** Version bump only for package troika-three-text





## [0.47.1](https://github.com/protectwise/troika/compare/v0.47.0...v0.47.1) (2022-12-15)


### Bug Fixes

* **troika-three-text:** update Typr.ts to get kerning fix ([#228](https://github.com/protectwise/troika/issues/228)) ([a45db5d](https://github.com/protectwise/troika/commit/a45db5ddddcba35c9358c3014aff79fd80b30ae1))





# [0.47.0](https://github.com/protectwise/troika/compare/v0.46.3...v0.47.0) (2022-12-15)


### Bug Fixes

* **troika-three-text:** include lineGap value from the font in 'normal' line-height calculation ([c278118](https://github.com/protectwise/troika/commit/c2781182ad897a444f9502031a9626b703e85050))
* **troika-three-text:** remove IIFEs for tree-shaking ([#224](https://github.com/protectwise/troika/issues/224)) ([2e688f0](https://github.com/protectwise/troika/commit/2e688f0248296fee46e16f58a5de7b963a4cb73b))
* **troika-three-text:** update Typr to fix doubled kerning in some fonts ([#196](https://github.com/protectwise/troika/issues/196)) ([1fab9a2](https://github.com/protectwise/troika/commit/1fab9a2ce739a1f26c36b737a499075a439f8980))
* **troika-three-text:** use sTypoAscender/Descender from OS/2 font table if available ([f5c244c](https://github.com/protectwise/troika/commit/f5c244c92f9ede541b1206744aa1c7e1ff6711fc))
* **troika-three-text:** work around Safari<15 bug using SDF canvas as a texture ([#199](https://github.com/protectwise/troika/issues/199)) ([fca9aae](https://github.com/protectwise/troika/commit/fca9aae20e7b67cbd7ac3669dd91257ec84f1997))


### Features

* raise three min version to r125 and fix BufferGeometry references ([#225](https://github.com/protectwise/troika/issues/225)) ([f2ef803](https://github.com/protectwise/troika/commit/f2ef803db7ab3d9d03de2719a2781c1c3f5122cf))
* **troika-three-text:** add 'top-cap' and 'top-ex' as keywords for anchorY ([#193](https://github.com/protectwise/troika/issues/193)) ([c6a10ae](https://github.com/protectwise/troika/commit/c6a10ae30837d26505d5614b8e15ab49f2ad4625))
* **troika-three-text:** include capHeight and xHeight font metrics in textRenderInfo ([3459fd5](https://github.com/protectwise/troika/commit/3459fd540925d7aebad48c70c28e1e0a9b4195f0))
* **troika-three-text:** remove deprecated totalBounds/totalBlockSize properties from textRenderInfo ([2b87308](https://github.com/protectwise/troika/commit/2b87308f8fd02552fb86fdcc81a8e949de8e5989))
* remove custom Thenable polyfill in favor of native promises ([7af402e](https://github.com/protectwise/troika/commit/7af402e254675ca2fc182467a65d2d4f860845e4))
* **troika-three-text:** remove long-deprecated `anchor` array property ([752e302](https://github.com/protectwise/troika/commit/752e3025cec4176aadaab2a3ca475b3fd49d572e))





## [0.46.3](https://github.com/protectwise/troika/compare/v0.46.2...v0.46.3) (2022-03-11)


### Bug Fixes

* **troika-three-text:** update Typr to fix doubled kerning in some fonts ([#196](https://github.com/protectwise/troika/issues/196)) ([080119a](https://github.com/protectwise/troika/commit/080119a10797024f3bc82cb37f614c1c90027be6))





## [0.46.2](https://github.com/protectwise/troika/compare/v0.46.1...v0.46.2) (2022-03-06)


### Bug Fixes

* **troika-three-text:** fix SDF texture resizing in Three r136+ ([0fab679](https://github.com/protectwise/troika/commit/0fab679b0d547a67fff10cb0a84c17e856cf4349))





## [0.46.1](https://github.com/protectwise/troika/compare/v0.46.0...v0.46.1) (2022-03-05)


### Bug Fixes

* remove console.log ([3518689](https://github.com/protectwise/troika/commit/3518689f97f7d02236248cc547b703cdbc97a1e2))





# [0.46.0](https://github.com/protectwise/troika/compare/v0.45.0...v0.46.0) (2022-03-05)


### Features

* **troika-three-text:** add a `gpuAccelerateSDF` property for opting out of webgl sdf generation ([d436ffd](https://github.com/protectwise/troika/commit/d436ffd5063747e2e4d453240b702b174f91268d))
* **troika-three-text:** integrate webgl-sdf-generator for GPU-accelerated SDF generation ([b5c9138](https://github.com/protectwise/troika/commit/b5c913882daf480d18def77927e0dc70add082df))





# [0.45.0](https://github.com/protectwise/troika/compare/v0.44.0...v0.45.0) (2022-01-02)


### Features

* **troika-three-text:** SDFs for all fonts are now stored in the same texture ([7e871f7](https://github.com/protectwise/troika/commit/7e871f77c17dbbb68ca5c2240f569d4b102031f0))


### Performance Improvements

* **troika-three-text:** avoid extra draw call on double sided materials as of Three r130 ([6222ef3](https://github.com/protectwise/troika/commit/6222ef300ac364dcb0bb099a7469622e9287651e))
* **troika-three-text:** make the glyphColors buffer transferable ([c8c92fa](https://github.com/protectwise/troika/commit/c8c92faa70a8ad0fa08cadf38f8e4d4d2e933c10))





# [0.44.0](https://github.com/protectwise/troika/compare/v0.43.1-alpha.0...v0.44.0) (2021-11-14)


### Bug Fixes

* **troika-three-text:** fill in missing caret positions when the final glyph is a ligature - [#165](https://github.com/protectwise/troika/issues/165) ([ad2eda6](https://github.com/protectwise/troika/commit/ad2eda657a65fc01511daf52c1cfb7ccac2a03b0))





## [0.43.1-alpha.0](https://github.com/protectwise/troika/compare/v0.43.0...v0.43.1-alpha.0) (2021-10-24)


### Bug Fixes

* **troika-three-text:** fix font parsing failures in iOS Safari ([a542b42](https://github.com/protectwise/troika/commit/a542b42f0cc198fe2e9d46e4840fb8984279034b))





# [0.43.0](https://github.com/protectwise/troika/compare/v0.42.0...v0.43.0) (2021-09-20)


### Features

* **troika-three-text:** allow line wrapping after some common non-whitespace chars like hyphens ([1b20e34](https://github.com/protectwise/troika/commit/1b20e34e13fd6de7aa8257b8e50f0db671e4c964)), closes [#136](https://github.com/protectwise/troika/issues/136)


### Performance Improvements

* **troika-three-text:** parallelize SDF generation with multiple worker threads ([c2bf886](https://github.com/protectwise/troika/commit/c2bf886f280ca1c587bc3ae80a41d30ce8cb6dce))






# [0.42.0](https://github.com/protectwise/troika/compare/v0.41.2...v0.42.0) (2021-05-17)


### Bug Fixes

* add three to peerDependencies in all leaf packages ([0a11ab6](https://github.com/protectwise/troika/commit/0a11ab6ddff13b3ebd0f1f2463e0cfed17b3f5fa))


### Features

* open up 'three' peer dependency to include future versions ([d4a5b23](https://github.com/protectwise/troika/commit/d4a5b2376fffb3681750761f757b684ab798315a))





## [0.41.2](https://github.com/protectwise/troika/compare/v0.41.1...v0.41.2) (2021-05-05)


### Bug Fixes

* update bidi-js for its ES5 build files ([49ce5f2](https://github.com/protectwise/troika/commit/49ce5f2244e8a108f1c07fe32b9e8ce77f4afebb))





## [0.41.1](https://github.com/protectwise/troika/compare/v0.41.0...v0.41.1) (2021-04-26)


### Bug Fixes

* update bidi-js for fix removing type:module from package.json ([394c371](https://github.com/protectwise/troika/commit/394c37117042c28f6245aa3d1aa9a180ff8250bf))





# [0.41.0](https://github.com/protectwise/troika/compare/v0.40.0...v0.41.0) (2021-04-19)


### Bug Fixes

* **troika-three-text:** fix Arabic word position letter forms ([480ee97](https://github.com/protectwise/troika/commit/480ee97426c219195d80733b04092018f9bbca86))
* **troika-three-text:** formatting characters no longer produce visible glyphs ([c0d28e8](https://github.com/protectwise/troika/commit/c0d28e8c05a2482c06f67a6d6fe9ea45fff39cd4))
* **troika-three-text:** more correct impl for character joining types ([2ce519a](https://github.com/protectwise/troika/commit/2ce519aa9b8f502f3f4af5cdd5447456958d036b))
* **troika-three-text:** prevent mutation of input to worldPositionToTextCoords method ([d487b8a](https://github.com/protectwise/troika/commit/d487b8aeaf3ca6831192587ee4d4c1bee978f90f))


### Features

* **troika-three-text:** add full bidi text support ([3fde850](https://github.com/protectwise/troika/commit/3fde850d28524393538e2bac8920f7a4ee0e1fb4))
* **troika-three-text:** simple bidi layout support, using explicit LRO/RLO/PDF chars only ([d511655](https://github.com/protectwise/troika/commit/d511655926f53262abb4b6c990c5102180f23f64))
* **troika-three-text:** very basic support for right-to-left text layout ([ce887be](https://github.com/protectwise/troika/commit/ce887beed7976ec23fa0590d5199457182c6e6bf))


### Performance Improvements

* prune some unused functions out of the Typr build ([26e669f](https://github.com/protectwise/troika/commit/26e669f5382fd8a160d1f9814e4329620ae2879b))





# [0.40.0](https://github.com/protectwise/troika/compare/v0.39.2...v0.40.0) (2021-02-28)


### Bug Fixes

* **troika-three-text:** fix boundingBox, boundingSphere, and raycasting with curveRadius ([7cc7c82](https://github.com/protectwise/troika/commit/7cc7c821eca8f7ae63170d9a484e806bc8814a94)), closes [#103](https://github.com/protectwise/troika/issues/103)





## [0.39.2](https://github.com/protectwise/troika/compare/v0.39.1...v0.39.2) (2021-02-18)


### Bug Fixes

* **troika-three-text:** fix shader error in WebGL1 ([cdbc7dc](https://github.com/protectwise/troika/commit/cdbc7dc0cac980a0317219a4736cb48ae4bc18eb)), closes [#108](https://github.com/protectwise/troika/issues/108)





## [0.39.1](https://github.com/protectwise/troika/compare/v0.39.0...v0.39.1) (2021-02-17)


### Bug Fixes

* **troika-three-text:** selection rects no longer clip off trailing whitespace ([158305c](https://github.com/protectwise/troika/commit/158305c9f3f83aa3729b2d32c1ae2d9112540348)), closes [#78](https://github.com/protectwise/troika/issues/78)





# [0.39.0](https://github.com/protectwise/troika/compare/v0.38.1...v0.39.0) (2021-02-15)


### Features

* **troika-three-text:** add curveRadius for applying cylindrical curvature ([6fdfbbf](https://github.com/protectwise/troika/commit/6fdfbbfcc0cdae0143555c9cb6569ba9e70150c5))
* **troika-three-text:** export a function for debugging SDF textures ([3fb0c23](https://github.com/protectwise/troika/commit/3fb0c23bae22b3812839c0639f8278d68120fc8c))
* **troika-three-text:** pack SDFs using all 4 color channels, to increase max glyphs in a texture ([d236caf](https://github.com/protectwise/troika/commit/d236caf9526b5b05bb14980f54f3d73a207ed874))





## [0.38.1](https://github.com/protectwise/troika/compare/v0.38.0...v0.38.1) (2021-02-03)


### Bug Fixes

* **troika-three-text:** prevent copy() from sharing geometry between instances ([8c3ba2d](https://github.com/protectwise/troika/commit/8c3ba2d8f610c045dadee17a6221ea61ab8d26d4))





# [0.38.0](https://github.com/protectwise/troika/compare/v0.37.0...v0.38.0) (2021-01-24)


### Bug Fixes

* **troika-three-text:** allow negative percentages for outlineOffsetX/Y ([3a274f0](https://github.com/protectwise/troika/commit/3a274f070b30e5312e2f546f66db2ab9352962ca)), closes [#100](https://github.com/protectwise/troika/issues/100)





# [0.37.0](https://github.com/protectwise/troika/compare/v0.36.1...v0.37.0) (2021-01-18)


### Features

* **troika-three-text:** added inner stroke and outline blur capabilities ([e004b9d](https://github.com/protectwise/troika/commit/e004b9d2f7e2ef9e841e61156b68958076533a62))


### Performance Improvements

* **troika-three-text:** swap tiny-inflate to fflate for minor speed boost on woff fonts ([2ae29fa](https://github.com/protectwise/troika/commit/2ae29faffcec2302453ce9dabac633ade8181127))






## [0.36.1](https://github.com/protectwise/troika/compare/v0.36.0...v0.36.1) (2020-12-16)


### Bug Fixes

* **troika-three-text:** soften Typr.ts console warnings to debug level ([50d951f](https://github.com/protectwise/troika/commit/50d951fd06108194ef0a485af1fcce58c2710cde))





# [0.36.0](https://github.com/protectwise/troika/compare/v0.35.0...v0.36.0) (2020-12-04)


### Bug Fixes

* **troika-three-text:** fix wrong caret position for collapsed ligature characters ([f220035](https://github.com/protectwise/troika/commit/f220035430787b3d178ad8cfe4b067fe9793de97))


### Features

* **troika-three-text:** fix kerning by updating from Typr.js to Typr.ts ([43144cf](https://github.com/protectwise/troika/commit/43144cfbb8f553d552a5bef179a7e5cfc8179fe3)), closes [#70](https://github.com/protectwise/troika/issues/70)





# [0.35.0](https://github.com/protectwise/troika/compare/v0.34.2...v0.35.0) (2020-11-16)

**Note:** Version bump only for package troika-three-text





## [0.34.2](https://github.com/protectwise/troika/compare/v0.34.1...v0.34.2) (2020-11-09)


### Bug Fixes

* **troika-three-text:** dispose the outline material when the base material is disposed ([68bd2c8](https://github.com/protectwise/troika/commit/68bd2c867f9ccbb53a41b2a3c3aedcf886354d38))
* **troika-three-text:** fix error when disposing the base material with outlines enabled ([73a51f5](https://github.com/protectwise/troika/commit/73a51f5ef87676727667becc0e6bbc6495bff751))






## [0.34.1](https://github.com/protectwise/troika/compare/v0.34.0...v0.34.1) (2020-10-20)

**Note:** Version bump only for package troika-three-text





# [0.34.0](https://github.com/protectwise/troika/compare/v0.33.1...v0.34.0) (2020-10-19)


### Bug Fixes

* **troika-three-text:** clipRect is no longer clamped to the text block's bounds ([15edbd9](https://github.com/protectwise/troika/commit/15edbd95c0ec525c4a268ff3781e6e516981da02))
* **troika-three-text:** fix text baseline being positioned too low ([596d8ca](https://github.com/protectwise/troika/commit/596d8ca1e6ba35f9e68bcbda74329823a3b1b1ad))


### Features

* **troika-three-text:** expose blockBounds and visibleBounds in textRenderInfo ([f3340ec](https://github.com/protectwise/troika/commit/f3340ec1efac6a6b00f596d9ef898ed7c2a6568a))
* **troika-three-text:** text outline and better antialiasing at small sizes ([3836809](https://github.com/protectwise/troika/commit/3836809cc919b57b5eb357e66e35a15903bd54f7))


### Performance Improvements

* micro-optimization of sdf texture insertion loop ([995c2a6](https://github.com/protectwise/troika/commit/995c2a6652181f26677b8da4207f18c32455e59c))






## [0.33.1](https://github.com/protectwise/troika/compare/v0.33.0...v0.33.1) (2020-10-02)

**Note:** Version bump only for package troika-three-text





# [0.33.0](https://github.com/protectwise/troika/compare/v0.32.0...v0.33.0) (2020-10-02)


### Bug Fixes

* add "sideEffects":false to package.json files to assist treeshaking ([61109b2](https://github.com/protectwise/troika/commit/61109b2e3d21dc794ef66b3f28cf63bbdd34150e))
* add PURE annotations to make troika-three-text treeshakeable ([8e76b5c](https://github.com/protectwise/troika/commit/8e76b5c31a3cbda86595654ba9d66d8d635e44a1))
* remove redundant "browser" and defunct "jsnext:main" fields from package.json files ([0abec40](https://github.com/protectwise/troika/commit/0abec40e3af06d3ae4d990bf198d871b46730f1f))
* **troika-three-text:** make `color` prop only apply to that instance when sharing a base material ([da0f995](https://github.com/protectwise/troika/commit/da0f995be3b7594bafc6f24dd6981ee787ff4ee1))


### Features

* **troika-three-text:** modifications to the base material are now picked up automatically ([fc81d3a](https://github.com/protectwise/troika/commit/fc81d3a13ef84a8358bfbdcac066cb13a161c7f6))





# [0.32.0](https://github.com/protectwise/troika/compare/v0.31.0...v0.32.0) (2020-09-16)


### Bug Fixes

* mutate boundingBox and set depth to 0 ([1f9b6be](https://github.com/protectwise/troika/commit/1f9b6bef083c26c9de9ac0ce169544ed3f99cf89))


### Features

* added boundingBox calculation ([140e9e8](https://github.com/protectwise/troika/commit/140e9e8bf2865c54f21877ca03834bbde4e9ab52))





# [0.31.0](https://github.com/protectwise/troika/compare/v0.30.2...v0.31.0) (2020-08-11)

**Note:** Version bump only for package troika-three-text





## [0.30.2](https://github.com/protectwise/troika/compare/v0.30.1...v0.30.2) (2020-07-22)


### Bug Fixes

* **troika-three-text:** prevent unbound buffer errors when disposing a GlyphsGeometry ([e860eac](https://github.com/protectwise/troika/commit/e860eacd04404a328cc758af9103f5d2f55201ba)), closes [#69](https://github.com/protectwise/troika/issues/69) [react-spring/drei#62](https://github.com/react-spring/drei/issues/62)





## [0.30.1](https://github.com/protectwise/troika/compare/v0.30.0...v0.30.1) (2020-07-19)


### Bug Fixes

* **troika-three-text:** fix changing text length in ThreeJS r117+ ([a7ef945](https://github.com/protectwise/troika/commit/a7ef945119649b4c3b451783000dd5c40ad3f3ba)), closes [#69](https://github.com/protectwise/troika/issues/69)





# [0.30.0](https://github.com/protectwise/troika/compare/v0.29.0...v0.30.0) (2020-07-16)


### Features

* **troika-three-text:** add support for textIndent ([b689c0c](https://github.com/protectwise/troika/commit/b689c0c1b1d9de437eeea9390cfcf9be6c10eae9))





# [0.29.0](https://github.com/protectwise/troika/compare/v0.28.1...v0.29.0) (2020-07-06)


### Features

* **troika-three-text:** promote standalone text to a new `troika-three-text` package ([995f2eb](https://github.com/protectwise/troika/commit/995f2eb7202789a83671878209c65d240082ade7)), closes [#47](https://github.com/protectwise/troika/issues/47)
