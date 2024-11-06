import { Color, ColorRepresentation } from 'three';
import { ReactThreeFiber, Vector2 as FiberVector2, Vector3 as FiberVector3 } from '@react-three/fiber';
import { LineMaterial, LineMaterialParameters, Line2, LineSegments2 } from 'three-stdlib';
import { ForwardRefComponent } from '../helpers/ts-utils';
export type LineProps = {
    points: ReadonlyArray<FiberVector2 | FiberVector3>;
    vertexColors?: ReadonlyArray<Color | [number, number, number] | [number, number, number, number]>;
    lineWidth?: number;
    segments?: boolean;
} & Omit<LineMaterialParameters, 'vertexColors' | 'color'> & Omit<ReactThreeFiber.Object3DNode<Line2, typeof Line2>, 'args'> & Omit<ReactThreeFiber.Object3DNode<LineMaterial, [LineMaterialParameters]>, 'color' | 'vertexColors' | 'args'> & {
    color?: ColorRepresentation;
};
export declare const Line: ForwardRefComponent<LineProps, Line2 | LineSegments2>;
