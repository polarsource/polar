import { Group, LightProbe, DirectionalLight, WebGLCubeRenderTarget } from "three";
class SessionLightProbe {
  constructor(xrLight, renderer, lightProbe, environmentEstimation, estimationStartCallback) {
    this.xrLight = xrLight;
    this.renderer = renderer;
    this.lightProbe = lightProbe;
    this.xrWebGLBinding = null;
    this.estimationStartCallback = estimationStartCallback;
    this.frameCallback = this.onXRFrame.bind(this);
    const session = renderer.xr.getSession();
    if (environmentEstimation && "XRWebGLBinding" in window) {
      const cubeRenderTarget = new WebGLCubeRenderTarget(16);
      xrLight.environment = cubeRenderTarget.texture;
      const gl = renderer.getContext();
      switch (session.preferredReflectionFormat) {
        case "srgba8":
          gl.getExtension("EXT_sRGB");
          break;
        case "rgba16f":
          gl.getExtension("OES_texture_half_float");
          break;
      }
      this.xrWebGLBinding = new XRWebGLBinding(session, gl);
      this.lightProbe.addEventListener("reflectionchange", () => {
        this.updateReflection();
      });
    }
    session.requestAnimationFrame(this.frameCallback);
  }
  updateReflection() {
    const textureProperties = this.renderer.properties.get(this.xrLight.environment);
    if (textureProperties) {
      const cubeMap = this.xrWebGLBinding.getReflectionCubeMap(this.lightProbe);
      if (cubeMap) {
        textureProperties.__webglTexture = cubeMap;
        this.xrLight.environment.needsPMREMUpdate = true;
      }
    }
  }
  onXRFrame(time, xrFrame) {
    if (!this.xrLight) {
      return;
    }
    const session = xrFrame.session;
    session.requestAnimationFrame(this.frameCallback);
    const lightEstimate = xrFrame.getLightEstimate(this.lightProbe);
    if (lightEstimate) {
      this.xrLight.lightProbe.sh.fromArray(lightEstimate.sphericalHarmonicsCoefficients);
      this.xrLight.lightProbe.intensity = 1;
      const intensityScalar = Math.max(
        1,
        Math.max(
          lightEstimate.primaryLightIntensity.x,
          Math.max(lightEstimate.primaryLightIntensity.y, lightEstimate.primaryLightIntensity.z)
        )
      );
      this.xrLight.directionalLight.color.setRGB(
        lightEstimate.primaryLightIntensity.x / intensityScalar,
        lightEstimate.primaryLightIntensity.y / intensityScalar,
        lightEstimate.primaryLightIntensity.z / intensityScalar
      );
      this.xrLight.directionalLight.intensity = intensityScalar;
      this.xrLight.directionalLight.position.copy(lightEstimate.primaryLightDirection);
      if (this.estimationStartCallback) {
        this.estimationStartCallback();
        this.estimationStartCallback = null;
      }
    }
  }
  dispose() {
    this.xrLight = null;
    this.renderer = null;
    this.lightProbe = null;
    this.xrWebGLBinding = null;
  }
}
class XREstimatedLight extends Group {
  constructor(renderer, environmentEstimation = true) {
    super();
    this.lightProbe = new LightProbe();
    this.lightProbe.intensity = 0;
    this.add(this.lightProbe);
    this.directionalLight = new DirectionalLight();
    this.directionalLight.intensity = 0;
    this.add(this.directionalLight);
    this.environment = null;
    let sessionLightProbe = null;
    let estimationStarted = false;
    renderer.xr.addEventListener("sessionstart", () => {
      const session = renderer.xr.getSession();
      if ("requestLightProbe" in session) {
        session.requestLightProbe({
          reflectionFormat: session.preferredReflectionFormat
        }).then((probe) => {
          sessionLightProbe = new SessionLightProbe(this, renderer, probe, environmentEstimation, () => {
            estimationStarted = true;
            this.dispatchEvent({ type: "estimationstart" });
          });
        });
      }
    });
    renderer.xr.addEventListener("sessionend", () => {
      if (sessionLightProbe) {
        sessionLightProbe.dispose();
        sessionLightProbe = null;
      }
      if (estimationStarted) {
        this.dispatchEvent({ type: "estimationend" });
      }
    });
    this.dispose = () => {
      if (sessionLightProbe) {
        sessionLightProbe.dispose();
        sessionLightProbe = null;
      }
      this.remove(this.lightProbe);
      this.lightProbe = null;
      this.remove(this.directionalLight);
      this.directionalLight = null;
      this.environment = null;
    };
  }
}
export {
  XREstimatedLight
};
//# sourceMappingURL=XREstimatedLight.js.map
