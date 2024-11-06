import * as THREE from 'three';
import { Panel } from './panel';

interface StatsOptions {
  trackGPU?: boolean;
  logsPerSecond?: number;
  samplesLog?: number;
  samplesGraph?: number;
  precision?: number;
  minimal?: boolean;
  horizontal?: boolean;
  mode?: number;
}

interface QueryInfo {
  query: WebGLQuery;
}

interface AverageData {
  logs: number[];
  graph: number[];
}

interface InfoData {
  render: {
    timestamp: number;
  };
  compute: {
    timestamp: number;
  };
}

class Stats {
  private dom: HTMLDivElement;
  private mode: number;
  private horizontal: boolean;
  private minimal: boolean;
  private trackGPU: boolean;
  private samplesLog: number;
  private samplesGraph: number;
  private precision: number;
  private logsPerSecond: number;

  private gl: WebGL2RenderingContext | null = null;
  private ext: any | null = null;
  private info?: InfoData;
  private activeQuery: WebGLQuery | null = null;
  private gpuQueries: QueryInfo[] = [];
  private threeRendererPatched = false;

  private beginTime: number;
  private prevTime: number;
  private prevCpuTime: number;
  private frames = 0;
  private renderCount = 0;
  private isRunningCPUProfiling = false;

  private totalCpuDuration = 0;
  private totalGpuDuration = 0;
  private totalGpuDurationCompute = 0;
  private totalFps = 0;

  private fpsPanel: Panel;
  private msPanel: Panel;
  private gpuPanel: Panel | null = null;
  private gpuPanelCompute: Panel | null = null;

  private averageFps: AverageData = { logs: [], graph: [] };
  private averageCpu: AverageData = { logs: [], graph: [] };
  private averageGpu: AverageData = { logs: [], graph: [] };
  private averageGpuCompute: AverageData = { logs: [], graph: [] };

  static Panel = Panel;

  constructor({
    trackGPU = false,
    logsPerSecond = 30,
    samplesLog = 60,
    samplesGraph = 10,
    precision = 2,
    minimal = false,
    horizontal = true,
    mode = 0
  }: StatsOptions = {}) {
    this.mode = mode;
    this.horizontal = horizontal;
    this.minimal = minimal;
    this.trackGPU = trackGPU;
    this.samplesLog = samplesLog;
    this.samplesGraph = samplesGraph;
    this.precision = precision;
    this.logsPerSecond = logsPerSecond;

    // Initialize DOM
    this.dom = document.createElement('div');
    this.initializeDOM();

    // Initialize timing
    this.beginTime = performance.now();
    this.prevTime = this.beginTime;
    this.prevCpuTime = this.beginTime;

    // Create panels
    this.fpsPanel = this.addPanel(new Stats.Panel('FPS', '#0ff', '#002'), 0);
    this.msPanel = this.addPanel(new Stats.Panel('CPU', '#0f0', '#020'), 1);

    this.setupEventListeners();
  }


