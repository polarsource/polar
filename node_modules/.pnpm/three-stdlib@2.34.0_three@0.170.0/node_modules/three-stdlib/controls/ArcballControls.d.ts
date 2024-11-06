import { Vector3, Scene, PerspectiveCamera, OrthographicCamera, EventDispatcher } from 'three';
type Camera = OrthographicCamera | PerspectiveCamera;
/**
 *
 * @param {CamOrthographicCamera | PerspectiveCameraera} camera Virtual camera used in the scene
 * @param {HTMLElement=null} domElement Renderer's dom element
 * @param {Scene=null} scene The scene to be rendered
 */
declare class ArcballControls extends EventDispatcher {
    private camera;
    private domElement;
    private scene;
    private mouseActions;
    private _mouseOp;
    private _v2_1;
    private _v3_1;
    private _v3_2;
    private _m4_1;
    private _m4_2;
    private _quat;
    private _translationMatrix;
    private _rotationMatrix;
    private _scaleMatrix;
    private _rotationAxis;
    private _cameraMatrixState;
    private _cameraProjectionState;
    private _fovState;
    private _upState;
    private _zoomState;
    private _nearPos;
    private _farPos;
    private _gizmoMatrixState;
    private _up0;
    private _zoom0;
    private _fov0;
    private _initialNear;
    private _nearPos0;
    private _initialFar;
    private _farPos0;
    private _cameraMatrixState0;
    private _gizmoMatrixState0;
    private _button;
    private _touchStart;
    private _touchCurrent;
    private _input;
    private _switchSensibility;
    private _startFingerDistance;
    private _currentFingerDistance;
    private _startFingerRotation;
    private _currentFingerRotation;
    private _devPxRatio;
    private _downValid;
    private _nclicks;
    private _downEvents;
    private _clickStart;
    private _maxDownTime;
    private _maxInterval;
    private _posThreshold;
    private _movementThreshold;
    private _currentCursorPosition;
    private _startCursorPosition;
    private _grid;
    private _gridPosition;
    private _gizmos;
    private _curvePts;
    private _timeStart;
    private _animationId;
    focusAnimationTime: number;
    private _timePrev;
    private _timeCurrent;
    private _anglePrev;
    private _angleCurrent;
    private _cursorPosPrev;
    private _cursorPosCurr;
    private _wPrev;
    private _wCurr;
    adjustNearFar: boolean;
    scaleFactor: number;
    dampingFactor: number;
    wMax: number;
    enableAnimations: boolean;
    enableGrid: boolean;
    cursorZoom: boolean;
    minFov: number;
    maxFov: number;
    enabled: boolean;
    enablePan: boolean;
    enableRotate: boolean;
    enableZoom: boolean;
    minDistance: number;
    maxDistance: number;
    minZoom: number;
    maxZoom: number;
    readonly target: Vector3;
    private _currentTarget;
    private _tbRadius;
    private _state;
    constructor(camera: Camera | null, domElement?: HTMLElement | null | undefined, scene?: Scene | null | undefined);
    private onWindowResize;
    private onContextMenu;
    private onPointerCancel;
    private onPointerDown;
    private onPointerMove;
    private onPointerUp;
    private onWheel;
    private onSinglePanStart;
    private onSinglePanMove;
    private onSinglePanEnd;
    private onDoubleTap;
    private onDoublePanStart;
    private onDoublePanMove;
    private onDoublePanEnd;
    private onRotateStart;
    private onRotateMove;
    private onRotateEnd;
    private onPinchStart;
    private onPinchMove;
    private onPinchEnd;
    private onTriplePanStart;
    private onTriplePanMove;
    private onTriplePanEnd;
    /**
     * Set _center's x/y coordinates
     * @param {Number} clientX
     * @param {Number} clientY
     */
    private setCenter;
    /**
     * Set default mouse actions
     */
    private initializeMouseActions;
    /**
     * Set a new mouse action by specifying the operation to be performed and a mouse/key combination. In case of conflict, replaces the existing one
     * @param {String} operation The operation to be performed ('PAN', 'ROTATE', 'ZOOM', 'FOV)
     * @param {*} mouse A mouse button (0, 1, 2) or 'WHEEL' for wheel notches
     * @param {*} key The keyboard modifier ('CTRL', 'SHIFT') or null if key is not needed
     * @returns {Boolean} True if the mouse action has been successfully added, false otherwise
     */
    private setMouseAction;
    /**
     * Return the operation associated to a mouse/keyboard combination
     * @param {*} mouse A mouse button (0, 1, 2) or 'WHEEL' for wheel notches
     * @param {*} key The keyboard modifier ('CTRL', 'SHIFT') or null if key is not needed
     * @returns The operation if it has been found, null otherwise
     */
    private getOpFromAction;
    /**
     * Get the operation associated to mouse and key combination and returns the corresponding FSA state
     * @param {Number} mouse Mouse button
     * @param {String} key Keyboard modifier
     * @returns The FSA state obtained from the operation associated to mouse/keyboard combination
     */
    private getOpStateFromAction;
    /**
     * Calculate the angle between two pointers
     * @param {PointerEvent} p1
     * @param {PointerEvent} p2
     * @returns {Number} The angle between two pointers in degrees
     */
    private getAngle;
    /**
     * Update a PointerEvent inside current pointerevents array
     * @param {PointerEvent} event
     */
    private updateTouchEvent;
    /**
     * Apply a transformation matrix, to the camera and gizmos
     * @param {Object} transformation Object containing matrices to apply to camera and gizmos
     */
    private applyTransformMatrix;
    /**
     * Calculate the angular speed
     * @param {Number} p0 Position at t0
     * @param {Number} p1 Position at t1
     * @param {Number} t0 Initial time in milliseconds
     * @param {Number} t1 Ending time in milliseconds
     */
    private calculateAngularSpeed;
    /**
     * Calculate the distance between two pointers
     * @param {PointerEvent} p0 The first pointer
     * @param {PointerEvent} p1 The second pointer
     * @returns {number} The distance between the two pointers
     */
    private calculatePointersDistance;
    /**
     * Calculate the rotation axis as the vector perpendicular between two vectors
     * @param {Vector3} vec1 The first vector
     * @param {Vector3} vec2 The second vector
     * @returns {Vector3} The normalized rotation axis
     */
    private calculateRotationAxis;
    /**
     * Calculate the trackball radius so that gizmo's diamater will be 2/3 of the minimum side of the camera frustum
     * @param {Camera} camera
     * @returns {Number} The trackball radius
     */
    private calculateTbRadius;
    /**
     * Focus operation consist of positioning the point of interest in front of the camera and a slightly zoom in
     * @param {Vector3} point The point of interest
     * @param {Number} size Scale factor
     * @param {Number} amount Amount of operation to be completed (used for focus animations, default is complete full operation)
     */
    private focus;
    /**
     * Draw a grid and add it to the scene
     */
    private drawGrid;
    connect: (domElement: HTMLElement) => void;
    /**
     * Remove all listeners, stop animations and clean scene
     */
    dispose: () => void;
    /**
     * remove the grid from the scene
     */
    private disposeGrid;
    /**
     * Compute the easing out cubic function for ease out effect in animation
     * @param {Number} t The absolute progress of the animation in the bound of 0 (beginning of the) and 1 (ending of animation)
     * @returns {Number} Result of easing out cubic at time t
     */
    private easeOutCubic;
    /**
     * Make rotation gizmos more or less visible
     * @param {Boolean} isActive If true, make gizmos more visible
     */
    private activateGizmos;
    /**
     * Calculate the cursor position in NDC
     * @param {number} x Cursor horizontal coordinate within the canvas
     * @param {number} y Cursor vertical coordinate within the canvas
     * @param {HTMLElement} canvas The canvas where the renderer draws its output
     * @returns {Vector2} Cursor normalized position inside the canvas
     */
    private getCursorNDC;
    /**
     * Calculate the cursor position inside the canvas x/y coordinates with the origin being in the center of the canvas
     * @param {Number} x Cursor horizontal coordinate within the canvas
     * @param {Number} y Cursor vertical coordinate within the canvas
     * @param {HTMLElement} canvas The canvas where the renderer draws its output
     * @returns {Vector2} Cursor position inside the canvas
     */
    private getCursorPosition;
    /**
     * Set the camera to be controlled
     * @param {Camera} camera The virtual camera to be controlled
     */
    private setCamera;
    /**
     * Set gizmos visibility
     * @param {Boolean} value Value of gizmos visibility
     */
    setGizmosVisible(value: boolean): void;
    /**
     * Creates the rotation gizmos matching trackball center and radius
     * @param {Vector3} tbCenter The trackball center
     * @param {number} tbRadius The trackball radius
     */
    private makeGizmos;
    /**
     * Perform animation for focus operation
     * @param {Number} time Instant in which this function is called as performance.now()
     * @param {Vector3} point Point of interest for focus operation
     * @param {Matrix4} cameraMatrix Camera matrix
     * @param {Matrix4} gizmoMatrix Gizmos matrix
     */
    private onFocusAnim;
    /**
     * Perform animation for rotation operation
     * @param {Number} time Instant in which this function is called as performance.now()
     * @param {Vector3} rotationAxis Rotation axis
     * @param {number} w0 Initial angular velocity
     */
    private onRotationAnim;
    /**
     * Perform pan operation moving camera between two points
     * @param {Vector3} p0 Initial point
     * @param {Vector3} p1 Ending point
     * @param {Boolean} adjust If movement should be adjusted considering camera distance (Perspective only)
     */
    private pan;
    /**
     * Reset trackball
     */
    reset: () => void;
    /**
     * Rotate the camera around an axis passing by trackball's center
     * @param {Vector3} axis Rotation axis
     * @param {number} angle Angle in radians
     * @returns {Object} Object with 'camera' field containing transformation matrix resulting from the operation to be applied to the camera
     */
    private rotate;
    copyState: () => void;
    pasteState: () => void;
    /**
     * Save the current state of the control. This can later be recovered with .reset
     */
    saveState: () => void;
    /**
     * Perform uniform scale operation around a given point
     * @param {Number} size Scale factor
     * @param {Vector3} point Point around which scale
     * @param {Boolean} scaleGizmos If gizmos should be scaled (Perspective only)
     * @returns {Object} Object with 'camera' and 'gizmo' fields containing transformation matrices resulting from the operation to be applied to the camera and gizmos
     */
    private applyScale;
    /**
     * Set camera fov
     * @param {Number} value fov to be setted
     */
    private setFov;
    /**
     * Set the trackball's center point
     * @param {Number} x X coordinate
     * @param {Number} y Y coordinate
     * @param {Number} z Z coordinate
     */
    setTarget: (x: number, y: number, z: number) => void;
    /**
     * Set values in transformation object
     * @param {Matrix4} camera Transformation to be applied to the camera
     * @param {Matrix4} gizmos Transformation to be applied to gizmos
     */
    private setTransformationMatrices;
    /**
     * Rotate camera around its direction axis passing by a given point by a given angle
     * @param {Vector3} point The point where the rotation axis is passing trough
     * @param {Number} angle Angle in radians
     * @returns The computed transormation matix
     */
    private zRotate;
    /**
     * Unproject the cursor on the 3D object surface
     * @param {Vector2} cursor Cursor coordinates in NDC
     * @param {Camera} camera Virtual camera
     * @returns {Vector3} The point of intersection with the model, if exist, null otherwise
     */
    private unprojectOnObj;
    /**
     * Unproject the cursor on the trackball surface
     * @param {Camera} camera The virtual camera
     * @param {Number} cursorX Cursor horizontal coordinate on screen
     * @param {Number} cursorY Cursor vertical coordinate on screen
     * @param {HTMLElement} canvas The canvas where the renderer draws its output
     * @param {number} tbRadius The trackball radius
     * @returns {Vector3} The unprojected point on the trackball surface
     */
    private unprojectOnTbSurface;
    /**
     * Unproject the cursor on the plane passing through the center of the trackball orthogonal to the camera
     * @param {Camera} camera The virtual camera
     * @param {Number} cursorX Cursor horizontal coordinate on screen
     * @param {Number} cursorY Cursor vertical coordinate on screen
     * @param {HTMLElement} canvas The canvas where the renderer draws its output
     * @param {Boolean} initialDistance If initial distance between camera and gizmos should be used for calculations instead of current (Perspective only)
     * @returns {Vector3} The unprojected point on the trackball plane
     */
    private unprojectOnTbPlane;
    /**
     * Update camera and gizmos state
     */
    private updateMatrixState;
    /**
     * Update the trackball FSA
     * @param {STATE} newState New state of the FSA
     * @param {Boolean} updateMatrices If matriices state should be updated
     */
    private updateTbState;
    update: () => void;
    private setStateFromJSON;
}
export { ArcballControls };
