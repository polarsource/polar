# @use-gesture/core

## 10.3.1

### Patch Changes

- Updated dependencies [6f6f4a5b4]
  - @use-gesture/core@10.3.1

## 10.3.0

### Patch Changes

- Updated dependencies [c19ff0b24]
- Updated dependencies [1ee9f42e3]
  - @use-gesture/core@10.3.0

## 10.2.27

### Patch Changes

- Updated dependencies [0dce2216c]
- Updated dependencies [957aee8b5]
- Updated dependencies [51c6cfcf4]
  - @use-gesture/core@10.2.27

## 10.2.26

### Patch Changes

- Updated dependencies [db0d934eb]
- Updated dependencies [43e751a51]
  - @use-gesture/core@10.2.26

## 10.2.25

### Patch Changes

- Updated dependencies [3701753ea]
  - @use-gesture/core@10.2.25

## 10.2.24

### Patch Changes

- Updated dependencies [60aae2149]
  - @use-gesture/core@10.2.24

## 10.2.23

### Patch Changes

- Updated dependencies [79684a05f]
  - @use-gesture/core@10.2.23

## 10.2.22

### Patch Changes

- Updated dependencies [c6215e8ad]
  - @use-gesture/core@10.2.22

## 10.2.21

### Patch Changes

- Updated dependencies [6f4c09b55]
- Updated dependencies [854f4dfc1]
  - @use-gesture/core@10.2.21

## 10.2.20

### Patch Changes

- Updated dependencies [de807fddc]
  - @use-gesture/core@10.2.20

## 10.2.19

### Patch Changes

- Updated dependencies [c7cb407bd]
  - @use-gesture/core@10.2.19

## 10.2.18

### Patch Changes

- Updated dependencies [115ee1f59]
  - @use-gesture/core@10.2.18

## 10.2.17

### Patch Changes

- Updated dependencies [48dc6a102]
- Updated dependencies [d73ee4e34]
  - @use-gesture/core@10.2.17

## 10.2.16

### Patch Changes

- a521a171f: types: remove React types dependency on core package
- Updated dependencies [a521a171f]
  - @use-gesture/core@10.2.16

## 10.2.15

### Patch Changes

- Updated dependencies [be1703a6d]
  - @use-gesture/core@10.2.15

## 10.2.14

### Patch Changes

- Updated dependencies [e82f1c220]
  - @use-gesture/core@10.2.14

## 10.2.13

### Patch Changes

- Updated dependencies [6896094b3]
- Updated dependencies [15724eb5c]
  - @use-gesture/core@10.2.13

## 10.2.12

### Patch Changes

- 91651b202: Fix config types
- Updated dependencies [91651b202]
  - @use-gesture/core@10.2.12

## 10.2.11

### Patch Changes

- Updated dependencies [670e6e2db]
- Updated dependencies [5979b1add]
  - @use-gesture/core@10.2.11

## 10.2.10

### Patch Changes

- Updated dependencies [f593dbe09]
  - @use-gesture/core@10.2.10

## 10.2.9

### Patch Changes

- Updated dependencies [d86df73b9]
  - @use-gesture/core@10.2.9

## 10.2.8

### Patch Changes

- Updated dependencies [2c0fde118]
  - @use-gesture/core@10.2.8

## 10.2.7

### Patch Changes

- Updated dependencies [2d943428c]
  - @use-gesture/core@10.2.7

## 10.2.6

### Patch Changes

- Updated dependencies [916d178c6]
  - @use-gesture/core@10.2.6

## 10.2.5

### Patch Changes

- Updated dependencies [cd5533a4c]
- Updated dependencies [548a90985]
- Updated dependencies [c5067dce0]
- Updated dependencies [4eaabaf1a]
  - @use-gesture/core@10.2.5

## 10.2.4

### Patch Changes

- Updated dependencies [ae631004a]
  - @use-gesture/core@10.2.4

