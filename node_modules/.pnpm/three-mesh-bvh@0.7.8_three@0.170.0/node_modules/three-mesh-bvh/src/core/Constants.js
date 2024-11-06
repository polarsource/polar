// Split strategy constants
export const CENTER = 0;
export const AVERAGE = 1;
export const SAH = 2;

// Traversal constants
export const NOT_INTERSECTED = 0;
export const INTERSECTED = 1;
export const CONTAINED = 2;

// SAH cost constants
// TODO: hone these costs more. The relative difference between them should be the
// difference in measured time to perform a triangle intersection vs traversing
// bounds.
export const TRIANGLE_INTERSECT_COST = 1.25;
export const TRAVERSAL_COST = 1;


// Build constants
export const BYTES_PER_NODE = 6 * 4 + 4 + 4;
export const IS_LEAFNODE_FLAG = 0xFFFF;

// EPSILON for computing floating point error during build
// https://en.wikipedia.org/wiki/Machine_epsilon#Values_for_standard_hardware_floating_point_arithmetics
export const FLOAT32_EPSILON = Math.pow( 2, - 24 );

export const SKIP_GENERATION = Symbol( 'SKIP_GENERATION' );
