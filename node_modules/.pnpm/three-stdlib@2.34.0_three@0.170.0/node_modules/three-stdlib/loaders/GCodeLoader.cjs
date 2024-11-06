"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class GCodeLoader extends THREE.Loader {
  constructor(manager) {
    super(manager);
    this.splitLayer = false;
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
  parse(data) {
    let state = { x: 0, y: 0, z: 0, e: 0, f: 0, extruding: false, relative: false };
    let layers = [];
    let currentLayer = void 0;
    const pathMaterial = new THREE.LineBasicMaterial({ color: 16711680 });
    pathMaterial.name = "path";
    const extrudingMaterial = new THREE.LineBasicMaterial({ color: 65280 });
    extrudingMaterial.name = "extruded";
    function newLayer(line) {
      currentLayer = { vertex: [], pathVertex: [], z: line.z };
      layers.push(currentLayer);
    }
    function addSegment(p1, p2) {
      if (currentLayer === void 0) {
        newLayer(p1);
      }
      if (state.extruding) {
        currentLayer.vertex.push(p1.x, p1.y, p1.z);
        currentLayer.vertex.push(p2.x, p2.y, p2.z);
      } else {
        currentLayer.pathVertex.push(p1.x, p1.y, p1.z);
        currentLayer.pathVertex.push(p2.x, p2.y, p2.z);
      }
    }
    function delta(v1, v2) {
      return state.relative ? v2 : v2 - v1;
    }
    function absolute(v1, v2) {
      return state.relative ? v1 + v2 : v2;
    }
    let lines = data.replace(/;.+/g, "").split("\n");
    for (let i = 0; i < lines.length; i++) {
      let tokens = lines[i].split(" ");
      let cmd = tokens[0].toUpperCase();
      let args = {};
      tokens.splice(1).forEach(function(token) {
        if (token[0] !== void 0) {
          let key = token[0].toLowerCase();
          let value = parseFloat(token.substring(1));
          args[key] = value;
        }
      });
      if (cmd === "G0" || cmd === "G1") {
        let line = {
          x: args.x !== void 0 ? absolute(state.x, args.x) : state.x,
          y: args.y !== void 0 ? absolute(state.y, args.y) : state.y,
          z: args.z !== void 0 ? absolute(state.z, args.z) : state.z,
          e: args.e !== void 0 ? absolute(state.e, args.e) : state.e,
          f: args.f !== void 0 ? absolute(state.f, args.f) : state.f
        };
        if (delta(state.e, line.e) > 0) {
          line.extruding = delta(state.e, line.e) > 0;
          if (currentLayer == void 0 || line.z != currentLayer.z) {
            newLayer(line);
          }
        }
        addSegment(state, line);
        state = line;
      } else if (cmd === "G2" || cmd === "G3")
        ;
      else if (cmd === "G90") {
        state.relative = false;
      } else if (cmd === "G91") {
        state.relative = true;
      } else if (cmd === "G92") {
        let line = state;
        line.x = args.x !== void 0 ? args.x : line.x;
        line.y = args.y !== void 0 ? args.y : line.y;
        line.z = args.z !== void 0 ? args.z : line.z;
        line.e = args.e !== void 0 ? args.e : line.e;
        state = line;
      } else
        ;
    }
    function addObject(vertex, extruding, i) {
      let geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertex, 3));
      let segments = new THREE.LineSegments(geometry, extruding ? extrudingMaterial : pathMaterial);
      segments.name = "layer" + i;
      object.add(segments);
    }
    const object = new THREE.Group();
    object.name = "gcode";
    if (this.splitLayer) {
      for (let i = 0; i < layers.length; i++) {
        let layer = layers[i];
        addObject(layer.vertex, true, i);
        addObject(layer.pathVertex, false, i);
      }
    } else {
      const vertex = [], pathVertex = [];
      for (let i = 0; i < layers.length; i++) {
        let layer = layers[i];
        let layerVertex = layer.vertex;
        let layerPathVertex = layer.pathVertex;
        for (let j = 0; j < layerVertex.length; j++) {
          vertex.push(layerVertex[j]);
        }
        for (let j = 0; j < layerPathVertex.length; j++) {
          pathVertex.push(layerPathVertex[j]);
        }
      }
      addObject(vertex, true, layers.length);
      addObject(pathVertex, false, layers.length);
    }
    object.quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    return object;
  }
}
exports.GCodeLoader = GCodeLoader;
//# sourceMappingURL=GCodeLoader.cjs.map
