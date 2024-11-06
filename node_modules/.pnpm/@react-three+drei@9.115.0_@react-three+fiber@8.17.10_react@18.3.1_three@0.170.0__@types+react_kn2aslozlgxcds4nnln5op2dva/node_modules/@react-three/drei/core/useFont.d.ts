export type Glyph = {
    _cachedOutline: string[];
    ha: number;
    o: string;
};
export type FontData = {
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
type FontInput = string | FontData;
export declare function useFont(font: FontInput): import("three-stdlib").Font;
export declare namespace useFont {
    var preload: (font: FontInput) => undefined;
    var clear: (font: FontInput) => void;
}
export {};
