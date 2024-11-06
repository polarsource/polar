export class PrimitivePool {

	constructor( getNewPrimitive ) {

		this._getNewPrimitive = getNewPrimitive;
		this._primitives = [];

	}

	getPrimitive() {

		const primitives = this._primitives;
		if ( primitives.length === 0 ) {

			return this._getNewPrimitive();

		} else {

			return primitives.pop();

		}

	}

	releasePrimitive( primitive ) {

		this._primitives.push( primitive );

	}

}
