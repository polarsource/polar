import * as React from 'react';
import { useState, useContext, useRef, useLayoutEffect, createContext } from 'react';
import { useFrame } from '@react-three/fiber';

const context = /* @__PURE__ */createContext(null);
function PerformanceMonitor({
  iterations = 10,
  ms = 250,
  threshold = 0.75,
  step = 0.1,
  factor: _factor = 0.5,
  flipflops = Infinity,
  bounds = refreshrate => refreshrate > 100 ? [60, 100] : [40, 60],
  onIncline,
  onDecline,
  onChange,
  onFallback,
  children
}) {
  const decimalPlacesRatio = Math.pow(10, 0);
  const [api, _] = useState(() => ({
    fps: 0,
    index: 0,
    factor: _factor,
    flipped: 0,
    refreshrate: 0,
    fallback: false,
    frames: [],
    averages: [],
    subscriptions: new Map(),
    subscribe: ref => {
      const key = Symbol();
      api.subscriptions.set(key, ref.current);
      return () => void api.subscriptions.delete(key);
    }
  }));
  let lastFactor = 0;
  useFrame(() => {
    const {
      frames,
      averages
    } = api;

    // If the fallback has been reached do not continue running samples
    if (api.fallback) return;
    if (averages.length < iterations) {
      frames.push(performance.now());
      const msPassed = frames[frames.length - 1] - frames[0];
      if (msPassed >= ms) {
        api.fps = Math.round(frames.length / msPassed * 1000 * decimalPlacesRatio) / decimalPlacesRatio;
        api.refreshrate = Math.max(api.refreshrate, api.fps);
        averages[api.index++ % iterations] = api.fps;
        if (averages.length === iterations) {
          const [lower, upper] = bounds(api.refreshrate);
          const upperBounds = averages.filter(value => value >= upper);
          const lowerBounds = averages.filter(value => value < lower);
          // Trigger incline when more than -threshold- avgs exceed the upper bound
          if (upperBounds.length > iterations * threshold) {
            api.factor = Math.min(1, api.factor + step);
            api.flipped++;
            if (onIncline) onIncline(api);
            api.subscriptions.forEach(value => value.onIncline && value.onIncline(api));
          }
          // Trigger decline when more than -threshold- avgs are below the lower bound
          if (lowerBounds.length > iterations * threshold) {
            api.factor = Math.max(0, api.factor - step);
            api.flipped++;
            if (onDecline) onDecline(api);
            api.subscriptions.forEach(value => value.onDecline && value.onDecline(api));
          }
          if (lastFactor !== api.factor) {
            lastFactor = api.factor;
            if (onChange) onChange(api);
            api.subscriptions.forEach(value => value.onChange && value.onChange(api));
          }
          if (api.flipped > flipflops && !api.fallback) {
            api.fallback = true;
            if (onFallback) onFallback(api);
            api.subscriptions.forEach(value => value.onFallback && value.onFallback(api));
          }
          api.averages = [];

          // Resetting the refreshrate creates more problems than it solves atm
          // api.refreshrate = 0
        }

        api.frames = [];
      }
    }
  });
  return /*#__PURE__*/React.createElement(context.Provider, {
    value: api
  }, children);
}
function usePerformanceMonitor({
  onIncline,
  onDecline,
  onChange,
  onFallback
}) {
  const api = useContext(context);
  const ref = useRef({
    onIncline,
    onDecline,
    onChange,
    onFallback
  });
  useLayoutEffect(() => {
    ref.current.onIncline = onIncline;
    ref.current.onDecline = onDecline;
    ref.current.onChange = onChange;
    ref.current.onFallback = onFallback;
  }, [onIncline, onDecline, onChange, onFallback]);
  useLayoutEffect(() => api.subscribe(ref), [api]);
}

export { PerformanceMonitor, usePerformanceMonitor };
