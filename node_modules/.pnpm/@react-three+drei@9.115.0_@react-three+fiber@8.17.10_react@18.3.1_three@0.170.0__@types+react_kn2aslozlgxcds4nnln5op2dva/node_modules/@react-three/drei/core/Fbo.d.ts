import * as React from 'react';
import * as THREE from 'three';
import { TextureEncoding } from '../helpers/deprecated';
type ColorSpace = 'srgb' | 'srgb-linear' | '' | string;
type FBOSettings = {
    samples?: number;
    depth?: boolean;
    wrapS?: THREE.Wrapping | undefined;
    wrapT?: THREE.Wrapping | undefined;
    magFilter?: THREE.MagnificationTextureFilter | undefined;
    minFilter?: THREE.MinificationTextureFilter | undefined;
    format?: number | undefined;
    type?: THREE.TextureDataType | undefined;
    anisotropy?: number | undefined;
    depthBuffer?: boolean | undefined;
    stencilBuffer?: boolean | undefined;
    generateMipmaps?: boolean | undefined;
    depthTexture?: THREE.DepthTexture | undefined;
    encoding?: TextureEncoding | undefined;
    colorSpace?: ColorSpace | undefined;
};
export declare function useFBO(width?: number | FBOSettings, height?: number, settings?: FBOSettings): THREE.WebGLRenderTarget;
export declare const Fbo: ({ children, width, height, ...settings }: {
    children?: (target: ReturnType<typeof useFBO>) => React.ReactNode;
    width: Parameters<typeof useFBO>[0];
    height: Parameters<typeof useFBO>[1];
} & FBOSettings) => React.JSX.Element;
export {};
