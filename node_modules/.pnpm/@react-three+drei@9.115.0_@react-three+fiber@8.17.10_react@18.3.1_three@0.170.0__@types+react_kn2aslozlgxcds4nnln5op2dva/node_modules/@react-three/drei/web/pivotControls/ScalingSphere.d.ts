import * as React from 'react';
import * as THREE from 'three';
export declare const calculateOffset: (clickPoint: THREE.Vector3, normal: THREE.Vector3, rayStart: THREE.Vector3, rayDir: THREE.Vector3) => number;
export declare const ScalingSphere: React.FC<{
    direction: THREE.Vector3;
    axis: 0 | 1 | 2;
}>;
