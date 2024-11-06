import { PositionalAudio as PositionalAudioImpl } from 'three';
import { ForwardRefComponent } from '../helpers/ts-utils';
type Props = JSX.IntrinsicElements['positionalAudio'] & {
    url: string;
    distance?: number;
    loop?: boolean;
};
export declare const PositionalAudio: ForwardRefComponent<Props, PositionalAudioImpl>;
export {};
