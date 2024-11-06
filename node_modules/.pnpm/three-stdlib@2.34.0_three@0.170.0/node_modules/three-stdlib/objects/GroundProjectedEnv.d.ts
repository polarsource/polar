import { Mesh, ShaderMaterial, Texture, CubeTexture, BufferGeometry } from 'three';
export interface GroundProjectedEnvParameters {
    height?: number;
    radius?: number;
}
export declare class GroundProjectedEnv extends Mesh<BufferGeometry, ShaderMaterial> {
    constructor(texture: CubeTexture | Texture, options?: GroundProjectedEnvParameters);
    set radius(radius: number);
    get radius(): number;
    set height(height: number);
    get height(): number;
}
