import * as React from 'react';
import { GLTFLoader, GLTF } from 'three-stdlib';
import { ObjectMap } from '@react-three/fiber';
import { Clone } from './Clone';
type Path = string | string[];
type UseDraco = boolean | string;
type UseMeshopt = boolean;
type ExtendLoader = (loader: GLTFLoader) => void;
export declare const useGLTF: {
    <T extends Path>(path: T, useDraco?: UseDraco, useMeshopt?: UseMeshopt, extendLoader?: ExtendLoader): T extends any[] ? (GLTF & ObjectMap)[] : GLTF & ObjectMap;
    preload(path: Path, useDraco?: UseDraco, useMeshopt?: UseMeshopt, extendLoader?: ExtendLoader): undefined;
    clear(path: Path): void;
    setDecoderPath(path: string): void;
};
type CloneProps = React.ComponentProps<typeof Clone>;
type GltfProps = Omit<CloneProps, 'object'> & {
    src: string;
    useDraco?: UseDraco;
    useMeshOpt?: UseMeshopt;
    extendLoader?: ExtendLoader;
};
export declare const Gltf: React.ForwardRefExoticComponent<Omit<GltfProps, "ref"> & React.RefAttributes<import("three").Group>>;
export {};
