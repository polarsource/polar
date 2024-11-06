"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class HTMLMesh extends THREE.Mesh {
  constructor(dom) {
    const texture = new HTMLTexture(dom);
    const geometry = new THREE.PlaneGeometry(texture.image.width * 1e-3, texture.image.height * 1e-3);
    const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, transparent: true });
    super(geometry, material);
    function onEvent(event) {
      material.map.dispatchDOMEvent(event);
    }
    this.addEventListener("mousedown", onEvent);
    this.addEventListener("mousemove", onEvent);
    this.addEventListener("mouseup", onEvent);
    this.addEventListener("click", onEvent);
    this.dispose = function() {
      geometry.dispose();
      material.dispose();
      material.map.dispose();
      canvases.delete(dom);
      this.removeEventListener("mousedown", onEvent);
      this.removeEventListener("mousemove", onEvent);
      this.removeEventListener("mouseup", onEvent);
      this.removeEventListener("click", onEvent);
    };
  }
}
class HTMLTexture extends THREE.CanvasTexture {
  constructor(dom) {
    super(html2canvas(dom));
    this.dom = dom;
    this.anisotropy = 16;
    if ("colorSpace" in this)
      this.colorSpace = "srgb";
    else
      this.encoding = 3001;
    this.minFilter = THREE.LinearFilter;
    this.magFilter = THREE.LinearFilter;
    const observer = new MutationObserver(() => {
      if (!this.scheduleUpdate) {
        this.scheduleUpdate = setTimeout(() => this.update(), 16);
      }
    });
    const config = { attributes: true, childList: true, subtree: true, characterData: true };
    observer.observe(dom, config);
    this.observer = observer;
  }
  dispatchDOMEvent(event) {
    if (event.data) {
      htmlevent(this.dom, event.type, event.data.x, event.data.y);
    }
  }
  update() {
    this.image = html2canvas(this.dom);
    this.needsUpdate = true;
    this.scheduleUpdate = null;
  }
  dispose() {
    if (this.observer) {
      this.observer.disconnect();
    }
    this.scheduleUpdate = clearTimeout(this.scheduleUpdate);
    super.dispose();
  }
}
const canvases = /* @__PURE__ */ new WeakMap();
function html2canvas(element) {
  const range = document.createRange();
  const color = new THREE.Color();
  function Clipper(context2) {
    const clips = [];
    let isClipping = false;
    function doClip() {
      if (isClipping) {
        isClipping = false;
        context2.restore();
      }
      if (clips.length === 0)
        return;
      let minX = -Infinity, minY = -Infinity;
      let maxX = Infinity, maxY = Infinity;
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        minX = Math.max(minX, clip.x);
        minY = Math.max(minY, clip.y);
        maxX = Math.min(maxX, clip.x + clip.width);
        maxY = Math.min(maxY, clip.y + clip.height);
      }
      context2.save();
      context2.beginPath();
      context2.rect(minX, minY, maxX - minX, maxY - minY);
      context2.clip();
      isClipping = true;
    }
    return {
      add: function(clip) {
        clips.push(clip);
        doClip();
      },
      remove: function() {
        clips.pop();
        doClip();
      }
    };
  }
  function drawText(style, x, y, string) {
    if (string !== "") {
      if (style.textTransform === "uppercase") {
        string = string.toUpperCase();
      }
      context.font = style.fontWeight + " " + style.fontSize + " " + style.fontFamily;
      context.textBaseline = "top";
      context.fillStyle = style.color;
      context.fillText(string, x, y + parseFloat(style.fontSize) * 0.1);
    }
  }
  function buildRectPath(x, y, w, h, r) {
    if (w < 2 * r)
      r = w / 2;
    if (h < 2 * r)
      r = h / 2;
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }
  function drawBorder(style, which, x, y, width, height) {
    const borderWidth = style[which + "Width"];
    const borderStyle = style[which + "Style"];
    const borderColor = style[which + "Color"];
    if (borderWidth !== "0px" && borderStyle !== "none" && borderColor !== "transparent" && borderColor !== "rgba(0, 0, 0, 0)") {
      context.strokeStyle = borderColor;
      context.lineWidth = parseFloat(borderWidth);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + width, y + height);
      context.stroke();
    }
  }
  function drawElement(element2, style) {
    let x = 0, y = 0, width = 0, height = 0;
    if (element2.nodeType === Node.TEXT_NODE) {
      range.selectNode(element2);
      const rect = range.getBoundingClientRect();
      x = rect.left - offset.left - 0.5;
      y = rect.top - offset.top - 0.5;
      width = rect.width;
      height = rect.height;
      drawText(style, x, y, element2.nodeValue.trim());
    } else if (element2.nodeType === Node.COMMENT_NODE) {
      return;
    } else if (element2 instanceof HTMLCanvasElement) {
      if (element2.style.display === "none")
        return;
      context.save();
      const dpr = window.devicePixelRatio;
      context.scale(1 / dpr, 1 / dpr);
      context.drawImage(element2, 0, 0);
      context.restore();
    } else {
      if (element2.style.display === "none")
        return;
      const rect = element2.getBoundingClientRect();
      x = rect.left - offset.left - 0.5;
      y = rect.top - offset.top - 0.5;
      width = rect.width;
      height = rect.height;
      style = window.getComputedStyle(element2);
      buildRectPath(x, y, width, height, parseFloat(style.borderRadius));
      const backgroundColor = style.backgroundColor;
      if (backgroundColor !== "transparent" && backgroundColor !== "rgba(0, 0, 0, 0)") {
        context.fillStyle = backgroundColor;
        context.fill();
      }
      const borders = ["borderTop", "borderLeft", "borderBottom", "borderRight"];
      let match = true;
      let prevBorder = null;
      for (const border of borders) {
        if (prevBorder !== null) {
          match = style[border + "Width"] === style[prevBorder + "Width"] && style[border + "Color"] === style[prevBorder + "Color"] && style[border + "Style"] === style[prevBorder + "Style"];
        }
        if (match === false)
          break;
        prevBorder = border;
      }
      if (match === true) {
        const width2 = parseFloat(style.borderTopWidth);
        if (style.borderTopWidth !== "0px" && style.borderTopStyle !== "none" && style.borderTopColor !== "transparent" && style.borderTopColor !== "rgba(0, 0, 0, 0)") {
          context.strokeStyle = style.borderTopColor;
          context.lineWidth = width2;
          context.stroke();
        }
      } else {
        drawBorder(style, "borderTop", x, y, width, 0);
        drawBorder(style, "borderLeft", x, y, 0, height);
        drawBorder(style, "borderBottom", x, y + height, width, 0);
        drawBorder(style, "borderRight", x + width, y, 0, height);
      }
      if (element2 instanceof HTMLInputElement) {
        let accentColor = style.accentColor;
        if (accentColor === void 0 || accentColor === "auto")
          accentColor = style.color;
        color.set(accentColor);
        const luminance = Math.sqrt(0.299 * color.r ** 2 + 0.587 * color.g ** 2 + 0.114 * color.b ** 2);
        const accentTextColor = luminance < 0.5 ? "white" : "#111111";
        if (element2.type === "radio") {
          buildRectPath(x, y, width, height, height);
          context.fillStyle = "white";
          context.strokeStyle = accentColor;
          context.lineWidth = 1;
          context.fill();
          context.stroke();
          if (element2.checked) {
            buildRectPath(x + 2, y + 2, width - 4, height - 4, height);
            context.fillStyle = accentColor;
            context.strokeStyle = accentTextColor;
            context.lineWidth = 2;
            context.fill();
            context.stroke();
          }
        }
        if (element2.type === "checkbox") {
          buildRectPath(x, y, width, height, 2);
          context.fillStyle = element2.checked ? accentColor : "white";
          context.strokeStyle = element2.checked ? accentTextColor : accentColor;
          context.lineWidth = 1;
          context.stroke();
          context.fill();
          if (element2.checked) {
            const currentTextAlign = context.textAlign;
            context.textAlign = "center";
            const properties = {
              color: accentTextColor,
              fontFamily: style.fontFamily,
              fontSize: height + "px",
              fontWeight: "bold"
            };
            drawText(properties, x + width / 2, y, "✔");
            context.textAlign = currentTextAlign;
          }
        }
        if (element2.type === "range") {
          const [min, max, value] = ["min", "max", "value"].map((property) => parseFloat(element2[property]));
          const position = (value - min) / (max - min) * (width - height);
          buildRectPath(x, y + height / 4, width, height / 2, height / 4);
          context.fillStyle = accentTextColor;
          context.strokeStyle = accentColor;
          context.lineWidth = 1;
          context.fill();
          context.stroke();
          buildRectPath(x, y + height / 4, position + height / 2, height / 2, height / 4);
          context.fillStyle = accentColor;
          context.fill();
          buildRectPath(x + position, y, height, height, height / 2);
          context.fillStyle = accentColor;
          context.fill();
        }
        if (element2.type === "color" || element2.type === "text" || element2.type === "number") {
          clipper.add({ x, y, width, height });
          drawText(style, x + parseInt(style.paddingLeft), y + parseInt(style.paddingTop), element2.value);
          clipper.remove();
        }
      }
    }
    const isClipping = style.overflow === "auto" || style.overflow === "hidden";
    if (isClipping)
      clipper.add({ x, y, width, height });
    for (let i = 0; i < element2.childNodes.length; i++) {
      drawElement(element2.childNodes[i], style);
    }
    if (isClipping)
      clipper.remove();
  }
  const offset = element.getBoundingClientRect();
  let canvas = canvases.get(element);
  if (canvas === void 0) {
    canvas = document.createElement("canvas");
    canvas.width = offset.width;
    canvas.height = offset.height;
    canvases.set(element, canvas);
  }
  const context = canvas.getContext(
    "2d"
    /*, { alpha: false }*/
  );
  const clipper = new Clipper(context);
  drawElement(element);
  return canvas;
}
function htmlevent(element, event, x, y) {
  const mouseEventInit = {
    clientX: x * element.offsetWidth + element.offsetLeft,
    clientY: y * element.offsetHeight + element.offsetTop,
    view: element.ownerDocument.defaultView
  };
  window.dispatchEvent(new MouseEvent(event, mouseEventInit));
  const rect = element.getBoundingClientRect();
  x = x * rect.width + rect.left;
  y = y * rect.height + rect.top;
  function traverse(element2) {
    if (element2.nodeType !== Node.TEXT_NODE && element2.nodeType !== Node.COMMENT_NODE) {
      const rect2 = element2.getBoundingClientRect();
      if (x > rect2.left && x < rect2.right && y > rect2.top && y < rect2.bottom) {
        element2.dispatchEvent(new MouseEvent(event, mouseEventInit));
        if (element2 instanceof HTMLInputElement && element2.type === "range" && (event === "mousedown" || event === "click")) {
          const [min, max] = ["min", "max"].map((property) => parseFloat(element2[property]));
          const width = rect2.width;
          const offsetX = x - rect2.x;
          const proportion = offsetX / width;
          element2.value = min + (max - min) * proportion;
          element2.dispatchEvent(new InputEvent("input", { bubbles: true }));
        }
      }
      for (let i = 0; i < element2.childNodes.length; i++) {
        traverse(element2.childNodes[i]);
      }
    }
  }
  traverse(element);
}
exports.HTMLMesh = HTMLMesh;
//# sourceMappingURL=HTMLMesh.cjs.map
