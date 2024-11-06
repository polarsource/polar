import * as THREE from 'three';
import * as React from 'react';
import { applyProps } from '@react-three/fiber';

// credits for the box-projecting shader code go to codercat (https://codercat.tk)
// and @0beqz https://gist.github.com/0beqz/8d51b4ae16d68021a09fb504af708fca

const worldposReplace = /* glsl */`
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )
  vec4 worldPosition = modelMatrix * vec4( transformed, 1.0 );
  #ifdef BOX_PROJECTED_ENV_MAP
    vWorldPosition = worldPosition.xyz;
  #endif
#endif
`;
const boxProjectDefinitions = /*glsl */`
#ifdef BOX_PROJECTED_ENV_MAP
  uniform vec3 envMapSize;
  uniform vec3 envMapPosition;
  varying vec3 vWorldPosition;
    
  vec3 parallaxCorrectNormal( vec3 v, vec3 cubeSize, vec3 cubePos ) {
    vec3 nDir = normalize( v );
    vec3 rbmax = ( .5 * cubeSize + cubePos - vWorldPosition ) / nDir;
    vec3 rbmin = ( -.5 * cubeSize + cubePos - vWorldPosition ) / nDir;
    vec3 rbminmax;
    rbminmax.x = ( nDir.x > 0. ) ? rbmax.x : rbmin.x;
    rbminmax.y = ( nDir.y > 0. ) ? rbmax.y : rbmin.y;
    rbminmax.z = ( nDir.z > 0. ) ? rbmax.z : rbmin.z;
    float correction = min( min( rbminmax.x, rbminmax.y ), rbminmax.z );
    vec3 boxIntersection = vWorldPosition + nDir * correction;    
    return boxIntersection - cubePos;
  }
#endif
`;

// will be inserted after "vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );"
const getIBLIrradiance_patch = /* glsl */`
#ifdef BOX_PROJECTED_ENV_MAP
  worldNormal = parallaxCorrectNormal( worldNormal, envMapSize, envMapPosition );
#endif
`;

// will be inserted after "reflectVec = inverseTransformDirection( reflectVec, viewMatrix );"
const getIBLRadiance_patch = /* glsl */`
#ifdef BOX_PROJECTED_ENV_MAP
  reflectVec = parallaxCorrectNormal( reflectVec, envMapSize, envMapPosition );
#endif
`;

// FIXME Replace with `THREE.WebGLProgramParametersWithUniforms` type when able to target @types/three@0.160.0

function boxProjectedEnvMap(shader, envMapPosition, envMapSize) {
  // defines
  shader.defines.BOX_PROJECTED_ENV_MAP = true;
  // uniforms
  shader.uniforms.envMapPosition = {
    value: envMapPosition
  };
  shader.uniforms.envMapSize = {
    value: envMapSize
  };
  // vertex shader
  shader.vertexShader = `
  varying vec3 vWorldPosition;
  ${shader.vertexShader.replace('#include <worldpos_vertex>', worldposReplace)}`;
  // fragment shader
  shader.fragmentShader = `
    ${boxProjectDefinitions}
    ${shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>', THREE.ShaderChunk.envmap_physical_pars_fragment).replace('vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );', `vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
         ${getIBLIrradiance_patch}
         `).replace('reflectVec = inverseTransformDirection( reflectVec, viewMatrix );', `reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
         ${getIBLRadiance_patch}
        `)}`;
}
function useBoxProjectedEnv(position = new THREE.Vector3(), size = new THREE.Vector3()) {
  const [config] = React.useState(() => ({
    position: new THREE.Vector3(),
    size: new THREE.Vector3()
  }));
  applyProps(config, {
    position,
    size
  });
  const ref = React.useRef(null);
  const spread = React.useMemo(() => ({
    ref,
    onBeforeCompile: shader => boxProjectedEnvMap(shader, config.position, config.size),
    customProgramCacheKey: () => JSON.stringify(config.position.toArray()) + JSON.stringify(config.size.toArray())
  }), [...config.position.toArray(), ...config.size.toArray()]);
  React.useLayoutEffect(() => void (ref.current.needsUpdate = true), [config]);
  return spread;
}

export { useBoxProjectedEnv };
