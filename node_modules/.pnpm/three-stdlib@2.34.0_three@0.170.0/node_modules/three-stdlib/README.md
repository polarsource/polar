# three-stdlib

[![Version](https://img.shields.io/npm/v/three-stdlib?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/three-stdlib)
[![Downloads](https://img.shields.io/npm/dt/three-stdlib.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/three-stdlib)
[![Twitter](https://img.shields.io/twitter/follow/pmndrs?label=%40pmndrs&style=flat&colorA=000000&colorB=000000&logo=twitter&logoColor=000000)](https://twitter.com/pmndrs)
[![Discord](https://img.shields.io/discord/740090768164651008?style=flat&colorA=000000&colorB=000000&label=discord&logo=discord&logoColor=000000)](https://discord.gg/ZZjjNvJ)
[![release](https://github.com/pmndrs/three-stdlib/actions/workflows/main.yml/badge.svg?style=flat&colorA=000000&colorB=000000)](https://github.com/pmndrs/three-stdlib/actions/workflows/main.yml)

Stand-alone version of [threejs/examples/jsm](https://github.com/mrdoob/three.js/tree/dev/examples/jsm) written in Typescript & built for ESM & CJS.

## Basic usage

```bash
npm install three-stdlib
```

```ts
// Export collection
import * as STDLIB from 'three-stdlib'
// Flatbundle
import { OrbitControls, ... } from 'three-stdlib'
```

## Problem

`three/examples` are usually regarded as something that you copy/paste into your project and adapt to your needs. That's not how people use it, and this has caused numerous issues in the past.

## Solution

- A build system for ESM and CJS, compatible with browser, workers, and Node
- Class based, optimized for tree-shaking, no globals, exports instead of collections
- Typesafety with simple annotation-like types
- SemVer and NPM managed dependencies

But most importantly, allowing more people that use and rely on these primitives to hold a little stake, and to share the weight of maintaining it.

## How to Contribute

1.  Fork and clone the repo
2.  Run `yarn install` to install dependencies
3.  Create a branch for your PR with `git checkout -b pr-type/issue-number-your-branch-name beta
4.  Let's get cooking! 👨🏻‍🍳🥓

### Commit Guidelines

Be sure your commit messages follow this specification: https://conventionalcommits.org/en/v1.0.0-beta.4

## Publishing

We use `semantic-release-action` to deploy the package. Because of this only certain commits will trigger the action of creating a release:

- `chore` will not release a new version
- `fix:` will create a `0.0.x` version
- `feat:` will create a `0.x.0` version
- `BREAKING CHANGE:` will create a `x.0.0` version