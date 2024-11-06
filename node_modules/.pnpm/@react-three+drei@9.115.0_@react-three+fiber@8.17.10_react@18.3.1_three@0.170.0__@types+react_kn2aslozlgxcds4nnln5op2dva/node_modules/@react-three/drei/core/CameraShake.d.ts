import { ForwardRefComponent } from '../helpers/ts-utils';
export interface ShakeController {
    getIntensity: () => number;
    setIntensity: (val: number) => void;
}
export interface CameraShakeProps {
    intensity?: number;
    decay?: boolean;
    decayRate?: number;
    maxYaw?: number;
    maxPitch?: number;
    maxRoll?: number;
    yawFrequency?: number;
    pitchFrequency?: number;
    rollFrequency?: number;
}
export declare const CameraShake: ForwardRefComponent<CameraShakeProps, ShakeController | undefined>;
