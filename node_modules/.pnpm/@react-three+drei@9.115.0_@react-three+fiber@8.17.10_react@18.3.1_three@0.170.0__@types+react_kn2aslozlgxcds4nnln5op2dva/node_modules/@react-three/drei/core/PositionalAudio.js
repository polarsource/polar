import _extends from '@babel/runtime/helpers/esm/extends';
import * as React from 'react';
import { AudioListener, AudioLoader } from 'three';
import { useThree, useLoader } from '@react-three/fiber';

const PositionalAudio = /* @__PURE__ */React.forwardRef(({
  url,
  distance = 1,
  loop = true,
  autoplay,
  ...props
}, ref) => {
  const sound = React.useRef(null);
  React.useImperativeHandle(ref, () => sound.current, []);
  const camera = useThree(({
    camera
  }) => camera);
  const [listener] = React.useState(() => new AudioListener());
  const buffer = useLoader(AudioLoader, url);
  React.useEffect(() => {
    const _sound = sound.current;
    if (_sound) {
      _sound.setBuffer(buffer);
      _sound.setRefDistance(distance);
      _sound.setLoop(loop);
      if (autoplay && !_sound.isPlaying) _sound.play();
    }
  }, [buffer, camera, distance, loop]);
  React.useEffect(() => {
    const _sound = sound.current;
    camera.add(listener);
    return () => {
      camera.remove(listener);
      if (_sound) {
        if (_sound.isPlaying) _sound.stop();
        if (_sound.source && _sound.source._connected) _sound.disconnect();
      }
    };
  }, []);
  return /*#__PURE__*/React.createElement("positionalAudio", _extends({
    ref: sound,
    args: [listener]
  }, props));
});

export { PositionalAudio };
