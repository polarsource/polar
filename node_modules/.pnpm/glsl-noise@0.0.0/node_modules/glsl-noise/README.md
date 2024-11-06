# glsl-noise [![frozen](http://hughsk.github.io/stability-badges/dist/frozen.svg)](http://github.com/hughsk/stability-badges) #

[webgl-noise](http://github.com/ashima/webgl-noise) ported to an NPM package
so that you can require it from
[glslify](http://github.com/chrisdickinson/glslify).

[![glsl-noise](https://nodei.co/npm/glsl-noise.png?mini=true)](https://nodei.co/npm/glsl-noise)

## Usage ##

``` glsl
// Require as many or as little as you need:
#pragma glslify: cnoise2 = require(glsl-noise)
#pragma glslify: snoise2 = require(glsl-noise/simplex/2d)
#pragma glslify: snoise3 = require(glsl-noise/simplex/3d)
#pragma glslify: snoise4 = require(glsl-noise/simplex/4d)
#pragma glslify: cnoise2 = require(glsl-noise/classic/2d)
#pragma glslify: cnoise3 = require(glsl-noise/classic/3d)
#pragma glslify: cnoise4 = require(glsl-noise/classic/4d)
#pragma glslify: pnoise2 = require(glsl-noise/periodic/2d)
#pragma glslify: pnoise3 = require(glsl-noise/periodic/3d)
#pragma glslify: pnoise4 = require(glsl-noise/periodic/4d)

attribute vec3 position;

// And just treat them as functions like
// you normally would:
void main() {
  gl_FragColor = vec4(snoise3(position), 1.0);
}
```
