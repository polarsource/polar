import * as React from 'react';
import { useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Texture } from 'three';

// smooth new sample (measurement) based on previous sample (current)
function smoothAverage(current, measurement, smoothing = 0.9) {
  return measurement * smoothing + current * (1.0 - smoothing);
}

// default ease
const easeCircleOut = x => Math.sqrt(1 - Math.pow(x - 1, 2));
class TrailTextureImpl {
  constructor({
    size = 256,
    maxAge = 750,
    radius = 0.3,
    intensity = 0.2,
    interpolate = 0,
    smoothing = 0,
    minForce = 0.3,
    blend = 'screen',
    // source-over is canvas default. Others are slower
    ease = easeCircleOut
  } = {}) {
    this.size = size;
    this.maxAge = maxAge;
    this.radius = radius;
    this.intensity = intensity;
    this.ease = ease;
    this.interpolate = interpolate;
    this.smoothing = smoothing;
    this.minForce = minForce;
    this.blend = blend;
    this.trail = [];
    this.force = 0;
    this.initTexture();
  }
  initTexture() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.size;
    const ctx = this.canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('2D not available');
    }
    this.ctx = ctx;
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.texture = new Texture(this.canvas);
    this.canvas.id = 'touchTexture';
    this.canvas.style.width = this.canvas.style.height = `${this.canvas.width}px`;
  }
  update(delta) {
    this.clear();

    // age points
    this.trail.forEach((point, i) => {
      point.age += delta * 1000;
      // remove old
      if (point.age > this.maxAge) {
        this.trail.splice(i, 1);
      }
    });

    // reset force when empty (when smoothing)
    if (!this.trail.length) this.force = 0;
    this.trail.forEach(point => {
      this.drawTouch(point);
    });
    this.texture.needsUpdate = true;
  }
  clear() {
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.fillStyle = 'black';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  addTouch(point) {
    const last = this.trail[this.trail.length - 1];
    if (last) {
      const dx = last.x - point.x;
      const dy = last.y - point.y;
      const dd = dx * dx + dy * dy;
      const force = Math.max(this.minForce, Math.min(dd * 10000, 1));
      this.force = smoothAverage(force, this.force, this.smoothing);
      if (!!this.interpolate) {
        const lines = Math.ceil(dd / Math.pow(this.radius * 0.5 / this.interpolate, 2));
        if (lines > 1) {
          for (let i = 1; i < lines; i++) {
            this.trail.push({
              x: last.x - dx / lines * i,
              y: last.y - dy / lines * i,
              age: 0,
              force
            });
          }
        }
      }
    }
    this.trail.push({
      x: point.x,
      y: point.y,
      age: 0,
      force: this.force
    });
  }
  drawTouch(point) {
    const pos = {
      x: point.x * this.size,
      y: (1 - point.y) * this.size
    };
    let intensity = 1;
    if (point.age < this.maxAge * 0.3) {
      intensity = this.ease(point.age / (this.maxAge * 0.3));
    } else {
      intensity = this.ease(1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7));
    }
    intensity *= point.force;

    // apply blending
    this.ctx.globalCompositeOperation = this.blend;
    const radius = this.size * this.radius * intensity;
    const grd = this.ctx.createRadialGradient(pos.x, pos.y, Math.max(0, radius * 0.25), pos.x, pos.y, Math.max(0, radius));
    grd.addColorStop(0, `rgba(255, 255, 255, ${this.intensity})`);
    grd.addColorStop(1, `rgba(0, 0, 0, 0.0)`);
    this.ctx.beginPath();
    this.ctx.fillStyle = grd;
    this.ctx.arc(pos.x, pos.y, Math.max(0, radius), 0, Math.PI * 2);
    this.ctx.fill();
  }
}
function useTrailTexture(config = {}) {
  const {
    size,
    maxAge,
    radius,
    intensity,
    interpolate,
    smoothing,
    minForce,
    blend,
    ease
  } = config;
  const trail = useMemo(() => new TrailTextureImpl(config), [size, maxAge, radius, intensity, interpolate, smoothing, minForce, blend, ease]);
  useFrame((_, delta) => void trail.update(delta));
  const onMove = useCallback(e => trail.addTouch(e.uv), [trail]);
  return [trail.texture, onMove];
}

//

const TrailTexture = ({
  children,
  ...config
}) => {
  const ret = useTrailTexture(config);
  return /*#__PURE__*/React.createElement(React.Fragment, null, children == null ? void 0 : children(ret));
};

export { TrailTexture, useTrailTexture };
