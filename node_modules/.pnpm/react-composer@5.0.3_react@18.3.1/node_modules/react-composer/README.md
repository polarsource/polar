# React Composer

[![Travis build status](http://img.shields.io/travis/jamesplease/react-composer.svg?style=flat)](https://travis-ci.org/jamesplease/react-composer)
[![npm version](https://img.shields.io/npm/v/react-composer.svg)](https://www.npmjs.com/package/react-composer)
[![npm downloads](https://img.shields.io/npm/dm/react-composer.svg)](https://www.npmjs.com/package/react-composer)
[![Test Coverage](https://coveralls.io/repos/github/jamesplease/react-composer/badge.svg?branch=master)](https://coveralls.io/github/jamesplease/react-composer?branch=master)
[![gzip size](http://img.badgesize.io/https://unpkg.com/react-composer/dist/react-composer.min.js?compression=gzip)](https://unpkg.com/react-composer/dist/react-composer.min.js)

Compose [render prop](https://reactjs.org/docs/render-props.html) components.

## Motivation

Render props are great. Using a component with a render prop looks like the following:

```jsx
<RenderPropComponent {...config}>
  {result => <MyComponent result={result} />}
</RenderPropComponent>
```

Sometimes you need the result of multiple render prop components inside of `MyComponent`. This
can get messy.

```jsx
<RenderPropComponent {...config}>
  {resultOne => (
    <RenderPropComponent {...configTwo}>
      {resultTwo => (
        <RenderPropComponent {...configThree}>
          {resultThree => (
            <MyComponent results={{ resultOne, resultTwo, resultThree }} />
          )}
        </RenderPropComponent>
      )}
    </RenderPropComponent>
  )}
</RenderPropComponent>
```

Nesting render prop components leads to rightward drift of your code. Use React Composer to
prevent that drift.

```jsx
import Composer from 'react-composer';

<Composer
  components={[
    <RenderPropComponent {...configOne} />,
    <RenderPropComponent {...configTwo} />,
    <RenderPropComponent {...configThree} />
  ]}>
  {([resultOne, resultTwo, resultThree]) => (
    <MyComponent results={{ resultOne, resultTwo, resultThree }} />
  )}
</Composer>;
```

## Installation

Install using [npm](https://www.npmjs.com):

```
npm install react-composer
```

or [yarn](https://yarnpkg.com/):

```
yarn add react-composer
```

## API

This library has one, default export: `Composer`.

### `<Composer />`

Compose multiple render prop components together. The props are as
follows:

### `props.children`

A render function that is called with an array of results accumulated from the render prop components.

```jsx
<Composer components={[]}>
  {results => {
    /* Do something with results... Return a valid React element. */
  }}
</Composer>
```

### `props.components`

The render prop components to compose. This is an array of [React elements](https://reactjs.org/docs/glossary.html#elements) and/or render functions that are invoked with a render function and the currently accumulated results.

```jsx
<Composer
  components={[
    // React elements may be passed for basic use cases
    // props.children will be provided via React.cloneElement
    <Outer />,

    // Render functions may be passed for added flexibility and control
    ({ results, render }) => (
      <Middle previousResults={results} children={render} />
    )
  ]}>
  {([outerResult, middleResult]) => {
    /* Do something with results... Return a valid React element. */
  }}
</Composer>
```

> **Note:** You do not need to provide `props.children` to the React element entries in `props.components`. If you do provide `props.children` to these elements, it will be ignored and overwritten.

#### `props.components` as render functions

A render function may be passed instead of a React element for added flexibility.

Render functions provided must return a valid React element. Render functions will be invoked with an object containing 2 properties:

1.  `results`: The currently accumulated results. You can use this for render prop components which depend on the results of other render prop components.
2.  `render`: The render function for the component to invoke with the value produced. Plug this into your render prop component. This will typically be plugged in as `props.children` or `props.render`.

```jsx
<Composer
  components={[
    // props.components may contain both elements and render functions
    <Outer />,
    ({ /* results, */ render }) => <SomeComponent children={render} />
  ]}>
  {results => {
    /* Do something with results... */
  }}
</Composer>
```

## Examples and Guides

### Example: Render prop component(s) depending on the result of other render prop component(s)

```jsx
<Composer
  components={[
    <Outer />,
    ({ results: [outerResult], render }) => (
      <Middle fromOuter={outerResult} children={render} />
    ),
    ({ results, render }) => (
      <Inner fromOuterAndMiddle={results} children={render} />
    )
    // ...
  ]}>
  {([outerResult, middleResult, innerResult]) => {
    /* Do something with results... */
  }}
</Composer>
```

### Example: Render props named other than `props.children`.

By default, `<Composer />` will enhance your React elements with `props.children`.

Render prop components typically use `props.children` or `props.render` as their render prop. Some even accept both. For cases when your render prop component's render prop is not `props.children` you can plug `render` in directly yourself. Example:

```jsx
<Composer
  components={[
    // Support varying named render props
    <RenderAsChildren />,
    ({ render }) => <RenderAsChildren children={render} />,
    ({ render }) => <RenderAsRender render={render} />,
    ({ render }) => <CustomRenderPropName renderItem={render} />
    // ...
  ]}>
  {results => {
    /* Do something with results... */
  }}
</Composer>
```

### Example: Render prop component(s) that produce multiple arguments

Example of how to handle cases when a component passes multiple arguments to its render prop rather than a single argument.

```jsx
<Composer
  components={[
    <Outer />,
    // Differing render prop signature (multi-arg producers)
    ({ render }) => (
      <ProducesMultipleArgs>
        {(one, two) => render([one, two])}
      </ProducesMultipleArgs>
    ),
    <Inner />
  ]}>
  {([outerResult, [one, two], innerResult]) => {
    /* Do something with results... */
  }}
</Composer>
```

### Limitations

This library only works for render prop components that have a single render
prop. So, for instance, this library will not work if your component has an API like the following:

```jsx
<RenderPropComponent onSuccess={onSuccess} onError={onError} />
```

### Render Order

The first item in the `components` array will be the outermost component that is rendered. So, for instance,
if you pass

```jsx
<Composer components={[<A/>, <B/>, <C/>]}>
```

then your tree will render like so:

```
- A
  - B
    - C
```

### Console Warnings

Render prop components often specify with [PropTypes](https://reactjs.org/docs/typechecking-with-proptypes.html)
that the render prop is required. When using these components with React Composer, you may get a warning in the
console.

One way to eliminate the warnings is to define the render prop as an empty function knowning that `Composer` will
overwrite it with the real render function.

```jsx
<Composer
  components={[
    <RenderPropComponent {...props} children={() => null} />
  ]}
  // ...
>
```

Alternatively, you can leverage the flexibility of the `props.components` as functions API and plug the render function in directly yourself.

```jsx
<Composer
  components={[
    ({render}) => <RenderPropComponent {...props} children={render} />
  ]}
  // ...
>
```

### Example Usage

Here are some examples of render prop components that benefit from React Composer:

* React's [Context API](https://reactjs.org/docs/context.html). See [this example](https://codesandbox.io/s/92pj14134y) by [Kent Dodds](https://twitter.com/kentcdodds).
* [React Request](https://github.com/jamesplease/react-request)
* Apollo's [Query component](https://www.apollographql.com/docs/react/essentials/queries.html#basic)

Do you know of a component that you think benefits from React Composer? Open a Pull Request and add it to the list!

## Contributing

Are you interested in helping out with this project? That's awesome – thank you! Head on over to
[the contributing guide](./CONTRIBUTING.md) to get started.
