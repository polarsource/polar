import { ExtrudeGeometry } from 'three';
import type { Font } from '../loaders/FontLoader';
export type TextGeometryParameters = {
    bevelEnabled?: boolean;
    bevelOffset?: number;
    bevelSize?: number;
    bevelThickness?: number;
    curveSegments?: number;
    font: Font;
    height?: number;
    size?: number;
    lineHeight?: number;
    letterSpacing?: number;
};
export declare class TextGeometry extends ExtrudeGeometry {
    constructor(text: string, parameters?: TextGeometryParameters);
}
export { TextGeometry as TextBufferGeometry };
