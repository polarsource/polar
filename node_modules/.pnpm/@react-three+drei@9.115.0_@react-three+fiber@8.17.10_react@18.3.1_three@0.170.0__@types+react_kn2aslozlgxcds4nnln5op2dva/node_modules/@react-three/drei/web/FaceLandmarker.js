import * as React from 'react';
import { useEffect, useContext, createContext } from 'react';
import { suspend, clear } from 'suspend-react';

/* eslint react-hooks/exhaustive-deps: 1 */
const FaceLandmarkerContext = /* @__PURE__ */createContext({});
const FaceLandmarkerDefaults = {
  basePath: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm',
  options: {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU'
    },
    runningMode: 'VIDEO',
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true
  }
};
function FaceLandmarker({
  basePath = FaceLandmarkerDefaults.basePath,
  options = FaceLandmarkerDefaults.options,
  children
}) {
  const opts = JSON.stringify(options);
  const faceLandmarker = suspend(async () => {
    const {
      FilesetResolver,
      FaceLandmarker
    } = await import('@mediapipe/tasks-vision');
    const vision = await FilesetResolver.forVisionTasks(basePath);
    return FaceLandmarker.createFromOptions(vision, options);
  }, [basePath, opts]);
  useEffect(() => {
    return () => {
      faceLandmarker == null || faceLandmarker.close();
      clear([basePath, opts]);
    };
  }, [faceLandmarker, basePath, opts]);
  return /*#__PURE__*/React.createElement(FaceLandmarkerContext.Provider, {
    value: faceLandmarker
  }, children);
}
function useFaceLandmarker() {
  return useContext(FaceLandmarkerContext);
}

export { FaceLandmarker, FaceLandmarkerDefaults, useFaceLandmarker };
