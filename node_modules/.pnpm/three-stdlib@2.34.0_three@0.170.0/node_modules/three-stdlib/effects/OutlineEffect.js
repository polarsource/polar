import { Color, REVISION, ShaderMaterial, UniformsUtils, UniformsLib, BackSide } from "three";
class OutlineEffect {
  constructor(renderer, parameters = {}) {
    this.enabled = true;
    const defaultThickness = parameters.defaultThickness !== void 0 ? parameters.defaultThickness : 3e-3;
    const defaultColor = new Color().fromArray(
      parameters.defaultColor !== void 0 ? parameters.defaultColor : [0, 0, 0]
    );
    const defaultAlpha = parameters.defaultAlpha !== void 0 ? parameters.defaultAlpha : 1;
    const defaultKeepAlive = parameters.defaultKeepAlive !== void 0 ? parameters.defaultKeepAlive : false;
    const cache = {};
    const removeThresholdCount = 60;
    const originalMaterials = {};
    const originalOnBeforeRenders = {};
    const uniformsOutline = {
      outlineThickness: { value: defaultThickness },
      outlineColor: { value: defaultColor },
      outlineAlpha: { value: defaultAlpha }
    };
    const vertexShader = [
      "#include <common>",
      "#include <uv_pars_vertex>",
      "#include <displacementmap_pars_vertex>",
      "#include <fog_pars_vertex>",
      "#include <morphtarget_pars_vertex>",
      "#include <skinning_pars_vertex>",
      "#include <logdepthbuf_pars_vertex>",
      "#include <clipping_planes_pars_vertex>",
      "uniform float outlineThickness;",
      "vec4 calculateOutline( vec4 pos, vec3 normal, vec4 skinned ) {",
      "	float thickness = outlineThickness;",
      "	const float ratio = 1.0;",
      // TODO: support outline thickness ratio for each vertex
      "	vec4 pos2 = projectionMatrix * modelViewMatrix * vec4( skinned.xyz + normal, 1.0 );",
      // NOTE: subtract pos2 from pos because BackSide objectNormal is negative
      "	vec4 norm = normalize( pos - pos2 );",
      "	return pos + norm * thickness * pos.w * ratio;",
      "}",
      "void main() {",
      "	#include <uv_vertex>",
      "	#include <beginnormal_vertex>",
      "	#include <morphnormal_vertex>",
      "	#include <skinbase_vertex>",
      "	#include <skinnormal_vertex>",
      "	#include <begin_vertex>",
      "	#include <morphtarget_vertex>",
      "	#include <skinning_vertex>",
      "	#include <displacementmap_vertex>",
      "	#include <project_vertex>",
      "	vec3 outlineNormal = - objectNormal;",
      // the outline material is always rendered with BackSide
      "	gl_Position = calculateOutline( gl_Position, outlineNormal, vec4( transformed, 1.0 ) );",
      "	#include <logdepthbuf_vertex>",
      "	#include <clipping_planes_vertex>",
      "	#include <fog_vertex>",
      "}"
    ].join("\n");
    const fragmentShader = [
      "#include <common>",
      "#include <fog_pars_fragment>",
      "#include <logdepthbuf_pars_fragment>",
      "#include <clipping_planes_pars_fragment>",
      "uniform vec3 outlineColor;",
      "uniform float outlineAlpha;",
      "void main() {",
      "	#include <clipping_planes_fragment>",
      "	#include <logdepthbuf_fragment>",
      "	gl_FragColor = vec4( outlineColor, outlineAlpha );",
      "	#include <tonemapping_fragment>",
      `	#include <${parseInt(REVISION.replace(/\D+/g, "")) >= 154 ? "colorspace_fragment" : "encodings_fragment"}>`,
      "	#include <fog_fragment>",
      "	#include <premultiplied_alpha_fragment>",
      "}"
    ].join("\n");
    function createMaterial() {
      return new ShaderMaterial({
        type: "OutlineEffect",
        uniforms: UniformsUtils.merge([UniformsLib["fog"], UniformsLib["displacementmap"], uniformsOutline]),
        vertexShader,
        fragmentShader,
        side: BackSide
      });
    }
    function getOutlineMaterialFromCache(originalMaterial) {
      let data = cache[originalMaterial.uuid];
      if (data === void 0) {
        data = {
          material: createMaterial(),
          used: true,
          keepAlive: defaultKeepAlive,
          count: 0
        };
        cache[originalMaterial.uuid] = data;
      }
      data.used = true;
      return data.material;
    }
    function getOutlineMaterial(originalMaterial) {
      const outlineMaterial = getOutlineMaterialFromCache(originalMaterial);
      originalMaterials[outlineMaterial.uuid] = originalMaterial;
      updateOutlineMaterial(outlineMaterial, originalMaterial);
      return outlineMaterial;
    }
    function isCompatible(object) {
      const geometry = object.geometry;
      const hasNormals = geometry !== void 0 && geometry.attributes.normal !== void 0;
      return object.isMesh === true && object.material !== void 0 && hasNormals === true;
    }
    function setOutlineMaterial(object) {
      if (isCompatible(object) === false)
        return;
      if (Array.isArray(object.material)) {
        for (let i = 0, il = object.material.length; i < il; i++) {
          object.material[i] = getOutlineMaterial(object.material[i]);
        }
      } else {
        object.material = getOutlineMaterial(object.material);
      }
      originalOnBeforeRenders[object.uuid] = object.onBeforeRender;
      object.onBeforeRender = onBeforeRender;
    }
    function restoreOriginalMaterial(object) {
      if (isCompatible(object) === false)
        return;
      if (Array.isArray(object.material)) {
        for (let i = 0, il = object.material.length; i < il; i++) {
          object.material[i] = originalMaterials[object.material[i].uuid];
        }
      } else {
        object.material = originalMaterials[object.material.uuid];
      }
      object.onBeforeRender = originalOnBeforeRenders[object.uuid];
    }
    function onBeforeRender(renderer2, scene, camera, geometry, material) {
      const originalMaterial = originalMaterials[material.uuid];
      if (originalMaterial === void 0)
        return;
      updateUniforms(material, originalMaterial);
    }
    function updateUniforms(material, originalMaterial) {
      const outlineParameters = originalMaterial.userData.outlineParameters;
      material.uniforms.outlineAlpha.value = originalMaterial.opacity;
      if (outlineParameters !== void 0) {
        if (outlineParameters.thickness !== void 0)
          material.uniforms.outlineThickness.value = outlineParameters.thickness;
        if (outlineParameters.color !== void 0)
          material.uniforms.outlineColor.value.fromArray(outlineParameters.color);
        if (outlineParameters.alpha !== void 0)
          material.uniforms.outlineAlpha.value = outlineParameters.alpha;
      }
      if (originalMaterial.displacementMap) {
        material.uniforms.displacementMap.value = originalMaterial.displacementMap;
        material.uniforms.displacementScale.value = originalMaterial.displacementScale;
        material.uniforms.displacementBias.value = originalMaterial.displacementBias;
      }
    }
    function updateOutlineMaterial(material, originalMaterial) {
      if (material.name === "invisible")
        return;
      const outlineParameters = originalMaterial.userData.outlineParameters;
      material.fog = originalMaterial.fog;
      material.toneMapped = originalMaterial.toneMapped;
      material.premultipliedAlpha = originalMaterial.premultipliedAlpha;
      material.displacementMap = originalMaterial.displacementMap;
      if (outlineParameters !== void 0) {
        if (originalMaterial.visible === false) {
          material.visible = false;
        } else {
          material.visible = outlineParameters.visible !== void 0 ? outlineParameters.visible : true;
        }
        material.transparent = outlineParameters.alpha !== void 0 && outlineParameters.alpha < 1 ? true : originalMaterial.transparent;
        if (outlineParameters.keepAlive !== void 0)
          cache[originalMaterial.uuid].keepAlive = outlineParameters.keepAlive;
      } else {
        material.transparent = originalMaterial.transparent;
        material.visible = originalMaterial.visible;
      }
      if (originalMaterial.wireframe === true || originalMaterial.depthTest === false)
        material.visible = false;
      if (originalMaterial.clippingPlanes) {
        material.clipping = true;
        material.clippingPlanes = originalMaterial.clippingPlanes;
        material.clipIntersection = originalMaterial.clipIntersection;
        material.clipShadows = originalMaterial.clipShadows;
      }
      material.version = originalMaterial.version;
    }
    function cleanupCache() {
      let keys;
      keys = Object.keys(originalMaterials);
      for (let i = 0, il = keys.length; i < il; i++) {
        originalMaterials[keys[i]] = void 0;
      }
      keys = Object.keys(originalOnBeforeRenders);
      for (let i = 0, il = keys.length; i < il; i++) {
        originalOnBeforeRenders[keys[i]] = void 0;
      }
      keys = Object.keys(cache);
      for (let i = 0, il = keys.length; i < il; i++) {
        const key = keys[i];
        if (cache[key].used === false) {
          cache[key].count++;
          if (cache[key].keepAlive === false && cache[key].count > removeThresholdCount) {
            delete cache[key];
          }
        } else {
          cache[key].used = false;
          cache[key].count = 0;
        }
      }
    }
    this.render = function(scene, camera) {
      if (this.enabled === false) {
        renderer.render(scene, camera);
        return;
      }
      const currentAutoClear = renderer.autoClear;
      renderer.autoClear = this.autoClear;
      renderer.render(scene, camera);
      renderer.autoClear = currentAutoClear;
      this.renderOutline(scene, camera);
    };
    this.renderOutline = function(scene, camera) {
      const currentAutoClear = renderer.autoClear;
      const currentSceneAutoUpdate = scene.matrixWorldAutoUpdate;
      const currentSceneBackground = scene.background;
      const currentShadowMapEnabled = renderer.shadowMap.enabled;
      scene.matrixWorldAutoUpdate = false;
      scene.background = null;
      renderer.autoClear = false;
      renderer.shadowMap.enabled = false;
      scene.traverse(setOutlineMaterial);
      renderer.render(scene, camera);
      scene.traverse(restoreOriginalMaterial);
      cleanupCache();
      scene.matrixWorldAutoUpdate = currentSceneAutoUpdate;
      scene.background = currentSceneBackground;
      renderer.autoClear = currentAutoClear;
      renderer.shadowMap.enabled = currentShadowMapEnabled;
    };
    this.autoClear = renderer.autoClear;
    this.domElement = renderer.domElement;
    this.shadowMap = renderer.shadowMap;
    this.clear = function(color, depth, stencil) {
      renderer.clear(color, depth, stencil);
    };
    this.getPixelRatio = function() {
      return renderer.getPixelRatio();
    };
    this.setPixelRatio = function(value) {
      renderer.setPixelRatio(value);
    };
    this.getSize = function(target) {
      return renderer.getSize(target);
    };
    this.setSize = function(width, height, updateStyle) {
      renderer.setSize(width, height, updateStyle);
    };
    this.setViewport = function(x, y, width, height) {
      renderer.setViewport(x, y, width, height);
    };
    this.setScissor = function(x, y, width, height) {
      renderer.setScissor(x, y, width, height);
    };
    this.setScissorTest = function(boolean) {
      renderer.setScissorTest(boolean);
    };
    this.setRenderTarget = function(renderTarget) {
      renderer.setRenderTarget(renderTarget);
    };
  }
}
export {
  OutlineEffect
};
//# sourceMappingURL=OutlineEffect.js.map
