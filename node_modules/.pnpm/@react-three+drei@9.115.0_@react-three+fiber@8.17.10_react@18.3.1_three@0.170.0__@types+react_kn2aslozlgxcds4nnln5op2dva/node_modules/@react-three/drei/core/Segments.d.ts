import * as THREE from 'three';
import * as React from 'react';
import { ReactThreeFiber } from '@react-three/fiber';
import { Line2, LineMaterialParameters } from 'three-stdlib';
import { ForwardRefComponent } from '../helpers/ts-utils';
type SegmentsProps = LineMaterialParameters & {
    limit?: number;
    lineWidth?: number;
    children: React.ReactNode;
};
type SegmentProps = Omit<JSX.IntrinsicElements['segmentObject'], 'start' | 'end' | 'color'> & {
    start: ReactThreeFiber.Vector3;
    end: ReactThreeFiber.Vector3;
    color?: ReactThreeFiber.Color;
};
declare const Segments: ForwardRefComponent<SegmentsProps, Line2>;
declare global {
    namespace JSX {
        interface IntrinsicElements {
            segmentObject: ReactThreeFiber.Object3DNode<SegmentObject, typeof SegmentObject>;
        }
    }
}
export declare class SegmentObject {
    color: THREE.Color;
    start: THREE.Vector3;
    end: THREE.Vector3;
    constructor();
}
declare const Segment: ForwardRefComponent<SegmentProps, SegmentObject>;
export { Segments, Segment };
