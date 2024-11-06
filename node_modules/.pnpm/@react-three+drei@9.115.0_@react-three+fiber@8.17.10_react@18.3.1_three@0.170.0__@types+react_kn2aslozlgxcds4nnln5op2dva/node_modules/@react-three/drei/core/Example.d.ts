import * as React from 'react';
import type { Color } from '@react-three/fiber';
export type ExampleProps = {
    font: string;
    color?: Color;
    debug?: boolean;
    bevelSize?: number;
} & React.ComponentProps<'group'>;
export type ExampleApi = {
    incr: (x?: number) => void;
    decr: (x?: number) => void;
};
export declare const Example: React.ForwardRefExoticComponent<Omit<ExampleProps, "ref"> & React.RefAttributes<ExampleApi>>;
