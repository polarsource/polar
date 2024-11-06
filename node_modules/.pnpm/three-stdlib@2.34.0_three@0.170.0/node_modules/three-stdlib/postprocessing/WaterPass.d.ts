import { WebGLRenderer, WebGLRenderTarget, ShaderMaterial, Vector2, IUniform, Texture } from 'three';
import { Pass, FullScreenQuad } from '../postprocessing/Pass';
/**
 * Simple underwater shader
 *
 
 parameters:
 tex: texture
 time: this should increase with time passing
 factor: to what degree will the shader distort the screen

 explaination:
 the shader is quite simple
 it chooses a center and start from there make pixels around it to "swell" then "shrink" then "swell"...
 this is of course nothing really similar to underwater scene
 but you can combine several this shaders together to create the effect you need...
 And yes, this shader could be used for something other than underwater effect, for example, magnifier effect :)

 * @author vergil Wang
 */
declare class WaterPass extends Pass {
    material: ShaderMaterial;
    fsQuad: FullScreenQuad;
    factor: number;
    time: number;
    uniforms: {
        tex: IUniform<Texture>;
        time: IUniform<number>;
        factor: IUniform<number>;
        resolution: IUniform<Vector2>;
    };
    constructor();
    render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void;
}
export { WaterPass };
