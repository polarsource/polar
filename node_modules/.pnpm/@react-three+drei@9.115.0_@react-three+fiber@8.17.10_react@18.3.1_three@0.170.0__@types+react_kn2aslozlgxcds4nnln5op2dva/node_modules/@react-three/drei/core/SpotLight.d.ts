import * as React from 'react';
import { DepthTexture, SpotLight as SpotLightImpl, Texture } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
type SpotLightProps = JSX.IntrinsicElements['spotLight'] & {
    depthBuffer?: DepthTexture;
    attenuation?: number;
    anglePower?: number;
    radiusTop?: number;
    radiusBottom?: number;
    opacity?: number;
    color?: string | number;
    volumetric?: boolean;
    debug?: boolean;
};
interface ShadowMeshProps {
    distance?: number;
    alphaTest?: number;
    scale?: number;
    map?: Texture;
    shader?: string;
    width?: number;
    height?: number;
}
export declare function SpotLightShadow(props: React.PropsWithChildren<ShadowMeshProps>): React.JSX.Element;
declare const SpotLight: ForwardRefComponent<React.PropsWithChildren<SpotLightProps>, SpotLightImpl>;
export { SpotLight };
