import { useThree } from '@react-three/fiber';

function useAspect(width, height, factor = 1) {
  const v = useThree(state => state.viewport);
  const adaptedHeight = height * (v.aspect > width / height ? v.width / width : v.height / height);
  const adaptedWidth = width * (v.aspect > width / height ? v.width / width : v.height / height);
  return [adaptedWidth * factor, adaptedHeight * factor, 1];
}

export { useAspect };
