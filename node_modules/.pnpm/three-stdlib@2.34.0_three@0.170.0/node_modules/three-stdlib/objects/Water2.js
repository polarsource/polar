var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { Mesh, Vector4, Color, Vector2, Matrix4, Clock, ShaderMaterial, UniformsUtils, UniformsLib, RepeatWrapping } from "three";
import { Reflector } from "./Reflector.js";
import { Refractor } from "./Refractor.js";
import { version } from "../_polyfill/constants.js";
const _Water2 = class extends Mesh {
  constructor(geometry, options = {}) {
    super(geometry);
    this.isWater = true;
    this.type = "Water";
    const scope = this;
    const color = options.color !== void 0 ? new Color(options.color) : new Color(16777215);
    const textureWidth = options.textureWidth || 512;
    const textureHeight = options.textureHeight || 512;
    const clipBias = options.clipBias || 0;
    const flowDirection = options.flowDirection || new Vector2(1, 0);
    const flowSpeed = options.flowSpeed || 0.03;
    const reflectivity = options.reflectivity || 0.02;
    const scale = options.scale || 1;
    const shader = options.shader || _Water2.WaterShader;
    const encoding = options.encoding !== void 0 ? options.encoding : 3e3;
    const flowMap = options.flowMap || void 0;
    const normalMap0 = options.normalMap0;
    const normalMap1 = options.normalMap1;
    const cycle = 0.15;
    const halfCycle = cycle * 0.5;
    const textureMatrix = new Matrix4();
    const clock = new Clock();
    if (Reflector === void 0) {
      console.error("THREE.Water: Required component Reflector not found.");
      return;
    }
    if (Refractor === void 0) {
      console.error("THREE.Water: Required component Refractor not found.");
      return;
    }
    const reflector = new Reflector(geometry, {
      textureWidth,
      textureHeight,
      clipBias,
      encoding
    });
    const refractor = new Refractor(geometry, {
      textureWidth,
      textureHeight,
      clipBias,
      encoding
    });
    reflector.matrixAutoUpdate = false;
    refractor.matrixAutoUpdate = false;
    this.material = new ShaderMaterial({
      uniforms: UniformsUtils.merge([UniformsLib["fog"], shader.uniforms]),
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      transparent: true,
      fog: true
    });
    if (flowMap !== void 0) {
      this.material.defines.USE_FLOWMAP = "";
      this.material.uniforms["tFlowMap"] = {
        type: "t",
        value: flowMap
      };
    } else {
      this.material.uniforms["flowDirection"] = {
        type: "v2",
        value: flowDirection
      };
    }
    normalMap0.wrapS = normalMap0.wrapT = RepeatWrapping;
    normalMap1.wrapS = normalMap1.wrapT = RepeatWrapping;
    this.material.uniforms["tReflectionMap"].value = reflector.getRenderTarget().texture;
    this.material.uniforms["tRefractionMap"].value = refractor.getRenderTarget().texture;
    this.material.uniforms["tNormalMap0"].value = normalMap0;
    this.material.uniforms["tNormalMap1"].value = normalMap1;
    this.material.uniforms["color"].value = color;
    this.material.uniforms["reflectivity"].value = reflectivity;
    this.material.uniforms["textureMatrix"].value = textureMatrix;
    this.material.uniforms["config"].value.x = 0;
    this.material.uniforms["config"].value.y = halfCycle;
    this.material.uniforms["config"].value.z = halfCycle;
    this.material.uniforms["config"].value.w = scale;
    function updateTextureMatrix(camera) {
      textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
      textureMatrix.multiply(camera.projectionMatrix);
      textureMatrix.multiply(camera.matrixWorldInverse);
      textureMatrix.multiply(scope.matrixWorld);
    }
    function updateFlow() {
      const delta = clock.getDelta();
      const config = scope.material.uniforms["config"];
      config.value.x += flowSpeed * delta;
      config.value.y = config.value.x + halfCycle;
      if (config.value.x >= cycle) {
        config.value.x = 0;
        config.value.y = halfCycle;
      } else if (config.value.y >= cycle) {
        config.value.y = config.value.y - cycle;
      }
    }
    this.onBeforeRender = function(renderer, scene, camera) {
      updateTextureMatrix(camera);
      updateFlow();
      scope.visible = false;
      reflector.matrixWorld.copy(scope.matrixWorld);
      refractor.matrixWorld.copy(scope.matrixWorld);
      reflector.onBeforeRender(renderer, scene, camera);
      refractor.onBeforeRender(renderer, scene, camera);
      scope.visible = true;
    };
  }
};
let Water2 = _Water2;
__publicField(Water2, "WaterShader", {
  uniforms: {
    color: {
      value: null
    },
    reflectivity: {
      value: 0
    },
    tReflectionMap: {
      value: null
    },
    tRefractionMap: {
      value: null
    },
    tNormalMap0: {
      value: null
    },
    tNormalMap1: {
      value: null
    },
    textureMatrix: {
      value: null
    },
    config: {
      value: new Vector4()
    }
  },
  vertexShader: (
    /* glsl */
    `

		#include <common>
		#include <fog_pars_vertex>
		#include <logdepthbuf_pars_vertex>

		uniform mat4 textureMatrix;

		varying vec4 vCoord;
		varying vec2 vUv;
		varying vec3 vToEye;

		void main() {

			vUv = uv;
			vCoord = textureMatrix * vec4( position, 1.0 );

			vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
			vToEye = cameraPosition - worldPosition.xyz;

			vec4 mvPosition =  viewMatrix * worldPosition; // used in fog_vertex
			gl_Position = projectionMatrix * mvPosition;

			#include <logdepthbuf_vertex>
			#include <fog_vertex>

		}`
  ),
  fragmentShader: (
    /* glsl */
    `

		#include <common>
		#include <fog_pars_fragment>
		#include <logdepthbuf_pars_fragment>

		uniform sampler2D tReflectionMap;
		uniform sampler2D tRefractionMap;
		uniform sampler2D tNormalMap0;
		uniform sampler2D tNormalMap1;

		#ifdef USE_FLOWMAP
			uniform sampler2D tFlowMap;
		#else
			uniform vec2 flowDirection;
		#endif

		uniform vec3 color;
		uniform float reflectivity;
		uniform vec4 config;

		varying vec4 vCoord;
		varying vec2 vUv;
		varying vec3 vToEye;

		void main() {

			#include <logdepthbuf_fragment>

			float flowMapOffset0 = config.x;
			float flowMapOffset1 = config.y;
			float halfCycle = config.z;
			float scale = config.w;

			vec3 toEye = normalize( vToEye );

			// determine flow direction
			vec2 flow;
			#ifdef USE_FLOWMAP
				flow = texture2D( tFlowMap, vUv ).rg * 2.0 - 1.0;
			#else
				flow = flowDirection;
			#endif
			flow.x *= - 1.0;

			// sample normal maps (distort uvs with flowdata)
			vec4 normalColor0 = texture2D( tNormalMap0, ( vUv * scale ) + flow * flowMapOffset0 );
			vec4 normalColor1 = texture2D( tNormalMap1, ( vUv * scale ) + flow * flowMapOffset1 );

			// linear interpolate to get the final normal color
			float flowLerp = abs( halfCycle - flowMapOffset0 ) / halfCycle;
			vec4 normalColor = mix( normalColor0, normalColor1, flowLerp );

			// calculate normal vector
			vec3 normal = normalize( vec3( normalColor.r * 2.0 - 1.0, normalColor.b,  normalColor.g * 2.0 - 1.0 ) );

			// calculate the fresnel term to blend reflection and refraction maps
			float theta = max( dot( toEye, normal ), 0.0 );
			float reflectance = reflectivity + ( 1.0 - reflectivity ) * pow( ( 1.0 - theta ), 5.0 );

			// calculate final uv coords
			vec3 coord = vCoord.xyz / vCoord.w;
			vec2 uv = coord.xy + coord.z * normal.xz * 0.05;

			vec4 reflectColor = texture2D( tReflectionMap, vec2( 1.0 - uv.x, uv.y ) );
			vec4 refractColor = texture2D( tRefractionMap, uv );

			// multiply water color with the mix of both textures
			gl_FragColor = vec4( color, 1.0 ) * mix( refractColor, reflectColor, reflectance );

			#include <tonemapping_fragment>
			#include <${version >= 154 ? "colorspace_fragment" : "encodings_fragment"}>
			#include <fog_fragment>

		}`
  )
});
export {
  Water2
};
//# sourceMappingURL=Water2.js.map
