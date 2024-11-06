System.register([], (function (exports) {
  'use strict';
  return {
    execute: (function () {

      exports('default', shallow);

      function shallow(objA, objB) {
        if (Object.is(objA, objB)) {
          return true;
        }
        if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) {
          return false;
        }
        const keysA = Object.keys(objA);
        if (keysA.length !== Object.keys(objB).length) {
          return false;
        }
        for (let i = 0; i < keysA.length; i++) {
          if (!Object.prototype.hasOwnProperty.call(objB, keysA[i]) || !Object.is(objA[keysA[i]], objB[keysA[i]])) {
            return false;
          }
        }
        return true;
      }

    })
  };
}));
