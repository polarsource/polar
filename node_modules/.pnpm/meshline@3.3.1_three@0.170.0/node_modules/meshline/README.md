# MeshLine

A mesh replacement for `THREE.Line`. Instead of using GL_LINE, it uses a strip of billboarded triangles. This is a fork of [spite/THREE.MeshLine](https://github.com/spite/THREE.MeshLine), previously maintained by studio [Utsuboco](https://github.com/utsuboco).

<p align="center">
  <img width="32%" src="screenshots/demo.jpg" alt=""/>
  <img width="32%" src="screenshots/graph.jpg" alt=""/>
  <img width="32%" src="screenshots/spinner.jpg" alt=""/>
  <img width="32%" src="screenshots/svg.jpg" alt=""/>
  <img width="32%" src="screenshots/shape.jpg" alt=""/>
  <img width="32%" src="screenshots/birds.jpg" alt=""/>
</p>

### How to use

```
npm install meshline
```

```jsx
import * as THREE from 'three'
import { MeshLineGeometry, MeshLineMaterial, raycast } from 'meshline'

const geometry = new MeshLineGeometry()
geometry.setPoints([...])
const material = new MeshLineMaterial({ ... })
const mesh = new THREE.Mesh(geometry, material)
mesh.raycast = raycast
scene.add(mesh)
```

#### Assign points

Create a `MeshLineGeometry` and pass a list of points into `.setPoints()`. Expected inputs are:

- `Float32Array`
- `THREE.BufferGeometry`
- `Array<THREE.Vector3 | THREE.Vector2 | [number, number, number] | [number, number] | number>`

```jsx
const geometry = new MeshLineGeometry()

const points = []
for (let j = 0; j < Math.PI; j += (2 * Math.PI) / 100)
  points.push(Math.cos(j), Math.sin(j), 0)

geometry.setPoints(points)
```

Note: `.setPoints` accepts a second parameter, which is a function to define a variable width for each point along the line. By default that value is 1, making the line width 1 \* lineWidth.

```jsx
// p is a decimal percentage of the number of points
// ie. point 200 of 250 points, p = 0.8
geometry.setPoints(points, (p) => 2) // makes width 2 * lineWidth
geometry.setPoints(points, (p) => 1 - p) // makes width taper
geometry.setPoints(points, (p) => 2 + Math.sin(50 * p)) // makes width sinusoidal
```

#### Create a material

```jsx
const material = new MeshLineMaterial(options)
```

By default it's a white material of width 1 unit.

`MeshLineMaterial` has several attributes to control the appereance:

- `map` - a `THREE.Texture` to paint along the line (requires `useMap` set to true)
- `useMap` - tells the material to use `map` (0 - solid color, 1 use texture)
- `alphaMap` - a `THREE.Texture` to use as alpha along the line (requires `useAlphaMap` set to true)
- `useAlphaMap` - tells the material to use `alphaMap` (0 - no alpha, 1 modulate alpha)
- `repeat` - THREE.Vector2 to define the texture tiling (applies to map and alphaMap)
- `color` - `THREE.Color` to paint the line width, or tint the texture with
- `opacity` - alpha value from 0 to 1 (requires `transparent` set to `true`)
- `alphaTest` - cutoff value from 0 to 1
- `dashArray` - the length and space between dashes. (0 - no dash)
- `dashOffset` - defines the location where the dash will begin. Ideal to animate the line.
- `dashRatio` - defines the ratio between that is visible or not (0 - more visible, 1 - more invisible).
- `resolution` - `THREE.Vector2` specifying the canvas size (REQUIRED)
- `sizeAttenuation` - constant lineWidth regardless of distance (1 is 1px on screen) (0 - attenuate, 1 - don't)
- `lineWidth` - float defining width (if `sizeAttenuation` is true, it's world units; else is screen pixels)

If you're rendering transparent lines or using a texture with alpha map, you should set `depthTest` to `false`, `transparent` to `true` and `blending` to an appropriate blending mode, or use `alphaTest`.

#### Form a mesh

```jsx
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)
```

### Raycasting

Raycast can be optionally added by overwriting `mesh.raycast` with the one that meshline provides.

```jsx
import { raycast } from 'meshline'

mesh.raycast = raycast
```

### Declarative use

Meshline can be used declaritively in [react-three-fiber](https://github.com/pmndrs/react-three-fiber). `MeshLineGeometry` has a convenience setter/getter for `.setPoints()`, `points`.

```jsx
import { Canvas, extend } from '@react-three/fiber'
import { MeshLineGeometry, MeshLineMaterial, raycast } from 'meshline'

extend({ MeshLineGeometry, MeshLineMaterial })

function App() {
  return (
    <Canvas>
      <mesh raycast={raycast} onPointerOver={console.log}>
        <meshLineGeometry points={[0, 0, 0, 1, 0, 0]} />
        <meshLineMaterial lineWidth={1} color="hotpink" />
      </mesh>
    </Canvas>
  )
}
```

#### Variable line widths

Variable line widths can be set for each point using the `widthCallback` prop.

```jsx
<meshLineGeometry points={points} widthCallback={(p) => p * Math.random()} />
```

#### Types

Add these declarations to your entry point.

```tsx
import { Object3DNode, MaterialNode } from '@react-three/fiber'

declare module '@react-three/fiber' {
  interface ThreeElements {
    meshLineGeometry: Object3DNode<MeshLineGeometry, typeof MeshLineGeometry>
    meshLineMaterial: MaterialNode<MeshLineMaterial, typeof MeshLineMaterial>
  }
}
```

### References

- [Drawing lines is hard](http://mattdesl.svbtle.com/drawing-lines-is-hard)
- [WebGL rendering of solid trails](http://codeflow.org/entries/2012/aug/05/webgl-rendering-of-solid-trails/)
- [Drawing Antialiased Lines with OpenGL](https://www.mapbox.com/blog/drawing-antialiased-lines/)
