var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { Vector3, Quaternion, Matrix4 } from "three";
import { CharsetEncoder } from "../libs/mmdparser.js";
class MMDExporter {
  constructor() {
    // Unicode to Shift_JIS table
    __publicField(this, "u2sTable");
  }
  /* TODO: implement
  // mesh -> pmd
  this.parsePmd = function ( object ) {
  };
  */
  /* TODO: implement
  // mesh -> pmx
  this.parsePmx = function ( object ) {
  };
  */
  /* TODO: implement
  // animation + skeleton -> vmd
  this.parseVmd = function ( object ) {
  };
  */
  /*
   * skeleton -> vpd
   * Returns Shift_JIS encoded Uint8Array. Otherwise return strings.
   */
  parseVpd(skin, outputShiftJis, useOriginalBones) {
    if (skin.isSkinnedMesh !== true) {
      console.warn("THREE.MMDExporter: parseVpd() requires SkinnedMesh instance.");
      return null;
    }
    function toStringsFromNumber(num) {
      if (Math.abs(num) < 1e-6)
        num = 0;
      let a = num.toString();
      if (a.indexOf(".") === -1) {
        a += ".";
      }
      a += "000000";
      const index = a.indexOf(".");
      const d = a.slice(0, index);
      const p = a.slice(index + 1, index + 7);
      return d + "." + p;
    }
    function toStringsFromArray(array2) {
      const a = [];
      for (let i = 0, il = array2.length; i < il; i++) {
        a.push(toStringsFromNumber(array2[i]));
      }
      return a.join(",");
    }
    skin.updateMatrixWorld(true);
    const bones = skin.skeleton.bones;
    const bones2 = this.getBindBones(skin);
    const position = new Vector3();
    const quaternion = new Quaternion();
    const quaternion2 = new Quaternion();
    const matrix = new Matrix4();
    const array = [];
    array.push("Vocaloid Pose Data file");
    array.push("");
    array.push((skin.name !== "" ? skin.name.replace(/\s/g, "_") : "skin") + ".osm;");
    array.push(bones.length + ";");
    array.push("");
    for (let i = 0, il = bones.length; i < il; i++) {
      const bone = bones[i];
      const bone2 = bones2[i];
      if (useOriginalBones === true && bone.userData.ik !== void 0 && bone.userData.ik.originalMatrix !== void 0) {
        matrix.fromArray(bone.userData.ik.originalMatrix);
      } else {
        matrix.copy(bone.matrix);
      }
      position.setFromMatrixPosition(matrix);
      quaternion.setFromRotationMatrix(matrix);
      const pArray = position.sub(bone2.position).toArray();
      const qArray = quaternion2.copy(bone2.quaternion).conjugate().multiply(quaternion).toArray();
      pArray[2] = -pArray[2];
      qArray[0] = -qArray[0];
      qArray[1] = -qArray[1];
      array.push("Bone" + i + "{" + bone.name);
      array.push("  " + toStringsFromArray(pArray) + ";");
      array.push("  " + toStringsFromArray(qArray) + ";");
      array.push("}");
      array.push("");
    }
    array.push("");
    const lines = array.join("\n");
    return outputShiftJis === true ? this.unicodeToShiftjis(lines) : lines;
  }
  unicodeToShiftjis(str) {
    if (this.u2sTable === void 0) {
      const encoder = new CharsetEncoder();
      const table = encoder.s2uTable;
      this.u2sTable = {};
      const keys = Object.keys(table);
      for (let i = 0, il = keys.length; i < il; i++) {
        let key = keys[i];
        const value = table[key];
        this.u2sTable[value] = parseInt(key);
      }
    }
    const array = [];
    for (let i = 0, il = str.length; i < il; i++) {
      const code = str.charCodeAt(i);
      const value = this.u2sTable[code];
      if (value === void 0) {
        throw "cannot convert charcode 0x" + code.toString(16);
      } else if (value > 255) {
        array.push(value >> 8 & 255);
        array.push(value & 255);
      } else {
        array.push(value & 255);
      }
    }
    return new Uint8Array(array);
  }
  getBindBones(skin) {
    const poseSkin = skin.clone();
    poseSkin.pose();
    return poseSkin.skeleton.bones;
  }
}
export {
  MMDExporter
};
//# sourceMappingURL=MMDExporter.js.map
