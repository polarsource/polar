import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { Text as Text$1, preloadFont } from 'troika-three-text';
import { useThree } from '@react-three/fiber';
import { suspend } from 'suspend-react';

// eslint-disable-next-line prettier/prettier
const Text = /* @__PURE__ */React.forwardRef(({
  sdfGlyphSize = 64,
  anchorX = 'center',
  anchorY = 'middle',
  font,
  fontSize = 1,
  children,
  characters,
  onSync,
  ...props
}, ref) => {
  const invalidate = useThree(({
    invalidate
  }) => invalidate);
  const [troikaMesh] = React.useState(() => new Text$1());
  const [nodes, text] = React.useMemo(() => {
    const n = [];
    let t = '';
    React.Children.forEach(children, child => {
      if (typeof child === 'string' || typeof child === 'number') {
        t += child;
      } else {
        n.push(child);
      }
    });
    return [n, t];
  }, [children]);
  suspend(() => new Promise(res => preloadFont({
    font,
    characters
  }, res)), ['troika-text', font, characters]);
  React.useLayoutEffect(() => void troikaMesh.sync(() => {
    invalidate();
    if (onSync) onSync(troikaMesh);
  }));
  React.useEffect(() => {
    return () => troikaMesh.dispose();
  }, [troikaMesh]);
  return /*#__PURE__*/React.createElement("primitive", _extends({
    object: troikaMesh,
    ref: ref,
    font: font,
    text: text,
    anchorX: anchorX,
    anchorY: anchorY,
    fontSize: fontSize,
    sdfGlyphSize: sdfGlyphSize
  }, props), nodes);
});

export { Text };
