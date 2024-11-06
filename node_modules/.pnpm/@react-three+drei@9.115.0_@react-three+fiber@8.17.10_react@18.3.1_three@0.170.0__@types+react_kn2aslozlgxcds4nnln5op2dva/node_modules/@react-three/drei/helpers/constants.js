import { REVISION } from 'three';

const getVersion = () => parseInt(REVISION.replace(/\D+/g, ''));
const version = /* @__PURE__ */getVersion();

export { version };
