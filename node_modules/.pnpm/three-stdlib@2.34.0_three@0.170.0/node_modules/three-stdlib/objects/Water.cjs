"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class Water extends THREE.Mesh {
  constructor(geometry, options = {}) {
    super(geometry);
    this.isWater = true;
    const scope = this;
    const textureWidth = options.textureWidth !== void 0 ? options.textureWidth : 512;
    const textureHeight = options.textureHeight !== void 0 ? options.textureHeight : 512;
    const clipBias = options.clipBias !== void 0 ? options.clipBias : 0;
    const alpha = options.alpha !== void 0 ? options.alpha : 1;
    const time = options.time !== void 0 ? options.time : 0;
    const normalSampler = options.waterNormals !== void 0 ? options.waterNormals : null;
    const sunDirection = options.sunDirection !== void 0 ? options.sunDirection : new THREE.Vector3(0.70707, 0.70707, 0);
    const sunColor = new THREE.Color(options.sunColor !== void 0 ? options.sunColor : 16777215);
    const waterColor = new THREE.Color(options.waterColor !== void 0 ? options.waterColor : 8355711);
    const eye = options.eye !== void 0 ? options.eye : new THREE.Vector3(0, 0, 0);
    const distortionScale = options.distortionScale !== void 0 ? options.distortionScale : 20;
    const side = options.side !== void 0 ? options.side : THREE.FrontSide;
    const fog = options.fog !== void 0 ? options.fog : false;
    const mirrorPlane = new THREE.Plane();
    const normal = new THREE.Vector3();
    const mirrorWorldPosition = new THREE.Vector3();
    const cameraWorldPosition = new THREE.Vector3();
    const rotationMatrix = new THREE.Matrix4();
    const lookAtPosition = new THREE.Vector3(0, 0, -1);
    const clipPlane = new THREE.Vector4();
    const view = new THREE.Vector3();
    const target = new THREE.Vector3();
    const q = new THREE.Vector4();
    const textureMatrix = new THREE.Matrix4();
    const mirrorCamera = new THREE.PerspectiveCamera();
    const renderTarget = new THREE.WebGLRenderTarget(textureWidth, textureHeight);
    const mirrorShader = {
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib["fog"],
        THREE.UniformsLib["lights"],
        {
          normalSampler: { value: null },
          mirrorSampler: { value: null },
          alpha: { value: 1 },
          time: { value: 0 },
          size: { value: 1 },
          distortionScale: { value: 20 },
          textureMatrix: { value: new THREE.Matrix4() },
          sunColor: { value: new THREE.Color(8355711) },
          sunDirection: { value: new THREE.Vector3(0.70707, 0.70707, 0) },
          eye: { value: new THREE.Vector3() },
          waterColor: { value: new THREE.Color(5592405) }
        }
      ]),
      vertexShader: (
        /* glsl */
        `
				uniform mat4 textureMatrix;
				uniform float time;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;

				#include <common>
				#include <fog_pars_vertex>
				#include <shadowmap_pars_vertex>
				#include <logdepthbuf_pars_vertex>

				void main() {
					mirrorCoord = modelMatrix * vec4( position, 1.0 );
					worldPosition = mirrorCoord.xyzw;
					mirrorCoord = textureMatrix * mirrorCoord;
					vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );
					gl_Position = projectionMatrix * mvPosition;

				#include <beginnormal_vertex>
				#include <defaultnormal_vertex>
				#include <logdepthbuf_vertex>
				#include <fog_vertex>
				#include <shadowmap_vertex>
			}`
      ),
      fragmentShader: (
        /* glsl */
        `
				uniform sampler2D mirrorSampler;
				uniform float alpha;
				uniform float time;
				uniform float size;
				uniform float distortionScale;
				uniform sampler2D normalSampler;
				uniform vec3 sunColor;
				uniform vec3 sunDirection;
				uniform vec3 eye;
				uniform vec3 waterColor;

				varying vec4 mirrorCoord;
				varying vec4 worldPosition;

				vec4 getNoise( vec2 uv ) {
					vec2 uv0 = ( uv / 103.0 ) + vec2(time / 17.0, time / 29.0);
					vec2 uv1 = uv / 107.0-vec2( time / -19.0, time / 31.0 );
					vec2 uv2 = uv / vec2( 8907.0, 9803.0 ) + vec2( time / 101.0, time / 97.0 );
					vec2 uv3 = uv / vec2( 1091.0, 1027.0 ) - vec2( time / 109.0, time / -113.0 );
					vec4 noise = texture2D( normalSampler, uv0 ) +
						texture2D( normalSampler, uv1 ) +
						texture2D( normalSampler, uv2 ) +
						texture2D( normalSampler, uv3 );
					return noise * 0.5 - 1.0;
				}

				void sunLight( const vec3 surfaceNormal, const vec3 eyeDirection, float shiny, float spec, float diffuse, inout vec3 diffuseColor, inout vec3 specularColor ) {
					vec3 reflection = normalize( reflect( -sunDirection, surfaceNormal ) );
					float direction = max( 0.0, dot( eyeDirection, reflection ) );
					specularColor += pow( direction, shiny ) * sunColor * spec;
					diffuseColor += max( dot( sunDirection, surfaceNormal ), 0.0 ) * sunColor * diffuse;
				}

				#include <common>
				#include <packing>
				#include <bsdfs>
				#include <fog_pars_fragment>
				#include <logdepthbuf_pars_fragment>
				#include <lights_pars_begin>
				#include <shadowmap_pars_fragment>
				#include <shadowmask_pars_fragment>

				void main() {

					#include <logdepthbuf_fragment>
					vec4 noise = getNoise( worldPosition.xz * size );
					vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );

					vec3 diffuseLight = vec3(0.0);
					vec3 specularLight = vec3(0.0);

					vec3 worldToEye = eye-worldPosition.xyz;
					vec3 eyeDirection = normalize( worldToEye );
					sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );

					float distance = length(worldToEye);

					vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;
					vec3 reflectionSample = vec3( texture2D( mirrorSampler, mirrorCoord.xy / mirrorCoord.w + distortion ) );

					float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );
					float rf0 = 0.3;
					float reflectance = rf0 + ( 1.0 - rf0 ) * pow( ( 1.0 - theta ), 5.0 );
					vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;
					vec3 albedo = mix( ( sunColor * diffuseLight * 0.3 + scatter ) * getShadowMask(), ( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight ), reflectance);
					vec3 outgoingLight = albedo;
					gl_FragColor = vec4( outgoingLight, alpha );

					#include <tonemapping_fragment>
					#include <${parseInt(THREE.REVISION.replace(/\D+/g, "")) >= 154 ? "colorspace_fragment" : "encodings_fragment"}>
					#include <fog_fragment>	
				}`
      )
    };
    const material = new THREE.ShaderMaterial({
      fragmentShader: mirrorShader.fragmentShader,
      vertexShader: mirrorShader.vertexShader,
      uniforms: THREE.UniformsUtils.clone(mirrorShader.uniforms),
      lights: true,
      side,
      fog
    });
    material.uniforms["mirrorSampler"].value = renderTarget.texture;
    material.uniforms["textureMatrix"].value = textureMatrix;
    material.uniforms["alpha"].value = alpha;
    material.uniforms["time"].value = time;
    material.uniforms["normalSampler"].value = normalSampler;
    material.uniforms["sunColor"].value = sunColor;
    material.uniforms["waterColor"].value = waterColor;
    material.uniforms["sunDirection"].value = sunDirection;
    material.uniforms["distortionScale"].value = distortionScale;
    material.uniforms["eye"].value = eye;
    scope.material = material;
    scope.onBeforeRender = function(renderer, scene, camera) {
      mirrorWorldPosition.setFromMatrixPosition(scope.matrixWorld);
      cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
      rotationMatrix.extractRotation(scope.matrixWorld);
      normal.set(0, 0, 1);
      normal.applyMatrix4(rotationMatrix);
      view.subVectors(mirrorWorldPosition, cameraWorldPosition);
      if (view.dot(normal) > 0)
        return;
      view.reflect(normal).negate();
      view.add(mirrorWorldPosition);
      rotationMatrix.extractRotation(camera.matrixWorld);
      lookAtPosition.set(0, 0, -1);
      lookAtPosition.applyMatrix4(rotationMatrix);
      lookAtPosition.add(cameraWorldPosition);
      target.subVectors(mirrorWorldPosition, lookAtPosition);
      target.reflect(normal).negate();
      target.add(mirrorWorldPosition);
      mirrorCamera.position.copy(view);
      mirrorCamera.up.set(0, 1, 0);
      mirrorCamera.up.applyMatrix4(rotationMatrix);
      mirrorCamera.up.reflect(normal);
      mirrorCamera.lookAt(target);
      mirrorCamera.far = camera.far;
      mirrorCamera.updateMatrixWorld();
      mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);
      textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      textureMatrix.multiply(mirrorCamera.projectionMatrix);
      textureMatrix.multiply(mirrorCamera.matrixWorldInverse);
      mirrorPlane.setFromNormalAndCoplanarPoint(normal, mirrorWorldPosition);
      mirrorPlane.applyMatrix4(mirrorCamera.matrixWorldInverse);
      clipPlane.set(mirrorPlane.normal.x, mirrorPlane.normal.y, mirrorPlane.normal.z, mirrorPlane.constant);
      const projectionMatrix = mirrorCamera.projectionMatrix;
      q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
      q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
      q.z = -1;
      q.w = (1 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];
      clipPlane.multiplyScalar(2 / clipPlane.dot(q));
      projectionMatrix.elements[2] = clipPlane.x;
      projectionMatrix.elements[6] = clipPlane.y;
      projectionMatrix.elements[10] = clipPlane.z + 1 - clipBias;
      projectionMatrix.elements[14] = clipPlane.w;
      eye.setFromMatrixPosition(camera.matrixWorld);
      const currentRenderTarget = renderer.getRenderTarget();
      const currentXrEnabled = renderer.xr.enabled;
      const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
      scope.visible = false;
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(renderTarget);
      renderer.state.buffers.depth.setMask(true);
      if (renderer.autoClear === false)
        renderer.clear();
      renderer.render(scene, mirrorCamera);
      scope.visible = true;
      renderer.xr.enabled = currentXrEnabled;
      renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
      renderer.setRenderTarget(currentRenderTarget);
      const viewport = camera.viewport;
      if (viewport !== void 0) {
        renderer.state.viewport(viewport);
      }
    };
  }
}
exports.Water = Water;
//# sourceMappingURL=Water.cjs.map
