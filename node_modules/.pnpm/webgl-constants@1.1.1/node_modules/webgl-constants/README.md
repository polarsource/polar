# WebGL constants

![](http://img.badgesize.io/TimvanScherpenzeel/webgl-constants/master/dist/webgl-constants.cjs.js.svg?compression=gzip&maxAge=60)
[![npm version](https://badge.fury.io/js/webgl-constants.svg)](https://badge.fury.io/js/webgl-constants)

Complete set of constants as specified in the WebGL, WebGL2 and extension spec.

All constants have their original names prefixed with `GL_` in order to namespace the constants and were directly ported from the documentation on the [Mozilla Developer Network](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants). In some cases the documentation describes duplicate cases such as `UNSIGNED_BYTE` as both a `data` type as well as a `pixel` type. For that reason I've decided to prefix each with their type resulting in `GL_DATA_UNSIGNED_BYTE` and `GL_PIXEL_UNSIGNED_BYTE`.

## Licence

My work is released under the [MIT license](https://raw.githubusercontent.com/TimvanScherpenzeel/webgl-constants/master/LICENSE).
