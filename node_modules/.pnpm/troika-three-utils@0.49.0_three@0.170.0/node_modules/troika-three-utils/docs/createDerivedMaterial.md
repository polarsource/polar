# Three.js Derived Materials

**How to use Troika's `createDerivedMaterial` utility to extend existing Three.js materials with custom shader code**

_[Source code with JSDoc](https://github.com/protectwise/troika/blob/master/packages/troika-three-utils/src/DerivedMaterial.js)_

One of the most powerful things about Three.js is its excellent set of built-in materials. They provide many features like physically-based reflectivity, shadows, texture maps, fog, and so on, building the very complex shaders behind the scenes.

But sometimes you need to do something custom in the shaders, such as move around the vertices, or change the colors or transparency of certain pixels. You could use a [ShaderMaterial](https://threejs.org/docs/#api/en/materials/ShaderMaterial) but then you lose all the built-in features. The experimental [NodeMaterial](https://www.donmccurdy.com/2019/03/17/three-nodematerial-introduction/) seems promising but doesn't appear to be ready as a full replacement.

The [onBeforeCompile](https://threejs.org/docs/#api/en/materials/Material.onBeforeCompile) hook lets you intercept the shader code and modify it, but in practice there are quirks to this that make it difficult to work with, not to mention the complexity of forming regular expressions to inject your custom shader code in the right places.

Troika's `createDerivedMaterial(baseMaterial, options)` utility handles all that complexity, letting you "extend" a built-in Material's shaders via a declarative interface. The resulting material can be prototype-chained to the base material so it picks up changes to its properties. It has methods for generating depth and distance materials so your shader modifications can be reflected in shadow maps. 

Lastly, you can create a derived material from _another derived material_, and so on. This enables composable patterns where you can piece in small bits of shader logic one at a time.

Here's a simple example that injects an auto-incrementing `elapsed` uniform holding the current time, and uses that to transform the vertices in a wave pattern.

```js
import { createDerivedMaterial} from 'troika-three-utils'
import { Mesh, MeshStandardMaterial, PlaneGeometry } from 'three'

const baseMaterial = new MeshStandardMaterial({color: 0xffcc00})
const customMaterial = createDerivedMaterial(
  baseMaterial,
  {
    timeUniform: 'elapsed',
    // Add GLSL to tweak the vertex... notice this modifies the `position`
    // and `normal` attributes, which is normally not possible!
    vertexTransform: `
      float waveAmplitude = 0.1;
      float waveX = uv.x * PI * 4.0 - mod(elapsed / 300.0, PI2);
      float waveZ = sin(waveX) * waveAmplitude;
      normal.xyz = normalize(vec3(-cos(waveX) * waveAmplitude, 0.0, 1.0));
      position.z += waveZ;
    `
  }
)
const mesh = new Mesh(
  new PlaneGeometry(1, 1, 64, 1),
  customMaterial
)

// to enable directional light shadows:
mesh.castShadow = true
mesh.customDepthMaterial = customMaterial.getDepthMaterial()
```

You can also declare custom `uniforms` and `defines`, inject fragment shader code to modify the output color, etc. See the JSDoc in the [DerivedMaterial.js source code](https://github.com/protectwise/troika/blob/master/packages/troika-three-utils/src/DerivedMaterial.js) for full details.
