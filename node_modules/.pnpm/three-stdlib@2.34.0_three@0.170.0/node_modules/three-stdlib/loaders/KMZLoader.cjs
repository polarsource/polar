"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
const ColladaLoader = require("./ColladaLoader.cjs");
const fflate$1 = require("fflate");
class KMZLoader extends THREE.Loader {
  constructor(manager) {
    super(manager);
  }
  load(url, onLoad, onProgress, onError) {
    const scope = this;
    const loader = new THREE.FileLoader(scope.manager);
    loader.setPath(scope.path);
    loader.setResponseType("arraybuffer");
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
    function findFile(url) {
      for (const path in zip) {
        if (path.substr(-url.length) === url) {
          return zip[path];
        }
      }
    }
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(function(url) {
      const image = findFile(url);
      if (image) {
        console.log("Loading", url);
        const blob = new Blob([image.buffer], { type: "application/octet-stream" });
        return URL.createObjectURL(blob);
      }
      return url;
    });
    const zip = fflate$1.unzipSync(new Uint8Array(data));
    if (zip["doc.kml"]) {
      const xml = new DOMParser().parseFromString(fflate.strFromU8(zip["doc.kml"]), "application/xml");
      const model = xml.querySelector("Placemark Model Link href");
      if (model) {
        const loader = new ColladaLoader.ColladaLoader(manager);
        return loader.parse(fflate.strFromU8(zip[model.textContent]));
      }
    } else {
      console.warn("KMZLoader: Missing doc.kml file.");
      for (const path in zip) {
        const extension = path.split(".").pop().toLowerCase();
        if (extension === "dae") {
          const loader = new ColladaLoader.ColladaLoader(manager);
          return loader.parse(fflate.strFromU8(zip[path]));
        }
      }
    }
    console.error("KMZLoader: Couldn't find .dae file.");
    return { scene: new THREE.Group() };
  }
}
exports.KMZLoader = KMZLoader;
//# sourceMappingURL=KMZLoader.cjs.map
