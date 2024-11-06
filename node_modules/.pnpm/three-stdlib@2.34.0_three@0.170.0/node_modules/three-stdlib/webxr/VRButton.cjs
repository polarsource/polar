"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const _VRButton = class {
  static createButton(renderer, sessionInit = {}) {
    const button = document.createElement("button");
    function showEnterVR() {
      let currentSession = null;
      async function onSessionStarted(session) {
        session.addEventListener("end", onSessionEnded);
        await renderer.xr.setSession(session);
        button.textContent = "EXIT VR";
        currentSession = session;
      }
      function onSessionEnded() {
        currentSession.removeEventListener("end", onSessionEnded);
        button.textContent = "ENTER VR";
        currentSession = null;
      }
      button.style.display = "";
      button.style.cursor = "pointer";
      button.style.left = "calc(50% - 50px)";
      button.style.width = "100px";
      button.textContent = "ENTER VR";
      button.onmouseenter = () => {
        button.style.opacity = "1.0";
      };
      button.onmouseleave = () => {
        button.style.opacity = "0.5";
      };
      button.onclick = () => {
        var _a;
        if (currentSession === null) {
          const optionalFeatures = [sessionInit.optionalFeatures, "local-floor", "bounded-floor", "hand-tracking"].flat().filter(Boolean);
          (_a = navigator.xr) == null ? void 0 : _a.requestSession("immersive-vr", { ...sessionInit, optionalFeatures }).then(onSessionStarted);
        } else {
          currentSession.end();
        }
      };
    }
    function disableButton() {
      button.style.display = "";
      button.style.cursor = "auto";
      button.style.left = "calc(50% - 75px)";
      button.style.width = "150px";
      button.onmouseenter = null;
      button.onmouseleave = null;
      button.onclick = null;
    }
    function showWebXRNotFound() {
      disableButton();
      button.textContent = "VR NOT SUPPORTED";
    }
    function stylizeElement(element) {
      element.style.position = "absolute";
      element.style.bottom = "20px";
      element.style.padding = "12px 6px";
      element.style.border = "1px solid #fff";
      element.style.borderRadius = "4px";
      element.style.background = "rgba(0,0,0,0.1)";
      element.style.color = "#fff";
      element.style.font = "normal 13px sans-serif";
      element.style.textAlign = "center";
      element.style.opacity = "0.5";
      element.style.outline = "none";
      element.style.zIndex = "999";
    }
    if ("xr" in navigator) {
      stylizeElement(button);
      button.id = "VRButton";
      button.style.display = "none";
      navigator.xr.isSessionSupported("immersive-vr").then((supported) => {
        supported ? showEnterVR() : showWebXRNotFound();
        if (supported && _VRButton.xrSessionIsGranted) {
          button.click();
        }
      });
      return button;
    } else {
      const message = document.createElement("a");
      if (window.isSecureContext === false) {
        message.href = document.location.href.replace(/^http:/, "https:");
        message.innerHTML = "WEBXR NEEDS HTTPS";
      } else {
        message.href = "https://immersiveweb.dev/";
        message.innerHTML = "WEBXR NOT AVAILABLE";
      }
      message.style.left = "calc(50% - 90px)";
      message.style.width = "180px";
      message.style.textDecoration = "none";
      stylizeElement(message);
      return message;
    }
  }
  static registerSessionGrantedListener() {
    if (typeof navigator !== "undefined" && "xr" in navigator) {
      navigator.xr.addEventListener("sessiongranted", () => {
        _VRButton.xrSessionIsGranted = true;
      });
    }
  }
};
let VRButton = _VRButton;
__publicField(VRButton, "xrSessionIsGranted", false);
VRButton.registerSessionGrantedListener();
exports.VRButton = VRButton;
//# sourceMappingURL=VRButton.cjs.map
