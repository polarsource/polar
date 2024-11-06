import * as THREE from 'three';
import { MeshBVHUniformStruct } from 'three-mesh-bvh';
export declare function shaderMaterial(uniforms: {
    [name: string]: THREE.CubeTexture | THREE.Texture | Int32Array | Float32Array | THREE.Matrix4 | THREE.Matrix3 | THREE.Quaternion | THREE.Vector4 | THREE.Vector3 | THREE.Vector2 | THREE.Color | MeshBVHUniformStruct | number | boolean | Array<any> | null;
}, vertexShader: string, fragmentShader: string, onInit?: (material?: THREE.ShaderMaterial) => void): typeof THREE.ShaderMaterial & {
    key: string;
};
