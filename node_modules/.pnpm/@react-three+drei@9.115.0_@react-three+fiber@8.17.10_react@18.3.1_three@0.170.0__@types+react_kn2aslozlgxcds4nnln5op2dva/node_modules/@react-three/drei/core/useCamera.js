import * as React from 'react';
import { Raycaster, Camera } from 'three';
import { useThree, applyProps } from '@react-three/fiber';

function useCamera(camera, props) {
  const pointer = useThree(state => state.pointer);
  const [raycast] = React.useState(() => {
    const raycaster = new Raycaster();
    /**
     * applyProps is an internal method of r3f and
     * therefore requires its first arg to be an
     * "Instance" a term used with the Reconciler
     * so we have an expect error to mask this
     */
    // @ts-expect-error
    if (props) applyProps(raycaster, props, {});
    return function (_, intersects) {
      raycaster.setFromCamera(pointer, camera instanceof Camera ? camera : camera.current);
      const rc = this.constructor.prototype.raycast.bind(this);
      if (rc) rc(raycaster, intersects);
    };
  });
  return raycast;
}

export { useCamera };
