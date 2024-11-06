import { EventDispatcher, MOUSE, OrthographicCamera, PerspectiveCamera, Quaternion, Spherical, TOUCH, Vector3 } from 'three';
export type CHANGE_EVENT = {
    type: 'change' | 'start' | 'end';
};
export declare const STATE: {
    NONE: number;
    ROTATE: number;
    DOLLY: number;
    PAN: number;
    TOUCH_ROTATE: number;
    TOUCH_PAN: number;
    TOUCH_DOLLY_PAN: number;
    TOUCH_DOLLY_ROTATE: number;
};
declare class CameraControls extends EventDispatcher {
    object: PerspectiveCamera | OrthographicCamera;
    domElement: HTMLElement;
    /** Set to false to disable this control */
    enabled: boolean;
    /** "target" sets the location of focus, where the object orbits around */
    target: Vector3;
    /** Set to true to enable trackball behavior */
    trackball: boolean;
    /** How far you can dolly in ( PerspectiveCamera only ) */
    minDistance: number;
    /** How far you can dolly out ( PerspectiveCamera only ) */
    maxDistance: number;
    minZoom: number;
    maxZoom: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;
    enableDamping: boolean;
    dampingFactor: number;
    /**
     * This option enables dollying in and out; property named as "zoom" for backwards compatibility
     * Set to false to disable zooming
     */
    enableZoom: boolean;
    zoomSpeed: number;
    /** Set to false to disable rotating */
    enableRotate: boolean;
    rotateSpeed: number;
    /** Set to false to disable panning */
    enablePan: boolean;
    panSpeed: number;
    /** if true, pan in screen-space */
    screenSpacePanning: boolean;
    /** pixels moved per arrow key push */
    keyPanSpeed: number;
    /**
     * Set to true to automatically rotate around the target
     * If auto-rotate is enabled, you must call controls.update() in your animation loop
     * auto-rotate is not supported for trackball behavior
     */
    autoRotate: boolean;
    autoRotateSpeed: number;
    /** Set to false to disable use of the keys */
    enableKeys: boolean;
    /** The four arrow keys */
    keys: {
        LEFT: string;
        UP: string;
        RIGHT: string;
        BOTTOM: string;
    };
    mouseButtons: {
        LEFT: MOUSE;
        MIDDLE?: MOUSE;
        RIGHT: MOUSE;
    };
    /** Touch fingers */
    touches: {
        ONE: TOUCH;
        TWO: TOUCH;
    };
    target0: Vector3;
    position0: Vector3;
    quaternion0: Quaternion;
    zoom0: number;
    spherical: Spherical;
    sphericalDelta: Spherical;
    private changeEvent;
    private startEvent;
    private endEvent;
    private state;
    private EPS;
    private scale;
    private panOffset;
    private zoomChanged;
    private rotateStart;
    private rotateEnd;
    private rotateDelta;
    private panStart;
    private panEnd;
    private panDelta;
    private dollyStart;
    private dollyEnd;
    private dollyDelta;
    private offset;
    private lastPosition;
    private lastQuaternion;
    private q;
    private v;
    private vec;
    private quat;
    private quatInverse;
    constructor(object: PerspectiveCamera | OrthographicCamera, domElement: HTMLElement);
    getPolarAngle: () => number;
    getAzimuthalAngle: () => number;
    saveState: () => void;
    reset: () => void;
    dispose: () => void;
    private update;
    private getAutoRotationAngle;
    private getZoomScale;
    private rotateLeft;
    private rotateUp;
    private panLeft;
    private panUp;
    private pan;
    private dollyIn;
    private dollyOut;
    private handleMouseDownRotate;
    private handleMouseDownDolly;
    private handleMouseDownPan;
    private handleMouseMoveRotate;
    private handleMouseMoveDolly;
    private handleMouseMovePan;
    private handleMouseUp;
    private handleMouseWheel;
    private handleKeyDown;
    private handleTouchStartRotate;
    private handleTouchStartPan;
    private handleTouchStartDolly;
    private handleTouchStartDollyPan;
    private handleTouchStartDollyRotate;
    private handleTouchMoveRotate;
    private handleTouchMovePan;
    private handleTouchMoveDolly;
    private handleTouchMoveDollyPan;
    private handleTouchMoveDollyRotate;
    private handleTouchEnd;
    private onMouseDown;
    private onMouseMove;
    private onMouseUp;
    private onMouseWheel;
    private onKeyDown;
    private onTouchStart;
    private onTouchMove;
    private onTouchEnd;
    private onContextMenu;
}
/**
 * OrbitControls maintains the "up" direction, camera.up (+Y by default).
 *
 * @event Orbit - left mouse / touch: one-finger move
 * @event Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
 * @event Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move
 */
declare class OrbitControlsExp extends CameraControls {
    mouseButtons: {
        LEFT: MOUSE;
        RIGHT: MOUSE;
    };
    touches: {
        ONE: TOUCH;
        TWO: TOUCH;
    };
    constructor(object: PerspectiveCamera | OrthographicCamera, domElement: HTMLElement);
}
/**
 * MapControls maintains the "up" direction, camera.up (+Y by default)
 *
 * @event Orbit - right mouse, or left mouse + ctrl/meta/shiftKey / touch: two-finger rotate
 * @event Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
 * @event Pan - left mouse, or left right + ctrl/meta/shiftKey, or arrow keys / touch: one-finger move
 */
declare class MapControlsExp extends CameraControls {
    mouseButtons: {
        LEFT: MOUSE;
        RIGHT: MOUSE;
    };
    touches: {
        ONE: TOUCH;
        TWO: TOUCH;
    };
    constructor(object: PerspectiveCamera | OrthographicCamera, domElement: HTMLElement);
}
/**
 * TrackballControls allows the camera to rotate over the polls and does not maintain camera.up
 *
 * @event Orbit - left mouse / touch: one-finger move
 * @event Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
 * @event Pan - right mouse, or left mouse + ctrl/meta/shiftKey, or arrow keys / touch: two-finger move
 */
declare class TrackballControlsExp extends CameraControls {
    trackball: boolean;
    screenSpacePanning: boolean;
    autoRotate: boolean;
    mouseButtons: {
        LEFT: MOUSE;
        RIGHT: MOUSE;
    };
    touches: {
        ONE: TOUCH;
        TWO: TOUCH;
    };
    constructor(object: PerspectiveCamera | OrthographicCamera, domElement: HTMLElement);
}
export { CameraControls, OrbitControlsExp, MapControlsExp, TrackballControlsExp };
