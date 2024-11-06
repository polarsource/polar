import * as React from 'react';
import { Texture } from 'three';
export declare function useMatcapTexture(id?: number | string, format?: number, onLoad?: (texture: Texture | Texture[]) => void): [Texture, string, number];
export declare const MatcapTexture: ({ children, id, format, onLoad, }: {
    children?: (texture: ReturnType<typeof useMatcapTexture>) => React.ReactNode;
    id?: Parameters<typeof useMatcapTexture>[0];
    format?: Parameters<typeof useMatcapTexture>[1];
    onLoad?: Parameters<typeof useMatcapTexture>[2];
}) => React.JSX.Element;
