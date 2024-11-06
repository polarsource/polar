import * as React from 'react';
import { addEffect, addAfterEffect } from '@react-three/fiber';
import StatsImpl from 'stats.js';
import { useEffectfulState } from '../helpers/useEffectfulState.js';

function Stats({
  showPanel = 0,
  className,
  parent
}) {
  const stats = useEffectfulState(() => new StatsImpl(), []);
  React.useEffect(() => {
    if (stats) {
      const node = parent && parent.current || document.body;
      stats.showPanel(showPanel);
      node == null || node.appendChild(stats.dom);
      const classNames = (className !== null && className !== void 0 ? className : '').split(' ').filter(cls => cls);
      if (classNames.length) stats.dom.classList.add(...classNames);
      const begin = addEffect(() => stats.begin());
      const end = addAfterEffect(() => stats.end());
      return () => {
        if (classNames.length) stats.dom.classList.remove(...classNames);
        node == null || node.removeChild(stats.dom);
        begin();
        end();
      };
    }
  }, [parent, stats, className, showPanel]);
  return null;
}

export { Stats };
