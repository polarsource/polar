"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const BokehShader2 = require("../shaders/BokehShader2.cjs");
class CinematicCamera extends THREE.PerspectiveCamera {
  constructor(fov, aspect, near, far) {
    super(fov, aspect, near, far);
    this.type = "CinematicCamera";
    this.postprocessing = { enabled: true };
    this.shaderSettings = {
      rings: 3,
      samples: 4
    };
    const depthShader = BokehShader2.BokehDepthShader;
    this.materialDepth = new THREE.ShaderMaterial({
      uniforms: depthShader.uniforms,
      vertexShader: depthShader.vertexShader,
      fragmentShader: depthShader.fragmentShader
    });
    this.materialDepth.uniforms["mNear"].value = near;
    this.materialDepth.uniforms["mFar"].value = far;
    this.setLens();
    this.initPostProcessing();
  }
  // providing fnumber and coc(Circle of Confusion) as extra arguments
  setLens(focalLength, filmGauge, fNumber, coc) {
    if (focalLength === void 0)
      focalLength = 35;
    if (filmGauge !== void 0)
      this.filmGauge = filmGauge;
    this.setFocalLength(focalLength);
    if (fNumber === void 0)
      fNumber = 8;
    if (coc === void 0)
      coc = 0.019;
    this.fNumber = fNumber;
    this.coc = coc;
    this.aperture = focalLength / this.fNumber;
    this.hyperFocal = focalLength * focalLength / (this.aperture * this.coc);
  }
  linearize(depth) {
    const zfar = this.far;
    const znear = this.near;
    return -zfar * znear / (depth * (zfar - znear) - zfar);
  }
  smoothstep(near, far, depth) {
    const x = this.saturate((depth - near) / (far - near));
    return x * x * (3 - 2 * x);
  }
  saturate(x) {
    return Math.max(0, Math.min(1, x));
  }
  // function for focusing at a distance from the camera
  focusAt(focusDistance) {
    if (focusDistance === void 0)
      focusDistance = 20;
    const focalLength = this.getFocalLength();
    this.focus = focusDistance;
    this.nearPoint = this.hyperFocal * this.focus / (this.hyperFocal + (this.focus - focalLength));
    this.farPoint = this.hyperFocal * this.focus / (this.hyperFocal - (this.focus - focalLength));
    this.depthOfField = this.farPoint - this.nearPoint;
    if (this.depthOfField < 0)
      this.depthOfField = 0;
    this.sdistance = this.smoothstep(this.near, this.far, this.focus);
    this.ldistance = this.linearize(1 - this.sdistance);
    this.postprocessing.bokeh_uniforms["focalDepth"].value = this.ldistance;
  }
  initPostProcessing() {
    if (this.postprocessing.enabled) {
      this.postprocessing.scene = new THREE.Scene();
      this.postprocessing.camera = new THREE.OrthographicCamera(
        window.innerWidth / -2,
        window.innerWidth / 2,
        window.innerHeight / 2,
        window.innerHeight / -2,
        -1e4,
        1e4
      );
      this.postprocessing.scene.add(this.postprocessing.camera);
      this.postprocessing.rtTextureDepth = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
      this.postprocessing.rtTextureColor = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
      const bokeh_shader = BokehShader2.BokehShader2;
      this.postprocessing.bokeh_uniforms = THREE.UniformsUtils.clone(bokeh_shader.uniforms);
      this.postprocessing.bokeh_uniforms["tColor"].value = this.postprocessing.rtTextureColor.texture;
      this.postprocessing.bokeh_uniforms["tDepth"].value = this.postprocessing.rtTextureDepth.texture;
      this.postprocessing.bokeh_uniforms["manualdof"].value = 0;
      this.postprocessing.bokeh_uniforms["shaderFocus"].value = 0;
      this.postprocessing.bokeh_uniforms["fstop"].value = 2.8;
      this.postprocessing.bokeh_uniforms["showFocus"].value = 1;
      this.postprocessing.bokeh_uniforms["focalDepth"].value = 0.1;
      this.postprocessing.bokeh_uniforms["znear"].value = this.near;
      this.postprocessing.bokeh_uniforms["zfar"].value = this.near;
      this.postprocessing.bokeh_uniforms["textureWidth"].value = window.innerWidth;
      this.postprocessing.bokeh_uniforms["textureHeight"].value = window.innerHeight;
      this.postprocessing.materialBokeh = new THREE.ShaderMaterial({
        uniforms: this.postprocessing.bokeh_uniforms,
        vertexShader: bokeh_shader.vertexShader,
        fragmentShader: bokeh_shader.fragmentShader,
        defines: {
          RINGS: this.shaderSettings.rings,
          SAMPLES: this.shaderSettings.samples,
          DEPTH_PACKING: 1
        }
      });
      this.postprocessing.quad = new THREE.Mesh(
        new THREE.PlaneGeometry(window.innerWidth, window.innerHeight),
        this.postprocessing.materialBokeh
      );
      this.postprocessing.quad.position.z = -500;
      this.postprocessing.scene.add(this.postprocessing.quad);
    }
  }
  renderCinematic(scene, renderer) {
    if (this.postprocessing.enabled) {
      const currentRenderTarget = renderer.getRenderTarget();
      renderer.clear();
      scene.overrideMaterial = null;
      renderer.setRenderTarget(this.postprocessing.rtTextureColor);
      renderer.clear();
      renderer.render(scene, this);
      scene.overrideMaterial = this.materialDepth;
      renderer.setRenderTarget(this.postprocessing.rtTextureDepth);
      renderer.clear();
      renderer.render(scene, this);
      renderer.setRenderTarget(null);
      renderer.render(this.postprocessing.scene, this.postprocessing.camera);
      renderer.setRenderTarget(currentRenderTarget);
    }
  }
}
exports.CinematicCamera = CinematicCamera;
//# sourceMappingURL=CinematicCamera.cjs.map
