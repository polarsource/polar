# Installation
> `npm install --save @types/stats.js`

# Summary
This package contains type definitions for stats.js (https://github.com/mrdoob/stats.js).

# Details
Files were exported from https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/stats.js.
## [index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/stats.js/index.d.ts)
````ts
declare class Stats {
    constructor();
    REVISION: number;
    dom: HTMLDivElement;

    /**
     * @param value 0:fps, 1: ms, 2: mb, 3+: custom
     */
    showPanel(value: number): void;
    begin(): void;
    end(): number;
    update(): void;

    addPanel(panel: Stats.Panel): Stats.Panel;
}

declare namespace Stats {
    class Panel {
        constructor(name: string, foregroundColor: string, backgroundColor: string);
        dom: HTMLCanvasElement;
        update(value: number, maxValue: number): void;
    }
}

declare module "stats.js" {
    export = Stats;
}

````

### Additional Details
 * Last updated: Tue, 07 Nov 2023 15:11:36 GMT
 * Dependencies: none

# Credits
These definitions were written by [Gregory Dalton](https://github.com/gregolai), [Harm Berntsen](https://github.com/hberntsen), and [Dan Vanderkam](https://github.com/danvk).
