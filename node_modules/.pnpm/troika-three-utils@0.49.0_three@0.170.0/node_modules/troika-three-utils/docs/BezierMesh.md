# BezierMesh

This is a Three.js object which bends a cylindrical mesh along a 3D cubic bezier path between two points. This is useful for drawing nicely curved lines in 3D space, where the lines have thickness.

Rather than assembling a BufferGeometry on the CPU, BezierMesh bends the tube on the GPU in a custom derived vertex shader. This makes it very good for situations where the line's endpoints and control points change over time. They can even be animated every frame without penalty.

It can also have any `material` assigned to it, so it can have lighting, textures, etc. like any other mesh. It will automatically upgrade that material behind the scenes to apply the extra vertex shader transformation. 

- _[Source code with JSDoc](https://github.com/protectwise/troika/blob/master/packages/troika-three-utils/src/BezierMesh.js)_

- _[Online example](https://troika-examples.netlify.com/#bezier3d)_

  ![Example 1](../../../docs/troika-three-utils/images/beziers1.png)

- _[Online example using InstancedUniformsMesh](https://ibyou.csb.app/)_

  ![Example 2](../../../docs/troika-three-utils/images/beziers2.png)

## Usage:

```js
import { BezierMesh } from 'troika-three-utils'

const bezier = new BezierMesh()
bezier.pointA.set(-0.3, 0.4, -0.3)
bezier.controlA.set(0.7, 0.6, 0.4)
bezier.controlB.set(-0.6, -0.6, -0.6)
bezier.pointB.set(0.7, 0, -0.7)
bezier.radius = 0.01
scene.add(bezier)
```

## Supported Properties:

### `pointA`
A Vector3 holding the position of the first endpoint.

### `controlA`
A Vector3 holding the position of the first control point.

### `controlB`
A Vector3 holding the position of the second control point.

### `pointB`
A Vector3 holding the position of the second endpoint.

### `radius`
A number defining the radius of the tube.

### `dashArray`
An array of two numbers, defining the length of "on" and "off" parts of a dashed line style. Each number is a 0-1 ratio of the entire path's length. (Actually this is the `t` length used as input to the cubic bezier function, not its visible length.)

> Note that the dashes will appear like a hollow tube, not solid; this will be more apparent on thicker tubes.

### `dashOffset`
A numeric offset of where the dash starts. You can animate this to make the dashes move.

