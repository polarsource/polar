# @use-gesture/core

## 10.3.1

### Patch Changes

- 6f6f4a5b4: fix(types): compatibility with @types/react >=18.2.66

## 10.3.0

### Minor Changes

- 1ee9f42e3: Fix: touch support is reverted to only checking TouchEvent support #626

### Patch Changes

- c19ff0b24: feat: modifierKey can be an array via @BJvdA

## 10.2.27

### Patch Changes

- 0dce2216c: detect lost pointer capture in PinchEngine
- 957aee8b5: fix: don't block events with similar timestamps #581
- 51c6cfcf4: chore: upgrade to typescript 5.0

## 10.2.26

### Patch Changes

- db0d934eb: fix: add a try catch when calculating the distance and angle as apparently some events might be undefined on Windows #551
- 43e751a51: fix: calculate swipe from raw movement (\_movement) #592

## 10.2.25

### Patch Changes

- 3701753ea: fix: set startTime inside start function

## 10.2.24

### Patch Changes

- 60aae2149: feat: Added option to configure keyboard displacement in the drag gesture

## 10.2.23

### Patch Changes

- 79684a05f: types: add package exports

## 10.2.22

### Patch Changes

- c6215e8ad: fix: properly resolve pointer.keys config

## 10.2.21

### Patch Changes

- 6f4c09b55: fix: rolls back wheel-based pinch movement to bounds (thanks [@Andarist](https://github.com/Andarist)!)
- 854f4dfc1: feat (pinch):

  - `pinchOnwheel: false` prevents pinching with wheel.

## 10.2.20

### Patch Changes

- de807fddc: fix: applying a new config to useGesture / Gesture shouldn't throw an error.

## 10.2.19

### Patch Changes

- c7cb407bd: ts: Typescript 4.8 introduced a new mapping definition for NonNullable which breaks the package types.

  ```ts
  // Native NonNullable Utility Type

  // definition on 4.7 and lower
  type NonNullable<T> = T extends null | undefined ? never : T

  // definition from 4.8
  type NonNullable<T> = T & {}
  ```

  This fix reverts the definition of NonNullable so that it works.
  More information here: https://github.com/pmndrs/use-gesture/issues/501#issuecomment-1229486104

## 10.2.18

### Patch Changes

- 115ee1f59: fix: don't let Enter key preventDefault on onClick when filterTaps is true.

## 10.2.17

### Patch Changes

- 48dc6a102: feat: add option to remove arrow keys listeners for the drag gesture.
- d73ee4e34: Always trigger wheel events on pinch

## 10.2.16

### Patch Changes

- a521a171f: types: remove React types dependency on core package

## 10.2.15

### Patch Changes

- be1703a6d: fix: reset \_preventScroll when setting up scroll prevention to avoid side effects

## 10.2.14

### Patch Changes

- e82f1c220: fix: improve detection for drag gesture, also fixes #494

## 10.2.13

### Patch Changes

- 6896094b3: fix: preventScroll should resist to multiple fingers drag
- 15724eb5c: - Have `delta` increment on first keydown for drag
  - Fix `config.bounds` type for drag gestures
  - Add `eventOptions` option for each gesture

## 10.2.12

### Patch Changes

- 91651b202: Fix config types

## 10.2.11

### Patch Changes

- 670e6e2db: - fix: trigger `pointerDown` event when `triggerAllEvents` and `delay` options are set
  - fix: disable scroll prevention when the event type is `'mouse'`
  - feat: add `axisThreshold` property to set a threshold for axis calculation (can be set per device for the drag gesture)
  - fix: axis are now calculated on pixel movement rather than on transformed movement
- 5979b1add: feat: add modifierKey for wheel option. Defaults to `'ctrlKey'`.

## 10.2.10

### Patch Changes

- f593dbe09: - fix: increase `PINCH_WHEEL_RATIO` to `100` to slow down zoom on wheel-based devices.
  - fix: force drag to start no matter the threshold when delay is reached.
  - fix: improve `preventScroll`.

## 10.2.9

### Patch Changes

- d86df73b9: feat: add `pointer.mouse` option to force mouse listeners instead of pointers when possible.

## 10.2.8

### Patch Changes

- 2c0fde118: fix: delta is now derived from the `offset` value _after_ it is clamped by bounds.

## 10.2.7

### Patch Changes

- 2d943428c: Fix a bug when a touch identifier is equal to `0`

## 10.2.6

### Patch Changes

- 916d178c6: fix: make sure the drag gesture is ended when `touchcancel` event is triggered.

## 10.2.5

### Patch Changes

- cd5533a4c: fix: change TouchEvent detection
- 548a90985: [Drag] feat: Adding a custom threshold to taps when filtering them (`tapThreshold`)
- c5067dce0: feat: add `overflow` state attribute telling when offset is overflowing bounds.
  [Wheel] fix: only update `offset` when it stays within bounds.
- 4eaabaf1a: fix: add `lostpointercapture` listener for cases when the `pointerup` event is missed.

## 10.2.4

### Patch Changes

- ae631004a: fix: change isNaN to Number.isNaN in dev mode

## 10.2.3

### Patch Changes

- 8302c5bfd: fix: prevent deprecated resolvers from applying in dev mode

## 10.2.2

### Patch Changes

- cffaba5ae: fix: logic error in intent detection

## 10.2.1

### Patch Changes

- 2f0cd466b: fix: release pointerId when PointerEvent is canceled. Should fix [#376](https://github.com/pmndrs/use-gesture/issues/376).

## 10.2.0

### Minor Changes

- b4e6181e7: Fix: should fix `transform` function doesn't have [0,0] origin. This required some pretty drastic internal changes hence the minor version bump.

## 10.1.6

### Patch Changes

- 9883b1c78: types: fix ReactDOMAttributes type

## 10.1.5

### Patch Changes

- 55505c071: fix: `event.buttons` condition was preventing `pointer.touch` from behaving properly.

## 10.1.4

### Patch Changes

- 090ba6b62: feat: allow pointer.buttons to accept an array or -1

## 10.1.3

### Patch Changes

- a9f99ce3c: feat: warn in dev mode if transform function return invalid values

## 10.1.2

### Patch Changes

- ed0073543: fix: add threshold to config resolver

## 10.1.1

### Patch Changes

- 8a0bfacb0: fix: Remove the console output statement.
- 8a0bfacb0: fix: Remove the console output statement.

## 10.1.0

### Minor Changes

- b67543ff7: Feat (drag): add the `pointer.buttons` in order to customize which [buttons combination](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons) will trigger the drag gesture.

## 10.0.3

### Patch Changes

- de01d7dbb: Sets state `canceled` / `_active` attributes synchronously with `cancel()`.

## 10.0.2

### Patch Changes

- a219d3f69: fix: make sure delay still set first to true when moving so that onDragStart can fire.

## 10.0.1

### Patch Changes

- c00c7b1: fix: add movement to offset when using wheel-based browsers on pinch
