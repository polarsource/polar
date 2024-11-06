# Installation
> `npm install --save @types/debounce`

# Summary
This package contains type definitions for debounce (https://github.com/component/debounce).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/debounce.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/debounce/index.d.ts)
````ts
declare namespace _debounce {
    const debounce: typeof _debounce;
}

declare function _debounce<A extends Function>(
    f: A,
    interval?: number,
    immediate?: boolean,
): A & { clear(): void } & { flush(): void };

export = _debounce;

````

### Additional Details
 * Last updated: Mon, 06 Nov 2023 22:41:05 GMT
 * Dependencies: none

# Credits
These definitions were written by [Denis Sokolov](https://github.com/denis-sokolov), and [Wayne Carson](https://github.com/wcarson).
