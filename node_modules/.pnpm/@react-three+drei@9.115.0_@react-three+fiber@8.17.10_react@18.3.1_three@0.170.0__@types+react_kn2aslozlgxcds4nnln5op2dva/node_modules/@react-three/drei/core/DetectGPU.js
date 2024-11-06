import * as React from 'react';
import { getGPUTier } from 'detect-gpu';
import { suspend } from 'suspend-react';

const useDetectGPU = props => suspend(() => getGPUTier(props), ['useDetectGPU']);
function DetectGPU({
  children,
  ...options
}) {
  const result = useDetectGPU(options);
  return /*#__PURE__*/React.createElement(React.Fragment, null, children == null ? void 0 : children(result));
}

export { DetectGPU, useDetectGPU };
