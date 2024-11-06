# 📈 stats-gl
[![Version](https://img.shields.io/npm/v/stats-gl?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/stats-gl)
[![Version](https://img.shields.io/npm/dw/stats-gl?style=flat&colorA=000000&colorB=000000)](https://www.npmjs.com/package/stats-gl)

WebGL/WebGPU Performance Monitor tool.

🔗 [Live Demo](https://stats.renaudrohlinger.com/)


https://github.com/RenaudRohlinger/stats-gl/assets/15867665/3fdafff4-1357-4872-9baf-0629dbaf9d8c


### ❗📢 Note: To support GPU monitoring on Safari you need to enable Timer Queries under WebKit Feature Flags > WebGL Timer Queries  

## 📚 Description

`stats-gl` is a comprehensive tool to monitor WebGL performance. The Stats class provides methods to create performance panels, log performance metrics, and manage the display and layout of these panels. The performance metrics logged include FPS, CPU, and GPU. The GPU logging is available only if the user's browser supports the WebGL 2.0 `EXT_disjoint_timer_query_webgl2` extension or WebGPU Timestamp Queries.

In addition to logging real-time performance data, the class also provides methods to calculate and display average performance metrics over a specified interval.

## ⬇️ Installation

Stats-gl is available as an npm package. You can install it using the following command:

```bash
npm install stats-gl
```

## 🧑‍💻 Example Usage

Below is an example of how you can use this class in your code:
```js
import Stats from "stats-gl";

// create a new Stats object
const stats = new Stats({
    trackGPU: false,
    logsPerSecond: 20,
    samplesLog: 100, 
    samplesGraph: 10, 
    precision: 2, 
    horizontal: true,
    minimal: false, 
    mode: 0
});

// append the stats container to the body of the document
document.body.appendChild( stats.dom );

// begin the performance monitor
stats.begin();
// end the performance monitor
stats.end();

stats.begin();
// gl.draw... second pass
stats.end();


// when all the passes are drawn update the logs
stats.update();
```


Quick start with threejs:
```js
import * as THREE from 'three';

// use esm module instead of cjs
import Stats from 'https://www.unpkg.com/stats-gl?module';

const container = document.getElementById( 'container' );

const stats = new Stats();
container.appendChild( stats.dom );

const renderer = new THREE.WebGLRenderer( { antialias: true } ); // or WebGPURenderer
container.appendChild( renderer.domElement );

const scene = new THREE.Scene();

stats.init( renderer ); // this will patch the threejs render function so no need to call begin() or end()

function animate() {

    requestAnimationFrame( animate );

    render(); // needs async methods in WebGPU (renderAsync)
    stats.update();

}
```
Quick start with [@react-three/fiber](https://github.com/pmndrs/fiber). A `<StatsGl />` component is available through [@react-three/drei](https://github.com/pmndrs/drei):
```jsx
import { Canvas } from '@react-three/fiber'
import { StatsGl } from '@react-three/drei'

const Scene = () => (
    <Canvas>
        <StatsGl />
    </Canvas>
)
```

Quick start with [Tresjs](https://tresjs.org/) for Vue developers. A `<StatsGl />` component is available through [cientos](https://cientos.tresjs.org/guide/misc/stats-gl.html):

```vue
<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import { StatsGl } from '@tresjs/cientos'
</script>

<template>
  <TresCanvas>
    <StatsGl />
  </TresCanvas>
</template>
```
## ⚙️ Parameters
The constructor for the Stats class accepts an options object with the following properties:

- `logsPerSecond`: How often to log performance data, in logs per second.
- `samplesLog`: Number of recent log samples to keep for computing averages.
- `samplesGraph`: Number of recent graph samples to keep for computing averages.
- `precision`: Precision of the data, in number of decimal places (only affects CPU and GPU).
- `minimal`: A boolean value to control the minimalistic mode of the panel display. If set to true, a simple click on the panel will switch between different metrics.
- `mode`: Sets the initial panel to display - 0 for FPS, 1 for CPU, and 2 for GPU (if supported).
- `horizontal`: Display the canvases on the X axis, set to align on vertical axis.

All the parameters are optional and have default values. The class also provides other methods such as begin(), end(), init(canvas), etc. which can be used based on the requirement.


## 🤝 Contributing
Contributions to Stats-gl are welcome.

Please report any issues or bugs you encounter.

## 📜 License
This project is licensed under the MIT License.

## 🧑‍🎨 Maintainers :

- [`twitter 🐈‍⬛ @onirenaud`](https://twitter.com/onirenaud)
- [`twitter @utsuboco`](https://twitter.com/utsuboco)
