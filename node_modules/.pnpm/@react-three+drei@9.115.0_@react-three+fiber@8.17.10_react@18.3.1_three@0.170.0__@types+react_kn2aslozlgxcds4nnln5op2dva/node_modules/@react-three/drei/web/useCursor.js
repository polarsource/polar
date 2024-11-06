import * as React from 'react';

function useCursor(hovered, onPointerOver = 'pointer', onPointerOut = 'auto', container = document.body) {
  React.useEffect(() => {
    if (hovered) {
      container.style.cursor = onPointerOver;
      return () => void (container.style.cursor = onPointerOut);
    }
  }, [hovered]);
}

export { useCursor };
