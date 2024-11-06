# @use-gesture

[![npm (tag)](https://img.shields.io/npm/v/@use-gesture/react?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@use-gesture/react) ![npm bundle size](https://img.shields.io/bundlephobia/minzip/@use-gesture/react?style=flat&colorA=000000&colorB=000000) ![NPM](https://img.shields.io/npm/l/@use-gesture/react?style=flat&colorA=000000&colorB=000000) [![Discord Shield](https://img.shields.io/discord/740090768164651008?style=flat&colorA=000000&colorB=000000&label=discord&logo=discord&logoColor=ffffff)](https://discord.gg/poimandres)

@use-gesture is a library that lets you bind richer mouse and touch events to any component or view. With the data you receive, it becomes trivial to set up gestures, and often takes no more than a few lines of code.

You can use it stand-alone, but to make the most of it you should combine it with an animation library like [react-spring](https://github.com/pmndrs/react-spring), though you can most certainly use any other.

<p align="middle">
  <a href="https://codesandbox.io/s/github/pmndrs/use-gesture/tree/main/demo/src/sandboxes/draggable-list"><img src="https://i.imgur.com/qLKJod3.gif" width="400"/></a>
  <a href="https://codesandbox.io/s/github/pmndrs/use-gesture/tree/main/demo/src/sandboxes/cards-stack"><img src="https://i.imgur.com/H6nXQEq.gif" width="400"/></a>
  <a href="https://codesandbox.io/s/github/pmndrs/use-gesture/tree/main/demo/src/sandboxes/action-sheet"><img src="https://i.imgur.com/THKPrmR.gif" width="400"/></a>
  <a href="https://codesandbox.io/s/github/pmndrs/use-gesture/tree/main/demo/src/sandboxes/infinite-slideshow"><img src="https://i.imgur.com/cuOfqST.gif" width="400"/></a>
  <a href="https://codesandbox.io/s/github/pmndrs/use-gesture/tree/main/demo/src/sandboxes/viewpager"><img src="https://i.imgur.com/iwZOfT9.gif" width="400"/></a>
  <a href="https://codesandbox.io/s/github/pmndrs/use-gesture/tree/main/demo/src/sandboxes/card-zoom"><img src="https://i.imgur.com/Walt1Ip.gif" width="400"/></a>
</p>

<p align="middle"><i>The demos are real click them!</i></p>

## Installation

### React

```bash
#Yarn
yarn add @use-gesture/react

#NPM
npm install @use-gesture/react
```

### Vanilla javascript

```bash
#Yarn
yarn add @use-gesture/vanilla

#NPM
npm install @use-gesture/vanilla
```

### [Full documentation website](https://use-gesture.netlify.com)

- [Available Gestures](https://use-gesture.netlify.com/docs/gestures)
- [Gesture State](https://use-gesture.netlify.com/docs/state)
- [Gesture Options](https://use-gesture.netlify.com/docs/options)
- [FAQ](https://use-gesture.netlify.com/docs/faq)

### Simple example

<p align="middle">
  <a href="https://codesandbox.io/s/github/pmndrs/use-gesture/tree/main/demo/src/sandboxes/gesture-simplest"><img src="https://i.imgur.com/AMzsEi3.gif" width="400"/></a>
</p>

<details>
  <summary>React</summary>

```jsx
import { useSpring, animated } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'

function Example() {
  const [{ x, y }, api] = useSpring(() => ({ x: 0, y: 0 }))

  // Set the drag hook and define component movement based on gesture data.
  const bind = useDrag(({ down, movement: [mx, my] }) => {
    api.start({ x: down ? mx : 0, y: down ? my : 0 })
  })

  // Bind it to a component.
  return <animated.div {...bind()} style={{ x, y, touchAction: 'none' }} />
}
```

</details>

<details>
  <summary>Vanilla javascript</summary>

```html
<!-- index.html -->
<div id="drag" />
```

```js
// script.js
const el = document.getElementById('drag')
const gesture = new DragGesture(el, ({ active, movement: [mx, my] }) => {
  setActive(active)
  anime({
    targets: el,
    translateX: active ? mx : 0,
    translateY: active ? my : 0,
    duration: active ? 0 : 1000
  })
})

// when you want to remove the listener
gesture.destroy()
```

</details>

The example above makes a `div` draggable so that it follows your mouse on drag, and returns to its initial position on release.

**Make sure you always set [`touchAction`](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action) on a draggable element to prevent glitches with the browser native scrolling on touch devices**.

### Available hooks

@use-gesture/react exports several hooks that can handle different gestures:

| Hook         | Description                                |
| ------------ | ------------------------------------------ |
| `useDrag`    | Handles the drag gesture                   |
| `useMove`    | Handles mouse move events                  |
| `useHover`   | Handles mouse enter and mouse leave events |
| `useScroll`  | Handles scroll events                      |
| `useWheel`   | Handles wheel events                       |
| `usePinch`   | Handles the pinch gesture                  |
| `useGesture` | Handles multiple gestures in one hook      |

#### [More on the full documentation website...](https://use-gesture.netlify.app/)