  private initializeDOM(): void {
    this.dom.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      opacity: 0.9;
      z-index: 10000;
      ${this.minimal ? 'cursor: pointer;' : ''}
    `;
  }

  private setupEventListeners(): void {
    if (this.minimal) {
      this.dom.addEventListener('click', this.handleClick);
      this.showPanel(this.mode);
    } else {
      window.addEventListener('resize', this.handleResize);
    }
  }

  private handleClick = (event: MouseEvent): void => {
    event.preventDefault();
    this.showPanel(++this.mode % this.dom.children.length);
  };

  private handleResize = (): void => {
    this.resizePanel(this.fpsPanel, 0);
    this.resizePanel(this.msPanel, 1);
    if (this.gpuPanel) this.resizePanel(this.gpuPanel, 2);
    if (this.gpuPanelCompute) this.resizePanel(this.gpuPanelCompute, 3);
  };

  public async init(
    canvasOrGL: WebGL2RenderingContext | HTMLCanvasElement | OffscreenCanvas | any
  ): Promise<void> {
    if (!canvasOrGL) {
      console.error('Stats: The "canvas" parameter is undefined.');
      return;
    }

    if (this.handleThreeRenderer(canvasOrGL)) return;
    if (await this.handleWebGPURenderer(canvasOrGL)) return;
    if (!this.initializeWebGL(canvasOrGL)) return;

  }

  private handleThreeRenderer(renderer: any): boolean {
    if (renderer.isWebGLRenderer && !this.threeRendererPatched) {
      this.patchThreeRenderer(renderer);
      this.gl = renderer.getContext();

      if (this.trackGPU) {
        this.initializeGPUTracking();
      }
      return true;
    }
    return false;
  }

  private async handleWebGPURenderer(renderer: any): Promise<boolean> {
    if (renderer.isWebGPURenderer) {
      if (this.trackGPU) {
        renderer.backend.trackTimestamp = true;
        if (await renderer.hasFeatureAsync('timestamp-query')) {
          this.initializeWebGPUPanels();
        }
      }
      this.info = renderer.info;
      return true;
    }
    return false;
  }

  private initializeWebGPUPanels(): void {
    this.gpuPanel = this.addPanel(new Stats.Panel('GPU', '#ff0', '#220'), 2);
    this.gpuPanelCompute = this.addPanel(
      new Stats.Panel('CPT', '#e1e1e1', '#212121'),
      3
    );
  }

  private initializeWebGL(
    canvasOrGL: WebGL2RenderingContext | HTMLCanvasElement | OffscreenCanvas
  ): boolean {
    if (canvasOrGL instanceof WebGL2RenderingContext) {
      this.gl = canvasOrGL;
    } else if (
      canvasOrGL instanceof HTMLCanvasElement ||
      canvasOrGL instanceof OffscreenCanvas
    ) {
      this.gl = canvasOrGL.getContext('webgl2');
      if (!this.gl) {
        console.error('Stats: Unable to obtain WebGL2 context.');
        return false;
      }
    } else {
      console.error(
        'Stats: Invalid input type. Expected WebGL2RenderingContext, HTMLCanvasElement, or OffscreenCanvas.'
      );
      return false;
    }
    return true;
  }

  private initializeGPUTracking(): void {
    if (this.gl) {
      this.ext = this.gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (this.ext) {
        this.gpuPanel = this.addPanel(new Stats.Panel('GPU', '#ff0', '#220'), 2);
      }
    }
  }

  public begin(): void {
    if (!this.isRunningCPUProfiling) {
      this.beginProfiling('cpu-started');
    }

    if (!this.gl || !this.ext) return;

    if (this.activeQuery) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    }

    this.activeQuery = this.gl.createQuery();
    if (this.activeQuery) {
      this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, this.activeQuery);
    }
  }

  public end(): void {
    this.renderCount++;
    if (this.gl && this.ext && this.activeQuery) {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.gpuQueries.push({ query: this.activeQuery });
      this.activeQuery = null;
    }
  }

  public update(): void {
    if (!this.info) {
      this.processGpuQueries();
    } else {
      this.processWebGPUTimestamps();
    }

    this.endProfiling('cpu-started', 'cpu-finished', 'cpu-duration');
    this.updateAverages();
    this.resetCounters();
  }

  private processWebGPUTimestamps(): void {
    this.totalGpuDuration = this.info!.render.timestamp;
    this.totalGpuDurationCompute = this.info!.compute.timestamp;
    this.addToAverage(this.totalGpuDurationCompute, this.averageGpuCompute);
  }

  private updateAverages(): void {
    this.addToAverage(this.totalCpuDuration, this.averageCpu);
    this.addToAverage(this.totalGpuDuration, this.averageGpu);
  }

  private resetCounters(): void {
    this.renderCount = 0;
    if (this.totalCpuDuration === 0) {
      this.beginProfiling('cpu-started');
    }
    this.totalCpuDuration = 0;
    this.totalFps = 0;
    this.beginTime = this.endInternal();
  }


  resizePanel(panel: Panel, offset: number) {

    panel.canvas.style.position = 'absolute';

    if (this.minimal) {

      panel.canvas.style.display = 'none';

    } else {

      panel.canvas.style.display = 'block';
      if (this.horizontal) {
        panel.canvas.style.top = '0px';
        panel.canvas.style.left = offset * panel.WIDTH / panel.PR + 'px';
      } else {
        panel.canvas.style.left = '0px';
        panel.canvas.style.top = offset * panel.HEIGHT / panel.PR + 'px';

      }
    }

  }
  addPanel(panel: Panel, offset: number) {

    if (panel.canvas) {

      this.dom.appendChild(panel.canvas);

      this.resizePanel(panel, offset);

    }

    return panel;

  }

  showPanel(id: number) {

    for (let i = 0; i < this.dom.children.length; i++) {
      const child = this.dom.children[i] as HTMLElement;

      child.style.display = i === id ? 'block' : 'none';

    }

    this.mode = id;

  }

  processGpuQueries() {


    if (!this.gl || !this.ext) return;

    this.totalGpuDuration = 0;

    this.gpuQueries.forEach((queryInfo, index) => {
      if (this.gl) {
        const available = this.gl.getQueryParameter(queryInfo.query, this.gl.QUERY_RESULT_AVAILABLE);
        const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT);

        if (available && !disjoint) {
          const elapsed = this.gl.getQueryParameter(queryInfo.query, this.gl.QUERY_RESULT);
          const duration = elapsed * 1e-6;  // Convert nanoseconds to milliseconds
          this.totalGpuDuration += duration;
          this.gl.deleteQuery(queryInfo.query);
          this.gpuQueries.splice(index, 1);  // Remove the processed query
        }
      }
    });

  }

  endInternal() {

    this.frames++;
    const time = (performance || Date).now();
    const elapsed = time - this.prevTime;

    // Calculate FPS more frequently based on logsPerSecond
    if (time >= this.prevCpuTime + 1000 / this.logsPerSecond) {
      // Calculate FPS and round to nearest integer
      const fps = Math.round((this.frames * 1000) / elapsed);

      // Add to FPS averages
      this.addToAverage(fps, this.averageFps);

      // Update all panels
      this.updatePanel(this.fpsPanel, this.averageFps, 0);
      this.updatePanel(this.msPanel, this.averageCpu, this.precision);
      this.updatePanel(this.gpuPanel, this.averageGpu, this.precision);

      if (this.gpuPanelCompute) {
        this.updatePanel(this.gpuPanelCompute, this.averageGpuCompute);
      }

      // Reset frame counter for next interval
      this.frames = 0;
      this.prevCpuTime = time;
      this.prevTime = time;
    }

    return time;

  }

  addToAverage(value: number, averageArray: { logs: any; graph: any; }) {

    averageArray.logs.push(value);
    if (averageArray.logs.length > this.samplesLog) {

      averageArray.logs.shift();

    }

    averageArray.graph.push(value);
    if (averageArray.graph.length > this.samplesGraph) {

      averageArray.graph.shift();

    }

  }

  beginProfiling(marker: string) {

    if (window.performance) {

      window.performance.mark(marker);
      this.isRunningCPUProfiling = true

    }

  }

  endProfiling(startMarker: string | PerformanceMeasureOptions | undefined, endMarker: string | undefined, measureName: string) {

    if (window.performance && endMarker && this.isRunningCPUProfiling) {

      window.performance.mark(endMarker);
      const cpuMeasure = performance.measure(measureName, startMarker, endMarker);
      this.totalCpuDuration += cpuMeasure.duration;
      this.isRunningCPUProfiling = false

    }

  }

  updatePanel(panel: { update: any; } | null, averageArray: { logs: number[], graph: number[] }, precision = 2) {

    if (averageArray.logs.length > 0) {

      let sumLog = 0;
      let max = 0.01;

      for (let i = 0; i < averageArray.logs.length; i++) {

        sumLog += averageArray.logs[i];

        if (averageArray.logs[i] > max) {
          max = averageArray.logs[i];
        }

      }

      let sumGraph = 0;
      let maxGraph = 0.01;
      for (let i = 0; i < averageArray.graph.length; i++) {

        sumGraph += averageArray.graph[i];

        if (averageArray.graph[i] > maxGraph) {
          maxGraph = averageArray.graph[i];
        }

      }

      if (panel) {
        panel.update(sumLog / Math.min(averageArray.logs.length, this.samplesLog), sumGraph / Math.min(averageArray.graph.length, this.samplesGraph), max, maxGraph, precision);
      }

    }
  }

  get domElement() {
    // patch for some use case in threejs
    return this.dom;

  }

  patchThreeRenderer(renderer: any) {

    // Store the original render method
    const originalRenderMethod = renderer.render;

    // Reference to the stats instance
    const statsInstance = this;

    // Override the render method on the prototype
    renderer.render = function (scene: THREE.Scene, camera: THREE.Camera) {


      statsInstance.begin(); // Start tracking for this render call

      // Call the original render method
      originalRenderMethod.call(this, scene, camera);

      statsInstance.end(); // End tracking for this render call
    };


    this.threeRendererPatched = true;

  }
}


export default Stats;