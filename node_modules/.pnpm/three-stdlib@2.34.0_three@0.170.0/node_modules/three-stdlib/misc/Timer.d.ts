declare class Timer {
    private _previousTime;
    private _currentTime;
    private _delta;
    private _elapsed;
    private _timescale;
    private _useFixedDelta;
    private _fixedDelta;
    private _usePageVisibilityAPI;
    private _pageVisibilityHandler;
    constructor();
    connect(): this;
    dispose(): this;
    disableFixedDelta(): this;
    enableFixedDelta(): this;
    getDelta(): number;
    getElapsedTime(): number;
    getFixedDelta(): number;
    getTimescale(): number;
    reset(): this;
    setFixedDelta(fixedDelta: number): this;
    setTimescale(timescale: number): this;
    update(): this;
    get elapsedTime(): number;
    private _now;
}
export { Timer };
