(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.zustandShallow = {}));
})(this, (function (exports) { 'use strict';

  function shallow(objA, objB) {
    if (Object.is(objA, objB)) {
      return true;
    }

    if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
      return false;
    }

    var keysA = Object.keys(objA);

    if (keysA.length !== Object.keys(objB).length) {
      return false;
    }

    for (var i = 0; i < keysA.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(objB, keysA[i]) || !Object.is(objA[keysA[i]], objB[keysA[i]])) {
        return false;
      }
    }

    return true;
  }

  exports["default"] = shallow;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
