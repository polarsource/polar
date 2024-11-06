import * as React from 'react';
import { useThree } from '@react-three/fiber';

function AdaptiveEvents() {
  const get = useThree(state => state.get);
  const setEvents = useThree(state => state.setEvents);
  const current = useThree(state => state.performance.current);
  React.useEffect(() => {
    const enabled = get().events.enabled;
    return () => setEvents({
      enabled
    });
  }, []);
  React.useEffect(() => setEvents({
    enabled: current === 1
  }), [current]);
  return null;
}

export { AdaptiveEvents };
