/**
 * @webxr-input-profiles/motion-controllers 1.0.0 https://github.com/immersive-web/webxr-input-profiles
 */
/// <reference types="webxr" />
import type { Object3D } from 'three';
interface GamepadIndices {
    button: number;
    xAxis?: number;
    yAxis?: number;
}
interface VisualResponseDescription {
    componentProperty: string;
    states: string[];
    valueNodeProperty: string;
    valueNodeName: string;
    minNodeName?: string;
    maxNodeName?: string;
}
type VisualResponses = Record<string, VisualResponseDescription>;
interface ComponentDescription {
    type: string;
    gamepadIndices: GamepadIndices;
    rootNodeName: string;
    visualResponses: VisualResponses;
    touchPointNodeName?: string;
}
interface Components {
    [componentKey: string]: ComponentDescription;
}
interface LayoutDescription {
    selectComponentId: string;
    components: Components;
    gamepadMapping: string;
    rootNodeName: string;
    assetPath: string;
}
type Layouts = Partial<Record<XRHandedness, LayoutDescription>>;
export interface Profile {
    profileId: string;
    fallbackProfileIds: string[];
    layouts: Layouts;
}
interface ProfilesList {
    [profileId: string]: {
        path: string;
        deprecated?: boolean;
    } | undefined;
}
declare const MotionControllerConstants: {
    Handedness: {
        NONE: string;
        LEFT: string;
        RIGHT: string;
    };
    ComponentState: {
        DEFAULT: string;
        TOUCHED: string;
        PRESSED: string;
    };
    ComponentProperty: {
        BUTTON: string;
        X_AXIS: string;
        Y_AXIS: string;
        STATE: string;
    };
    ComponentType: {
        TRIGGER: string;
        SQUEEZE: string;
        TOUCHPAD: string;
        THUMBSTICK: string;
        BUTTON: string;
    };
    ButtonTouchThreshold: number;
    AxisTouchThreshold: number;
    VisualResponseProperty: {
        TRANSFORM: string;
        VISIBILITY: string;
    };
};
declare function fetchProfilesList(basePath: string): Promise<ProfilesList>;
declare function fetchProfile(xrInputSource: XRInputSource, basePath: string, defaultProfile?: string | null, getAssetPath?: boolean): Promise<{
    profile: Profile;
    assetPath: string | undefined;
}>;
/**
 * Contains the description of how the 3D model should visually respond to a specific user input.
 * This is accomplished by initializing the object with the name of a node in the 3D model and
 * property that need to be modified in response to user input, the name of the nodes representing
 * the allowable range of motion, and the name of the input which triggers the change. In response
 * to the named input changing, this object computes the appropriate weighting to use for
 * interpolating between the range of motion nodes.
 */
declare class VisualResponse implements VisualResponseDescription {
    value: number | boolean;
    componentProperty: string;
    states: string[];
    valueNodeName: string;
    valueNodeProperty: string;
    minNodeName?: string;
    maxNodeName?: string;
    valueNode: Object3D | undefined;
    minNode: Object3D | undefined;
    maxNode: Object3D | undefined;
    constructor(visualResponseDescription: VisualResponseDescription);
    /**
     * Computes the visual response's interpolation weight based on component state
     * @param {Object} componentValues - The component from which to update
     * @param {number | undefined} xAxis - The reported X axis value of the component
     * @param {number | undefined} yAxis - The reported Y axis value of the component
     * @param {number | undefined} button - The reported value of the component's button
     * @param {string} state - The component's active state
     */
    updateFromComponent({ xAxis, yAxis, button, state, }: {
        xAxis?: number;
        yAxis?: number;
        button?: number;
        state: string;
    }): void;
}
declare class Component implements ComponentDescription {
    id: string;
    values: {
        state: string;
        button: number | undefined;
        xAxis: number | undefined;
        yAxis: number | undefined;
    };
    type: string;
    gamepadIndices: GamepadIndices;
    rootNodeName: string;
    visualResponses: Record<string, VisualResponse>;
    touchPointNodeName?: string | undefined;
    touchPointNode?: Object3D;
    /**
     * @param {string} componentId - Id of the component
     * @param {InputProfileComponent} componentDescription - Description of the component to be created
     */
    constructor(componentId: string, componentDescription: ComponentDescription);
    get data(): {
        id: Component['id'];
    } & Component['values'];
    /**
     * @description Poll for updated data based on current gamepad state
     * @param {Object} gamepad - The gamepad object from which the component data should be polled
     */
    updateFromGamepad(gamepad: Gamepad): void;
}
/**
 * @description Builds a motion controller with components and visual responses based on the
 * supplied profile description. Data is polled from the xrInputSource's gamepad.
 * @author Nell Waliczek / https://github.com/NellWaliczek
 */
declare class MotionController {
    xrInputSource: XRInputSource;
    assetUrl: string;
    layoutDescription: LayoutDescription;
    id: string;
    components: Record<string, Component>;
    /**
     * @param {XRInputSource} xrInputSource - The XRInputSource to build the MotionController around
     * @param {Profile} profile - The best matched profile description for the supplied xrInputSource
     * @param {string} assetUrl
     */
    constructor(xrInputSource: XRInputSource, profile: Profile, assetUrl: string);
    get gripSpace(): XRInputSource['gripSpace'];
    get targetRaySpace(): XRInputSource['targetRaySpace'];
    /**
     * @description Returns a subset of component data for simplified debugging
     */
    get data(): Array<Component['data']>;
    /**
     * @description Poll for updated data based on current gamepad state
     */
    updateFromGamepad(): void;
}
export { MotionControllerConstants, MotionController, fetchProfile, fetchProfilesList };
