import { EventDispatcher, MOUSE, OrthographicCamera, PerspectiveCamera, TOUCH, Vector3 } from 'three';
declare class OrbitControls extends EventDispatcher {
    object: PerspectiveCamera | OrthographicCamera;
    domElement: HTMLElement | undefined;
    enabled: boolean;
    target: Vector3;
    minDistance: number;
    maxDistance: number;
    minZoom: number;
    maxZoom: number;
    minPolarAngle: number;
    maxPolarAngle: number;
    minAzimuthAngle: number;
    maxAzimuthAngle: number;
    enableDamping: boolean;
    dampingFactor: number;
    enableZoom: boolean;
    zoomSpeed: number;
    enableRotate: boolean;
    rotateSpeed: number;
    enablePan: boolean;
    panSpeed: number;
    screenSpacePanning: boolean;
    keyPanSpeed: number;
    zoomToCursor: boolean;
    autoRotate: boolean;
    autoRotateSpeed: number;
    reverseOrbit: boolean;
    reverseHorizontalOrbit: boolean;
    reverseVerticalOrbit: boolean;
    keys: {
        LEFT: string;
        UP: string;
        RIGHT: string;
        BOTTOM: string;
    };
    mouseButtons: Partial<{
        LEFT: MOUSE;
        MIDDLE: MOUSE;
        RIGHT: MOUSE;
    }>;
    touches: Partial<{
        ONE: TOUCH;
        TWO: TOUCH;
    }>;
    target0: Vector3;
    position0: Vector3;
    zoom0: number;
    _domElementKeyEvents: any;
    getPolarAngle: () => number;
    getAzimuthalAngle: () => number;
    setPolarAngle: (x: number) => void;
    setAzimuthalAngle: (x: number) => void;
    getDistance: () => number;
    getZoomScale: () => number;
    listenToKeyEvents: (domElement: HTMLElement) => void;
    stopListenToKeyEvents: () => void;
    saveState: () => void;
    reset: () => void;
    update: () => void;
    connect: (domElement: HTMLElement) => void;
    dispose: () => void;
    dollyIn: (dollyScale?: number) => void;
    dollyOut: (dollyScale?: number) => void;
    getScale: () => number;
    setScale: (newScale: number) => void;
    constructor(object: PerspectiveCamera | OrthographicCamera, domElement?: HTMLElement);
}
declare class MapControls extends OrbitControls {
    constructor(object: PerspectiveCamera | OrthographicCamera, domElement?: HTMLElement);
}
export { OrbitControls, MapControls };
