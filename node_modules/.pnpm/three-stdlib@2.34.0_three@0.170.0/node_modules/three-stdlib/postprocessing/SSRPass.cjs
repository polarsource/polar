"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const Pass = require("./Pass.cjs");
const SSRShader = require("../shaders/SSRShader.cjs");
const CopyShader = require("../shaders/CopyShader.cjs");
const _SSRPass = class extends Pass.Pass {
  constructor({ renderer, scene, camera, width, height, selects, bouncing = false, groundReflector }) {
    super();
    this.width = width !== void 0 ? width : 512;
    this.height = height !== void 0 ? height : 512;
    this.clear = true;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.groundReflector = groundReflector;
    this.opacity = SSRShader.SSRShader.uniforms.opacity.value;
    this.output = 0;
    this.maxDistance = SSRShader.SSRShader.uniforms.maxDistance.value;
    this.thickness = SSRShader.SSRShader.uniforms.thickness.value;
    this.tempColor = new THREE.Color();
    this._selects = selects;
    this.selective = Array.isArray(this._selects);
    Object.defineProperty(this, "selects", {
      get() {
        return this._selects;
      },
      set(val) {
        if (this._selects === val)
          return;
        this._selects = val;
        if (Array.isArray(val)) {
          this.selective = true;
          this.ssrMaterial.defines.SELECTIVE = true;
          this.ssrMaterial.needsUpdate = true;
        } else {
          this.selective = false;
          this.ssrMaterial.defines.SELECTIVE = false;
          this.ssrMaterial.needsUpdate = true;
        }
      }
    });
    this._bouncing = bouncing;
    Object.defineProperty(this, "bouncing", {
      get() {
        return this._bouncing;
      },
      set(val) {
        if (this._bouncing === val)
          return;
        this._bouncing = val;
        if (val) {
          this.ssrMaterial.uniforms["tDiffuse"].value = this.prevRenderTarget.texture;
        } else {
          this.ssrMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
        }
      }
    });
    this.blur = true;
    this._distanceAttenuation = SSRShader.SSRShader.defines.DISTANCE_ATTENUATION;
    Object.defineProperty(this, "distanceAttenuation", {
      get() {
        return this._distanceAttenuation;
      },
      set(val) {
        if (this._distanceAttenuation === val)
          return;
        this._distanceAttenuation = val;
        this.ssrMaterial.defines.DISTANCE_ATTENUATION = val;
        this.ssrMaterial.needsUpdate = true;
      }
    });
    this._fresnel = SSRShader.SSRShader.defines.FRESNEL;
    Object.defineProperty(this, "fresnel", {
      get() {
        return this._fresnel;
      },
      set(val) {
        if (this._fresnel === val)
          return;
        this._fresnel = val;
        this.ssrMaterial.defines.FRESNEL = val;
        this.ssrMaterial.needsUpdate = true;
      }
    });
    this._infiniteThick = SSRShader.SSRShader.defines.INFINITE_THICK;
    Object.defineProperty(this, "infiniteThick", {
      get() {
        return this._infiniteThick;
      },
      set(val) {
        if (this._infiniteThick === val)
          return;
        this._infiniteThick = val;
        this.ssrMaterial.defines.INFINITE_THICK = val;
        this.ssrMaterial.needsUpdate = true;
      }
    });
    const depthTexture = new THREE.DepthTexture();
    depthTexture.type = THREE.UnsignedShortType;
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;
    this.beautyRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType,
      depthTexture,
      depthBuffer: true
    });
    this.prevRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter
    });
    this.normalRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType
    });
    this.metalnessRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      type: THREE.HalfFloatType
    });
    this.ssrRenderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter
    });
    this.blurRenderTarget = this.ssrRenderTarget.clone();
    this.blurRenderTarget2 = this.ssrRenderTarget.clone();
    this.ssrMaterial = new THREE.ShaderMaterial({
      defines: Object.assign({}, SSRShader.SSRShader.defines, {
        MAX_STEP: Math.sqrt(this.width * this.width + this.height * this.height)
      }),
      uniforms: THREE.UniformsUtils.clone(SSRShader.SSRShader.uniforms),
      vertexShader: SSRShader.SSRShader.vertexShader,
      fragmentShader: SSRShader.SSRShader.fragmentShader,
      blending: THREE.NoBlending
    });
    this.ssrMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
    this.ssrMaterial.uniforms["tNormal"].value = this.normalRenderTarget.texture;
    this.ssrMaterial.defines.SELECTIVE = this.selective;
    this.ssrMaterial.needsUpdate = true;
    this.ssrMaterial.uniforms["tMetalness"].value = this.metalnessRenderTarget.texture;
    this.ssrMaterial.uniforms["tDepth"].value = this.beautyRenderTarget.depthTexture;
    this.ssrMaterial.uniforms["cameraNear"].value = this.camera.near;
    this.ssrMaterial.uniforms["cameraFar"].value = this.camera.far;
    this.ssrMaterial.uniforms["thickness"].value = this.thickness;
    this.ssrMaterial.uniforms["resolution"].value.set(this.width, this.height);
    this.ssrMaterial.uniforms["cameraProjectionMatrix"].value.copy(this.camera.projectionMatrix);
    this.ssrMaterial.uniforms["cameraInverseProjectionMatrix"].value.copy(this.camera.projectionMatrixInverse);
    this.normalMaterial = new THREE.MeshNormalMaterial();
    this.normalMaterial.blending = THREE.NoBlending;
    this.metalnessOnMaterial = new THREE.MeshBasicMaterial({
      color: "white"
    });
    this.metalnessOffMaterial = new THREE.MeshBasicMaterial({
      color: "black"
    });
    this.blurMaterial = new THREE.ShaderMaterial({
      defines: Object.assign({}, SSRShader.SSRBlurShader.defines),
      uniforms: THREE.UniformsUtils.clone(SSRShader.SSRBlurShader.uniforms),
      vertexShader: SSRShader.SSRBlurShader.vertexShader,
      fragmentShader: SSRShader.SSRBlurShader.fragmentShader
    });
    this.blurMaterial.uniforms["tDiffuse"].value = this.ssrRenderTarget.texture;
    this.blurMaterial.uniforms["resolution"].value.set(this.width, this.height);
    this.blurMaterial2 = new THREE.ShaderMaterial({
      defines: Object.assign({}, SSRShader.SSRBlurShader.defines),
      uniforms: THREE.UniformsUtils.clone(SSRShader.SSRBlurShader.uniforms),
      vertexShader: SSRShader.SSRBlurShader.vertexShader,
      fragmentShader: SSRShader.SSRBlurShader.fragmentShader
    });
    this.blurMaterial2.uniforms["tDiffuse"].value = this.blurRenderTarget.texture;
    this.blurMaterial2.uniforms["resolution"].value.set(this.width, this.height);
    this.depthRenderMaterial = new THREE.ShaderMaterial({
      defines: Object.assign({}, SSRShader.SSRDepthShader.defines),
      uniforms: THREE.UniformsUtils.clone(SSRShader.SSRDepthShader.uniforms),
      vertexShader: SSRShader.SSRDepthShader.vertexShader,
      fragmentShader: SSRShader.SSRDepthShader.fragmentShader,
      blending: THREE.NoBlending
    });
    this.depthRenderMaterial.uniforms["tDepth"].value = this.beautyRenderTarget.depthTexture;
    this.depthRenderMaterial.uniforms["cameraNear"].value = this.camera.near;
    this.depthRenderMaterial.uniforms["cameraFar"].value = this.camera.far;
    this.copyMaterial = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(CopyShader.CopyShader.uniforms),
      vertexShader: CopyShader.CopyShader.vertexShader,
      fragmentShader: CopyShader.CopyShader.fragmentShader,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendEquation: THREE.AddEquation,
      blendSrcAlpha: THREE.SrcAlphaFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      blendEquationAlpha: THREE.AddEquation
      // premultipliedAlpha:true,
    });
    this.fsQuad = new Pass.FullScreenQuad(null);
    this.originalClearColor = new THREE.Color();
  }
  dispose() {
    this.beautyRenderTarget.dispose();
    this.prevRenderTarget.dispose();
    this.normalRenderTarget.dispose();
    this.metalnessRenderTarget.dispose();
    this.ssrRenderTarget.dispose();
    this.blurRenderTarget.dispose();
    this.blurRenderTarget2.dispose();
    this.normalMaterial.dispose();
    this.metalnessOnMaterial.dispose();
    this.metalnessOffMaterial.dispose();
    this.blurMaterial.dispose();
    this.blurMaterial2.dispose();
    this.copyMaterial.dispose();
    this.depthRenderMaterial.dispose();
    this.fsQuad.dispose();
  }
  render(renderer, writeBuffer) {
    renderer.setRenderTarget(this.beautyRenderTarget);
    renderer.clear();
    if (this.groundReflector) {
      this.groundReflector.visible = false;
      this.groundReflector.doRender(this.renderer, this.scene, this.camera);
      this.groundReflector.visible = true;
    }
    renderer.render(this.scene, this.camera);
    if (this.groundReflector)
      this.groundReflector.visible = false;
    this.renderOverride(renderer, this.normalMaterial, this.normalRenderTarget, 0, 0);
    if (this.selective) {
      this.renderMetalness(renderer, this.metalnessOnMaterial, this.metalnessRenderTarget, 0, 0);
    }
    this.ssrMaterial.uniforms["opacity"].value = this.opacity;
    this.ssrMaterial.uniforms["maxDistance"].value = this.maxDistance;
    this.ssrMaterial.uniforms["thickness"].value = this.thickness;
    this.renderPass(renderer, this.ssrMaterial, this.ssrRenderTarget);
    if (this.blur) {
      this.renderPass(renderer, this.blurMaterial, this.blurRenderTarget);
      this.renderPass(renderer, this.blurMaterial2, this.blurRenderTarget2);
    }
    switch (this.output) {
      case _SSRPass.OUTPUT.Default:
        if (this.bouncing) {
          this.copyMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
          this.copyMaterial.blending = THREE.NoBlending;
          this.renderPass(renderer, this.copyMaterial, this.prevRenderTarget);
          if (this.blur)
            this.copyMaterial.uniforms["tDiffuse"].value = this.blurRenderTarget2.texture;
          else
            this.copyMaterial.uniforms["tDiffuse"].value = this.ssrRenderTarget.texture;
          this.copyMaterial.blending = THREE.NormalBlending;
          this.renderPass(renderer, this.copyMaterial, this.prevRenderTarget);
          this.copyMaterial.uniforms["tDiffuse"].value = this.prevRenderTarget.texture;
          this.copyMaterial.blending = THREE.NoBlending;
          this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        } else {
          this.copyMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
          this.copyMaterial.blending = THREE.NoBlending;
          this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
          if (this.blur)
            this.copyMaterial.uniforms["tDiffuse"].value = this.blurRenderTarget2.texture;
          else
            this.copyMaterial.uniforms["tDiffuse"].value = this.ssrRenderTarget.texture;
          this.copyMaterial.blending = THREE.NormalBlending;
          this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        }
        break;
      case _SSRPass.OUTPUT.SSR:
        if (this.blur)
          this.copyMaterial.uniforms["tDiffuse"].value = this.blurRenderTarget2.texture;
        else
          this.copyMaterial.uniforms["tDiffuse"].value = this.ssrRenderTarget.texture;
        this.copyMaterial.blending = THREE.NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        if (this.bouncing) {
          if (this.blur)
            this.copyMaterial.uniforms["tDiffuse"].value = this.blurRenderTarget2.texture;
          else
            this.copyMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
          this.copyMaterial.blending = THREE.NoBlending;
          this.renderPass(renderer, this.copyMaterial, this.prevRenderTarget);
          this.copyMaterial.uniforms["tDiffuse"].value = this.ssrRenderTarget.texture;
          this.copyMaterial.blending = THREE.NormalBlending;
          this.renderPass(renderer, this.copyMaterial, this.prevRenderTarget);
        }
        break;
      case _SSRPass.OUTPUT.Beauty:
        this.copyMaterial.uniforms["tDiffuse"].value = this.beautyRenderTarget.texture;
        this.copyMaterial.blending = THREE.NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSRPass.OUTPUT.Depth:
        this.renderPass(renderer, this.depthRenderMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSRPass.OUTPUT.Normal:
        this.copyMaterial.uniforms["tDiffuse"].value = this.normalRenderTarget.texture;
        this.copyMaterial.blending = THREE.NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      case _SSRPass.OUTPUT.Metalness:
        this.copyMaterial.uniforms["tDiffuse"].value = this.metalnessRenderTarget.texture;
        this.copyMaterial.blending = THREE.NoBlending;
        this.renderPass(renderer, this.copyMaterial, this.renderToScreen ? null : writeBuffer);
        break;
      default:
        console.warn("THREE.SSRPass: Unknown output type.");
    }
  }
  renderPass(renderer, passMaterial, renderTarget, clearColor, clearAlpha) {
    this.originalClearColor.copy(renderer.getClearColor(this.tempColor));
    const originalClearAlpha = renderer.getClearAlpha(this.tempColor);
    const originalAutoClear = renderer.autoClear;
    renderer.setRenderTarget(renderTarget);
    renderer.autoClear = false;
    if (clearColor !== void 0 && clearColor !== null) {
      renderer.setClearColor(clearColor);
      renderer.setClearAlpha(clearAlpha || 0);
      renderer.clear();
    }
    this.fsQuad.material = passMaterial;
    this.fsQuad.render(renderer);
    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this.originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
  }
  renderOverride(renderer, overrideMaterial, renderTarget, clearColor, clearAlpha) {
    this.originalClearColor.copy(renderer.getClearColor(this.tempColor));
    const originalClearAlpha = renderer.getClearAlpha(this.tempColor);
    const originalAutoClear = renderer.autoClear;
    renderer.setRenderTarget(renderTarget);
    renderer.autoClear = false;
    clearColor = overrideMaterial.clearColor || clearColor;
    clearAlpha = overrideMaterial.clearAlpha || clearAlpha;
    if (clearColor !== void 0 && clearColor !== null) {
      renderer.setClearColor(clearColor);
      renderer.setClearAlpha(clearAlpha || 0);
      renderer.clear();
    }
    this.scene.overrideMaterial = overrideMaterial;
    renderer.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this.originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
  }
  renderMetalness(renderer, overrideMaterial, renderTarget, clearColor, clearAlpha) {
    this.originalClearColor.copy(renderer.getClearColor(this.tempColor));
    const originalClearAlpha = renderer.getClearAlpha(this.tempColor);
    const originalAutoClear = renderer.autoClear;
    renderer.setRenderTarget(renderTarget);
    renderer.autoClear = false;
    clearColor = overrideMaterial.clearColor || clearColor;
    clearAlpha = overrideMaterial.clearAlpha || clearAlpha;
    if (clearColor !== void 0 && clearColor !== null) {
      renderer.setClearColor(clearColor);
      renderer.setClearAlpha(clearAlpha || 0);
      renderer.clear();
    }
    this.scene.traverseVisible((child) => {
      child._SSRPassBackupMaterial = child.material;
      if (this._selects.includes(child)) {
        child.material = this.metalnessOnMaterial;
      } else {
        child.material = this.metalnessOffMaterial;
      }
    });
    renderer.render(this.scene, this.camera);
    this.scene.traverseVisible((child) => {
      child.material = child._SSRPassBackupMaterial;
    });
    renderer.autoClear = originalAutoClear;
    renderer.setClearColor(this.originalClearColor);
    renderer.setClearAlpha(originalClearAlpha);
  }
  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.ssrMaterial.defines.MAX_STEP = Math.sqrt(width * width + height * height);
    this.ssrMaterial.needsUpdate = true;
    this.beautyRenderTarget.setSize(width, height);
    this.prevRenderTarget.setSize(width, height);
    this.ssrRenderTarget.setSize(width, height);
    this.normalRenderTarget.setSize(width, height);
    this.metalnessRenderTarget.setSize(width, height);
    this.blurRenderTarget.setSize(width, height);
    this.blurRenderTarget2.setSize(width, height);
    this.ssrMaterial.uniforms["resolution"].value.set(width, height);
    this.ssrMaterial.uniforms["cameraProjectionMatrix"].value.copy(this.camera.projectionMatrix);
    this.ssrMaterial.uniforms["cameraInverseProjectionMatrix"].value.copy(this.camera.projectionMatrixInverse);
    this.blurMaterial.uniforms["resolution"].value.set(width, height);
    this.blurMaterial2.uniforms["resolution"].value.set(width, height);
  }
};
let SSRPass = _SSRPass;
__publicField(SSRPass, "OUTPUT", {
  Default: 0,
  SSR: 1,
  Beauty: 3,
  Depth: 4,
  Normal: 5,
  Metalness: 7
});
exports.SSRPass = SSRPass;
//# sourceMappingURL=SSRPass.cjs.map
