export function IS_LEAF( n16, uint16Array ) {

	return uint16Array[ n16 + 15 ] === 0xFFFF;

}

export function OFFSET( n32, uint32Array ) {

	return uint32Array[ n32 + 6 ];

}

export function COUNT( n16, uint16Array ) {

	return uint16Array[ n16 + 14 ];

}

export function LEFT_NODE( n32 ) {

	return n32 + 8;

}

export function RIGHT_NODE( n32, uint32Array ) {

	return uint32Array[ n32 + 6 ];

}

export function SPLIT_AXIS( n32, uint32Array ) {

	return uint32Array[ n32 + 7 ];

}

export function BOUNDING_DATA_INDEX( n32 ) {

	return n32;

}
