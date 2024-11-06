[![logo](docs/logo.jpg)](https://codesandbox.io/s/bfplr)

[![Storybook](https://img.shields.io/static/v1?message=Storybook&style=flat&colorA=000000&colorB=000000&label=&logo=storybook&logoColor=ffffff)](https://drei.pmnd.rs/)
[![Version](https://img.shields.io/npm/v/@react-three/drei?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@react-three/drei)
[![Downloads](https://img.shields.io/npm/dt/@react-three/drei.svg?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/@react-three/drei)
[![Discord Shield](https://img.shields.io/discord/740090768164651008?style=flat&colorA=000000&colorB=000000&label=discord&logo=discord&logoColor=ffffff)](https://discord.com/channels/740090768164651008/741751532592038022)
[![Open in GitHub Codespaces](https://img.shields.io/static/v1?&message=Open%20in%20%20Codespaces&style=flat&colorA=000000&colorB=000000&label=GitHub&logo=github&logoColor=ffffff)](https://github.com/codespaces/new?template_repository=pmndrs%2Fdrei)

A growing collection of useful helpers and fully functional, ready-made abstractions for [@react-three/fiber](https://github.com/pmndrs/react-three-fiber).

If you make a component that is generic enough to be useful to others, think about [CONTRIBUTING](CONTRIBUTING.md)!

```bash
npm install @react-three/drei
```

> [!IMPORTANT]
> this package is using the stand-alone [`three-stdlib`](https://github.com/pmndrs/three-stdlib) instead of [`three/examples/jsm`](https://github.com/mrdoob/three.js/tree/master/examples/jsm).

## Basic usage

```jsx
import { PerspectiveCamera, PositionalAudio, ... } from '@react-three/drei'
```

## React-native

```jsx
import { PerspectiveCamera, PositionalAudio, ... } from '@react-three/drei/native'
```

The `native` route of the library **does not** export `Html` or `Loader`. The default export of the library is `web` which **does** export `Html` and `Loader`.

## Documentation

https://pmndrs.github.io/drei

<details>
  <summary>Old doc</summary>

> [!WARNING]
> Below is an archive of the anchors links with their new respective locations to the documentation website.
> Do not update the links below, they are for reference only.

<!-- <table>
  <tr>
    <td valign="top">
      <ul>
        <li><a href="#cameras">Cameras</a></li>
        <ul>
          <li><a href="#perspectivecamera">PerspectiveCamera</a></li>
          <li><a href="#orthographiccamera">OrthographicCamera</a></li>
          <li><a href="#cubecamera">CubeCamera</a></li>
        </ul>
        <li><a href="#controls">Controls</a></li>
        <ul>
          <li><a href="#cameracontrols">CameraControls</a></li>
          <li><a href="#controls">FlyControls</a></li>
          <li><a href="#controls">MapControls</a></li>
          <li><a href="#controls">DeviceOrientationControls</a></li>
          <li><a href="#controls">TrackballControls</a></li>
          <li><a href="#controls">ArcballControls</a></li>
          <li><a href="#controls">PointerLockControls</a></li>
          <li><a href="#controls">FirstPersonControls</a></li>
          <li><a href="#scrollcontrols">ScrollControls</a></li>
          <li><a href="#presentationcontrols">PresentationControls</a></li>
          <li><a href="#keyboardcontrols">KeyboardControls</a></li>
          <li><a href="#FaceControls">FaceControls</a></li>
          <li><a href="#motionpathcontrols">MotionPathControls</a></li>
        </ul>
        <li><a href="#gizmos">Gizmos</a></li>
        <ul>
          <li><a href="#gizmohelper">GizmoHelper</a></li>
          <li><a href="#pivotcontrols">PivotControls</a></li>
          <li><a href="#dragcontrols">DragControls</a></li>
          <li><a href="#transformcontrols">TransformControls</a></li>
          <li><a href="#grid">Grid</a></li>
          <li><a href="#helper--usehelper">Helper / useHelper</a></li>
          <li><a href="#helper">Helper</a></li>
        </ul>
        <li><a href="#abstractions">Abstractions</a></li>
        <ul>
          <li><a href="#image">Image</a></li>
          <li><a href="#text">Text</a></li>
          <li><a href="#text3d">Text3D</a></li>
          <li><a href="#positionalaudio">PositionalAudio</a></li>
          <li><a href="#billboard">Billboard</a></li>
          <li><a href="#screenspace">ScreenSpace</a></li>
          <li><a href="#screensizer">ScreenSizer</a></li>
          <li><a href="#effects">Effects</a></li>
          <li><a href="#gradienttexture">GradientTexture</a></li>
          <li><a href="#edges">Edges</a></li>
          <li><a href="#outlines">Outlines</a></li>
          <li><a href="#trail">Trail</a></li>
          <li><a href="#sampler">Sampler</a></li>
          <li><a href="#computedattribute">ComputedAttribute</a></li>
          <li><a href="#clone">Clone</a></li>
          <li><a href="#useanimations">useAnimations</a></li>
          <li><a href="#marchingcubes">MarchingCubes</a></li>
          <li><a href="#decal">Decal</a></li>
          <li><a href="#svg">Svg</a></li>
          <li><a href="#gltf">Gltf</a></li>
          <li><a href="#asciirenderer">AsciiRenderer</a></li>
          <li><a href="#splat">Splat</a></li>
        </ul>
        <li><a href="#shaders">Shaders</a></li>
        <ul>
          <li><a href="#meshreflectormaterial">MeshReflectorMaterial</a></li>
          <li><a href="#meshwobblematerial">MeshWobbleMaterial</a></li>
          <li><a href="#meshdistortmaterial">MeshDistortMaterial</a></li>
          <li><a href="#meshrefractionmaterial">MeshRefractionMaterial</a></li>
          <li><a href="#meshtransmissionmaterial">MeshTransmissionMaterial</a></li>
          <li><a href="#meshdiscardmaterial">MeshDiscardMaterial</a></li>
          <li><a href="#pointmaterial">PointMaterial</a></li>
          <li><a href="#softshadows">SoftShadows</a></li>
          <li><a href="#shadermaterial">shaderMaterial</a></li>
        </ul>
      </ul>
    </td>
    <td valign="top">
      <ul>
        <li><a href="#misc">Misc</a></li>
        <ul>
          <li><a href="#example">Example</a></li>
          <li><a href="#html">Html</a></li>
          <li><a href="#cycleraycast">CycleRaycast</a></li>
          <li><a href="#select">Select</a></li>
          <li><a href="#sprite-animator">Sprite Animator</a></li>
          <li><a href="#stats">Stats</a></li>
          <li><a href="#stats-gl">StatsGl</a></li>
          <li><a href="#wireframe">Wireframe</a></li>
          <li><a href="#usedepthbuffer">useDepthBuffer</a></li>
          <li><a href="#usecontextbridge">useContextBridge</a></li>
          <li><a href="#fbo--usefbo">Fbo / useFBO</a></li>
          <li><a href="#usecamera">useCamera</a></li>
          <li><a href="#cubecamera--usecubecamera">CubeCamera / useCubeCamera</a></li>
          <li><a href="#detectgpu--usedetectgpu">DetectGPU / useDetectGPU</a></li>
          <li><a href="#useaspect">useAspect</a></li>
          <li><a href="#usecursor">useCursor</a></li>
          <li><a href="#useintersect">useIntersect</a></li>
          <li><a href="#useboxprojectedenv">useBoxProjectedEnv</a></li>
          <li><a href="#trail--useTrail">Trail / useTrail</a></li>
          <li><a href="#useSurfaceSampler">useSurfaceSampler</a></li>
          <li><a href="#facelandmarker">FaceLandmarker</a></li>
        </ul>
        <li><a href="#loading">Loaders</a></li>
        <ul>
          <li><a href="#loader">Loader</a></li>
          <li><a href="#progress--useprogress">Progress / useProgress</a></li>
          <li><a href="#gltf--usegltf">Gltf / useGLTF</a></li>
          <li><a href="#fbx--usefbx">FBX / useFBX</a></li>
          <li><a href="#texture--usetexture">Texture / useTexture</a></li>
          <li><a href="#ktx2--usektx2">Ktx2 / useKTX2</a></li>
          <li><a href="#cubetexture--usecubetexture">CubeTexture / useCubeTexture</a></li>
          <li><a href="#videotexture--usevideotexture">VideoTexture / useVideoTexture</a></li>
          <li><a href="#trailtexture--usetrailtexture">TrailTexture / useTrailTexture</a></li>
          <li><a href="#usefont">useFont</a></li>
          <li><a href="#usespriteloader">useSpriteLoader</a></li>
        </ul>
        <li><a href="#performance">Performance</a></li>
        <ul>
          <li><a href="#instances">Instances</a></li>
          <li><a href="#merged">Merged</a></li>
          <li><a href="#points">Points</a></li>
          <li><a href="#segments">Segments</a></li>
          <li><a href="#detailed">Detailed</a></li>
          <li><a href="#preload">Preload</a></li>
          <li><a href="#bakeshadows">BakeShadows</a></li>
          <li><a href="#meshbounds">meshBounds</a></li>
          <li><a href="#adaptivedpr">AdaptiveDpr</a></li>
          <li><a href="#adaptiveevents">AdaptiveEvents</a></li>
          <li><a href="#bvh">Bvh</a></li>
          <li><a href="#performancemonitor">PerformanceMonitor</a></li>
        </ul>
        <li><a href="#portals">Portals</a></li>
        <ul>
          <li><a href="#hud">Hud</a></li>
          <li><a href="#view">View</a></li>
          <li><a href="#rendertexture">RenderTexture</a></li>
          <li><a href="#rendercubetexture">RenderCubeTexture</a></li>
          <li><a href="#fisheye">Fisheye</a></li>
          <li><a href="#mask">Mask</a></li>
          <li><a href="#meshportalmaterial">MeshPortalMaterial</a></li>
        </ul>
        <li><a href="#modifiers">Modifiers</a></li>
        <ul>
          <li><a href="#curvemodifier">CurveModifier</a></li>
        </ul>
      </ul>
    </td>
    <td valign="top">
      <ul>
        <li><a href="#shapes">Shapes</a></li>
        <ul>
          <li><a href="#shapes">Plane</a></li>
          <li><a href="#shapes">Box</a></li>
          <li><a href="#shapes">Sphere</a></li>
          <li><a href="#shapes">Circle</a></li>
          <li><a href="#shapes">Cone</a></li>
          <li><a href="#shapes">Cylinder</a></li>
          <li><a href="#shapes">Tube</a></li>
          <li><a href="#shapes">Torus</a></li>
          <li><a href="#shapes">TorusKnot</a></li>
          <li><a href="#shapes">Ring</a></li>
          <li><a href="#shapes">Tetrahedron</a></li>
          <li><a href="#shapes">Polyhedron</a></li>
          <li><a href="#shapes">Icosahedron</a></li>
          <li><a href="#shapes">Octahedron</a></li>
          <li><a href="#shapes">Dodecahedron</a></li>
          <li><a href="#shapes">Extrude</a></li>
          <li><a href="#shapes">Lathe</a></li>
          <li><a href="#shapes">Shape</a></li>
          <li><a href="#roundedbox">RoundedBox</a></li>
          <li><a href="#screenquad">Screenquad</a></li>
          <li><a href="#line">Line</a></li>
          <li><a href="#quadraticbezierline">QuadraticBezierLine</a></li>
          <li><a href="#cubicbezierline">CubicBezierLine</a></li>
          <li><a href="#catmullromline">CatmullRomLine</a></li>
          <li><a href="#facemesh">Facemesh</a></li>
        </ul>
        <li><a href="#staging">Staging</a></li>
        <ul>
          <li><a href="#center">Center</a></li>
          <li><a href="#resize">Resize</a></li>
          <li><a href="#BBAnchor">BBAnchor</a></li>
          <li><a href="#bounds">Bounds</a></li>
          <li><a href="#camerashake">CameraShake</a></li>
          <li><a href="#float">Float</a></li>
          <li><a href="#stage">Stage</a></li>
          <li><a href="#backdrop">Backdrop</a></li>
          <li><a href="#environment">Environment</a></li>
          <li><a href="#lightformer">Lightformer</a></li>
          <li><a href="#spotlight">SpotLight</a></li>
          <li><a href="#spotlightshadow">SpotLightShadow</a></li>
          <li><a href="#shadow">Shadow</a></li>
          <li><a href="#caustics">Caustics</a></li>
          <li><a href="#contactshadows">ContactShadows</a></li>
          <li><a href="#randomizedlight">RandomizedLight</a></li>
          <li><a href="#accumulativeshadows">AccumulativeShadows</a></li>
          <li><a href="#sky">Sky</a></li>
          <li><a href="#stars">Stars</a></li>
          <li><a href="#sparkles">Sparkles</a></li>
          <li><a href="#cloud">Cloud</a></li>
          <li><a href="#useenvironment">useEnvironment</a></li>
          <li><a href="#matcaptexture--usematcaptexture">MatcapTexture / useMatcapTexture</a></li>
          <li><a href="#normaltexture--usenormaltexture">NormalTexture / useNormalTexture</a></li>
          <li><a href="#shadowalpha">ShadowAlpha</a></li>
        </ul>
      </ul>
    </td>
  </tr>
</table> -->

### Cameras

#### PerspectiveCamera

[Documentation has moved here](https://pmndrs.github.io/drei/cameras/perspective-camera)

#### OrthographicCamera

[Documentation has moved here](https://pmndrs.github.io/drei/cameras/orthographic-camera)

#### CubeCamera

[Documentation has moved here](https://pmndrs.github.io/drei/cameras/cube-camera)

### Controls

#### CameraControls

[Documentation has moved here](https://pmndrs.github.io/drei/controls/camera-controls)

#### ScrollControls

[Documentation has moved here](https://pmndrs.github.io/drei/controls/scroll-controls)

#### PresentationControls

[Documentation has moved here](https://pmndrs.github.io/drei/controls/presentation-controls)

#### KeyboardControls

[Documentation has moved here](https://pmndrs.github.io/drei/controls/keyboard-controls)

#### FaceControls

[Documentation has moved here](https://pmndrs.github.io/drei/controls/face-controls)

#### MotionPathControls

[Documentation has moved here](https://pmndrs.github.io/drei/controls/motion-path-controls)

### Gizmos

#### GizmoHelper

[Documentation has moved here](https://pmndrs.github.io/drei/gizmos/gizmo-helper)

#### PivotControls

[Documentation has moved here](https://pmndrs.github.io/drei/gizmos/pivot-controls)

#### DragControls

[Documentation has moved here](https://pmndrs.github.io/drei/gizmos/drag-controls)

#### TransformControls

[Documentation has moved here](https://pmndrs.github.io/drei/gizmos/transform-controls)

#### Grid

[Documentation has moved here](https://pmndrs.github.io/drei/gizmos/grid)

#### Helper / useHelper

[Documentation has moved here](https://pmndrs.github.io/drei/gizmos/helper-use-helper)

### Shapes

#### Plane, Box, Sphere, Circle, Cone, Cylinder, Tube, Torus, TorusKnot, Ring, Tetrahedron, Polyhedron, Icosahedron, Octahedron, Dodecahedron, Extrude, Lathe, Shape

[Documentation has moved here](https://pmndrs.github.io/drei/shapes/mesh)

#### RoundedBox

[Documentation has moved here](https://pmndrs.github.io/drei/shapes/rounded-box)

#### ScreenQuad

[Documentation has moved here](https://pmndrs.github.io/drei/shapes/screen-quad)

#### Line

[Documentation has moved here](https://pmndrs.github.io/drei/shapes/line)

#### QuadraticBezierLine

[Documentation has moved here](https://pmndrs.github.io/drei/shapes/quadratic-bezier-line)

#### CubicBezierLine

[Documentation has moved here](https://pmndrs.github.io/drei/shapes/cubic-bezier-line)

#### CatmullRomLine

[Documentation has moved here](https://pmndrs.github.io/drei/shapes/catmull-rom-line)

#### Facemesh

[Documentation has moved here](https://pmndrs.github.io/drei/shapes/facemesh)

### Abstractions

#### Image

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/image)

#### Text

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/text)

#### Text3D

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/text3d)

#### Effects

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/effects)

#### PositionalAudio

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/positional-audio)

#### Billboard

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/billboard)

#### ScreenSpace

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/screen-space)

#### ScreenSizer

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/screen-sizer)

#### GradientTexture

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/gradient-texture)

#### Edges

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/edges)

#### Outlines

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/outlines)

#### Trail

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/trail)

#### Sampler

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/sampler)

#### ComputedAttribute

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/computed-attribute)

#### Clone

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/clone)

#### useAnimations

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/use-animations)

#### MarchingCubes

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/marching-cubes)

#### Decal

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/decal)

#### Svg

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/svg)

#### AsciiRenderer

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/ascii-renderer)

#### Splat

[Documentation has moved here](https://pmndrs.github.io/drei/abstractions/splat)

### Shaders

#### MeshReflectorMaterial

[Documentation has moved here](https://pmndrs.github.io/drei/shaders/mesh-reflector-material)

#### MeshWobbleMaterial

[Documentation has moved here](https://pmndrs.github.io/drei/shaders/mesh-wobble-material)

#### MeshDistortMaterial

[Documentation has moved here](https://pmndrs.github.io/drei/shaders/mesh-distort-material)

#### MeshRefractionMaterial

[Documentation has moved here](https://pmndrs.github.io/drei/shaders/mesh-refraction-material)

#### MeshTransmissionMaterial

[Documentation has moved here](https://pmndrs.github.io/drei/shaders/mesh-transmission-material)

#### MeshDiscardMaterial

[Documentation has moved here](https://pmndrs.github.io/drei/shaders/mesh-discard-material)

#### PointMaterial

[Documentation has moved here](https://pmndrs.github.io/drei/shaders/point-material)

#### SoftShadows

[Documentation has moved here](https://pmndrs.github.io/drei/shaders/soft-shadows)

#### shaderMaterial

[Documentation has moved here](https://pmndrs.github.io/drei/shaders/shader-material)

### Modifiers

#### CurveModifier

[Documentation has moved here](https://pmndrs.github.io/drei/modifiers/curve-modifier)

### Misc

#### useContextBridge

[Documentation has moved here](https://pmndrs.github.io/drei/misc/use-context-bridge)

#### Example

[Documentation has moved here](https://pmndrs.github.io/drei/misc/example)

#### Html

[Documentation has moved here](https://pmndrs.github.io/drei/misc/html)

#### CycleRaycast

[Documentation has moved here](https://pmndrs.github.io/drei/misc/cycle-raycast)

#### Select

[Documentation has moved here](https://pmndrs.github.io/drei/misc/select)

#### Sprite Animator

[Documentation has moved here](https://pmndrs.github.io/drei/misc/sprite-animator)

#### Stats

[Documentation has moved here](https://pmndrs.github.io/drei/misc/stats)

#### StatsGl

[Documentation has moved here](https://pmndrs.github.io/drei/misc/stats-gl)

#### Wireframe

[Documentation has moved here](https://pmndrs.github.io/drei/misc/wireframe)

#### useDepthBuffer

[Documentation has moved here](https://pmndrs.github.io/drei/misc/use-depth-buffer)

#### Fbo / useFBO

[Documentation has moved here](https://pmndrs.github.io/drei/misc/fbo-use-fbo)

#### useCamera

[Documentation has moved here](https://pmndrs.github.io/drei/misc/use-camera)

#### CubeCamera / useCubeCamera

[Documentation has moved here](https://pmndrs.github.io/drei/misc/cube-camera-use-cube-camera)

#### DetectGPU / useDetectGPU

[Documentation has moved here](https://pmndrs.github.io/drei/misc/detect-gpu-use-detect-gpu)

#### useAspect

[Documentation has moved here](https://pmndrs.github.io/drei/misc/use-aspect)

#### useCursor

[Documentation has moved here](https://pmndrs.github.io/drei/misc/use-cursor)

#### useIntersect

[Documentation has moved here](https://pmndrs.github.io/drei/misc/use-intersect)

#### useBoxProjectedEnv

[Documentation has moved here](https://pmndrs.github.io/drei/misc/use-box-projected-env)

#### Trail / useTrail

[Documentation has moved here](https://pmndrs.github.io/drei/misc/trail-use-trail)

#### useSurfaceSampler

[Documentation has moved here](https://pmndrs.github.io/drei/misc/use-surface-sampler)

#### FaceLandmarker

[Documentation has moved here](https://pmndrs.github.io/drei/misc/face-landmarker)

### Loading

#### Loader

[Documentation has moved here](https://pmndrs.github.io/drei/loaders/loader)

#### Progress / useProgress

[Documentation has moved here](https://pmndrs.github.io/drei/loaders/progress-use-progress)

#### Gltf / useGLTF

[Documentation has moved here](https://pmndrs.github.io/drei/loaders/gltf-use-gltf)

#### Fbx / useFBX

[Documentation has moved here](https://pmndrs.github.io/drei/loaders/fbx-use-fbx)

#### Texture / useTexture

[Documentation has moved here](https://pmndrs.github.io/drei/loaders/texture-use-texture)

#### Ktx2 / useKTX2

[Documentation has moved here](https://pmndrs.github.io/drei/loaders/ktx2-use-ktx2)

#### CubeTexture / useCubeTexture

[Documentation has moved here](https://pmndrs.github.io/drei/loaders/cube-texture-use-cube-texture)

#### VideoTexture / useVideoTexture

[Documentation has moved here](https://pmndrs.github.io/drei/loaders/video-texture-use-video-texture)

#### TrailTexture / useTrailTexture

[Documentation has moved here](https://pmndrs.github.io/drei/loaders/trail-texture-use-trail-texture)

#### useFont

[Documentation has moved here](https://pmndrs.github.io/drei/loaders/use-font)

#### useSpriteLoader

[Documentation has moved here](https://pmndrs.github.io/drei/loaders/use-sprite-loader)

### Performance

#### Instances

[Documentation has moved here](https://pmndrs.github.io/drei/performances/instances)

#### Merged

[Documentation has moved here](https://pmndrs.github.io/drei/performances/merged)

#### Points

[Documentation has moved here](https://pmndrs.github.io/drei/performances/points)

#### Segments

[Documentation has moved here](https://pmndrs.github.io/drei/performances/segments)

#### Detailed

[Documentation has moved here](https://pmndrs.github.io/drei/performances/detailed)

#### Preload

[Documentation has moved here](https://pmndrs.github.io/drei/performances/preload)

#### BakeShadows

[Documentation has moved here](https://pmndrs.github.io/drei/performances/bake-shadows)

#### meshBounds

[Documentation has moved here](https://pmndrs.github.io/drei/performances/mesh-bounds)

#### AdaptiveDpr

[Documentation has moved here](https://pmndrs.github.io/drei/performances/adaptive-dpr)

#### AdaptiveEvents

[Documentation has moved here](https://pmndrs.github.io/drei/performances/adaptive-events)

#### Bvh

[Documentation has moved here](https://pmndrs.github.io/drei/performances/bvh)

#### PerformanceMonitor

[Documentation has moved here](https://pmndrs.github.io/drei/performances/performance-monitor)

### Portals

#### Hud

[Documentation has moved here](https://pmndrs.github.io/drei/portals/hud)

#### View

[Documentation has moved here](https://pmndrs.github.io/drei/portals/view)

#### RenderTexture

[Documentation has moved here](https://pmndrs.github.io/drei/portals/render-texture)

#### RenderCubeTexture

[Documentation has moved here](https://pmndrs.github.io/drei/portals/render-cube-texture)

#### Fisheye

[Documentation has moved here](https://pmndrs.github.io/drei/portals/fisheye)

#### Mask

[Documentation has moved here](https://pmndrs.github.io/drei/portals/mask)

#### MeshPortalMaterial

[Documentation has moved here](https://pmndrs.github.io/drei/portals/mesh-portal-material)

### Staging

#### Center

[Documentation has moved here](https://pmndrs.github.io/drei/staging/center)

#### Resize

[Documentation has moved here](https://pmndrs.github.io/drei/staging/resize)

#### BBAnchor

[Documentation has moved here](https://pmndrs.github.io/drei/staging/bb-anchor)

#### Bounds

[Documentation has moved here](https://pmndrs.github.io/drei/staging/bounds)

#### CameraShake

[Documentation has moved here](https://pmndrs.github.io/drei/staging/camera-shake)

#### Float

[Documentation has moved here](https://pmndrs.github.io/drei/staging/float)

#### Stage

[Documentation has moved here](https://pmndrs.github.io/drei/staging/stage)

#### Backdrop

[Documentation has moved here](https://pmndrs.github.io/drei/staging/backdrop)

#### Shadow

[Documentation has moved here](https://pmndrs.github.io/drei/staging/shadow)

#### Caustics

[Documentation has moved here](https://pmndrs.github.io/drei/staging/caustics)

#### ContactShadows

[Documentation has moved here](https://pmndrs.github.io/drei/staging/contact-shadows)

#### RandomizedLight

[Documentation has moved here](https://pmndrs.github.io/drei/staging/randomized-light)

#### AccumulativeShadows

[Documentation has moved here](https://pmndrs.github.io/drei/staging/accumulative-shadows)

#### SpotLight

[Documentation has moved here](https://pmndrs.github.io/drei/staging/spot-light)

#### SpotLightShadow

[Documentation has moved here](https://pmndrs.github.io/drei/staging/spot-light-shadow)

#### Environment

[Documentation has moved here](https://pmndrs.github.io/drei/staging/environment)

#### Lightformer

[Documentation has moved here](https://pmndrs.github.io/drei/staging/lightformer)

#### Sky

[Documentation has moved here](https://pmndrs.github.io/drei/staging/sky)

#### Stars

[Documentation has moved here](https://pmndrs.github.io/drei/staging/stars)

#### Sparkles

[Documentation has moved here](https://pmndrs.github.io/drei/staging/sparkles)

#### Cloud

[Documentation has moved here](https://pmndrs.github.io/drei/staging/cloud)

#### useEnvironment

[Documentation has moved here](https://pmndrs.github.io/drei/staging/use-environment)

#### MatcapTexture / useMatcapTexture

[Documentation has moved here](https://pmndrs.github.io/drei/staging/matcap-texture-use-matcap-texture)

#### NormalTexture / useNormalTexture

[Documentation has moved here](https://pmndrs.github.io/drei/staging/normal-texture-use-normal-texture)

#### ShadowAlpha

[Documentation has moved here](https://pmndrs.github.io/drei/staging/shadow-alpha)

</details>
