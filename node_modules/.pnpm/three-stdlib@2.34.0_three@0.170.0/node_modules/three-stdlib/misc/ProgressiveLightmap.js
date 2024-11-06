import { Scene, WebGLRenderTarget, FloatType, MeshPhongMaterial, MeshBasicMaterial, DoubleSide, PlaneGeometry, Mesh } from "three";
import potpack from "potpack";
import { UV1 } from "../_polyfill/uv1.js";
class ProgressiveLightMap {
  constructor(renderer, res = 1024) {
    this.renderer = renderer;
    this.res = res;
    this.lightMapContainers = [];
    this.compiled = false;
    this.scene = new Scene();
    this.scene.background = null;
    this.tinyTarget = new WebGLRenderTarget(1, 1);
    this.buffer1Active = false;
    this.firstUpdate = true;
    this.warned = false;
    const format = /(Android|iPad|iPhone|iPod)/g.test(navigator.userAgent) ? alfFloatType : FloatType;
    this.progressiveLightMap1 = new WebGLRenderTarget(this.res, this.res, { type: format });
    this.progressiveLightMap2 = new WebGLRenderTarget(this.res, this.res, { type: format });
    this.uvMat = new MeshPhongMaterial();
    this.uvMat.uniforms = {};
    this.uvMat.onBeforeCompile = (shader) => {
      shader.vertexShader = "#define USE_LIGHTMAP\n" + shader.vertexShader.slice(0, -1) + `	gl_Position = vec4((${UV1} - 0.5) * 2.0, 1.0, 1.0); }`;
      const bodyStart = shader.fragmentShader.indexOf("void main() {");
      shader.fragmentShader = `varying vec2 v${UV1 === "uv1" ? UV1 : "Uv2"};
` + shader.fragmentShader.slice(0, bodyStart) + "	uniform sampler2D previousShadowMap;\n	uniform float averagingWindow;\n" + shader.fragmentShader.slice(bodyStart - 1, -1) + `
vec3 texelOld = texture2D(previousShadowMap, v${UV1 === "uv1" ? UV1 : "Uv2"}).rgb;
				gl_FragColor.rgb = mix(texelOld, gl_FragColor.rgb, 1.0/averagingWindow);
			}`;
      shader.uniforms.previousShadowMap = { value: this.progressiveLightMap1.texture };
      shader.uniforms.averagingWindow = { value: 100 };
      this.uvMat.uniforms = shader.uniforms;
      this.uvMat.userData.shader = shader;
      this.compiled = true;
    };
  }
  /**
   * Sets these objects' materials' lightmaps and modifies their uv1's.
   * @param {Object3D} objects An array of objects and lights to set up your lightmap.
   */
  addObjectsToLightMap(objects) {
    this.uv_boxes = [];
    const padding = 3 / this.res;
    for (let ob = 0; ob < objects.length; ob++) {
      const object = objects[ob];
      if (object.isLight) {
        this.scene.attach(object);
        continue;
      }
      if (!object.geometry.hasAttribute("uv")) {
        console.warn("All lightmap objects need UVs!");
        continue;
      }
      if (this.blurringPlane == null) {
        this._initializeBlurPlane(this.res, this.progressiveLightMap1);
      }
      object.material.lightMap = this.progressiveLightMap2.texture;
      object.material.dithering = true;
      object.castShadow = true;
      object.receiveShadow = true;
      object.renderOrder = 1e3 + ob;
      this.uv_boxes.push({ w: 1 + padding * 2, h: 1 + padding * 2, index: ob });
      this.lightMapContainers.push({ basicMat: object.material, object });
      this.compiled = false;
    }
    const dimensions = potpack(this.uv_boxes);
    this.uv_boxes.forEach((box) => {
      const uv1 = objects[box.index].geometry.getAttribute("uv").clone();
      for (let i = 0; i < uv1.array.length; i += uv1.itemSize) {
        uv1.array[i] = (uv1.array[i] + box.x + padding) / dimensions.w;
        uv1.array[i + 1] = (uv1.array[i + 1] + box.y + padding) / dimensions.h;
      }
      objects[box.index].geometry.setAttribute(UV1, uv1);
      objects[box.index].geometry.getAttribute(UV1).needsUpdate = true;
    });
  }
  /**
   * This function renders each mesh one at a time into their respective surface maps
   * @param {Camera} camera Standard Rendering Camera
   * @param {number} blendWindow When >1, samples will accumulate over time.
   * @param {boolean} blurEdges  Whether to fix UV Edges via blurring
   */
  update(camera, blendWindow = 100, blurEdges = true) {
    if (this.blurringPlane == null) {
      return;
    }
    const oldTarget = this.renderer.getRenderTarget();
    this.blurringPlane.visible = blurEdges;
    for (let l = 0; l < this.lightMapContainers.length; l++) {
      this.lightMapContainers[l].object.oldScene = this.lightMapContainers[l].object.parent;
      this.scene.attach(this.lightMapContainers[l].object);
    }
    if (this.firstUpdate) {
      this.renderer.setRenderTarget(this.tinyTarget);
      this.renderer.render(this.scene, camera);
      this.firstUpdate = false;
    }
    for (let l = 0; l < this.lightMapContainers.length; l++) {
      this.uvMat.uniforms.averagingWindow = { value: blendWindow };
      this.lightMapContainers[l].object.material = this.uvMat;
      this.lightMapContainers[l].object.oldFrustumCulled = this.lightMapContainers[l].object.frustumCulled;
      this.lightMapContainers[l].object.frustumCulled = false;
    }
    const activeMap = this.buffer1Active ? this.progressiveLightMap1 : this.progressiveLightMap2;
    const inactiveMap = this.buffer1Active ? this.progressiveLightMap2 : this.progressiveLightMap1;
    this.renderer.setRenderTarget(activeMap);
    this.uvMat.uniforms.previousShadowMap = { value: inactiveMap.texture };
    this.blurringPlane.material.uniforms.previousShadowMap = { value: inactiveMap.texture };
    this.buffer1Active = !this.buffer1Active;
    this.renderer.render(this.scene, camera);
    for (let l = 0; l < this.lightMapContainers.length; l++) {
      this.lightMapContainers[l].object.frustumCulled = this.lightMapContainers[l].object.oldFrustumCulled;
      this.lightMapContainers[l].object.material = this.lightMapContainers[l].basicMat;
      this.lightMapContainers[l].object.oldScene.attach(this.lightMapContainers[l].object);
    }
    this.renderer.setRenderTarget(oldTarget);
  }
  /** DEBUG
   * Draw the lightmap in the main scene.  Call this after adding the objects to it.
   * @param {boolean} visible Whether the debug plane should be visible
   * @param {Vector3} position Where the debug plane should be drawn
   */
  showDebugLightmap(visible, position = void 0) {
    if (this.lightMapContainers.length == 0) {
      if (!this.warned) {
        console.warn("Call this after adding the objects!");
        this.warned = true;
      }
      return;
    }
    if (this.labelMesh == null) {
      this.labelMaterial = new MeshBasicMaterial({
        map: this.progressiveLightMap1.texture,
        side: DoubleSide
      });
      this.labelPlane = new PlaneGeometry(100, 100);
      this.labelMesh = new Mesh(this.labelPlane, this.labelMaterial);
      this.labelMesh.position.y = 250;
      this.lightMapContainers[0].object.parent.add(this.labelMesh);
    }
    if (position != void 0) {
      this.labelMesh.position.copy(position);
    }
    this.labelMesh.visible = visible;
  }
  /**
   * INTERNAL Creates the Blurring Plane
   * @param {number} res The square resolution of this object's lightMap.
   * @param {WebGLRenderTexture} lightMap The lightmap to initialize the plane with.
   */
  _initializeBlurPlane(res, lightMap = null) {
    const blurMaterial = new MeshBasicMaterial();
    blurMaterial.uniforms = {
      previousShadowMap: { value: null },
      pixelOffset: { value: 1 / res },
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: 3
    };
    blurMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = "#define USE_UV\n" + shader.vertexShader.slice(0, -1) + "	gl_Position = vec4((uv - 0.5) * 2.0, 1.0, 1.0); }";
      const bodyStart = shader.fragmentShader.indexOf("void main() {");
      shader.fragmentShader = "#define USE_UV\n" + shader.fragmentShader.slice(0, bodyStart) + "	uniform sampler2D previousShadowMap;\n	uniform float pixelOffset;\n" + shader.fragmentShader.slice(bodyStart - 1, -1) + `	gl_FragColor.rgb = (
			  texture2D(previousShadowMap, vUv + vec2( pixelOffset,  0.0        )).rgb +
			  texture2D(previousShadowMap, vUv + vec2( 0.0        ,  pixelOffset)).rgb +
			  texture2D(previousShadowMap, vUv + vec2( 0.0        , -pixelOffset)).rgb +
			  texture2D(previousShadowMap, vUv + vec2(-pixelOffset,  0.0        )).rgb +
			  texture2D(previousShadowMap, vUv + vec2( pixelOffset,  pixelOffset)).rgb +
			  texture2D(previousShadowMap, vUv + vec2(-pixelOffset,  pixelOffset)).rgb +
			  texture2D(previousShadowMap, vUv + vec2( pixelOffset, -pixelOffset)).rgb +
			  texture2D(previousShadowMap, vUv + vec2(-pixelOffset, -pixelOffset)).rgb)/8.0;
		}`;
      shader.uniforms.previousShadowMap = { value: lightMap.texture };
      shader.uniforms.pixelOffset = { value: 0.5 / res };
      blurMaterial.uniforms = shader.uniforms;
      blurMaterial.userData.shader = shader;
      this.compiled = true;
    };
    this.blurringPlane = new Mesh(new PlaneGeometry(1, 1), blurMaterial);
    this.blurringPlane.name = "Blurring Plane";
    this.blurringPlane.frustumCulled = false;
    this.blurringPlane.renderOrder = 0;
    this.blurringPlane.material.depthWrite = false;
    this.scene.add(this.blurringPlane);
  }
}
export {
  ProgressiveLightMap
};
//# sourceMappingURL=ProgressiveLightmap.js.map
