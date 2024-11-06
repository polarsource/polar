"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const COLOR_SPACE_SVG = "srgb";
class SVGLoader extends THREE.Loader {
  constructor(manager) {
    super(manager);
    this.defaultDPI = 90;
    this.defaultUnit = "px";
  }
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const loader = new THREE.FileLoader(scope.manager);
    loader.setPath(scope.path);
    loader.setRequestHeader(scope.requestHeader);
    loader.setWithCredentials(scope.withCredentials);
    loader.load(
      url,
      function(text) {
        try {
          onLoad(scope.parse(text));
        } catch (e) {
          if (onError) {
            onError(e);
          } else {
            console.error(e);
          }
          scope.manager.itemError(url);
        }
      },
      onProgress,
      onError
    );
  }
  parse(text) {
    const scope = this;
    function parseNode(node, style) {
      if (node.nodeType !== 1)
        return;
      const transform = getNodeTransform(node);
      let isDefsNode = false;
      let path = null;
      switch (node.nodeName) {
        case "svg":
          style = parseStyle(node, style);
          break;
        case "style":
          parseCSSStylesheet(node);
          break;
        case "g":
          style = parseStyle(node, style);
          break;
        case "path":
          style = parseStyle(node, style);
          if (node.hasAttribute("d"))
            path = parsePathNode(node);
          break;
        case "rect":
          style = parseStyle(node, style);
          path = parseRectNode(node);
          break;
        case "polygon":
          style = parseStyle(node, style);
          path = parsePolygonNode(node);
          break;
        case "polyline":
          style = parseStyle(node, style);
          path = parsePolylineNode(node);
          break;
        case "circle":
          style = parseStyle(node, style);
          path = parseCircleNode(node);
          break;
        case "ellipse":
          style = parseStyle(node, style);
          path = parseEllipseNode(node);
          break;
        case "line":
          style = parseStyle(node, style);
          path = parseLineNode(node);
          break;
        case "defs":
          isDefsNode = true;
          break;
        case "use":
          style = parseStyle(node, style);
          const href = node.getAttributeNS("http://www.w3.org/1999/xlink", "href") || "";
          const usedNodeId = href.substring(1);
          const usedNode = node.viewportElement.getElementById(usedNodeId);
          if (usedNode) {
            parseNode(usedNode, style);
          } else {
            console.warn("SVGLoader: 'use node' references non-existent node id: " + usedNodeId);
          }
          break;
      }
      if (path) {
        if (style.fill !== void 0 && style.fill !== "none") {
          path.color.setStyle(style.fill, COLOR_SPACE_SVG);
        }
        transformPath(path, currentTransform);
        paths.push(path);
        path.userData = { node, style };
      }
      const childNodes = node.childNodes;
      for (let i = 0; i < childNodes.length; i++) {
        const node2 = childNodes[i];
        if (isDefsNode && node2.nodeName !== "style" && node2.nodeName !== "defs") {
          continue;
        }
        parseNode(node2, style);
      }
      if (transform) {
        transformStack.pop();
        if (transformStack.length > 0) {
          currentTransform.copy(transformStack[transformStack.length - 1]);
        } else {
          currentTransform.identity();
        }
      }
    }
    function parsePathNode(node) {
      const path = new THREE.ShapePath();
      const point = new THREE.Vector2();
      const control = new THREE.Vector2();
      const firstPoint = new THREE.Vector2();
      let isFirstPoint = true;
      let doSetFirstPoint = false;
      const d = node.getAttribute("d");
      if (d === "" || d === "none")
        return null;
      const commands = d.match(/[a-df-z][^a-df-z]*/gi);
      for (let i = 0, l = commands.length; i < l; i++) {
        const command = commands[i];
        const type = command.charAt(0);
        const data2 = command.slice(1).trim();
        if (isFirstPoint === true) {
          doSetFirstPoint = true;
          isFirstPoint = false;
        }
        let numbers;
        switch (type) {
          case "M":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j += 2) {
              point.x = numbers[j + 0];
              point.y = numbers[j + 1];
              control.x = point.x;
              control.y = point.y;
              if (j === 0) {
                path.moveTo(point.x, point.y);
              } else {
                path.lineTo(point.x, point.y);
              }
              if (j === 0)
                firstPoint.copy(point);
            }
            break;
          case "H":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j++) {
              point.x = numbers[j];
              control.x = point.x;
              control.y = point.y;
              path.lineTo(point.x, point.y);
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "V":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j++) {
              point.y = numbers[j];
              control.x = point.x;
              control.y = point.y;
              path.lineTo(point.x, point.y);
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "L":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j += 2) {
              point.x = numbers[j + 0];
              point.y = numbers[j + 1];
              control.x = point.x;
              control.y = point.y;
              path.lineTo(point.x, point.y);
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "C":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j += 6) {
              path.bezierCurveTo(
                numbers[j + 0],
                numbers[j + 1],
                numbers[j + 2],
                numbers[j + 3],
                numbers[j + 4],
                numbers[j + 5]
              );
              control.x = numbers[j + 2];
              control.y = numbers[j + 3];
              point.x = numbers[j + 4];
              point.y = numbers[j + 5];
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "S":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j += 4) {
              path.bezierCurveTo(
                getReflection(point.x, control.x),
                getReflection(point.y, control.y),
                numbers[j + 0],
                numbers[j + 1],
                numbers[j + 2],
                numbers[j + 3]
              );
              control.x = numbers[j + 0];
              control.y = numbers[j + 1];
              point.x = numbers[j + 2];
              point.y = numbers[j + 3];
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "Q":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j += 4) {
              path.quadraticCurveTo(numbers[j + 0], numbers[j + 1], numbers[j + 2], numbers[j + 3]);
              control.x = numbers[j + 0];
              control.y = numbers[j + 1];
              point.x = numbers[j + 2];
              point.y = numbers[j + 3];
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "T":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j += 2) {
              const rx = getReflection(point.x, control.x);
              const ry = getReflection(point.y, control.y);
              path.quadraticCurveTo(rx, ry, numbers[j + 0], numbers[j + 1]);
              control.x = rx;
              control.y = ry;
              point.x = numbers[j + 0];
              point.y = numbers[j + 1];
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "A":
            numbers = parseFloats(data2, [3, 4], 7);
            for (let j = 0, jl = numbers.length; j < jl; j += 7) {
              if (numbers[j + 5] == point.x && numbers[j + 6] == point.y)
                continue;
              const start = point.clone();
              point.x = numbers[j + 5];
              point.y = numbers[j + 6];
              control.x = point.x;
              control.y = point.y;
              parseArcCommand(
                path,
                numbers[j],
                numbers[j + 1],
                numbers[j + 2],
                numbers[j + 3],
                numbers[j + 4],
                start,
                point
              );
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "m":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j += 2) {
              point.x += numbers[j + 0];
              point.y += numbers[j + 1];
              control.x = point.x;
              control.y = point.y;
              if (j === 0) {
                path.moveTo(point.x, point.y);
              } else {
                path.lineTo(point.x, point.y);
              }
              if (j === 0)
                firstPoint.copy(point);
            }
            break;
          case "h":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j++) {
              point.x += numbers[j];
              control.x = point.x;
              control.y = point.y;
              path.lineTo(point.x, point.y);
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "v":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j++) {
              point.y += numbers[j];
              control.x = point.x;
              control.y = point.y;
              path.lineTo(point.x, point.y);
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "l":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j += 2) {
              point.x += numbers[j + 0];
              point.y += numbers[j + 1];
              control.x = point.x;
              control.y = point.y;
              path.lineTo(point.x, point.y);
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "c":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j += 6) {
              path.bezierCurveTo(
                point.x + numbers[j + 0],
                point.y + numbers[j + 1],
                point.x + numbers[j + 2],
                point.y + numbers[j + 3],
                point.x + numbers[j + 4],
                point.y + numbers[j + 5]
              );
              control.x = point.x + numbers[j + 2];
              control.y = point.y + numbers[j + 3];
              point.x += numbers[j + 4];
              point.y += numbers[j + 5];
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "s":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j += 4) {
              path.bezierCurveTo(
                getReflection(point.x, control.x),
                getReflection(point.y, control.y),
                point.x + numbers[j + 0],
                point.y + numbers[j + 1],
                point.x + numbers[j + 2],
                point.y + numbers[j + 3]
              );
              control.x = point.x + numbers[j + 0];
              control.y = point.y + numbers[j + 1];
              point.x += numbers[j + 2];
              point.y += numbers[j + 3];
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "q":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j += 4) {
              path.quadraticCurveTo(
                point.x + numbers[j + 0],
                point.y + numbers[j + 1],
                point.x + numbers[j + 2],
                point.y + numbers[j + 3]
              );
              control.x = point.x + numbers[j + 0];
              control.y = point.y + numbers[j + 1];
              point.x += numbers[j + 2];
              point.y += numbers[j + 3];
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "t":
            numbers = parseFloats(data2);
            for (let j = 0, jl = numbers.length; j < jl; j += 2) {
              const rx = getReflection(point.x, control.x);
              const ry = getReflection(point.y, control.y);
              path.quadraticCurveTo(rx, ry, point.x + numbers[j + 0], point.y + numbers[j + 1]);
              control.x = rx;
              control.y = ry;
              point.x = point.x + numbers[j + 0];
              point.y = point.y + numbers[j + 1];
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "a":
            numbers = parseFloats(data2, [3, 4], 7);
            for (let j = 0, jl = numbers.length; j < jl; j += 7) {
              if (numbers[j + 5] == 0 && numbers[j + 6] == 0)
                continue;
              const start = point.clone();
              point.x += numbers[j + 5];
              point.y += numbers[j + 6];
              control.x = point.x;
              control.y = point.y;
              parseArcCommand(
                path,
                numbers[j],
                numbers[j + 1],
                numbers[j + 2],
                numbers[j + 3],
                numbers[j + 4],
                start,
                point
              );
              if (j === 0 && doSetFirstPoint === true)
                firstPoint.copy(point);
            }
            break;
          case "Z":
          case "z":
            path.currentPath.autoClose = true;
            if (path.currentPath.curves.length > 0) {
              point.copy(firstPoint);
              path.currentPath.currentPoint.copy(point);
              isFirstPoint = true;
            }
            break;
          default:
            console.warn(command);
        }
        doSetFirstPoint = false;
      }
      return path;
    }
    function parseCSSStylesheet(node) {
      if (!node.sheet || !node.sheet.cssRules || !node.sheet.cssRules.length)
        return;
      for (let i = 0; i < node.sheet.cssRules.length; i++) {
        const stylesheet = node.sheet.cssRules[i];
        if (stylesheet.type !== 1)
          continue;
        const selectorList = stylesheet.selectorText.split(/,/gm).filter(Boolean).map((i2) => i2.trim());
        for (let j = 0; j < selectorList.length; j++) {
          const definitions = Object.fromEntries(Object.entries(stylesheet.style).filter(([, v]) => v !== ""));
          stylesheets[selectorList[j]] = Object.assign(stylesheets[selectorList[j]] || {}, definitions);
        }
      }
    }
    function parseArcCommand(path, rx, ry, x_axis_rotation, large_arc_flag, sweep_flag, start, end) {
      if (rx == 0 || ry == 0) {
        path.lineTo(end.x, end.y);
        return;
      }
      x_axis_rotation = x_axis_rotation * Math.PI / 180;
      rx = Math.abs(rx);
      ry = Math.abs(ry);
      const dx2 = (start.x - end.x) / 2;
      const dy2 = (start.y - end.y) / 2;
      const x1p = Math.cos(x_axis_rotation) * dx2 + Math.sin(x_axis_rotation) * dy2;
      const y1p = -Math.sin(x_axis_rotation) * dx2 + Math.cos(x_axis_rotation) * dy2;
      let rxs = rx * rx;
      let rys = ry * ry;
      const x1ps = x1p * x1p;
      const y1ps = y1p * y1p;
      const cr = x1ps / rxs + y1ps / rys;
      if (cr > 1) {
        const s = Math.sqrt(cr);
        rx = s * rx;
        ry = s * ry;
        rxs = rx * rx;
        rys = ry * ry;
      }
      const dq = rxs * y1ps + rys * x1ps;
      const pq = (rxs * rys - dq) / dq;
      let q = Math.sqrt(Math.max(0, pq));
      if (large_arc_flag === sweep_flag)
        q = -q;
      const cxp = q * rx * y1p / ry;
      const cyp = -q * ry * x1p / rx;
      const cx = Math.cos(x_axis_rotation) * cxp - Math.sin(x_axis_rotation) * cyp + (start.x + end.x) / 2;
      const cy = Math.sin(x_axis_rotation) * cxp + Math.cos(x_axis_rotation) * cyp + (start.y + end.y) / 2;
      const theta = svgAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
      const delta = svgAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry) % (Math.PI * 2);
      path.currentPath.absellipse(cx, cy, rx, ry, theta, theta + delta, sweep_flag === 0, x_axis_rotation);
    }
    function svgAngle(ux, uy, vx, vy) {
      const dot = ux * vx + uy * vy;
      const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
      let ang = Math.acos(Math.max(-1, Math.min(1, dot / len)));
      if (ux * vy - uy * vx < 0)
        ang = -ang;
      return ang;
    }
    function parseRectNode(node) {
      const x = parseFloatWithUnits(node.getAttribute("x") || 0);
      const y = parseFloatWithUnits(node.getAttribute("y") || 0);
      const rx = parseFloatWithUnits(node.getAttribute("rx") || node.getAttribute("ry") || 0);
      const ry = parseFloatWithUnits(node.getAttribute("ry") || node.getAttribute("rx") || 0);
      const w = parseFloatWithUnits(node.getAttribute("width"));
      const h = parseFloatWithUnits(node.getAttribute("height"));
      const bci = 1 - 0.551915024494;
      const path = new THREE.ShapePath();
      path.moveTo(x + rx, y);
      path.lineTo(x + w - rx, y);
      if (rx !== 0 || ry !== 0) {
        path.bezierCurveTo(x + w - rx * bci, y, x + w, y + ry * bci, x + w, y + ry);
      }
      path.lineTo(x + w, y + h - ry);
      if (rx !== 0 || ry !== 0) {
        path.bezierCurveTo(x + w, y + h - ry * bci, x + w - rx * bci, y + h, x + w - rx, y + h);
      }
      path.lineTo(x + rx, y + h);
      if (rx !== 0 || ry !== 0) {
        path.bezierCurveTo(x + rx * bci, y + h, x, y + h - ry * bci, x, y + h - ry);
      }
      path.lineTo(x, y + ry);
      if (rx !== 0 || ry !== 0) {
        path.bezierCurveTo(x, y + ry * bci, x + rx * bci, y, x + rx, y);
      }
      return path;
    }
    function parsePolygonNode(node) {
      function iterator(match, a, b) {
        const x = parseFloatWithUnits(a);
        const y = parseFloatWithUnits(b);
        if (index === 0) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
        index++;
      }
      const regex = /([+-]?\d*\.?\d+(?:e[+-]?\d+)?)(?:,|\s)([+-]?\d*\.?\d+(?:e[+-]?\d+)?)/g;
      const path = new THREE.ShapePath();
      let index = 0;
      node.getAttribute("points").replace(regex, iterator);
      path.currentPath.autoClose = true;
      return path;
    }
    function parsePolylineNode(node) {
      function iterator(match, a, b) {
        const x = parseFloatWithUnits(a);
        const y = parseFloatWithUnits(b);
        if (index === 0) {
          path.moveTo(x, y);
        } else {
          path.lineTo(x, y);
        }
        index++;
      }
      const regex = /([+-]?\d*\.?\d+(?:e[+-]?\d+)?)(?:,|\s)([+-]?\d*\.?\d+(?:e[+-]?\d+)?)/g;
      const path = new THREE.ShapePath();
      let index = 0;
      node.getAttribute("points").replace(regex, iterator);
      path.currentPath.autoClose = false;
      return path;
    }
    function parseCircleNode(node) {
      const x = parseFloatWithUnits(node.getAttribute("cx") || 0);
      const y = parseFloatWithUnits(node.getAttribute("cy") || 0);
      const r = parseFloatWithUnits(node.getAttribute("r") || 0);
      const subpath = new THREE.Path();
      subpath.absarc(x, y, r, 0, Math.PI * 2);
      const path = new THREE.ShapePath();
      path.subPaths.push(subpath);
      return path;
    }
    function parseEllipseNode(node) {
      const x = parseFloatWithUnits(node.getAttribute("cx") || 0);
      const y = parseFloatWithUnits(node.getAttribute("cy") || 0);
      const rx = parseFloatWithUnits(node.getAttribute("rx") || 0);
      const ry = parseFloatWithUnits(node.getAttribute("ry") || 0);
      const subpath = new THREE.Path();
      subpath.absellipse(x, y, rx, ry, 0, Math.PI * 2);
      const path = new THREE.ShapePath();
      path.subPaths.push(subpath);
      return path;
    }
    function parseLineNode(node) {
      const x1 = parseFloatWithUnits(node.getAttribute("x1") || 0);
      const y1 = parseFloatWithUnits(node.getAttribute("y1") || 0);
      const x2 = parseFloatWithUnits(node.getAttribute("x2") || 0);
      const y2 = parseFloatWithUnits(node.getAttribute("y2") || 0);
      const path = new THREE.ShapePath();
      path.moveTo(x1, y1);
      path.lineTo(x2, y2);
      path.currentPath.autoClose = false;
      return path;
    }
    function parseStyle(node, style) {
      style = Object.assign({}, style);
      let stylesheetStyles = {};
      if (node.hasAttribute("class")) {
        const classSelectors = node.getAttribute("class").split(/\s/).filter(Boolean).map((i) => i.trim());
        for (let i = 0; i < classSelectors.length; i++) {
          stylesheetStyles = Object.assign(stylesheetStyles, stylesheets["." + classSelectors[i]]);
        }
      }
      if (node.hasAttribute("id")) {
        stylesheetStyles = Object.assign(stylesheetStyles, stylesheets["#" + node.getAttribute("id")]);
      }
      function addStyle(svgName, jsName, adjustFunction) {
        if (adjustFunction === void 0)
          adjustFunction = function copy(v) {
            if (v.startsWith("url"))
              console.warn("SVGLoader: url access in attributes is not implemented.");
            return v;
          };
        if (node.hasAttribute(svgName))
          style[jsName] = adjustFunction(node.getAttribute(svgName));
        if (stylesheetStyles[svgName])
          style[jsName] = adjustFunction(stylesheetStyles[svgName]);
        if (node.style && node.style[svgName] !== "")
          style[jsName] = adjustFunction(node.style[svgName]);
      }
      function clamp(v) {
        return Math.max(0, Math.min(1, parseFloatWithUnits(v)));
      }
      function positive(v) {
        return Math.max(0, parseFloatWithUnits(v));
      }
      addStyle("fill", "fill");
      addStyle("fill-opacity", "fillOpacity", clamp);
      addStyle("fill-rule", "fillRule");
      addStyle("opacity", "opacity", clamp);
      addStyle("stroke", "stroke");
      addStyle("stroke-opacity", "strokeOpacity", clamp);
      addStyle("stroke-width", "strokeWidth", positive);
      addStyle("stroke-linejoin", "strokeLineJoin");
      addStyle("stroke-linecap", "strokeLineCap");
      addStyle("stroke-miterlimit", "strokeMiterLimit", positive);
      addStyle("visibility", "visibility");
      return style;
    }
    function getReflection(a, b) {
      return a - (b - a);
    }
    function parseFloats(input, flags, stride) {
      if (typeof input !== "string") {
        throw new TypeError("Invalid input: " + typeof input);
      }
      const RE = {
        SEPARATOR: /[ \t\r\n\,.\-+]/,
        WHITESPACE: /[ \t\r\n]/,
        DIGIT: /[\d]/,
        SIGN: /[-+]/,
        POINT: /\./,
        COMMA: /,/,
        EXP: /e/i,
        FLAGS: /[01]/
      };
      const SEP = 0;
      const INT = 1;
      const FLOAT = 2;
      const EXP = 3;
      let state = SEP;
      let seenComma = true;
      let number = "", exponent = "";
      const result = [];
      function throwSyntaxError(current2, i, partial) {
        const error = new SyntaxError('Unexpected character "' + current2 + '" at index ' + i + ".");
        error.partial = partial;
        throw error;
      }
      function newNumber() {
        if (number !== "") {
          if (exponent === "")
            result.push(Number(number));
          else
            result.push(Number(number) * Math.pow(10, Number(exponent)));
        }
        number = "";
        exponent = "";
      }
      let current;
      const length = input.length;
      for (let i = 0; i < length; i++) {
        current = input[i];
        if (Array.isArray(flags) && flags.includes(result.length % stride) && RE.FLAGS.test(current)) {
          state = INT;
          number = current;
          newNumber();
          continue;
        }
        if (state === SEP) {
          if (RE.WHITESPACE.test(current)) {
            continue;
          }
          if (RE.DIGIT.test(current) || RE.SIGN.test(current)) {
            state = INT;
            number = current;
            continue;
          }
          if (RE.POINT.test(current)) {
            state = FLOAT;
            number = current;
            continue;
          }
          if (RE.COMMA.test(current)) {
            if (seenComma) {
              throwSyntaxError(current, i, result);
            }
            seenComma = true;
          }
        }
        if (state === INT) {
          if (RE.DIGIT.test(current)) {
            number += current;
            continue;
          }
          if (RE.POINT.test(current)) {
            number += current;
            state = FLOAT;
            continue;
          }
          if (RE.EXP.test(current)) {
            state = EXP;
            continue;
          }
          if (RE.SIGN.test(current) && number.length === 1 && RE.SIGN.test(number[0])) {
            throwSyntaxError(current, i, result);
          }
        }
        if (state === FLOAT) {
          if (RE.DIGIT.test(current)) {
            number += current;
            continue;
          }
          if (RE.EXP.test(current)) {
            state = EXP;
            continue;
          }
          if (RE.POINT.test(current) && number[number.length - 1] === ".") {
            throwSyntaxError(current, i, result);
          }
        }
        if (state === EXP) {
          if (RE.DIGIT.test(current)) {
            exponent += current;
            continue;
          }
          if (RE.SIGN.test(current)) {
            if (exponent === "") {
              exponent += current;
              continue;
            }
            if (exponent.length === 1 && RE.SIGN.test(exponent)) {
              throwSyntaxError(current, i, result);
            }
          }
        }
        if (RE.WHITESPACE.test(current)) {
          newNumber();
          state = SEP;
          seenComma = false;
        } else if (RE.COMMA.test(current)) {
          newNumber();
          state = SEP;
          seenComma = true;
        } else if (RE.SIGN.test(current)) {
          newNumber();
          state = INT;
          number = current;
        } else if (RE.POINT.test(current)) {
          newNumber();
          state = FLOAT;
          number = current;
        } else {
          throwSyntaxError(current, i, result);
        }
      }
      newNumber();
      return result;
    }
    const units = ["mm", "cm", "in", "pt", "pc", "px"];
    const unitConversion = {
      mm: {
        mm: 1,
        cm: 0.1,
        in: 1 / 25.4,
        pt: 72 / 25.4,
        pc: 6 / 25.4,
        px: -1
      },
      cm: {
        mm: 10,
        cm: 1,
        in: 1 / 2.54,
        pt: 72 / 2.54,
        pc: 6 / 2.54,
        px: -1
      },
      in: {
        mm: 25.4,
        cm: 2.54,
        in: 1,
        pt: 72,
        pc: 6,
        px: -1
      },
      pt: {
        mm: 25.4 / 72,
        cm: 2.54 / 72,
        in: 1 / 72,
        pt: 1,
        pc: 6 / 72,
        px: -1
      },
      pc: {
        mm: 25.4 / 6,
        cm: 2.54 / 6,
        in: 1 / 6,
        pt: 72 / 6,
        pc: 1,
        px: -1
      },
      px: {
        px: 1
      }
    };
    function parseFloatWithUnits(string) {
      let theUnit = "px";
      if (typeof string === "string" || string instanceof String) {
        for (let i = 0, n = units.length; i < n; i++) {
          const u = units[i];
          if (string.endsWith(u)) {
            theUnit = u;
            string = string.substring(0, string.length - u.length);
            break;
          }
        }
      }
      let scale = void 0;
      if (theUnit === "px" && scope.defaultUnit !== "px") {
        scale = unitConversion["in"][scope.defaultUnit] / scope.defaultDPI;
      } else {
        scale = unitConversion[theUnit][scope.defaultUnit];
        if (scale < 0) {
          scale = unitConversion[theUnit]["in"] * scope.defaultDPI;
        }
      }
      return scale * parseFloat(string);
    }
    function getNodeTransform(node) {
      if (!(node.hasAttribute("transform") || node.nodeName === "use" && (node.hasAttribute("x") || node.hasAttribute("y")))) {
        return null;
      }
      const transform = parseNodeTransform(node);
      if (transformStack.length > 0) {
        transform.premultiply(transformStack[transformStack.length - 1]);
      }
      currentTransform.copy(transform);
      transformStack.push(transform);
      return transform;
    }
    function parseNodeTransform(node) {
      const transform = new THREE.Matrix3();
      const currentTransform2 = tempTransform0;
      if (node.nodeName === "use" && (node.hasAttribute("x") || node.hasAttribute("y"))) {
        const tx = parseFloatWithUnits(node.getAttribute("x"));
        const ty = parseFloatWithUnits(node.getAttribute("y"));
        transform.translate(tx, ty);
      }
      if (node.hasAttribute("transform")) {
        const transformsTexts = node.getAttribute("transform").split(")");
        for (let tIndex = transformsTexts.length - 1; tIndex >= 0; tIndex--) {
          const transformText = transformsTexts[tIndex].trim();
          if (transformText === "")
            continue;
          const openParPos = transformText.indexOf("(");
          const closeParPos = transformText.length;
          if (openParPos > 0 && openParPos < closeParPos) {
            const transformType = transformText.slice(0, openParPos);
            const array = parseFloats(transformText.slice(openParPos + 1));
            currentTransform2.identity();
            switch (transformType) {
              case "translate":
                if (array.length >= 1) {
                  const tx = array[0];
                  let ty = 0;
                  if (array.length >= 2) {
                    ty = array[1];
                  }
                  currentTransform2.translate(tx, ty);
                }
                break;
              case "rotate":
                if (array.length >= 1) {
                  let angle = 0;
                  let cx = 0;
                  let cy = 0;
                  angle = array[0] * Math.PI / 180;
                  if (array.length >= 3) {
                    cx = array[1];
                    cy = array[2];
                  }
                  tempTransform1.makeTranslation(-cx, -cy);
                  tempTransform2.makeRotation(angle);
                  tempTransform3.multiplyMatrices(tempTransform2, tempTransform1);
                  tempTransform1.makeTranslation(cx, cy);
                  currentTransform2.multiplyMatrices(tempTransform1, tempTransform3);
                }
                break;
              case "scale":
                if (array.length >= 1) {
                  const scaleX = array[0];
                  let scaleY = scaleX;
                  if (array.length >= 2) {
                    scaleY = array[1];
                  }
                  currentTransform2.scale(scaleX, scaleY);
                }
                break;
              case "skewX":
                if (array.length === 1) {
                  currentTransform2.set(1, Math.tan(array[0] * Math.PI / 180), 0, 0, 1, 0, 0, 0, 1);
                }
                break;
              case "skewY":
                if (array.length === 1) {
                  currentTransform2.set(1, 0, 0, Math.tan(array[0] * Math.PI / 180), 1, 0, 0, 0, 1);
                }
                break;
              case "matrix":
                if (array.length === 6) {
                  currentTransform2.set(array[0], array[2], array[4], array[1], array[3], array[5], 0, 0, 1);
                }
                break;
            }
          }
          transform.premultiply(currentTransform2);
        }
      }
      return transform;
    }
    function transformPath(path, m) {
      function transfVec2(v2) {
        tempV3.set(v2.x, v2.y, 1).applyMatrix3(m);
        v2.set(tempV3.x, tempV3.y);
      }
      function transfEllipseGeneric(curve) {
        const a = curve.xRadius;
        const b = curve.yRadius;
        const cosTheta = Math.cos(curve.aRotation);
        const sinTheta = Math.sin(curve.aRotation);
        const v1 = new THREE.Vector3(a * cosTheta, a * sinTheta, 0);
        const v2 = new THREE.Vector3(-b * sinTheta, b * cosTheta, 0);
        const f1 = v1.applyMatrix3(m);
        const f2 = v2.applyMatrix3(m);
        const mF = tempTransform0.set(f1.x, f2.x, 0, f1.y, f2.y, 0, 0, 0, 1);
        const mFInv = tempTransform1.copy(mF).invert();
        const mFInvT = tempTransform2.copy(mFInv).transpose();
        const mQ = mFInvT.multiply(mFInv);
        const mQe = mQ.elements;
        const ed = eigenDecomposition(mQe[0], mQe[1], mQe[4]);
        const rt1sqrt = Math.sqrt(ed.rt1);
        const rt2sqrt = Math.sqrt(ed.rt2);
        curve.xRadius = 1 / rt1sqrt;
        curve.yRadius = 1 / rt2sqrt;
        curve.aRotation = Math.atan2(ed.sn, ed.cs);
        const isFullEllipse = (curve.aEndAngle - curve.aStartAngle) % (2 * Math.PI) < Number.EPSILON;
        if (!isFullEllipse) {
          const mDsqrt = tempTransform1.set(rt1sqrt, 0, 0, 0, rt2sqrt, 0, 0, 0, 1);
          const mRT = tempTransform2.set(ed.cs, ed.sn, 0, -ed.sn, ed.cs, 0, 0, 0, 1);
          const mDRF = mDsqrt.multiply(mRT).multiply(mF);
          const transformAngle = (phi) => {
            const { x: cosR, y: sinR } = new THREE.Vector3(Math.cos(phi), Math.sin(phi), 0).applyMatrix3(mDRF);
            return Math.atan2(sinR, cosR);
          };
          curve.aStartAngle = transformAngle(curve.aStartAngle);
          curve.aEndAngle = transformAngle(curve.aEndAngle);
          if (isTransformFlipped(m)) {
            curve.aClockwise = !curve.aClockwise;
          }
        }
      }
      function transfEllipseNoSkew(curve) {
        const sx = getTransformScaleX(m);
        const sy = getTransformScaleY(m);
        curve.xRadius *= sx;
        curve.yRadius *= sy;
        const theta = sx > Number.EPSILON ? Math.atan2(m.elements[1], m.elements[0]) : Math.atan2(-m.elements[3], m.elements[4]);
        curve.aRotation += theta;
        if (isTransformFlipped(m)) {
          curve.aStartAngle *= -1;
          curve.aEndAngle *= -1;
          curve.aClockwise = !curve.aClockwise;
        }
      }
      const subPaths = path.subPaths;
      for (let i = 0, n = subPaths.length; i < n; i++) {
        const subPath = subPaths[i];
        const curves = subPath.curves;
        for (let j = 0; j < curves.length; j++) {
          const curve = curves[j];
          if (curve.isLineCurve) {
            transfVec2(curve.v1);
            transfVec2(curve.v2);
          } else if (curve.isCubicBezierCurve) {
            transfVec2(curve.v0);
            transfVec2(curve.v1);
            transfVec2(curve.v2);
            transfVec2(curve.v3);
          } else if (curve.isQuadraticBezierCurve) {
            transfVec2(curve.v0);
            transfVec2(curve.v1);
            transfVec2(curve.v2);
          } else if (curve.isEllipseCurve) {
            tempV2.set(curve.aX, curve.aY);
            transfVec2(tempV2);
            curve.aX = tempV2.x;
            curve.aY = tempV2.y;
            if (isTransformSkewed(m)) {
              transfEllipseGeneric(curve);
            } else {
              transfEllipseNoSkew(curve);
            }
          }
        }
      }
    }
    function isTransformFlipped(m) {
      const te = m.elements;
      return te[0] * te[4] - te[1] * te[3] < 0;
    }
    function isTransformSkewed(m) {
      const te = m.elements;
      const basisDot = te[0] * te[3] + te[1] * te[4];
      if (basisDot === 0)
        return false;
      const sx = getTransformScaleX(m);
      const sy = getTransformScaleY(m);
      return Math.abs(basisDot / (sx * sy)) > Number.EPSILON;
    }
    function getTransformScaleX(m) {
      const te = m.elements;
      return Math.sqrt(te[0] * te[0] + te[1] * te[1]);
    }
    function getTransformScaleY(m) {
      const te = m.elements;
      return Math.sqrt(te[3] * te[3] + te[4] * te[4]);
    }
    function eigenDecomposition(A, B, C) {
      let rt1, rt2, cs, sn, t;
      const sm = A + C;
      const df = A - C;
      const rt = Math.sqrt(df * df + 4 * B * B);
      if (sm > 0) {
        rt1 = 0.5 * (sm + rt);
        t = 1 / rt1;
        rt2 = A * t * C - B * t * B;
      } else if (sm < 0) {
        rt2 = 0.5 * (sm - rt);
      } else {
        rt1 = 0.5 * rt;
        rt2 = -0.5 * rt;
      }
      if (df > 0) {
        cs = df + rt;
      } else {
        cs = df - rt;
      }
      if (Math.abs(cs) > 2 * Math.abs(B)) {
        t = -2 * B / cs;
        sn = 1 / Math.sqrt(1 + t * t);
        cs = t * sn;
      } else if (Math.abs(B) === 0) {
        cs = 1;
        sn = 0;
      } else {
        t = -0.5 * cs / B;
        cs = 1 / Math.sqrt(1 + t * t);
        sn = t * cs;
      }
      if (df > 0) {
        t = cs;
        cs = -sn;
        sn = t;
      }
      return { rt1, rt2, cs, sn };
    }
    const paths = [];
    const stylesheets = {};
    const transformStack = [];
    const tempTransform0 = new THREE.Matrix3();
    const tempTransform1 = new THREE.Matrix3();
    const tempTransform2 = new THREE.Matrix3();
    const tempTransform3 = new THREE.Matrix3();
    const tempV2 = new THREE.Vector2();
    const tempV3 = new THREE.Vector3();
    const currentTransform = new THREE.Matrix3();
    const xml = new DOMParser().parseFromString(text, "image/svg+xml");
    parseNode(xml.documentElement, {
      fill: "#000",
      fillOpacity: 1,
      strokeOpacity: 1,
      strokeWidth: 1,
      strokeLineJoin: "miter",
      strokeLineCap: "butt",
      strokeMiterLimit: 4
    });
    const data = { paths, xml: xml.documentElement };
    return data;
  }
  static createShapes(shapePath) {
    const BIGNUMBER = 999999999;
    const IntersectionLocationType = {
      ORIGIN: 0,
      DESTINATION: 1,
      BETWEEN: 2,
      LEFT: 3,
      RIGHT: 4,
      BEHIND: 5,
      BEYOND: 6
    };
    const classifyResult = {
      loc: IntersectionLocationType.ORIGIN,
      t: 0
    };
    function findEdgeIntersection(a0, a1, b0, b1) {
      const x1 = a0.x;
      const x2 = a1.x;
      const x3 = b0.x;
      const x4 = b1.x;
      const y1 = a0.y;
      const y2 = a1.y;
      const y3 = b0.y;
      const y4 = b1.y;
      const nom1 = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
      const nom2 = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);
      const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
      const t1 = nom1 / denom;
      const t2 = nom2 / denom;
      if (denom === 0 && nom1 !== 0 || t1 <= 0 || t1 >= 1 || t2 < 0 || t2 > 1) {
        return null;
      } else if (nom1 === 0 && denom === 0) {
        for (let i = 0; i < 2; i++) {
          classifyPoint(i === 0 ? b0 : b1, a0, a1);
          if (classifyResult.loc == IntersectionLocationType.ORIGIN) {
            const point = i === 0 ? b0 : b1;
            return { x: point.x, y: point.y, t: classifyResult.t };
          } else if (classifyResult.loc == IntersectionLocationType.BETWEEN) {
            const x = +(x1 + classifyResult.t * (x2 - x1)).toPrecision(10);
            const y = +(y1 + classifyResult.t * (y2 - y1)).toPrecision(10);
            return { x, y, t: classifyResult.t };
          }
        }
        return null;
      } else {
        for (let i = 0; i < 2; i++) {
          classifyPoint(i === 0 ? b0 : b1, a0, a1);
          if (classifyResult.loc == IntersectionLocationType.ORIGIN) {
            const point = i === 0 ? b0 : b1;
            return { x: point.x, y: point.y, t: classifyResult.t };
          }
        }
        const x = +(x1 + t1 * (x2 - x1)).toPrecision(10);
        const y = +(y1 + t1 * (y2 - y1)).toPrecision(10);
        return { x, y, t: t1 };
      }
    }
    function classifyPoint(p, edgeStart, edgeEnd) {
      const ax = edgeEnd.x - edgeStart.x;
      const ay = edgeEnd.y - edgeStart.y;
      const bx = p.x - edgeStart.x;
      const by = p.y - edgeStart.y;
      const sa = ax * by - bx * ay;
      if (p.x === edgeStart.x && p.y === edgeStart.y) {
        classifyResult.loc = IntersectionLocationType.ORIGIN;
        classifyResult.t = 0;
        return;
      }
      if (p.x === edgeEnd.x && p.y === edgeEnd.y) {
        classifyResult.loc = IntersectionLocationType.DESTINATION;
        classifyResult.t = 1;
        return;
      }
      if (sa < -Number.EPSILON) {
        classifyResult.loc = IntersectionLocationType.LEFT;
        return;
      }
      if (sa > Number.EPSILON) {
        classifyResult.loc = IntersectionLocationType.RIGHT;
        return;
      }
      if (ax * bx < 0 || ay * by < 0) {
        classifyResult.loc = IntersectionLocationType.BEHIND;
        return;
      }
      if (Math.sqrt(ax * ax + ay * ay) < Math.sqrt(bx * bx + by * by)) {
        classifyResult.loc = IntersectionLocationType.BEYOND;
        return;
      }
      let t;
      if (ax !== 0) {
        t = bx / ax;
      } else {
        t = by / ay;
      }
      classifyResult.loc = IntersectionLocationType.BETWEEN;
      classifyResult.t = t;
    }
    function getIntersections(path1, path2) {
      const intersectionsRaw = [];
      const intersections = [];
      for (let index = 1; index < path1.length; index++) {
        const path1EdgeStart = path1[index - 1];
        const path1EdgeEnd = path1[index];
        for (let index2 = 1; index2 < path2.length; index2++) {
          const path2EdgeStart = path2[index2 - 1];
          const path2EdgeEnd = path2[index2];
          const intersection = findEdgeIntersection(path1EdgeStart, path1EdgeEnd, path2EdgeStart, path2EdgeEnd);
          if (intersection !== null && intersectionsRaw.find(
            (i) => i.t <= intersection.t + Number.EPSILON && i.t >= intersection.t - Number.EPSILON
          ) === void 0) {
            intersectionsRaw.push(intersection);
            intersections.push(new THREE.Vector2(intersection.x, intersection.y));
          }
        }
      }
      return intersections;
    }
    function getScanlineIntersections(scanline, boundingBox, paths) {
      const center = new THREE.Vector2();
      boundingBox.getCenter(center);
      const allIntersections = [];
      paths.forEach((path) => {
        if (path.boundingBox.containsPoint(center)) {
          const intersections = getIntersections(scanline, path.points);
          intersections.forEach((p) => {
            allIntersections.push({ identifier: path.identifier, isCW: path.isCW, point: p });
          });
        }
      });
      allIntersections.sort((i1, i2) => {
        return i1.point.x - i2.point.x;
      });
      return allIntersections;
    }
    function isHoleTo(simplePath, allPaths, scanlineMinX2, scanlineMaxX2, _fillRule) {
      if (_fillRule === null || _fillRule === void 0 || _fillRule === "") {
        _fillRule = "nonzero";
      }
      const centerBoundingBox = new THREE.Vector2();
      simplePath.boundingBox.getCenter(centerBoundingBox);
      const scanline = [new THREE.Vector2(scanlineMinX2, centerBoundingBox.y), new THREE.Vector2(scanlineMaxX2, centerBoundingBox.y)];
      const scanlineIntersections = getScanlineIntersections(scanline, simplePath.boundingBox, allPaths);
      scanlineIntersections.sort((i1, i2) => {
        return i1.point.x - i2.point.x;
      });
      const baseIntersections = [];
      const otherIntersections = [];
      scanlineIntersections.forEach((i2) => {
        if (i2.identifier === simplePath.identifier) {
          baseIntersections.push(i2);
        } else {
          otherIntersections.push(i2);
        }
      });
      const firstXOfPath = baseIntersections[0].point.x;
      const stack = [];
      let i = 0;
      while (i < otherIntersections.length && otherIntersections[i].point.x < firstXOfPath) {
        if (stack.length > 0 && stack[stack.length - 1] === otherIntersections[i].identifier) {
          stack.pop();
        } else {
          stack.push(otherIntersections[i].identifier);
        }
        i++;
      }
      stack.push(simplePath.identifier);
      if (_fillRule === "evenodd") {
        const isHole = stack.length % 2 === 0 ? true : false;
        const isHoleFor = stack[stack.length - 2];
        return { identifier: simplePath.identifier, isHole, for: isHoleFor };
      } else if (_fillRule === "nonzero") {
        let isHole = true;
        let isHoleFor = null;
        let lastCWValue = null;
        for (let i2 = 0; i2 < stack.length; i2++) {
          const identifier = stack[i2];
          if (isHole) {
            lastCWValue = allPaths[identifier].isCW;
            isHole = false;
            isHoleFor = identifier;
          } else if (lastCWValue !== allPaths[identifier].isCW) {
            lastCWValue = allPaths[identifier].isCW;
            isHole = true;
          }
        }
        return { identifier: simplePath.identifier, isHole, for: isHoleFor };
      } else {
        console.warn('fill-rule: "' + _fillRule + '" is currently not implemented.');
      }
    }
    let scanlineMinX = BIGNUMBER;
    let scanlineMaxX = -BIGNUMBER;
    let simplePaths = shapePath.subPaths.map((p) => {
      const points = p.getPoints();
      let maxY = -BIGNUMBER;
      let minY = BIGNUMBER;
      let maxX = -BIGNUMBER;
      let minX = BIGNUMBER;
      for (let i = 0; i < points.length; i++) {
        const p2 = points[i];
        if (p2.y > maxY) {
          maxY = p2.y;
        }
        if (p2.y < minY) {
          minY = p2.y;
        }
        if (p2.x > maxX) {
          maxX = p2.x;
        }
        if (p2.x < minX) {
          minX = p2.x;
        }
      }
      if (scanlineMaxX <= maxX) {
        scanlineMaxX = maxX + 1;
      }
      if (scanlineMinX >= minX) {
        scanlineMinX = minX - 1;
      }
      return {
        curves: p.curves,
        points,
        isCW: THREE.ShapeUtils.isClockWise(points),
        identifier: -1,
        boundingBox: new THREE.Box2(new THREE.Vector2(minX, minY), new THREE.Vector2(maxX, maxY))
      };
    });
    simplePaths = simplePaths.filter((sp) => sp.points.length > 1);
    for (let identifier = 0; identifier < simplePaths.length; identifier++) {
      simplePaths[identifier].identifier = identifier;
    }
    const isAHole = simplePaths.map(
      (p) => isHoleTo(
        p,
        simplePaths,
        scanlineMinX,
        scanlineMaxX,
        shapePath.userData ? shapePath.userData.style.fillRule : void 0
      )
    );
    const shapesToReturn = [];
    simplePaths.forEach((p) => {
      const amIAHole = isAHole[p.identifier];
      if (!amIAHole.isHole) {
        const shape = new THREE.Shape();
        shape.curves = p.curves;
        const holes = isAHole.filter((h) => h.isHole && h.for === p.identifier);
        holes.forEach((h) => {
          const hole = simplePaths[h.identifier];
          const path = new THREE.Path();
          path.curves = hole.curves;
          shape.holes.push(path);
        });
        shapesToReturn.push(shape);
      }
    });
    return shapesToReturn;
  }
  static getStrokeStyle(width, color, lineJoin, lineCap, miterLimit) {
    width = width !== void 0 ? width : 1;
    color = color !== void 0 ? color : "#000";
    lineJoin = lineJoin !== void 0 ? lineJoin : "miter";
    lineCap = lineCap !== void 0 ? lineCap : "butt";
    miterLimit = miterLimit !== void 0 ? miterLimit : 4;
    return {
      strokeColor: color,
      strokeWidth: width,
      strokeLineJoin: lineJoin,
      strokeLineCap: lineCap,
      strokeMiterLimit: miterLimit
    };
  }
  static pointsToStroke(points, style, arcDivisions, minDistance) {
    const vertices = [];
    const normals = [];
    const uvs = [];
    if (SVGLoader.pointsToStrokeWithBuffers(points, style, arcDivisions, minDistance, vertices, normals, uvs) === 0) {
      return null;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    return geometry;
  }
  static pointsToStrokeWithBuffers(points, style, arcDivisions, minDistance, vertices, normals, uvs, vertexOffset) {
    const tempV2_1 = new THREE.Vector2();
    const tempV2_2 = new THREE.Vector2();
    const tempV2_3 = new THREE.Vector2();
    const tempV2_4 = new THREE.Vector2();
    const tempV2_5 = new THREE.Vector2();
    const tempV2_6 = new THREE.Vector2();
    const tempV2_7 = new THREE.Vector2();
    const lastPointL = new THREE.Vector2();
    const lastPointR = new THREE.Vector2();
    const point0L = new THREE.Vector2();
    const point0R = new THREE.Vector2();
    const currentPointL = new THREE.Vector2();
    const currentPointR = new THREE.Vector2();
    const nextPointL = new THREE.Vector2();
    const nextPointR = new THREE.Vector2();
    const innerPoint = new THREE.Vector2();
    const outerPoint = new THREE.Vector2();
    arcDivisions = arcDivisions !== void 0 ? arcDivisions : 12;
    minDistance = minDistance !== void 0 ? minDistance : 1e-3;
    vertexOffset = vertexOffset !== void 0 ? vertexOffset : 0;
    points = removeDuplicatedPoints(points);
    const numPoints = points.length;
    if (numPoints < 2)
      return 0;
    const isClosed = points[0].equals(points[numPoints - 1]);
    let currentPoint;
    let previousPoint = points[0];
    let nextPoint;
    const strokeWidth2 = style.strokeWidth / 2;
    const deltaU = 1 / (numPoints - 1);
    let u0 = 0, u1;
    let innerSideModified;
    let joinIsOnLeftSide;
    let isMiter;
    let initialJoinIsOnLeftSide = false;
    let numVertices = 0;
    let currentCoordinate = vertexOffset * 3;
    let currentCoordinateUV = vertexOffset * 2;
    getNormal(points[0], points[1], tempV2_1).multiplyScalar(strokeWidth2);
    lastPointL.copy(points[0]).sub(tempV2_1);
    lastPointR.copy(points[0]).add(tempV2_1);
    point0L.copy(lastPointL);
    point0R.copy(lastPointR);
    for (let iPoint = 1; iPoint < numPoints; iPoint++) {
      currentPoint = points[iPoint];
      if (iPoint === numPoints - 1) {
        if (isClosed) {
          nextPoint = points[1];
        } else
          nextPoint = void 0;
      } else {
        nextPoint = points[iPoint + 1];
      }
      const normal1 = tempV2_1;
      getNormal(previousPoint, currentPoint, normal1);
      tempV2_3.copy(normal1).multiplyScalar(strokeWidth2);
      currentPointL.copy(currentPoint).sub(tempV2_3);
      currentPointR.copy(currentPoint).add(tempV2_3);
      u1 = u0 + deltaU;
      innerSideModified = false;
      if (nextPoint !== void 0) {
        getNormal(currentPoint, nextPoint, tempV2_2);
        tempV2_3.copy(tempV2_2).multiplyScalar(strokeWidth2);
        nextPointL.copy(currentPoint).sub(tempV2_3);
        nextPointR.copy(currentPoint).add(tempV2_3);
        joinIsOnLeftSide = true;
        tempV2_3.subVectors(nextPoint, previousPoint);
        if (normal1.dot(tempV2_3) < 0) {
          joinIsOnLeftSide = false;
        }
        if (iPoint === 1)
          initialJoinIsOnLeftSide = joinIsOnLeftSide;
        tempV2_3.subVectors(nextPoint, currentPoint);
        tempV2_3.normalize();
        const dot = Math.abs(normal1.dot(tempV2_3));
        if (dot > Number.EPSILON) {
          const miterSide = strokeWidth2 / dot;
          tempV2_3.multiplyScalar(-miterSide);
          tempV2_4.subVectors(currentPoint, previousPoint);
          tempV2_5.copy(tempV2_4).setLength(miterSide).add(tempV2_3);
          innerPoint.copy(tempV2_5).negate();
          const miterLength2 = tempV2_5.length();
          const segmentLengthPrev = tempV2_4.length();
          tempV2_4.divideScalar(segmentLengthPrev);
          tempV2_6.subVectors(nextPoint, currentPoint);
          const segmentLengthNext = tempV2_6.length();
          tempV2_6.divideScalar(segmentLengthNext);
          if (tempV2_4.dot(innerPoint) < segmentLengthPrev && tempV2_6.dot(innerPoint) < segmentLengthNext) {
            innerSideModified = true;
          }
          outerPoint.copy(tempV2_5).add(currentPoint);
          innerPoint.add(currentPoint);
          isMiter = false;
          if (innerSideModified) {
            if (joinIsOnLeftSide) {
              nextPointR.copy(innerPoint);
              currentPointR.copy(innerPoint);
            } else {
              nextPointL.copy(innerPoint);
              currentPointL.copy(innerPoint);
            }
          } else {
            makeSegmentTriangles();
          }
          switch (style.strokeLineJoin) {
            case "bevel":
              makeSegmentWithBevelJoin(joinIsOnLeftSide, innerSideModified, u1);
              break;
            case "round":
              createSegmentTrianglesWithMiddleSection(joinIsOnLeftSide, innerSideModified);
              if (joinIsOnLeftSide) {
                makeCircularSector(currentPoint, currentPointL, nextPointL, u1, 0);
              } else {
                makeCircularSector(currentPoint, nextPointR, currentPointR, u1, 1);
              }
              break;
            case "miter":
            case "miter-clip":
            default:
              const miterFraction = strokeWidth2 * style.strokeMiterLimit / miterLength2;
              if (miterFraction < 1) {
                if (style.strokeLineJoin !== "miter-clip") {
                  makeSegmentWithBevelJoin(joinIsOnLeftSide, innerSideModified, u1);
                  break;
                } else {
                  createSegmentTrianglesWithMiddleSection(joinIsOnLeftSide, innerSideModified);
                  if (joinIsOnLeftSide) {
                    tempV2_6.subVectors(outerPoint, currentPointL).multiplyScalar(miterFraction).add(currentPointL);
                    tempV2_7.subVectors(outerPoint, nextPointL).multiplyScalar(miterFraction).add(nextPointL);
                    addVertex(currentPointL, u1, 0);
                    addVertex(tempV2_6, u1, 0);
                    addVertex(currentPoint, u1, 0.5);
                    addVertex(currentPoint, u1, 0.5);
                    addVertex(tempV2_6, u1, 0);
                    addVertex(tempV2_7, u1, 0);
                    addVertex(currentPoint, u1, 0.5);
                    addVertex(tempV2_7, u1, 0);
                    addVertex(nextPointL, u1, 0);
                  } else {
                    tempV2_6.subVectors(outerPoint, currentPointR).multiplyScalar(miterFraction).add(currentPointR);
                    tempV2_7.subVectors(outerPoint, nextPointR).multiplyScalar(miterFraction).add(nextPointR);
                    addVertex(currentPointR, u1, 1);
                    addVertex(tempV2_6, u1, 1);
                    addVertex(currentPoint, u1, 0.5);
                    addVertex(currentPoint, u1, 0.5);
                    addVertex(tempV2_6, u1, 1);
                    addVertex(tempV2_7, u1, 1);
                    addVertex(currentPoint, u1, 0.5);
                    addVertex(tempV2_7, u1, 1);
                    addVertex(nextPointR, u1, 1);
                  }
                }
              } else {
                if (innerSideModified) {
                  if (joinIsOnLeftSide) {
                    addVertex(lastPointR, u0, 1);
                    addVertex(lastPointL, u0, 0);
                    addVertex(outerPoint, u1, 0);
                    addVertex(lastPointR, u0, 1);
                    addVertex(outerPoint, u1, 0);
                    addVertex(innerPoint, u1, 1);
                  } else {
                    addVertex(lastPointR, u0, 1);
                    addVertex(lastPointL, u0, 0);
                    addVertex(outerPoint, u1, 1);
                    addVertex(lastPointL, u0, 0);
                    addVertex(innerPoint, u1, 0);
                    addVertex(outerPoint, u1, 1);
                  }
                  if (joinIsOnLeftSide) {
                    nextPointL.copy(outerPoint);
                  } else {
                    nextPointR.copy(outerPoint);
                  }
                } else {
                  if (joinIsOnLeftSide) {
                    addVertex(currentPointL, u1, 0);
                    addVertex(outerPoint, u1, 0);
                    addVertex(currentPoint, u1, 0.5);
                    addVertex(currentPoint, u1, 0.5);
                    addVertex(outerPoint, u1, 0);
                    addVertex(nextPointL, u1, 0);
                  } else {
                    addVertex(currentPointR, u1, 1);
                    addVertex(outerPoint, u1, 1);
                    addVertex(currentPoint, u1, 0.5);
                    addVertex(currentPoint, u1, 0.5);
                    addVertex(outerPoint, u1, 1);
                    addVertex(nextPointR, u1, 1);
                  }
                }
                isMiter = true;
              }
              break;
          }
        } else {
          makeSegmentTriangles();
        }
      } else {
        makeSegmentTriangles();
      }
      if (!isClosed && iPoint === numPoints - 1) {
        addCapGeometry(points[0], point0L, point0R, joinIsOnLeftSide, true, u0);
      }
      u0 = u1;
      previousPoint = currentPoint;
      lastPointL.copy(nextPointL);
      lastPointR.copy(nextPointR);
    }
    if (!isClosed) {
      addCapGeometry(currentPoint, currentPointL, currentPointR, joinIsOnLeftSide, false, u1);
    } else if (innerSideModified && vertices) {
      let lastOuter = outerPoint;
      let lastInner = innerPoint;
      if (initialJoinIsOnLeftSide !== joinIsOnLeftSide) {
        lastOuter = innerPoint;
        lastInner = outerPoint;
      }
      if (joinIsOnLeftSide) {
        if (isMiter || initialJoinIsOnLeftSide) {
          lastInner.toArray(vertices, 0 * 3);
          lastInner.toArray(vertices, 3 * 3);
          if (isMiter) {
            lastOuter.toArray(vertices, 1 * 3);
          }
        }
      } else {
        if (isMiter || !initialJoinIsOnLeftSide) {
          lastInner.toArray(vertices, 1 * 3);
          lastInner.toArray(vertices, 3 * 3);
          if (isMiter) {
            lastOuter.toArray(vertices, 0 * 3);
          }
        }
      }
    }
    return numVertices;
    function getNormal(p1, p2, result) {
      result.subVectors(p2, p1);
      return result.set(-result.y, result.x).normalize();
    }
    function addVertex(position, u, v) {
      if (vertices) {
        vertices[currentCoordinate] = position.x;
        vertices[currentCoordinate + 1] = position.y;
        vertices[currentCoordinate + 2] = 0;
        if (normals) {
          normals[currentCoordinate] = 0;
          normals[currentCoordinate + 1] = 0;
          normals[currentCoordinate + 2] = 1;
        }
        currentCoordinate += 3;
        if (uvs) {
          uvs[currentCoordinateUV] = u;
          uvs[currentCoordinateUV + 1] = v;
          currentCoordinateUV += 2;
        }
      }
      numVertices += 3;
    }
    function makeCircularSector(center, p1, p2, u, v) {
      tempV2_1.copy(p1).sub(center).normalize();
      tempV2_2.copy(p2).sub(center).normalize();
      let angle = Math.PI;
      const dot = tempV2_1.dot(tempV2_2);
      if (Math.abs(dot) < 1)
        angle = Math.abs(Math.acos(dot));
      angle /= arcDivisions;
      tempV2_3.copy(p1);
      for (let i = 0, il = arcDivisions - 1; i < il; i++) {
        tempV2_4.copy(tempV2_3).rotateAround(center, angle);
        addVertex(tempV2_3, u, v);
        addVertex(tempV2_4, u, v);
        addVertex(center, u, 0.5);
        tempV2_3.copy(tempV2_4);
      }
      addVertex(tempV2_4, u, v);
      addVertex(p2, u, v);
      addVertex(center, u, 0.5);
    }
    function makeSegmentTriangles() {
      addVertex(lastPointR, u0, 1);
      addVertex(lastPointL, u0, 0);
      addVertex(currentPointL, u1, 0);
      addVertex(lastPointR, u0, 1);
      addVertex(currentPointL, u1, 0);
      addVertex(currentPointR, u1, 1);
    }
    function makeSegmentWithBevelJoin(joinIsOnLeftSide2, innerSideModified2, u) {
      if (innerSideModified2) {
        if (joinIsOnLeftSide2) {
          addVertex(lastPointR, u0, 1);
          addVertex(lastPointL, u0, 0);
          addVertex(currentPointL, u1, 0);
          addVertex(lastPointR, u0, 1);
          addVertex(currentPointL, u1, 0);
          addVertex(innerPoint, u1, 1);
          addVertex(currentPointL, u, 0);
          addVertex(nextPointL, u, 0);
          addVertex(innerPoint, u, 0.5);
        } else {
          addVertex(lastPointR, u0, 1);
          addVertex(lastPointL, u0, 0);
          addVertex(currentPointR, u1, 1);
          addVertex(lastPointL, u0, 0);
          addVertex(innerPoint, u1, 0);
          addVertex(currentPointR, u1, 1);
          addVertex(currentPointR, u, 1);
          addVertex(innerPoint, u, 0);
          addVertex(nextPointR, u, 1);
        }
      } else {
        if (joinIsOnLeftSide2) {
          addVertex(currentPointL, u, 0);
          addVertex(nextPointL, u, 0);
          addVertex(currentPoint, u, 0.5);
        } else {
          addVertex(currentPointR, u, 1);
          addVertex(nextPointR, u, 0);
          addVertex(currentPoint, u, 0.5);
        }
      }
    }
    function createSegmentTrianglesWithMiddleSection(joinIsOnLeftSide2, innerSideModified2) {
      if (innerSideModified2) {
        if (joinIsOnLeftSide2) {
          addVertex(lastPointR, u0, 1);
          addVertex(lastPointL, u0, 0);
          addVertex(currentPointL, u1, 0);
          addVertex(lastPointR, u0, 1);
          addVertex(currentPointL, u1, 0);
          addVertex(innerPoint, u1, 1);
          addVertex(currentPointL, u0, 0);
          addVertex(currentPoint, u1, 0.5);
          addVertex(innerPoint, u1, 1);
          addVertex(currentPoint, u1, 0.5);
          addVertex(nextPointL, u0, 0);
          addVertex(innerPoint, u1, 1);
        } else {
          addVertex(lastPointR, u0, 1);
          addVertex(lastPointL, u0, 0);
          addVertex(currentPointR, u1, 1);
          addVertex(lastPointL, u0, 0);
          addVertex(innerPoint, u1, 0);
          addVertex(currentPointR, u1, 1);
          addVertex(currentPointR, u0, 1);
          addVertex(innerPoint, u1, 0);
          addVertex(currentPoint, u1, 0.5);
          addVertex(currentPoint, u1, 0.5);
          addVertex(innerPoint, u1, 0);
          addVertex(nextPointR, u0, 1);
        }
      }
    }
    function addCapGeometry(center, p1, p2, joinIsOnLeftSide2, start, u) {
      switch (style.strokeLineCap) {
        case "round":
          if (start) {
            makeCircularSector(center, p2, p1, u, 0.5);
          } else {
            makeCircularSector(center, p1, p2, u, 0.5);
          }
          break;
        case "square":
          if (start) {
            tempV2_1.subVectors(p1, center);
            tempV2_2.set(tempV2_1.y, -tempV2_1.x);
            tempV2_3.addVectors(tempV2_1, tempV2_2).add(center);
            tempV2_4.subVectors(tempV2_2, tempV2_1).add(center);
            if (joinIsOnLeftSide2) {
              tempV2_3.toArray(vertices, 1 * 3);
              tempV2_4.toArray(vertices, 0 * 3);
              tempV2_4.toArray(vertices, 3 * 3);
            } else {
              tempV2_3.toArray(vertices, 1 * 3);
              uvs[3 * 2 + 1] === 1 ? tempV2_4.toArray(vertices, 3 * 3) : tempV2_3.toArray(vertices, 3 * 3);
              tempV2_4.toArray(vertices, 0 * 3);
            }
          } else {
            tempV2_1.subVectors(p2, center);
            tempV2_2.set(tempV2_1.y, -tempV2_1.x);
            tempV2_3.addVectors(tempV2_1, tempV2_2).add(center);
            tempV2_4.subVectors(tempV2_2, tempV2_1).add(center);
            const vl = vertices.length;
            if (joinIsOnLeftSide2) {
              tempV2_3.toArray(vertices, vl - 1 * 3);
              tempV2_4.toArray(vertices, vl - 2 * 3);
              tempV2_4.toArray(vertices, vl - 4 * 3);
            } else {
              tempV2_4.toArray(vertices, vl - 2 * 3);
              tempV2_3.toArray(vertices, vl - 1 * 3);
              tempV2_4.toArray(vertices, vl - 4 * 3);
            }
          }
          break;
      }
    }
    function removeDuplicatedPoints(points2) {
      let dupPoints = false;
      for (let i = 1, n = points2.length - 1; i < n; i++) {
        if (points2[i].distanceTo(points2[i + 1]) < minDistance) {
          dupPoints = true;
          break;
        }
      }
      if (!dupPoints)
        return points2;
      const newPoints = [];
      newPoints.push(points2[0]);
      for (let i = 1, n = points2.length - 1; i < n; i++) {
        if (points2[i].distanceTo(points2[i + 1]) >= minDistance) {
          newPoints.push(points2[i]);
        }
      }
      newPoints.push(points2[points2.length - 1]);
      return newPoints;
    }
  }
}
exports.SVGLoader = SVGLoader;
//# sourceMappingURL=SVGLoader.cjs.map