## 10.2.3

### Patch Changes

- Updated dependencies [8302c5bfd]
  - @use-gesture/core@10.2.3

## 10.2.2

### Patch Changes

- Updated dependencies [cffaba5ae]
  - @use-gesture/core@10.2.2

## 10.2.1

### Patch Changes

- Updated dependencies [2f0cd466b]
  - @use-gesture/core@10.2.1

## 10.2.0

### Patch Changes

- Updated dependencies [b4e6181e7]
  - @use-gesture/core@10.2.0

## 10.1.6

### Patch Changes

- Updated dependencies [9883b1c78]
  - @use-gesture/core@10.1.6

## 10.1.5

### Patch Changes

- Updated dependencies [55505c071]
  - @use-gesture/core@10.1.5

## 10.1.4

### Patch Changes

- Updated dependencies [090ba6b62]
  - @use-gesture/core@10.1.4

## 10.1.3

### Patch Changes

- Updated dependencies [a9f99ce3c]
  - @use-gesture/core@10.1.3

## 10.1.2

### Patch Changes

- Updated dependencies [ed0073543]
  - @use-gesture/core@10.1.2

## 10.1.1

### Patch Changes

- Updated dependencies [8a0bfacb0]
- Updated dependencies [8a0bfacb0]
  - @use-gesture/core@10.1.1

## 10.1.0

### Patch Changes

- Updated dependencies [b67543ff7]
  - @use-gesture/core@10.1.0

## 10.0.3

### Patch Changes

- Updated dependencies [de01d7dbb]
  - @use-gesture/core@10.0.3

## 10.0.2

### Patch Changes

- Updated dependencies [a219d3f69]
  - @use-gesture/core@10.0.2

## 10.0.1

### Patch Changes

- Updated dependencies [c00c7b1]
  - @use-gesture/core@10.0.1

## 10.0.0

- e5d1cac: ## General breaking changes

  - `config.domTarget` is renamed `config.target`
  - `config.initial` is renamed `config.from`
  - `config.from` accounts for `offset` and not for `movement` as it was the case for `config.initial`
  - `config.bounds` accounts for `offset`
  - `velocity` is now a Vector with absolute (use `direction` if you need relative velocity)
  - `vxvy`, `previous`, `vdva` are gone
  - `distance` is now a Vector with cumulative deltas
  - `state.pressed` is an alias to `state.down`
  - `config.transform` only transforms `movement` and `offset`. Raw values are no longer transformed.

  ## Features

  ### General

  - Types: Handlers have a better type inference
  - Adds `preventDefault` option so that all events are prevented when `true`

  ### Drag

  - keyboard support when target has focus!
  - shows warning when `touch-action` is not properly set in development mode
  - `bounds` accepts an `HTMLElement` or a React Ref
  - `config.experimental_preventWindowScrollY` is now `config.preventScroll`
  - supports non capturing (uses mouse listeners instead)

  ```js
  useDrag(handler, {
    pointer: {
      touch: true, // uses touch on mobile
      capture: false, // don't use setPointerCapture (uses window)
      lock: true // will perform a pointer lock when drag starts, and exit pointer lock when drag ends,
    },
    axis: undefined | 'x' | 'y' | 'lock',
    swipe: {
      distance: 50,
      velocity: 0.5,
      duration: 250
    }
  })
  ```

  ### Pinch

  - `distanceBounds` is now `scaleBounds`
  - `state.movement` and `state.offset` now reflect scale and not distance
  - Use pointer events where it can
  - Add `useTouch` option to use touch events if needed
  - `config.axis` can be set to `'lock'`, which will either scale or rotate.

  ```js
  usePinch(({ offset: [scale, angle] }) => {
    api.start({ rotate: angle, scale })
  })
  ```

  ### Mouse and Hover

  - Add option `mouseOnly` that you can set to `false` to trigger events on non-mouse events.
