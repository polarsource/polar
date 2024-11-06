import * as React from 'react';
import { Texture } from 'three';
type Settings = {
    repeat?: number[];
    anisotropy?: number;
    offset?: number[];
};
export declare function useNormalTexture(id?: number, settings?: Settings, onLoad?: (texture: Texture | Texture[]) => void): [Texture, string, number];
export declare const NormalTexture: ({ children, id, onLoad, ...settings }: {
    children?: (texture: ReturnType<typeof useNormalTexture>) => React.ReactNode;
    id?: Parameters<typeof useNormalTexture>[0];
    onLoad?: Parameters<typeof useNormalTexture>[2];
} & Settings) => React.JSX.Element;
export {};
