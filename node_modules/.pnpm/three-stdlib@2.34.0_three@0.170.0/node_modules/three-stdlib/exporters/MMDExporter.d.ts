import { SkinnedMesh } from 'three';
/**
 * Dependencies
 *  - mmd-parser https://github.com/takahirox/mmd-parser
 */
declare class MMDExporter {
    parseVpd(skin: SkinnedMesh, outputShiftJis: boolean, useOriginalBones: boolean): Uint8Array | string | null;
    private u2sTable;
    private unicodeToShiftjis;
    private getBindBones;
}
export { MMDExporter };
