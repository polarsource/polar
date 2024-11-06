import { ShaderChunk, UniformsUtils, ShaderLib, Color } from "three";
let _SubsurfaceScatteringShader;
function get() {
  if (_SubsurfaceScatteringShader)
    return _SubsurfaceScatteringShader;
  const meshphong_frag_head = ShaderChunk["meshphong_frag"].slice(
    0,
    ShaderChunk["meshphong_frag"].indexOf("void main() {")
  );
  const meshphong_frag_body = ShaderChunk["meshphong_frag"].slice(
    ShaderChunk["meshphong_frag"].indexOf("void main() {")
  );
  _SubsurfaceScatteringShader = {
    uniforms: UniformsUtils.merge([
      ShaderLib["phong"].uniforms,
      {
        thicknessMap: { value: null },
        thicknessColor: { value: new Color(16777215) },
        thicknessDistortion: { value: 0.1 },
        thicknessAmbient: { value: 0 },
        thicknessAttenuation: { value: 0.1 },
        thicknessPower: { value: 2 },
        thicknessScale: { value: 10 }
      }
    ]),
    vertexShader: (
      /* glsl */
      `
    #define USE_UV
    ${ShaderChunk["meshphong_vert"]}
  `
    ),
    fragmentShader: (
      /* glsl */
      `
    #define USE_UV',
    #define SUBSURFACE',

    ${meshphong_frag_head}

    uniform sampler2D thicknessMap;
    uniform float thicknessPower;
    uniform float thicknessScale;
    uniform float thicknessDistortion;
    uniform float thicknessAmbient;
    uniform float thicknessAttenuation;
    uniform vec3 thicknessColor;

    void RE_Direct_Scattering(const in IncidentLight directLight, const in vec2 uv, const in GeometricContext geometry, inout ReflectedLight reflectedLight) {
    	vec3 thickness = thicknessColor * texture2D(thicknessMap, uv).r;
    	vec3 scatteringHalf = normalize(directLight.direction + (geometry.normal * thicknessDistortion));
    	float scatteringDot = pow(saturate(dot(geometry.viewDir, -scatteringHalf)), thicknessPower) * thicknessScale;
    	vec3 scatteringIllu = (scatteringDot + thicknessAmbient) * thickness;
    	reflectedLight.directDiffuse += scatteringIllu * thicknessAttenuation * directLight.color;
    }

    ${meshphong_frag_body.replace(
        "#include <lights_fragment_begin>",
        ShaderChunk["lights_fragment_begin"].replace(
          /RE_Direct\( directLight, geometry, material, reflectedLight \);/g,
          /* glsl */
          `
        RE_Direct( directLight, geometry, material, reflectedLight );

        #if defined( SUBSURFACE ) && defined( USE_UV )
          RE_Direct_Scattering(directLight, vUv, geometry, reflectedLight);
        #endif
      `
        )
      )}
  `
    )
  };
  return _SubsurfaceScatteringShader;
}
const SubsurfaceScatteringShader = {
  get uniforms() {
    return get().uniforms;
  },
  set uniforms(value) {
    get().uniforms = value;
  },
  get vertexShader() {
    return get().vertexShader;
  },
  set vertexShader(value) {
    get().vertexShader = value;
  },
  get fragmentShader() {
    return get().vertexShader;
  },
  set fragmentShader(value) {
    get().vertexShader = value;
  }
};
export {
  SubsurfaceScatteringShader
};
//# sourceMappingURL=SubsurfaceScatteringShader.js.map
