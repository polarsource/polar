import * as React from 'react';
import { Raycaster, Camera, Intersection } from 'three';
export declare function useCamera(camera: Camera | React.MutableRefObject<Camera>, props?: Partial<Raycaster>): (_: Raycaster, intersects: Intersection[]) => void;
