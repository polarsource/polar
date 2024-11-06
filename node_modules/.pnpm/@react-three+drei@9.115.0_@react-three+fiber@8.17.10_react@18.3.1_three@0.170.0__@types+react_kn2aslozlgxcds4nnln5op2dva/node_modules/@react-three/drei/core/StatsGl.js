import { useThree, addAfterEffect } from '@react-three/fiber';
import * as React from 'react';
import Stats from 'stats-gl';

const StatsGl = /* @__PURE__ */React.forwardRef(({
  className,
  parent,
  id,
  clearStatsGlStyle,
  ...props
}, fref) => {
  const gl = useThree(state => state.gl);
  const stats = React.useMemo(() => {
    const stats = new Stats({
      ...props
    });
    stats.init(gl);
    return stats;
  }, [gl]);
  React.useImperativeHandle(fref, () => stats.dom);
  React.useEffect(() => {
    if (stats) {
      const node = parent && parent.current || document.body;
      node == null || node.appendChild(stats.dom);
      stats.dom.querySelectorAll('canvas').forEach(canvas => {
        canvas.style.removeProperty('position');
      });
      if (id) stats.dom.id = id;
      if (clearStatsGlStyle) stats.dom.removeAttribute('style');
      stats.dom.removeAttribute('style');
      const classNames = (className !== null && className !== void 0 ? className : '').split(' ').filter(cls => cls);
      if (classNames.length) stats.dom.classList.add(...classNames);
      const end = addAfterEffect(() => stats.update());
      return () => {
        if (classNames.length) stats.dom.classList.remove(...classNames);
        node == null || node.removeChild(stats.dom);
        end();
      };
    }
  }, [parent, stats, className, id, clearStatsGlStyle]);
  return null;
});
StatsGl.displayName = 'StatsGl';

export { StatsGl };
