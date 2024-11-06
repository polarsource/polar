"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const MotionControllerConstants = {
  Handedness: {
    NONE: "none",
    LEFT: "left",
    RIGHT: "right"
  },
  ComponentState: {
    DEFAULT: "default",
    TOUCHED: "touched",
    PRESSED: "pressed"
  },
  ComponentProperty: {
    BUTTON: "button",
    X_AXIS: "xAxis",
    Y_AXIS: "yAxis",
    STATE: "state"
  },
  ComponentType: {
    TRIGGER: "trigger",
    SQUEEZE: "squeeze",
    TOUCHPAD: "touchpad",
    THUMBSTICK: "thumbstick",
    BUTTON: "button"
  },
  ButtonTouchThreshold: 0.05,
  AxisTouchThreshold: 0.1,
  VisualResponseProperty: {
    TRANSFORM: "transform",
    VISIBILITY: "visibility"
  }
};
async function fetchJsonFile(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(response.statusText);
  } else {
    return response.json();
  }
}
async function fetchProfilesList(basePath) {
  if (!basePath) {
    throw new Error("No basePath supplied");
  }
  const profileListFileName = "profilesList.json";
  const profilesList = await fetchJsonFile(`${basePath}/${profileListFileName}`);
  return profilesList;
}
async function fetchProfile(xrInputSource, basePath, defaultProfile = null, getAssetPath = true) {
  if (!xrInputSource) {
    throw new Error("No xrInputSource supplied");
  }
  if (!basePath) {
    throw new Error("No basePath supplied");
  }
  const supportedProfilesList = await fetchProfilesList(basePath);
  let match = void 0;
  xrInputSource.profiles.some((profileId) => {
    const supportedProfile = supportedProfilesList[profileId];
    if (supportedProfile) {
      match = {
        profileId,
        profilePath: `${basePath}/${supportedProfile.path}`,
        deprecated: !!supportedProfile.deprecated
      };
    }
    return !!match;
  });
  if (!match) {
    if (!defaultProfile) {
      throw new Error("No matching profile name found");
    }
    const supportedProfile = supportedProfilesList[defaultProfile];
    if (!supportedProfile) {
      throw new Error(`No matching profile name found and default profile "${defaultProfile}" missing.`);
    }
    match = {
      profileId: defaultProfile,
      profilePath: `${basePath}/${supportedProfile.path}`,
      deprecated: !!supportedProfile.deprecated
    };
  }
  const profile = await fetchJsonFile(match.profilePath);
  let assetPath = void 0;
  if (getAssetPath) {
    let layout;
    if (xrInputSource.handedness === "any") {
      layout = profile.layouts[Object.keys(profile.layouts)[0]];
    } else {
      layout = profile.layouts[xrInputSource.handedness];
    }
    if (!layout) {
      throw new Error(`No matching handedness, ${xrInputSource.handedness}, in profile ${match.profileId}`);
    }
    if (layout.assetPath) {
      assetPath = match.profilePath.replace("profile.json", layout.assetPath);
    }
  }
  return { profile, assetPath };
}
const defaultComponentValues = {
  xAxis: 0,
  yAxis: 0,
  button: 0,
  state: MotionControllerConstants.ComponentState.DEFAULT
};
function normalizeAxes(x = 0, y = 0) {
  let xAxis = x;
  let yAxis = y;
  const hypotenuse = Math.sqrt(x * x + y * y);
  if (hypotenuse > 1) {
    const theta = Math.atan2(y, x);
    xAxis = Math.cos(theta);
    yAxis = Math.sin(theta);
  }
  const result = {
    normalizedXAxis: xAxis * 0.5 + 0.5,
    normalizedYAxis: yAxis * 0.5 + 0.5
  };
  return result;
}
class VisualResponse {
  constructor(visualResponseDescription) {
    __publicField(this, "value");
    __publicField(this, "componentProperty");
    __publicField(this, "states");
    __publicField(this, "valueNodeName");
    __publicField(this, "valueNodeProperty");
    __publicField(this, "minNodeName");
    __publicField(this, "maxNodeName");
    __publicField(this, "valueNode");
    __publicField(this, "minNode");
    __publicField(this, "maxNode");
    this.componentProperty = visualResponseDescription.componentProperty;
    this.states = visualResponseDescription.states;
    this.valueNodeName = visualResponseDescription.valueNodeName;
    this.valueNodeProperty = visualResponseDescription.valueNodeProperty;
    if (this.valueNodeProperty === MotionControllerConstants.VisualResponseProperty.TRANSFORM) {
      this.minNodeName = visualResponseDescription.minNodeName;
      this.maxNodeName = visualResponseDescription.maxNodeName;
    }
    this.value = 0;
    this.updateFromComponent(defaultComponentValues);
  }
  /**
   * Computes the visual response's interpolation weight based on component state
   * @param {Object} componentValues - The component from which to update
   * @param {number | undefined} xAxis - The reported X axis value of the component
   * @param {number | undefined} yAxis - The reported Y axis value of the component
   * @param {number | undefined} button - The reported value of the component's button
   * @param {string} state - The component's active state
   */
  updateFromComponent({
    xAxis,
    yAxis,
    button,
    state
  }) {
    const { normalizedXAxis, normalizedYAxis } = normalizeAxes(xAxis, yAxis);
    switch (this.componentProperty) {
      case MotionControllerConstants.ComponentProperty.X_AXIS:
        this.value = this.states.includes(state) ? normalizedXAxis : 0.5;
        break;
      case MotionControllerConstants.ComponentProperty.Y_AXIS:
        this.value = this.states.includes(state) ? normalizedYAxis : 0.5;
        break;
      case MotionControllerConstants.ComponentProperty.BUTTON:
        this.value = this.states.includes(state) && button ? button : 0;
        break;
      case MotionControllerConstants.ComponentProperty.STATE:
        if (this.valueNodeProperty === MotionControllerConstants.VisualResponseProperty.VISIBILITY) {
          this.value = this.states.includes(state);
        } else {
          this.value = this.states.includes(state) ? 1 : 0;
        }
        break;
      default:
        throw new Error(`Unexpected visualResponse componentProperty ${this.componentProperty}`);
    }
  }
}
class Component {
  /**
   * @param {string} componentId - Id of the component
   * @param {InputProfileComponent} componentDescription - Description of the component to be created
   */
  constructor(componentId, componentDescription) {
    __publicField(this, "id");
    __publicField(this, "values");
    __publicField(this, "type");
    __publicField(this, "gamepadIndices");
    __publicField(this, "rootNodeName");
    __publicField(this, "visualResponses");
    __publicField(this, "touchPointNodeName");
    __publicField(this, "touchPointNode");
    if (!componentId || !componentDescription || !componentDescription.visualResponses || !componentDescription.gamepadIndices || Object.keys(componentDescription.gamepadIndices).length === 0) {
      throw new Error("Invalid arguments supplied");
    }
    this.id = componentId;
    this.type = componentDescription.type;
    this.rootNodeName = componentDescription.rootNodeName;
    this.touchPointNodeName = componentDescription.touchPointNodeName;
    this.visualResponses = {};
    Object.keys(componentDescription.visualResponses).forEach((responseName) => {
      const visualResponse = new VisualResponse(componentDescription.visualResponses[responseName]);
      this.visualResponses[responseName] = visualResponse;
    });
    this.gamepadIndices = Object.assign({}, componentDescription.gamepadIndices);
    this.values = {
      state: MotionControllerConstants.ComponentState.DEFAULT,
      button: this.gamepadIndices.button !== void 0 ? 0 : void 0,
      xAxis: this.gamepadIndices.xAxis !== void 0 ? 0 : void 0,
      yAxis: this.gamepadIndices.yAxis !== void 0 ? 0 : void 0
    };
  }
  get data() {
    const data = { id: this.id, ...this.values };
    return data;
  }
  /**
   * @description Poll for updated data based on current gamepad state
   * @param {Object} gamepad - The gamepad object from which the component data should be polled
   */
  updateFromGamepad(gamepad) {
    this.values.state = MotionControllerConstants.ComponentState.DEFAULT;
    if (this.gamepadIndices.button !== void 0 && gamepad.buttons.length > this.gamepadIndices.button) {
      const gamepadButton = gamepad.buttons[this.gamepadIndices.button];
      this.values.button = gamepadButton.value;
      this.values.button = this.values.button < 0 ? 0 : this.values.button;
      this.values.button = this.values.button > 1 ? 1 : this.values.button;
      if (gamepadButton.pressed || this.values.button === 1) {
        this.values.state = MotionControllerConstants.ComponentState.PRESSED;
      } else if (gamepadButton.touched || this.values.button > MotionControllerConstants.ButtonTouchThreshold) {
        this.values.state = MotionControllerConstants.ComponentState.TOUCHED;
      }
    }
    if (this.gamepadIndices.xAxis !== void 0 && gamepad.axes.length > this.gamepadIndices.xAxis) {
      this.values.xAxis = gamepad.axes[this.gamepadIndices.xAxis];
      this.values.xAxis = this.values.xAxis < -1 ? -1 : this.values.xAxis;
      this.values.xAxis = this.values.xAxis > 1 ? 1 : this.values.xAxis;
      if (this.values.state === MotionControllerConstants.ComponentState.DEFAULT && Math.abs(this.values.xAxis) > MotionControllerConstants.AxisTouchThreshold) {
        this.values.state = MotionControllerConstants.ComponentState.TOUCHED;
      }
    }
    if (this.gamepadIndices.yAxis !== void 0 && gamepad.axes.length > this.gamepadIndices.yAxis) {
      this.values.yAxis = gamepad.axes[this.gamepadIndices.yAxis];
      this.values.yAxis = this.values.yAxis < -1 ? -1 : this.values.yAxis;
      this.values.yAxis = this.values.yAxis > 1 ? 1 : this.values.yAxis;
      if (this.values.state === MotionControllerConstants.ComponentState.DEFAULT && Math.abs(this.values.yAxis) > MotionControllerConstants.AxisTouchThreshold) {
        this.values.state = MotionControllerConstants.ComponentState.TOUCHED;
      }
    }
    Object.values(this.visualResponses).forEach((visualResponse) => {
      visualResponse.updateFromComponent(this.values);
    });
  }
}
class MotionController {
  /**
   * @param {XRInputSource} xrInputSource - The XRInputSource to build the MotionController around
   * @param {Profile} profile - The best matched profile description for the supplied xrInputSource
   * @param {string} assetUrl
   */
  constructor(xrInputSource, profile, assetUrl) {
    __publicField(this, "xrInputSource");
    __publicField(this, "assetUrl");
    __publicField(this, "layoutDescription");
    __publicField(this, "id");
    __publicField(this, "components");
    if (!xrInputSource) {
      throw new Error("No xrInputSource supplied");
    }
    if (!profile) {
      throw new Error("No profile supplied");
    }
    if (!profile.layouts[xrInputSource.handedness]) {
      throw new Error("No layout for " + xrInputSource.handedness + " handedness");
    }
    this.xrInputSource = xrInputSource;
    this.assetUrl = assetUrl;
    this.id = profile.profileId;
    this.layoutDescription = profile.layouts[xrInputSource.handedness];
    this.components = {};
    Object.keys(this.layoutDescription.components).forEach((componentId) => {
      const componentDescription = this.layoutDescription.components[componentId];
      this.components[componentId] = new Component(componentId, componentDescription);
    });
    this.updateFromGamepad();
  }
  get gripSpace() {
    return this.xrInputSource.gripSpace;
  }
  get targetRaySpace() {
    return this.xrInputSource.targetRaySpace;
  }
  /**
   * @description Returns a subset of component data for simplified debugging
   */
  get data() {
    const data = [];
    Object.values(this.components).forEach((component) => {
      data.push(component.data);
    });
    return data;
  }
  /**
   * @description Poll for updated data based on current gamepad state
   */
  updateFromGamepad() {
    Object.values(this.components).forEach((component) => {
      component.updateFromGamepad(this.xrInputSource.gamepad);
    });
  }
}
exports.MotionController = MotionController;
exports.MotionControllerConstants = MotionControllerConstants;
exports.fetchProfile = fetchProfile;
exports.fetchProfilesList = fetchProfilesList;
//# sourceMappingURL=MotionControllers.cjs.map
