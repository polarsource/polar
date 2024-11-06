import { Box3, BufferAttribute } from 'three';
import { MeshBVH } from '../core/MeshBVH.js';
import { WorkerBase } from './utils/WorkerBase.js';

export class GenerateMeshBVHWorker extends WorkerBase {

	constructor() {

		const worker = new Worker( new URL( './generateMeshBVH.worker.js', import.meta.url ), { type: 'module' } );
		super( worker );
		this.name = 'GenerateMeshBVHWorker';

	}

	runTask( worker, geometry, options = {} ) {

		return new Promise( ( resolve, reject ) => {

			if (
				geometry.getAttribute( 'position' ).isInterleavedBufferAttribute ||
				geometry.index && geometry.index.isInterleavedBufferAttribute
			) {

				throw new Error( 'GenerateMeshBVHWorker: InterleavedBufferAttribute are not supported for the geometry attributes.' );

			}

			worker.onerror = e => {

				reject( new Error( `GenerateMeshBVHWorker: ${ e.message }` ) );

			};

			worker.onmessage = e => {

				const { data } = e;

				if ( data.error ) {

					reject( new Error( data.error ) );
					worker.onmessage = null;

				} else if ( data.serialized ) {

					const { serialized, position } = data;
					const bvh = MeshBVH.deserialize( serialized, geometry, { setIndex: false } );
					const boundsOptions = Object.assign( {

						setBoundingBox: true,

					}, options );

					// we need to replace the arrays because they're neutered entirely by the
					// webworker transfer.
					geometry.attributes.position.array = position;
					if ( serialized.index ) {

						if ( geometry.index ) {

							geometry.index.array = serialized.index;

						} else {

							const newIndex = new BufferAttribute( serialized.index, 1, false );
							geometry.setIndex( newIndex );

						}

					}

					if ( boundsOptions.setBoundingBox ) {

						geometry.boundingBox = bvh.getBoundingBox( new Box3() );

					}

					if ( options.onProgress ) {

						options.onProgress( data.progress );

					}

					resolve( bvh );
					worker.onmessage = null;

				} else if ( options.onProgress ) {

					options.onProgress( data.progress );

				}

			};

			const index = geometry.index ? geometry.index.array : null;
			const position = geometry.attributes.position.array;
			const transferable = [ position ];
			if ( index ) {

				transferable.push( index );

			}

			worker.postMessage( {

				index,
				position,
				options: {
					...options,
					onProgress: null,
					includedProgressCallback: Boolean( options.onProgress ),
					groups: [ ... geometry.groups ],
				},

			}, transferable.map( arr => arr.buffer ).filter( v => ( typeof SharedArrayBuffer === 'undefined' ) || ! ( v instanceof SharedArrayBuffer ) ) );

		} );

	}

}
