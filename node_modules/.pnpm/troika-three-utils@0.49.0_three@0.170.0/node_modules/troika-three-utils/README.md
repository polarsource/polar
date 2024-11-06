# Troika Three.js Utilities

This package provides various utilities for working with [Three.js](https://github.com/mrdoob/three.js), particularly having to do with shaders. It is used by [Troika 3D](../troika-3d), but has no dependencies itself other than Three.js, so it can be used outside the Troika framework.


## Installation

Get it from [NPM](https://www.npmjs.com/package/troika-three-utils):

```sh
npm install troika-three-utils
```

You will also need to install a compatible version of [Three.js](https://threejs.org); see the [notes on Three.js versions in the Getting Started docs](../../docs/getting-started/setup.md#threejs) for details.

```sh
npm install three
```


## Provided Utilities

Several utilities are provided; for a full list follow the imports in [index.js](./src/index.js) to their source files, where each is documented in JSDoc comments.

Some of the most useful ones are:


### createDerivedMaterial()

This utility allows you to easily _extend_ existing Three.js materials with your own custom shader code. This is an incredibly powerful tool, and is the  secret behind most of Troika's shader-driven tools like `troika-three-text`, `three-instanced-uniforms-mesh`, and `BezierMesh`. 

See the [createDerivedMaterial documentation page](./docs/createDerivedMaterial.md) and its [source code with JSDoc](./src/DerivedMaterial.js) for details.


### BezierMesh

This creates a cylindrical mesh and bends it along a 3D cubic bezier path between two points, in a custom derived vertex shader. This is useful for visually connecting objects in 3D space with a line that has thickness to it.

See the [BezierMesh documentation page](./docs/BezierMesh.md) and its [source code with JSDoc](./src/BezierMesh.js) for details.


### InstancedUniformsMesh

> NOTE: InstancedUniformsMesh has been moved to [its own `three-instanced-uniforms-mesh` package](https://github.com/protectwise/troika/tree/master/packages/three-instanced-uniforms-mesh).
