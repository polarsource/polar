export function isSharedArrayBufferSupported() {

	return typeof SharedArrayBuffer !== 'undefined';

}

export function convertToBufferType( array, BufferConstructor ) {

	if ( array === null ) {

		return array;

	} else if ( array.buffer ) {

		const buffer = array.buffer;
		if ( buffer.constructor === BufferConstructor ) {

			return array;

		}

		const ArrayConstructor = array.constructor;
		const result = new ArrayConstructor( new BufferConstructor( buffer.byteLength ) );
		result.set( array );
		return result;

	} else {

		if ( array.constructor === BufferConstructor ) {

			return array;

		}

		const result = new BufferConstructor( array.byteLength );
		new Uint8Array( result ).set( new Uint8Array( array ) );
		return result;

	}

}
