import {
	BufferGeometry,
	BufferAttribute,
} from 'three';
import { MeshBVH } from '../core/MeshBVH.js';

onmessage = ( { data } ) => {

	let prevTime = performance.now();
	function onProgressCallback( progress ) {

		// account for error
		progress = Math.min( progress, 1 );

		const currTime = performance.now();
		if ( currTime - prevTime >= 10 && progress !== 1.0 ) {

			postMessage( {

				error: null,
				serialized: null,
				position: null,
				progress,

			} );
			prevTime = currTime;

		}

	}

	const { index, position, options } = data;
	try {

		const geometry = new BufferGeometry();
		geometry.setAttribute( 'position', new BufferAttribute( position, 3, false ) );
		if ( index ) {

			geometry.setIndex( new BufferAttribute( index, 1, false ) );

		}

		if ( options.includedProgressCallback ) {

			options.onProgress = onProgressCallback;

		}

		if ( options.groups ) {

			const groups = options.groups;
			for ( const i in groups ) {

				const group = groups[ i ];
				geometry.addGroup( group.start, group.count, group.materialIndex );

			}

		}

		const bvh = new MeshBVH( geometry, options );
		const serialized = MeshBVH.serialize( bvh, { copyIndexBuffer: false } );
		let toTransfer = [ position.buffer, ...serialized.roots ];
		if ( serialized.index ) {

			toTransfer.push( serialized.index.buffer );

		}

		toTransfer = toTransfer.filter( v => ( typeof SharedArrayBuffer === 'undefined' ) || ! ( v instanceof SharedArrayBuffer ) );

		if ( bvh._indirectBuffer ) {

			toTransfer.push( serialized.indirectBuffer.buffer );

		}

		postMessage( {

			error: null,
			serialized,
			position,
			progress: 1,

		}, toTransfer );

	} catch ( error ) {

		postMessage( {

			error,
			serialized: null,
			position: null,
			progress: 1,

		} );

	}

};
