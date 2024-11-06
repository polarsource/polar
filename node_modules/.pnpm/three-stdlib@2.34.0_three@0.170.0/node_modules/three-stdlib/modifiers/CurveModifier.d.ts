import { DataTexture, Mesh, InstancedMesh, Material, Curve, BufferGeometry } from 'three';
import type { IUniform } from 'three';
/**
 * Make a new DataTexture to store the descriptions of the curves.
 *
 * @param { number } numberOfCurves the number of curves needed to be described by this texture.
 */
export declare const initSplineTexture: (numberOfCurves?: number) => DataTexture;
/**
 * Write the curve description to the data texture
 *
 * @param { DataTexture } texture The DataTexture to write to
 * @param { Curve } splineCurve The curve to describe
 * @param { number } offset Which curve slot to write to
 */
export declare const updateSplineTexture: <TCurve extends Curve<any>>(texture: DataTexture, splineCurve: TCurve, offset?: number) => void;
export interface INumericUniform extends IUniform {
    type: 'f' | 'i';
    value: number;
}
export type CurveModifierUniforms = {
    spineTexture: IUniform<DataTexture>;
    pathOffset: INumericUniform;
    pathSegment: INumericUniform;
    spineOffset: INumericUniform;
    spineLength: INumericUniform;
    flow: INumericUniform;
};
/**
 * Create a new set of uniforms for describing the curve modifier
 *
 * @param { DataTexture } Texture which holds the curve description
 */
export declare const getUniforms: (splineTexture: DataTexture) => CurveModifierUniforms;
export type ModifiedMaterial<TMaterial extends Material> = TMaterial & {
    __ok: boolean;
};
export declare function modifyShader<TMaterial extends Material = Material>(material: ModifiedMaterial<TMaterial>, uniforms: CurveModifierUniforms, numberOfCurves?: number): void;
/**
 * A helper class for making meshes bend aroudn curves
 */
export declare class Flow<TMesh extends Mesh = Mesh> {
    curveArray: Curve<any>[];
    curveLengthArray: number[];
    object3D: TMesh;
    splineTexure: DataTexture;
    uniforms: CurveModifierUniforms;
    /**
     * @param {Mesh} mesh The mesh to clone and modify to bend around the curve
     * @param {number} numberOfCurves The amount of space that should preallocated for additional curves
     */
    constructor(mesh: TMesh, numberOfCurves?: number);
    updateCurve<TCurve extends Curve<any>>(index: number, curve: TCurve): void;
    moveAlongCurve(amount: number): void;
}
/**
 * A helper class for creating instanced versions of flow, where the instances are placed on the curve.
 */
export declare class InstancedFlow<TGeometry extends BufferGeometry = BufferGeometry, TMaterial extends Material = Material> extends Flow<InstancedMesh<TGeometry, TMaterial>> {
    offsets: number[];
    whichCurve: number[];
    /**
     *
     * @param {number} count The number of instanced elements
     * @param {number} curveCount The number of curves to preallocate for
     * @param {Geometry} geometry The geometry to use for the instanced mesh
     * @param {Material} material The material to use for the instanced mesh
     */
    constructor(count: number, curveCount: number, geometry: TGeometry, material: TMaterial);
    /**
     * The extra information about which curve and curve position is stored in the translation components of the matrix for the instanced objects
     * This writes that information to the matrix and marks it as needing update.
     *
     * @param {number} index of the instanced element to update
     */
    private writeChanges;
    /**
     * Move an individual element along the curve by a specific amount
     *
     * @param {number} index Which element to update
     * @param {number} offset Move by how much
     */
    moveIndividualAlongCurve(index: number, offset: number): void;
    /**
     * Select which curve to use for an element
     *
     * @param {number} index the index of the instanced element to update
     * @param {number} curveNo the index of the curve it should use
     */
    setCurve(index: number, curveNo: number): void;
}
