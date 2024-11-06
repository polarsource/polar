import { DepthTexture } from 'three';
declare function useDepthBuffer({ size, frames }?: {
    size?: number;
    frames?: number;
}): DepthTexture;
export { useDepthBuffer };
