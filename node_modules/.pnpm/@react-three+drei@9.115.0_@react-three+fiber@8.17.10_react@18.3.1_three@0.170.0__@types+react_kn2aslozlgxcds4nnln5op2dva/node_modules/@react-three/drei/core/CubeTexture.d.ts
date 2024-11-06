import * as React from 'react';
import { CubeTexture as _CubeTexture, Texture } from 'three';
type Options = {
    path: string;
};
export declare function useCubeTexture(files: string[], { path }: Options): _CubeTexture;
export declare namespace useCubeTexture {
    var preload: (files: string[], { path }: Options) => undefined;
}
type CubeTextureProps = {
    children?: (tex: Texture) => React.ReactNode;
    files: Parameters<typeof useCubeTexture>[0];
} & Options;
export declare function CubeTexture({ children, files, ...options }: CubeTextureProps): React.JSX.Element;
export {};
