[![Build Size](https://img.shields.io/bundlephobia/minzip/suspend-react@0.0.8?label=bundle%20size&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/result?p=suspend-react)
[![Version](https://img.shields.io/npm/v/suspend-react?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/suspend-react)

<br />
<a href="https://github.com/pmndrs/suspend-react"><img src="https://github.com/pmndrs/suspend-react/blob/main/hero.svg?raw=true" /></a>
<br />
<br />

```shell
npm install suspend-react
```

This library integrates your async ops into React suspense. Pending- and error-states are handled at the parental level which frees the individual component from that burden and allows for better orchestration. Think of it as async/await for components. **Works in all React versions >= 16.6**.

```jsx
import { Suspense } from 'react'
import { suspend } from 'suspend-react'

function Post({ id, version }) {
  const data = suspend(async () => {
    const res = await fetch(`https://hacker-news.firebaseio.com/${version}/item/${id}.json`)
    return res.json()    
  }, [id, version])
  return (
    <div>
      {data.title} by {data.by}
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<div>loading...</div>}>
      <Post id={1000} version="v0" />
    </Suspense>
  )
}
```

#### API

```tsx
const suspend = <Keys extends Tuple<unknown>, Fn extends (...keys: Keys) => Promise<unknown>>(
  fn: Fn | Promise<unknown>,
  keys?: Keys,
  config?: Config
) => Await<ReturnType<Fn>>
```

```tsx
// Function that returns a promise
const result = suspend((...keys) => anyPromise, keys, config)
// async function
const result = suspend(async (...keys) => { /* ... */ }, keys, config)
// Promise with keys
const result = suspend(anyPromise, keys, config)
// Promise itself is the key
const result = suspend(anyPromise)
```

`suspend` yields control back to React and the render-phase is aborted. It will resume once your promise resolves. For this to work you need to wrap it into a `<React.Suspense>` block, which requires you to set a fallback (can be `null`).

The dependencies (the 2nd argument) act as cache-keys, use as many as you want. If an entry is already in cache, calling `suspend` with the same keys will return it _immediately_ without breaking the render-phase. Cache access is similar to useMemo but *across the component tree*.

The 1st argument has to be a promise, or a function that returns a promise, or an asyn function. It receives the keys as arguments. `suspend` will return the resolved value, not a promise! This is guaranteed, *you do not have to check for validity*. Errors will bubble up to the nearest error-boundary.

#### Config

Both `suspend` and `preload` can _optionally_ receive a config object,

###### Keep-alive

The `lifespan` prop allows you to invalidate items over time, it defaults to `0` (keep-alive forever). Every read refreshes the timer to ensure that used entries stay valid.

```jsx
// Keep cached item alive for one minute without read
suspend(fn, keys, { lifespan: 60000 })
```

###### Equality function

The `equal` prop customizes per-key validation, it defaults to `(a, b) => a === b` (reference equality).

```jsx
import equal from 'fast-deep-equal'

// Validate keys deeply
suspend(fn, keys, { equal })
```

#### Preloading

```jsx
import { preload } from 'suspend-react'

async function fetchFromHN(id, version) {
  const res = await fetch(`https://hacker-news.firebaseio.com/${version}/item/${id}.json`)
  return res.json()
}

preload(fetchFromHN, [1000, 'v0'])
```

#### Cache busting

```jsx
import { clear } from 'suspend-react'

// Clear all cached entries
clear()
// Clear a specific entry
clear([1000, 'v0'])
```

#### Peeking into entries outside of suspense

```jsx
import { peek } from 'suspend-react'

// This will either return the value (without suspense!) or undefined
peek([1000, 'v0'])
```

#### Making cache-keys unique

Since `suspend` operates on a global cache (for now, see [React 18](#react-18)), you might be wondering if keys could bleed, and yes they would. To establish cache-safety, create unique or semi-unique appendixes.

```diff
- suspend(fn, [1000, 'v0'])
+ suspend(fn, [1000, 'v0', 'functionName/fetch'])
```

If you publish a library that suspends, consider symbols.

```jsx
const fetchUUID = Symbol()

export function Foo() {
  suspend(fn, [1000, 'v0', fetchUUID])
```

#### Typescript

Correct types will be inferred automatically.

#### React 18

Suspense, as is, has been a stable part of React since 16.6, but React will likely add some [interesting caching and cache busting APIs](https://github.com/reactwg/react-18/discussions/25) that could allow you to define cache boundaries declaratively. Expect these to be work for suspend-react once they come out.

#### Demos

Fetching posts from hacker-news: [codesandbox](https://codesandbox.io/s/use-asset-forked-yb62q)

Infinite list: [codesandbox](https://codesandbox.io/s/use-asset-infinite-list-forked-cwvs7)
