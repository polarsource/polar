import * as React from 'react';
import { Object3D } from 'three';
export declare function useIntersect<T extends Object3D>(onChange: (visible: boolean) => void): React.MutableRefObject<T>;
