import * as React from 'react';
import * as THREE from 'three';
import { GroupProps } from '@react-three/fiber';
export interface BBAnchorProps extends GroupProps {
    anchor: THREE.Vector3 | [number, number, number];
}
export declare const BBAnchor: ({ anchor, ...props }: BBAnchorProps) => React.JSX.Element;
