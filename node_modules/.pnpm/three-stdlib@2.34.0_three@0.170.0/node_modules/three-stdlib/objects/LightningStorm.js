import { Object3D, MeshBasicMaterial, MathUtils, Mesh } from "three";
import { LightningStrike } from "../geometries/LightningStrike.js";
class LightningStorm extends Object3D {
  constructor(stormParams = {}) {
    super();
    this.isLightningStorm = true;
    this.stormParams = stormParams;
    stormParams.size = stormParams.size !== void 0 ? stormParams.size : 1e3;
    stormParams.minHeight = stormParams.minHeight !== void 0 ? stormParams.minHeight : 80;
    stormParams.maxHeight = stormParams.maxHeight !== void 0 ? stormParams.maxHeight : 100;
    stormParams.maxSlope = stormParams.maxSlope !== void 0 ? stormParams.maxSlope : 1.1;
    stormParams.maxLightnings = stormParams.maxLightnings !== void 0 ? stormParams.maxLightnings : 3;
    stormParams.lightningMinPeriod = stormParams.lightningMinPeriod !== void 0 ? stormParams.lightningMinPeriod : 3;
    stormParams.lightningMaxPeriod = stormParams.lightningMaxPeriod !== void 0 ? stormParams.lightningMaxPeriod : 7;
    stormParams.lightningMinDuration = stormParams.lightningMinDuration !== void 0 ? stormParams.lightningMinDuration : 1;
    stormParams.lightningMaxDuration = stormParams.lightningMaxDuration !== void 0 ? stormParams.lightningMaxDuration : 2.5;
    this.lightningParameters = LightningStrike.copyParameters(
      stormParams.lightningParameters,
      stormParams.lightningParameters
    );
    this.lightningParameters.isEternal = false;
    this.lightningMaterial = stormParams.lightningMaterial !== void 0 ? stormParams.lightningMaterial : new MeshBasicMaterial({ color: 11599871 });
    if (stormParams.onRayPosition !== void 0) {
      this.onRayPosition = stormParams.onRayPosition;
    } else {
      this.onRayPosition = function(source, dest) {
        dest.set((Math.random() - 0.5) * stormParams.size, 0, (Math.random() - 0.5) * stormParams.size);
        const height = MathUtils.lerp(stormParams.minHeight, stormParams.maxHeight, Math.random());
        source.set(stormParams.maxSlope * (2 * Math.random() - 1), 1, stormParams.maxSlope * (2 * Math.random() - 1)).multiplyScalar(height).add(dest);
      };
    }
    this.onLightningDown = stormParams.onLightningDown;
    this.inited = false;
    this.nextLightningTime = 0;
    this.lightningsMeshes = [];
    this.deadLightningsMeshes = [];
    for (let i = 0; i < this.stormParams.maxLightnings; i++) {
      const lightning = new LightningStrike(LightningStrike.copyParameters({}, this.lightningParameters));
      const mesh = new Mesh(lightning, this.lightningMaterial);
      this.deadLightningsMeshes.push(mesh);
    }
  }
  update(time) {
    if (!this.inited) {
      this.nextLightningTime = this.getNextLightningTime(time) * Math.random();
      this.inited = true;
    }
    if (time >= this.nextLightningTime) {
      const lightningMesh = this.deadLightningsMeshes.pop();
      if (lightningMesh) {
        const lightningParams1 = LightningStrike.copyParameters(
          lightningMesh.geometry.rayParameters,
          this.lightningParameters
        );
        lightningParams1.birthTime = time;
        lightningParams1.deathTime = time + MathUtils.lerp(this.stormParams.lightningMinDuration, this.stormParams.lightningMaxDuration, Math.random());
        this.onRayPosition(lightningParams1.sourceOffset, lightningParams1.destOffset);
        lightningParams1.noiseSeed = Math.random();
        this.add(lightningMesh);
        this.lightningsMeshes.push(lightningMesh);
      }
      this.nextLightningTime = this.getNextLightningTime(time);
    }
    let i = 0, il = this.lightningsMeshes.length;
    while (i < il) {
      const mesh = this.lightningsMeshes[i];
      const lightning = mesh.geometry;
      const prevState = lightning.state;
      lightning.update(time);
      if (prevState === LightningStrike.RAY_PROPAGATING && lightning.state > prevState) {
        if (this.onLightningDown) {
          this.onLightningDown(lightning);
        }
      }
      if (lightning.state === LightningStrike.RAY_EXTINGUISHED) {
        this.lightningsMeshes.splice(this.lightningsMeshes.indexOf(mesh), 1);
        this.deadLightningsMeshes.push(mesh);
        this.remove(mesh);
        il--;
      } else {
        i++;
      }
    }
  }
  getNextLightningTime(currentTime) {
    return currentTime + MathUtils.lerp(this.stormParams.lightningMinPeriod, this.stormParams.lightningMaxPeriod, Math.random()) / (this.stormParams.maxLightnings + 1);
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.stormParams.size = source.stormParams.size;
    this.stormParams.minHeight = source.stormParams.minHeight;
    this.stormParams.maxHeight = source.stormParams.maxHeight;
    this.stormParams.maxSlope = source.stormParams.maxSlope;
    this.stormParams.maxLightnings = source.stormParams.maxLightnings;
    this.stormParams.lightningMinPeriod = source.stormParams.lightningMinPeriod;
    this.stormParams.lightningMaxPeriod = source.stormParams.lightningMaxPeriod;
    this.stormParams.lightningMinDuration = source.stormParams.lightningMinDuration;
    this.stormParams.lightningMaxDuration = source.stormParams.lightningMaxDuration;
    this.lightningParameters = LightningStrike.copyParameters({}, source.lightningParameters);
    this.lightningMaterial = source.stormParams.lightningMaterial;
    this.onLightningDown = source.onLightningDown;
    return this;
  }
  clone() {
    return new this.constructor(this.stormParams).copy(this);
  }
}
export {
  LightningStorm
};
//# sourceMappingURL=LightningStorm.js.map
