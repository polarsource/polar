var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class Timer {
  constructor() {
    __publicField(this, "_previousTime");
    __publicField(this, "_currentTime");
    __publicField(this, "_delta");
    __publicField(this, "_elapsed");
    __publicField(this, "_timescale");
    __publicField(this, "_useFixedDelta");
    __publicField(this, "_fixedDelta");
    __publicField(this, "_usePageVisibilityAPI");
    __publicField(this, "_pageVisibilityHandler");
    this._previousTime = 0;
    this._currentTime = 0;
    this._delta = 0;
    this._elapsed = 0;
    this._timescale = 1;
    this._useFixedDelta = false;
    this._fixedDelta = 16.67;
    this._usePageVisibilityAPI = typeof document !== "undefined" && document.hidden !== void 0;
  }
  // https://github.com/mrdoob/three.js/issues/20575
  // use Page Visibility API to avoid large time delta values
  connect() {
    if (this._usePageVisibilityAPI) {
      this._pageVisibilityHandler = handleVisibilityChange.bind(this);
      document.addEventListener("visibilitychange", this._pageVisibilityHandler, false);
    }
    return this;
  }
  dispose() {
    if (this._usePageVisibilityAPI && this._pageVisibilityHandler) {
      document.removeEventListener("visibilitychange", this._pageVisibilityHandler);
    }
    return this;
  }
  disableFixedDelta() {
    this._useFixedDelta = false;
    return this;
  }
  enableFixedDelta() {
    this._useFixedDelta = true;
    return this;
  }
  getDelta() {
    return this._delta / 1e3;
  }
  getElapsedTime() {
    return this._elapsed / 1e3;
  }
  getFixedDelta() {
    return this._fixedDelta / 1e3;
  }
  getTimescale() {
    return this._timescale;
  }
  reset() {
    this._currentTime = this._now();
    return this;
  }
  setFixedDelta(fixedDelta) {
    this._fixedDelta = fixedDelta * 1e3;
    return this;
  }
  setTimescale(timescale) {
    this._timescale = timescale;
    return this;
  }
  update() {
    if (this._useFixedDelta === true) {
      this._delta = this._fixedDelta;
    } else {
      this._previousTime = this._currentTime;
      this._currentTime = this._now();
      this._delta = this._currentTime - this._previousTime;
    }
    this._delta *= this._timescale;
    this._elapsed += this._delta;
    return this;
  }
  // For THREE.Clock backward compatibility
  get elapsedTime() {
    return this.getElapsedTime();
  }
  // private
  _now() {
    return (typeof performance === "undefined" ? Date : performance).now();
  }
}
function handleVisibilityChange() {
  if (document.hidden === false)
    this.reset();
}
export {
  Timer
};
//# sourceMappingURL=Timer.js.map
