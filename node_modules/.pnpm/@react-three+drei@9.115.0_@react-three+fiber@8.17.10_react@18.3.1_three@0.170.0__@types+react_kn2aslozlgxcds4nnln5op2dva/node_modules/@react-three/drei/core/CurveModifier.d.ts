import * as React from 'react';
import * as THREE from 'three';
import { Flow } from 'three-stdlib';
import { ForwardRefComponent } from '../helpers/ts-utils';
export interface CurveModifierProps {
    children: React.ReactElement<JSX.IntrinsicElements['mesh']>;
    curve?: THREE.Curve<THREE.Vector3>;
}
export type CurveModifierRef = Pick<Flow, 'moveAlongCurve'>;
export declare const CurveModifier: ForwardRefComponent<CurveModifierProps, CurveModifierRef>;
