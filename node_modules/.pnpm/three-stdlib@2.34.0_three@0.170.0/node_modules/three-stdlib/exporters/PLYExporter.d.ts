import { Object3D } from 'three';
/**
 * https://github.com/gkjohnson/ply-exporter-js
 *
 * Usage:
 *  const exporter = new PLYExporter();
 *
 *  // second argument is a list of options
 *  exporter.parse(mesh, data => console.log(data), { binary: true, excludeAttributes: [ 'color' ], littleEndian: true });
 *
 * Format Definition:
 * http://paulbourke.net/dataformats/ply/
 */
export interface PLYExporterOptions {
    binary?: boolean;
    excludeAttributes?: string[];
    littleEndian?: boolean;
}
declare class PLYExporter {
    parse(object: Object3D, onDone: ((res: string) => void) | undefined, options: PLYExporterOptions): string | ArrayBuffer | null;
    private traverseMeshes;
}
export { PLYExporter };
