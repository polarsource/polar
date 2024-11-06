import { Loader } from 'three';
import type { LoadingManager, Shape } from 'three';
type Options = {
    lineHeight: number;
    letterSpacing: number;
};
export declare class FontLoader extends Loader {
    constructor(manager?: LoadingManager);
    load(url: string, onLoad?: (responseFont: Font) => void, onProgress?: (event: ProgressEvent) => void, onError?: (event: ErrorEvent) => void): void;
    loadAsync(url: string, onProgress?: (event: ProgressEvent) => void): Promise<Font>;
    parse(json: FontData): Font;
}
type Glyph = {
    _cachedOutline: string[];
    ha: number;
    o: string;
};
type FontData = {
    boundingBox: {
        yMax: number;
        yMin: number;
    };
    familyName: string;
    glyphs: {
        [k: string]: Glyph;
    };
    resolution: number;
    underlineThickness: number;
};
export declare class Font {
    data: FontData;
    static isFont: true;
    static type: 'Font';
    constructor(data: FontData);
    generateShapes(text: string, size?: number, _options?: Partial<Options>): Shape[];
}
export {};
