import * as React from 'react';
import { useTexture } from './Texture.js';
import { RepeatWrapping, Vector2 } from 'three';
import { suspend } from 'suspend-react';

const NORMAL_ROOT = 'https://rawcdn.githack.com/pmndrs/drei-assets/7a3104997e1576f83472829815b00880d88b32fb';
const LIST_URL = 'https://cdn.jsdelivr.net/gh/pmndrs/drei-assets@master/normals/normals.json';
function useNormalTexture(id = 0, settings = {}, onLoad) {
  const {
    repeat = [1, 1],
    anisotropy = 1,
    offset = [0, 0]
  } = settings;
  const normalsList = suspend(() => fetch(LIST_URL).then(res => res.json()), ['normalsList']);
  const numTot = React.useMemo(() => Object.keys(normalsList).length, []);
  const DEFAULT_NORMAL = normalsList[0];
  const imageName = normalsList[id] || DEFAULT_NORMAL;
  const url = `${NORMAL_ROOT}/normals/${imageName}`;
  const normalTexture = useTexture(url, onLoad);
  React.useLayoutEffect(() => {
    if (!normalTexture) return;
    normalTexture.wrapS = normalTexture.wrapT = RepeatWrapping;
    normalTexture.repeat = new Vector2(repeat[0], repeat[1]);
    normalTexture.offset = new Vector2(offset[0], offset[1]);
    normalTexture.anisotropy = anisotropy;
  }, [normalTexture, anisotropy, repeat, offset]);
  return [normalTexture, url, numTot];
}

//

const NormalTexture = ({
  children,
  id,
  onLoad,
  ...settings
}) => {
  const ret = useNormalTexture(id, settings, onLoad);
  return /*#__PURE__*/React.createElement(React.Fragment, null, children == null ? void 0 : children(ret));
};

export { NormalTexture, useNormalTexture };
