<p align="center">
    <img src="https://user-images.githubusercontent.com/1061/185432665-ddfe409a-d399-4059-bd2f-bfefc2a97db1.png" alt="Tunnel Rat" height="600">
</p>

[![Version](https://img.shields.io/npm/v/tunnel-rat?style=for-the-badge)](https://www.npmjs.com/package/tunnel-rat)
[![Downloads](https://img.shields.io/npm/dt/tunnel-rat.svg?style=for-the-badge)](https://www.npmjs.com/package/tunnel-rat)
[![Bundle Size](https://img.shields.io/bundlephobia/min/tunnel-rat?label=bundle%20size&style=for-the-badge)](https://bundlephobia.com/result?p=tunnel-rat)

## Tunnel Rat

- Digs tunnels for React elements to **go in** and **appear somewhere else**!
- Works across **separate renderers** &ndash; use it to easily **render HTML elements from within your @react-three/fiber application**!
- Squeak! 🐀

## Examples & Sandboxes

- https://codesandbox.io/s/basic-demo-forked-kxq8g
- https://codesandbox.io/s/tunnel-rat-demo-ceupre

## Usage

Create a tunnel:

```tsx
import tunnel from 'tunnel-rat'
const t = tunnel()
```

Use the tunnel's `In` component to send one or more elements into the tunnel:

```tsx
<t.In>
  <h1>Very cool!</h1>
  <p>These will appear somewhere else!</p>
</t.In>
```

Somewhere else, use the tunnel's `Out` component to render them:

```tsx
<t.Out />
```

## Examples

This example describes a simple React app that has both a HTML UI as well as a @react-three/fiber 3D scene. Each of these is rendered using separate React renderers, which traditionally makes emitting HTML from within the Canvas a bit of a pain; but thanks to tunnel-rat, this is now super easy!

```jsx
import { Canvas } from '@react-three/fiber'
import tunnel from 'tunnel-rat'

/* Create a tunnel. */
const ui = tunnel()

const App = () => (
  <div>
    <div id="ui">
      {/* Anything that goes into the tunnel, we want to render here. */}
      <ui.Out />
    </div>

    {/* Here we're entering the part of the app that is driven by
    @react-three/fiber, where all children of the <Canvas> component
    are rendered by an entirely separate React renderer, which would
    typically not allow the use of HTML tags. */}
    <Canvas>
      {/* Let's send something into the tunnel! */}
      <ui.In>
        <p>Hi, I'm a cube!</p>
      </ui.In>

      <mesh>
        <boxGeometry />
        <meshBasicMaterial />
      </mesh>

      {/* You can send multiple things through the tunnel, and
      they will all show up in the order that you've defined them in! */}
      <ui.In>
        <p>And I'm a sphere!</p>
      </ui.In>

      <mesh>
        <sphereGeometry />
        <meshBasicMaterial />
      </mesh>
    </Canvas>
  </div>
)
```

Of course, the whole thing also works the other way around:

```jsx
import { Canvas } from '@react-three/fiber'
import tunnel from 'tunnel-rat'

/* Create a tunnel. */
const three = tunnel()

const App = () => (
  <div>
    <div id="ui">
      {/* Let's beam something into the R3F Canvas! */}
      <three.In>
        <mesh>
          <sphereGeometry />
          <meshBasicMaterial />
        </mesh>
      </three.In>
    </div>

    <Canvas>
      {/* Render anything sent through the tunnel! */}
      <three.Out />
    </Canvas>
  </div>
)
```
