export interface NumberGenerator {
    random: () => number;
}
export declare class SimplexNoise {
    private grad3;
    private grad4;
    private p;
    private perm;
    private simplex;
    /**
     * You can pass in a random number generator object if you like.
     * It is assumed to have a random() method.
     */
    constructor(r?: NumberGenerator);
    dot: (g: number[], x: number, y: number) => number;
    dot3: (g: number[], x: number, y: number, z: number) => number;
    dot4: (g: number[], x: number, y: number, z: number, w: number) => number;
    noise: (xin: number, yin: number) => number;
    private noise3d;
    noise4d: (x: number, y: number, z: number, w: number) => number;
}
