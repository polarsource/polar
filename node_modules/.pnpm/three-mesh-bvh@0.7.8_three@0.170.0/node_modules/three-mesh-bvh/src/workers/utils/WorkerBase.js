export class WorkerBase {

	constructor( worker ) {

		this.name = 'WorkerBase';
		this.running = false;
		this.worker = worker;
		this.worker.onerror = e => {

			if ( e.message ) {

				throw new Error( `${ this.name }: Could not create Web Worker with error "${ e.message }"` );

			} else {

				throw new Error( `${ this.name }: Could not create Web Worker.` );

			}

		};

	}

	runTask() {}

	generate( ...args ) {

		if ( this.running ) {

			throw new Error( 'GenerateMeshBVHWorker: Already running job.' );

		}

		if ( this.worker === null ) {

			throw new Error( 'GenerateMeshBVHWorker: Worker has been disposed.' );

		}

		this.running = true;

		const promise = this.runTask( this.worker, ...args );
		promise.finally( () => {

			this.running = false;

		} );

		return promise;

	}

	dispose() {

		this.worker.terminate();
		this.worker = null;

	}

}
