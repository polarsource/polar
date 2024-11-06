var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { Mesh, PerspectiveCamera, Color, Plane, Matrix4, WebGLRenderTarget, HalfFloatType, ShaderMaterial, UniformsUtils, Vector3, Quaternion, Vector4, NoToneMapping } from "three";
import { version } from "../_polyfill/constants.js";
const _Refractor = class extends Mesh {
  constructor(geometry, options = {}) {
    super(geometry);
    this.isRefractor = true;
    this.type = "Refractor";
    this.camera = new PerspectiveCamera();
    const scope = this;
    const color = options.color !== void 0 ? new Color(options.color) : new Color(8355711);
    const textureWidth = options.textureWidth || 512;
    const textureHeight = options.textureHeight || 512;
    const clipBias = options.clipBias || 0;
    const shader = options.shader || _Refractor.RefractorShader;
    const multisample = options.multisample !== void 0 ? options.multisample : 4;
    const virtualCamera = this.camera;
    virtualCamera.matrixAutoUpdate = false;
    virtualCamera.userData.refractor = true;
    const refractorPlane = new Plane();
    const textureMatrix = new Matrix4();
    const renderTarget = new WebGLRenderTarget(textureWidth, textureHeight, {
      samples: multisample,
      type: HalfFloatType
    });
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.clone(shader.uniforms),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      transparent: true
      // ensures, refractors are drawn from farthest to closest
    });
    this.material.uniforms["color"].value = color;
    this.material.uniforms["tDiffuse"].value = renderTarget.texture;
    this.material.uniforms["textureMatrix"].value = textureMatrix;
    const visible = function() {
      const refractorWorldPosition = new Vector3();
      const cameraWorldPosition = new Vector3();
      const rotationMatrix = new Matrix4();
      const view = new Vector3();
      const normal = new Vector3();
      return function visible2(camera) {
        refractorWorldPosition.setFromMatrixPosition(scope.matrixWorld);
        cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
        view.subVectors(refractorWorldPosition, cameraWorldPosition);
        rotationMatrix.extractRotation(scope.matrixWorld);
        normal.set(0, 0, 1);
        normal.applyMatrix4(rotationMatrix);
        return view.dot(normal) < 0;
      };
    }();
    const updateRefractorPlane = function() {
      const normal = new Vector3();
      const position = new Vector3();
      const quaternion = new Quaternion();
      const scale = new Vector3();
      return function updateRefractorPlane2() {
        scope.matrixWorld.decompose(position, quaternion, scale);
        normal.set(0, 0, 1).applyQuaternion(quaternion).normalize();
        normal.negate();
        refractorPlane.setFromNormalAndCoplanarPoint(normal, position);
      };
    }();
    const updateVirtualCamera = function() {
      const clipPlane = new Plane();
      const clipVector = new Vector4();
      const q = new Vector4();
      return function updateVirtualCamera2(camera) {
        virtualCamera.matrixWorld.copy(camera.matrixWorld);
        virtualCamera.matrixWorldInverse.copy(virtualCamera.matrixWorld).invert();
        virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
        virtualCamera.far = camera.far;
        clipPlane.copy(refractorPlane);
        clipPlane.applyMatrix4(virtualCamera.matrixWorldInverse);
        clipVector.set(clipPlane.normal.x, clipPlane.normal.y, clipPlane.normal.z, clipPlane.constant);
        const projectionMatrix = virtualCamera.projectionMatrix;
        q.x = (Math.sign(clipVector.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
        q.y = (Math.sign(clipVector.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
        q.z = -1;
        q.w = (1 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];
        clipVector.multiplyScalar(2 / clipVector.dot(q));
        projectionMatrix.elements[2] = clipVector.x;
        projectionMatrix.elements[6] = clipVector.y;
        projectionMatrix.elements[10] = clipVector.z + 1 - clipBias;
        projectionMatrix.elements[14] = clipVector.w;
      };
    }();
    function updateTextureMatrix(camera) {
      textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      textureMatrix.multiply(camera.projectionMatrix);
      textureMatrix.multiply(camera.matrixWorldInverse);
      textureMatrix.multiply(scope.matrixWorld);
    }
    function render(renderer, scene, camera) {
      scope.visible = false;
      const currentRenderTarget = renderer.getRenderTarget();
      const currentXrEnabled = renderer.xr.enabled;
      const currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;
      const currentToneMapping = renderer.toneMapping;
      let isSRGB = false;
      if ("outputColorSpace" in renderer)
        isSRGB = renderer.outputColorSpace === "srgb";
      else
        isSRGB = renderer.outputEncoding === 3001;
      renderer.xr.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      if ("outputColorSpace" in renderer)
        renderer.outputColorSpace = "srgb-linear";
      else
        renderer.outputEncoding = 3e3;
      renderer.toneMapping = NoToneMapping;
      renderer.setRenderTarget(renderTarget);
      if (renderer.autoClear === false)
        renderer.clear();
      renderer.render(scene, virtualCamera);
      renderer.xr.enabled = currentXrEnabled;
      renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;
      renderer.toneMapping = currentToneMapping;
      renderer.setRenderTarget(currentRenderTarget);
      if ("outputColorSpace" in renderer)
        renderer.outputColorSpace = isSRGB ? "srgb" : "srgb-linear";
      else
        renderer.outputEncoding = isSRGB ? 3001 : 3e3;
      const viewport = camera.viewport;
      if (viewport !== void 0) {
        renderer.state.viewport(viewport);
      }
      scope.visible = true;
    }
    this.onBeforeRender = function(renderer, scene, camera) {
      if (camera.userData.refractor === true)
        return;
      if (!visible(camera) === true)
        return;
      updateRefractorPlane();
      updateTextureMatrix(camera);
      updateVirtualCamera(camera);
      render(renderer, scene, camera);
    };
    this.getRenderTarget = function() {
      return renderTarget;
    };
    this.dispose = function() {
      renderTarget.dispose();
      scope.material.dispose();
    };
  }
};
let Refractor = _Refractor;
__publicField(Refractor, "RefractorShader", {
  uniforms: {
    color: {
      value: null
    },
    tDiffuse: {
      value: null
    },
    textureMatrix: {
      value: null
    }
  },
  vertexShader: (
    /* glsl */
    `

		uniform mat4 textureMatrix;

		varying vec4 vUv;

		void main() {

			vUv = textureMatrix * vec4( position, 1.0 );
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`
  ),
  fragmentShader: (
    /* glsl */
    `

		uniform vec3 color;
		uniform sampler2D tDiffuse;

		varying vec4 vUv;

		float blendOverlay( float base, float blend ) {

			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );

		}

		vec3 blendOverlay( vec3 base, vec3 blend ) {

			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );

		}

		void main() {

			vec4 base = texture2DProj( tDiffuse, vUv );
			gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );

			#include <tonemapping_fragment>
			#include <${version >= 154 ? "colorspace_fragment" : "encodings_fragment"}>

		}`
  )
});
export {
  Refractor
};
//# sourceMappingURL=Refractor.js.map
