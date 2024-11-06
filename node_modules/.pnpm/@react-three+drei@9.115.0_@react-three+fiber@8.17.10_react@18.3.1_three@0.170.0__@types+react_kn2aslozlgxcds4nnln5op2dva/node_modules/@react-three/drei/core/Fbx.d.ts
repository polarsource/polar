import * as React from 'react';
import { Group } from 'three';
import { Clone } from './Clone';
export declare function useFBX(path: string): Group;
export declare namespace useFBX {
    var preload: (path: string) => undefined;
    var clear: (input: string | string[]) => void;
}
export declare function Fbx({ path, ...props }: {
    path: Parameters<typeof useFBX>[0];
} & Omit<React.ComponentProps<typeof Clone>, 'object'>): React.JSX.Element;
