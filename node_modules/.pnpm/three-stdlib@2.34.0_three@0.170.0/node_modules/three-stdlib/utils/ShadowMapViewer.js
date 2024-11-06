import { OrthographicCamera, Scene, UniformsUtils, ShaderMaterial, PlaneGeometry, Mesh, Texture, LinearFilter, MeshBasicMaterial, DoubleSide } from "three";
import { UnpackDepthRGBAShader } from "../shaders/UnpackDepthRGBAShader.js";
class ShadowMapViewer {
  constructor(light) {
    const scope = this;
    const doRenderLabel = light.name !== void 0 && light.name !== "";
    let userAutoClearSetting;
    const frame = {
      x: 10,
      y: 10,
      width: 256,
      height: 256
    };
    const camera = new OrthographicCamera(
      window.innerWidth / -2,
      window.innerWidth / 2,
      window.innerHeight / 2,
      window.innerHeight / -2,
      1,
      10
    );
    camera.position.set(0, 0, 2);
    const scene = new Scene();
    const shader = UnpackDepthRGBAShader;
    const uniforms = UniformsUtils.clone(shader.uniforms);
    const material = new ShaderMaterial({
      uniforms,
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader
    });
    const plane = new PlaneGeometry(frame.width, frame.height);
    const mesh = new Mesh(plane, material);
    scene.add(mesh);
    let labelCanvas, labelMesh;
    if (doRenderLabel) {
      labelCanvas = document.createElement("canvas");
      const context = labelCanvas.getContext("2d");
      context.font = "Bold 20px Arial";
      const labelWidth = context.measureText(light.name).width;
      labelCanvas.width = labelWidth;
      labelCanvas.height = 25;
      context.font = "Bold 20px Arial";
      context.fillStyle = "rgba( 255, 0, 0, 1 )";
      context.fillText(light.name, 0, 20);
      const labelTexture = new Texture(labelCanvas);
      labelTexture.magFilter = LinearFilter;
      labelTexture.minFilter = LinearFilter;
      labelTexture.needsUpdate = true;
      const labelMaterial = new MeshBasicMaterial({ map: labelTexture, side: DoubleSide });
      labelMaterial.transparent = true;
      const labelPlane = new PlaneGeometry(labelCanvas.width, labelCanvas.height);
      labelMesh = new Mesh(labelPlane, labelMaterial);
      scene.add(labelMesh);
    }
    function resetPosition() {
      scope.position.set(scope.position.x, scope.position.y);
    }
    this.enabled = true;
    this.size = {
      width: frame.width,
      height: frame.height,
      set: function(width, height) {
        this.width = width;
        this.height = height;
        mesh.scale.set(this.width / frame.width, this.height / frame.height, 1);
        resetPosition();
      }
    };
    this.position = {
      x: frame.x,
      y: frame.y,
      set: function(x, y) {
        this.x = x;
        this.y = y;
        const width = scope.size.width;
        const height = scope.size.height;
        mesh.position.set(-window.innerWidth / 2 + width / 2 + this.x, window.innerHeight / 2 - height / 2 - this.y, 0);
        if (doRenderLabel)
          labelMesh.position.set(mesh.position.x, mesh.position.y - scope.size.height / 2 + labelCanvas.height / 2, 0);
      }
    };
    this.render = function(renderer) {
      if (this.enabled) {
        uniforms.tDiffuse.value = light.shadow.map.texture;
        userAutoClearSetting = renderer.autoClear;
        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(scene, camera);
        renderer.autoClear = userAutoClearSetting;
      }
    };
    this.updateForWindowResize = function() {
      if (this.enabled) {
        camera.left = window.innerWidth / -2;
        camera.right = window.innerWidth / 2;
        camera.top = window.innerHeight / 2;
        camera.bottom = window.innerHeight / -2;
        camera.updateProjectionMatrix();
        this.update();
      }
    };
    this.update = function() {
      this.position.set(this.position.x, this.position.y);
      this.size.set(this.size.width, this.size.height);
    };
    this.update();
  }
}
export {
  ShadowMapViewer
};
//# sourceMappingURL=ShadowMapViewer.js.map
