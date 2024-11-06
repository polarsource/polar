# three-mesh-bvh

[![npm version](https://img.shields.io/npm/v/three-mesh-bvh.svg?style=flat-square)](https://www.npmjs.com/package/three-mesh-bvh)
[![build](https://img.shields.io/github/actions/workflow/status/gkjohnson/three-mesh-bvh/node.js.yml?style=flat-square&label=build&branch=master)](https://github.com/gkjohnson/three-mesh-bvh/actions)
[![github](https://flat.badgen.net/badge/icon/github?icon=github&label)](https://github.com/gkjohnson/three-mesh-bvh/)
[![twitter](https://flat.badgen.net/badge/twitter/@garrettkjohnson/?icon&label)](https://twitter.com/garrettkjohnson)
[![sponsors](https://img.shields.io/github/sponsors/gkjohnson?style=flat-square&color=1da1f2)](https://github.com/sponsors/gkjohnson/)

A Bounding Volume Hierarchy (BVH) implementation to speed up raycasting and enable spatial queries against three.js meshes. See the associated [Wikipedia article](https://en.wikipedia.org/wiki/Bounding_volume_hierarchy) for more information on bounding volume hierarchies and how they work.

![screenshot](./docs/example-sm.gif)

Casting 500 rays against an 80,000 polygon model at 60fps!

# Examples

[Raycasting](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/raycast.html)

[Skinned geometry](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/skinnedMesh.html)

[Point cloud interesection](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/pointCloudIntersection.html)

[Shape intersection](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/shapecast.html)

[Geometry edge intersection](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/edgeIntersect.html)

[SDF generation](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/sdfGeneration.html)

[WebWorker generation](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/asyncGenerate.html)

[BVH options inspector](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/inspector.html)

[BatchedMesh Raycasting](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/batchedMesh.html)

**Tools**

[Sculpting](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/sculpt.html)

[Distance comparison](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/distancecast.html)

[Triangle painting](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/collectTriangles.html)

[Lasso selection](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/selection.html)

[Clipped edges](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/clippedEdges.html)

[Geometry voxelization](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/voxelize.html)

**Games**

[Sphere physics collision](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/physics.html)

[Player movement](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/characterMovement.html)

**Path Tracing**

[Simple GPU Path Tracing](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/gpuPathTracingSimple.html)

[Lambert GPU Path Tracing](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/gpuPathTracing.html)

[CPU Path Tracing](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/cpuPathTracing.html)

[Gem Refraction Path Tracing](https://gkjohnson.github.io/three-mesh-bvh/example/bundle/diamond.html)

**External Projects**

[three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer)

[three-bvh-csg](https://github.com/gkjohnson/three-bvh-csg)

[three-edge-projection](https://github.com/gkjohnson/three-edge-projection/)

# Use

Using pre-made functions

```js
import * as THREE from 'three';
import {
	computeBoundsTree, disposeBoundsTree,
	computeBatchedBoundsTree, disposeBatchedBoundsTree, acceleratedRaycast,
} from 'three-mesh-bvh';

// Add the extension functions
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

THREE.BatchedMesh.prototype.computeBoundsTree = computeBatchedBoundsTree;
THREE.BatchedMesh.prototype.disposeBoundsTree = disposeBatchedBoundsTree;
THREE.BatchedMesh.prototype.raycast = acceleratedRaycast;

// Generate geometry and associated BVH
const geom = new THREE.TorusKnotGeometry( 10, 3, 400, 100 );
const mesh = new THREE.Mesh( geom, material );
geom.computeBoundsTree();

// Or generate BatchedMesh and associated BVHs
const batchedMesh = new THREE.BatchedMesh( ... );
const geomId = batchedMesh.addGeometry( geom );
const instId = batchedMesh.addGeometry( geom );

// Generate bounds tree for sub geometry
batchedMesh.computeBoundsTree( geomId );
```

Or manually building the BVH

```js
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

// Add the raycast function. Assumes the BVH is available on
// the `boundsTree` variable
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// ...

// Generate the BVH and use the newly generated index
geom.boundsTree = new MeshBVH( geom );
```

And then raycasting

```js
// Setting "firstHitOnly" to true means the Mesh.raycast function will use the
// bvh "raycastFirst" function to return a result more quickly.
const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true;
raycaster.intersectObjects( [ mesh ] );
```

## Querying the BVH Directly

```js
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

let mesh, geometry;
const invMat = new THREE.Matrix4();

// instantiate the geometry

// ...

const bvh = new MeshBVH( geometry );
invMat.copy( mesh.matrixWorld ).invert();

// raycasting
// ensure the ray is in the local space of the geometry being cast against
raycaster.ray.applyMatrix4( invMat );
const hit = bvh.raycastFirst( raycaster.ray );

// results are returned in local spac, as well, so they must be transformed into
// world space if needed.
hit.point.applyMatrixWorld( mesh.matrixWorld );

// spherecasting
// ensure the sphere is in the local space of the geometry being cast against
sphere.applyMatrix4( invMat );
const intersects = bvh.intersectsSphere( sphere );
```

## With Skinned and Morph Target Meshes

```js
import { StaticGeometryGenerator } from 'three-mesh-bvh';

const generator = new StaticGeometryGenerator( [ ...skinnedMeshes ] );
const geometry = generator.generate();
geometry.computeBoundsTree();

// ...

// update the geometry in place
generator.generate( geometry );
geometry.boundsTree.refit();
```

## Serialization and Deserialization

```js
const geometry = new KnotGeometry( 1, 0.5, 40, 10 );
const bvh = new MeshBVH( geometry );
const serialized = MeshBVH.serialize( bvh );

// ...

const deserializedBVH = MeshBVH.deserialize( serialized, geometry );
geometry.boundsTree = deserializedBVH;
```

## Asynchronous Generation

_NOTE WebWorker syntax is inconsistently supported across bundlers and sometimes not supported at all so the GenerateMeshBVHWorker class is not exported from the package root. If needed the code from `src/worker` can be copied and modified to accommodate a particular build process._

```js
import { GenerateMeshBVHWorker } from 'three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js';

// ...

const geometry = new KnotGeometry( 1, 0.5, 40, 10 );
const worker = new GenerateMeshBVHWorker();
worker.generate( geometry ).then( bvh => {

    geometry.boundsTree = bvh;

} );
```

_Parallel BVH generation is also supported using "ParallelMeshBVHWorker", which requires support for SharedArrayBuffer. If SharedArrayBuffer is not available it falls back to "GenerateMeshBVHWorker". It is recommended that geometry passed to this function have `position` and `index` with SharedArrayBuffer arrays, otherwise buffer copies must be made._

```js
import { ParallelMeshBVHWorker } from 'three-mesh-bvh/src/workers/ParallelMeshBVHWorker.js';

// ...

const geometry = new KnotGeometry( 1, 0.5, 40, 10 );
const worker = new ParallelMeshBVHWorker();
worker.generate( geometry ).then( bvh => {

    geometry.boundsTree = bvh;

} );
```

## BVH Queries in a Shader

See the shader implementation in the [simple GPU Path Tracing example](https://github.com/gkjohnson/three-mesh-bvh/blob/master/example/gpuPathTracingSimple.js) for an example on how to perform BVH ray queries in a shader. Or the [GPU SDF Generation example](https://github.com/gkjohnson/three-mesh-bvh/blob/master/example/sdfGeneration.js) for how to perform distance and closest point to point queries in a shader.

# Exports

## Split Strategy Constants

#### CENTER

Option for splitting each BVH node down the center of the longest axis of the bounds.

This is the fastest construction option and will yield a good, performant bounds.

#### AVERAGE

Option for splitting each BVH node at the average point along the longest axis for all triangle centroids in the bounds.

This strategy may be better than `CENTER` with some geometry.

#### SAH

Option to use a Surface Area Heuristic to split the bounds more optimally. This SAH implementation tests 32 discrete splits in each node along each axis to determine which split is the lowest cost.

This is the slowest construction option but will yield the best bounds of the three options and use the least memory.

## Shapecast Intersection Constants

#### NOT_INTERSECTED

Indicates the shape did not intersect the given bounding box.

#### INTERSECTED

Indicates the shape did intersect the given bounding box.

#### CONTAINED

Indicate the shape entirely contains the given bounding box.

## MeshBVH

The MeshBVH generation process modifies the geometry's index bufferAttribute in place to save memory. The BVH construction will use the geometry's boundingBox if it exists or set it if it does not. The BVH will no longer work correctly if the index buffer is modified.

Note that all query functions expect arguments in local space of the BVH and return results in local space, as well. If world space results are needed they must be transformed into world space using `object.matrixWorld`.

### static .serialize

```js
static serialize( bvh : MeshBVH, options : Object = null ) : SerializedBVH
```

Generates a representation of the complete bounds tree and the geometry index buffer which can be used to recreate a bounds tree using the [deserialize](#static-deserialize) function. The `serialize` and `deserialize` functions can be used to generate a MeshBVH asynchronously in a background web worker to prevent the main thread from stuttering. The BVH roots buffer stored in the serialized representation are the same as the ones used by the original BVH so they should not be modified. If `SharedArrayBuffers` are used then the same BVH memory can be used for multiple BVH in multiple WebWorkers.

`bvh` is the MeshBVH to be serialized. The `options` object can have the following fields:

```js
{

	// if true then a clone of the `geometry.index.array` and MeshBVH buffers are made which slightly slower but
	// ensures modifications do not affect the serialized content. Can be set to "false" if it is guaranteed that
	// no modifications will be made, to save memory, or transfer and share them across WebWorkers if SharedArrayBuffers
	// are being used.
	cloneBuffers: true

}
```

### static .deserialize

```js
static deserialize( data : SerializedBVH, geometry : BufferGeometry, options : Object = null ) : MeshBVH
```

Returns a new MeshBVH instance from the serialized data. `geometry` is the geometry used to generate the original BVH `data` was derived from. The root buffers stored in `data` are set directly on the new BVH so the memory is shared.

The `options` object can have the following fields:

```js
{
	// If true then the buffer for the `geometry.index` attribute is set from the serialized
	// data attribute or created if an index does not exist.
	setIndex: true,

}
```

_NOTE: In order for the bounds tree to be used for casts the geometry index attribute must be replaced by the data in the SeralizedMeshBVH object._

### .constructor

```js
constructor( geometry : BufferGeometry, options : Object )
```

Constructs the bounds tree for the given geometry and produces a new index attribute buffer. A reference to the passed geometry is retained. The available options are

```js
{
    // Which split strategy to use when constructing the BVH.
    strategy: CENTER,

    // The maximum depth to allow the tree to build to.
    // Setting this to a smaller trades raycast speed for better construction
    // time and less memory allocation.
    maxDepth: 40,

    // The number of triangles to aim for in a leaf node. Setting this to a lower
    // number can improve raycast performance but increase construction time and
    // memory footprint.
    maxLeafTris: 10,

    // If true then the bounding box for the geometry is set once the BVH
    // has been constructed.
    setBoundingBox: true,

    // If true then the MeshBVH will use SharedArrayBuffer rather than ArrayBuffer when
    // initializing the BVH buffers. Geometry index data will be created as a
    // SharedArrayBuffer only if it needs to be created. Otherwise it is used as-is.
    useSharedArrayBuffer: false,

    // An optional function that takes a "progress" argument in the range [0, 1]
    // indicating the progress along BVH generation. Useful primarily when generating
    // the BVH asynchronously with the GenerateMeshBVHWorker class.
    onProgress: null,

    // If false then an index buffer is created if it does not exist and is rearranged
    // to hold the bvh structure. If false then a separate buffer is created to store the
    // structure and the index buffer (or lack thereof) is retained. This can be used
    // when the existing index layout is important or groups are being used so a
    // single BVH hierarchy can be created to improve performance.
    // Note: This setting is experimental.
    indirect: false,

    // Print out warnings encountered during tree construction.
    verbose: true,

    // If given, the MeshBVH will be computed for the given range on the geometry.
    // If not specified, geometry.drawRange is used.
    range: { start: number, count: number }

}
```

*NOTE: The geometry's index attribute array is modified in order to build the bounds tree unless `indirect` is set to `true`. If the geometry has no index then one is added if `indirect` is set to `false`.*

### .resolveTriangleIndex

```js
resolveTriangleIndex( index : Number ) : Number
```

Helper function for use when `indirect` is set to true. This function takes a triangle index in the BVH layout and returns the associated triangle index in the geometry index buffer or position attribute.

### .raycast

```js
raycast( ray : Ray, side : FrontSide | BackSide | DoubleSide = FrontSide, near : Number = 0, far : Number = Infinity ) : Array<RaycastHit>
```
```js
raycast( ray : Ray, material? : Array<Material> | Material, near : Number = 0, far : Number = Infinity ) : Array<RaycastHit>
```

Returns all raycast triangle hits in unsorted order. It is expected that `ray` is in the frame of the BVH already. Likewise the returned results are also provided in the local frame of the BVH. The `side` identifier is used to determine the side to check when raycasting or a material with the given side field can be passed. If an array of materials is provided then it is expected that the geometry has groups and the appropriate material side is used per group.

Note that unlike three.js' Raycaster results the points and distances in the intersections returned from this function are relative to the local frame of the MeshBVH. When using the [acceleratedRaycast](#acceleratedRaycast) function as an override for `Mesh.raycast` they are transformed into world space to be consistent with three's results.

### .raycastFirst

```js
raycastFirst( ray : Ray, side : FrontSide | BackSide | DoubleSide = FrontSide, near : Number = 0, far : Number = Infinity ) : RaycastHit
```
```js
raycastFirst( ray : Ray, material : Array<Material> | Material, near : Number = 0, far : Number = Infinity ) : RaycastHit
```

Returns the first raycast hit in the model. This is typically much faster than returning all hits. See [raycast](#raycast) for information on the side and material options as well as the frame of the returned intersections.

### .intersectsSphere

```js
intersectsSphere( sphere : Sphere ) : Boolean
```

Returns whether or not the mesh intersects the given sphere.

### .intersectsBox

```js
intersectsBox( box : Box3, boxToBvh : Matrix4 ) : Boolean
```

Returns whether or not the mesh intersects the given box.

The `boxToBvh` parameter is the transform of the box in the meshes frame.

### .intersectsGeometry

```js
intersectsGeometry( geometry : BufferGeometry, geometryToBvh : Matrix4 ) : Boolean
```

Returns whether or not the mesh intersects the given geometry.

The `geometryToBvh` parameter is the transform of the geometry in the BVH's local frame.

Performance improves considerably if the provided geometry _also_ has a `boundsTree`.

### .closestPointToPoint

```js
closestPointToPoint(
	point : Vector3,
	target : Object = {},
	minThreshold : Number = 0,
	maxThreshold : Number = Infinity
) : target
```

Computes the closest distance from the point to the mesh and gives additional information in `target`. The target can be left undefined to default to a new object which is ultimately returned by the function.

If a point is found that is closer than `minThreshold` then the function will return that result early. Any triangles or points outside of `maxThreshold` are ignored. If no point is found within the min / max thresholds then `null` is returned and the `target` object is not modified.

```js
target : {
	point : Vector3,
	distance : Number,
	faceIndex : Number
}
```

The returned faceIndex can be used with the standalone function [getTriangleHitPointInfo](#getTriangleHitPointInfo) to obtain more information like UV coordinates, triangle normal and materialIndex.

### .closestPointToGeometry

```js
closestPointToGeometry(
	geometry : BufferGeometry,
	geometryToBvh : Matrix4,
	target1 : Object = {},
	target2 : Object = {},
	minThreshold : Number = 0,
	maxThreshold : Number = Infinity
) : target1
```

Computes the closest distance from the geometry to the mesh and puts the closest point on the mesh in `target1` (in the frame of the BVH) and the closest point on the other geometry in `target2` (in the geometry frame). If `target1` is not provided a new Object is created and returned from the function.

The `geometryToBvh` parameter is the transform of the geometry in the BVH's local frame.

If a point is found that is closer than `minThreshold` then the function will return that result early. Any triangles or points outside of `maxThreshold` are ignored. If no point is found within the min / max thresholds then `null` is returned and the target objects are not modified.

`target1` and `target2` are optional objects that similar to the `target` parameter in [closestPointPoint](#closestPointToPoint) and set with the same fields as that function.

The returned in `target1` and `target2` can be used with the standalone function [getTriangleHitPointInfo](#getTriangleHitPointInfo) to obtain more information like UV coordinates, triangle normal and materialIndex.

_Note that this function can be very slow if `geometry` does not have a `geometry.boundsTree` computed._

### .shapecast

```js
shapecast(
	callbacks : {

		boundsTraverseOrder : (
			box: Box3
		) => Number = null,

		intersectsBounds : (
			box : Box3,
			isLeaf : Boolean,
			score : Number | undefined,
			depth : Number,
			nodeIndex : Number
		) => NOT_INTERSECTED | INTERSECTED | CONTAINED,

		intersectsRange : (
			triangleOffset : Number,
			triangleCount : Number
			contained : Boolean,
			depth : Number,
			nodeIndex : Number,
			box: Box3
		) => Boolean = null,

		intersectsTriangle : (
			triangle : ExtendedTriangle,
			triangleIndex : Number,
			contained : Boolean,
			depth : Number
		) => Boolean = null,

	}

) : Boolean
```

A generalized cast function that can be used to implement intersection logic for custom shapes. This is used internally for [intersectsBox](#intersectsBox), [intersectsSphere](#intersectsSphere), and more. The function returns as soon as a triangle has been reported as intersected and returns `true` if a triangle has been intersected. The bounds are traversed in depth first order calling `boundsTraverseOrder`, `intersectsBoundsFunc`, `intersectsRange`, and `intersectsTriangle` for each node and using the results to determine when to end traversal. The `depth` value passed to callbacks indicates the depth of the bounds the provided box or triangle range belongs to unless the triangles are indicated to be `CONTAINED`, in which case depth is the depth of the parent bounds that were contained. The depth field can be used to precompute, cache to an array, and then read information about a parent bound to improve performance while traversing because nodes are traversed in a dpeth first order. The `triangleIndex` parameter specifies the index of the triangle in the index buffer. The three vertex indices can be computed as `triangleIndex * 3 + 0`, `triangleIndex * 3 + 1`, `triangleIndex * 3 + 2`.

`boundsTraverseOrder` takes as an argument the axis aligned bounding box representing an internal node local to the BVH and returns a score (often distance) used to determine whether the left or right node should be traversed first. The shape with the lowest score is traversed first.

`intersectsBounds` takes the axis aligned bounding box representing an internal node local to the bvh, whether or not the node is a leaf, the score calculated by `boundsTraverseOrder`, the node depth, and the node index (for use with the [refit](#refit) function) and returns a constant indicating whether or not the bounds is intersected or contained meaning traversal should continue. If `CONTAINED` is returned (meaning the bounds is entirely encapsulated by the shape) then an optimization is triggered allowing the range and / or triangle intersection callbacks to be run immediately rather than traversing the rest of the child bounds.

`intersectsRange` takes a triangle offset and count representing the number of triangles to be iterated over. 1 triangle from this range represents 3 values in the geometry's index buffer. If this function returns true then traversal is stopped and `intersectsTriangle` is not called if provided.

*NOTE The triangle range provided in `intersectsRange` is for the indirect bvh storage buffer if the option has been set so it is necessary to transform to geometry triangle indices using `resolveTriangleIndex`.*

`intersectsTriangle` takes a triangle and the triangle index and returns whether or not the triangle has been intersected. If the triangle is reported to be intersected the traversal ends and the `shapecast` function completes. If multiple triangles need to be collected or intersected return false here and push results onto an array. `contained` is set to `true` if one of the parent bounds was marked as entirely contained (returned `CONTAINED`) in the `intersectsBoundsFunc` function.

### .refit

```js
refit( nodeIndices : Array<Number> | Set<Number> = null ) : void
```

Refit the node bounds to the current triangle positions. This is quicker than regenerating a new BVH but will not be optimal after significant changes to the vertices. `nodeIndices` is a set of node indices (provided by the [shapecast](#shapecast) function, see example snippet below) that need to be refit including all internal nodes. If one of a nodes children is also included in the set of node indices then only the included child bounds are traversed. If neither child index is included in the `nodeIndices` set, though, then it is assumed that every child below that node needs to be updated.

Here's how to get the set of indices that need to be refit:

```js
const nodeIndices = new Set();
bvh.shapecast(

	{

		intersectsBounds: ( box, isLeaf, score, depth, nodeIndex ) => {

			if ( /* intersects shape */ ) {

				nodeIndices.add( nodeIndex );
				return INTERSECTED;

			}

			return NOT_INTERSECTED;

		},

		intersectsRange: ( offset, count, contained, depth, nodeIndex ) => {

			/* collect triangles / vertices to move */

			// the nodeIndex here will have always already been added to the set in the
			// `intersectsBounds` callback.
			nodeIndices.add( nodeIndex );

		}

	}

);

/* update the positions of the triangle vertices */

// update the BVH bounds of just the bounds that need to be updated
bvh.refit( nodeIndices );
```

### .getBoundingBox

```js
getBoundingBox( target : Box3 ) : Box3
```

Get the bounding box of the geometry computed from the root node bounds of the BVH. Significantly faster than `BufferGeometry.computeBoundingBox`.

## SerializedBVH

### .roots

```js
roots : Array<ArrayBuffer>
```

### .index

```js
index : TypedArray
```

## MeshBVHHelper

_extends THREE.Group_

Displays a view of the bounds tree up to the given depth of the tree. Update() must be called after any fields that affect visualization geometry are changed.

_Note: The visualizer is expected to be a sibling of the mesh being visualized._

### .depth

```js
depth : Number
```

The depth to traverse and visualize the tree to.

### .color

```js
color = 0x00FF88 : THREE.Color
```

The color to render the bounding volume with.

### .opacity

```js
opacity = 0.3 : Number
```

The opacity to render the bounding volume with.

### .displayParents

```js
displayParents = false : Boolean
```

Whether or not to display the parent bounds.

### .displayEdges

```js
displayEdges = true : Boolean
```

If true displays the bounds as edges other displays the bounds as solid meshes.

### .objectIndex

```js
objectIndex = 0 : Number
```

When using an `InstancedMesh` or a `BatchedMesh` this refers to the item index to use for the BVH and / or matrix transformation to use.

### .edgeMaterial

```js
edgeMaterial : LineBasicMaterial
```

The material to use when rendering edges.

### .meshMaterial

```js
meshMaterial : MeshBasicMaterial
```

The material to use when rendering as a sold meshes.

### .constructor

```js
constructor(
	meshOrBvh: THREE.Mesh | MeshBVH,
	depth = 10 : Number
)

constructor(
	mesh = null : THREE.Mesh,
	bvh = null : MeshBVH,
	depth = 10 : Number
)
```

Instantiates the helper to visualize a MeshBVH.

If a `mesh` and no `bvh` is provided then the `mesh.geometry.boundsTree` is displayed. Otherwise the provided bvh is displayed. Addtionally, if `mesh` is provided then the helper world transform is automatically synchronized with the Mesh. Otherwise if not `mesh` is provided then the user can manage the transform.

### .update

```js
update() : void
```

Updates the display of the bounds tree in the case that the bounds tree has changed or the depth parameter has changed.

### .dispose

```js
dispose() : void
```

Disposes of the material used.

## ExtendedTriangle

_extends THREE.Triangle_

An extended version of three.js' Triangle class. A variety of derivative values are cached on the object to accelerate the intersection functions. `.needsUpdate` must be set to true when modifying the triangle parameters.

### .needsUpdate

```js
needsUpdate : Boolean
```

Indicates that the triangle fields have changed so cached variables to accelerate other function execution can be updated. Must be set to true after modifying the triangle `a`, `b`, `c` fields.

### .intersectsTriangle

```js
intersectsTriangle( other : Triangle, target? : Line3  ) : Boolean;
```

Returns whether the triangles intersect. `target` is set to the line segment representing the intersection.

### .intersectsSphere

```js
intersectsSphere( sphere : Sphere ) : Boolean
```

Returns whether the triangle intersects the given sphere.

### .closestPointToSegment

```js
closestPointToSegment( segment : Line3, target1? : Vector3, target2? : Vector3 ) : Number
```

Returns the distance to the provided line segment. `target1` and `target2` are set to the closest points on the triangle and segment respectively.

### .distanceToPoint

```js
distanceToPoint( point : Vector3 ) : Number
```

Returns the distance to the provided point.

### .distanceToTriangle

```js
distanceToTriangle( tri : Triangle ) : Number
```

Returns the distance to the provided triangle.

## OrientedBox

_extends THREE.Box3_

An oriented version of three.js' Box3 class. A variety of derivative values are cached on the object to accelerate the intersection functions. `.needsUpdate` must be set to true when modifying the box parameters.

### .matrix

```js
matrix : Matrix4
```

Matrix transformation applied to the box.

### .needsUpdate

```js
updateUpdate : Boolean
```

Indicates that the bounding box fields have changed so cached variables to accelerate other function execution can be updated. Must be set to true after modifying the oriented box `min`, `max`, `matrix` fields.

### .set

```js
set( min : Vector3, max : Vector3, matrix : Matrix4 ) : this
```

Sets the oriented box parameters.

### .intersectsBox

```js
intersectsBox( box : Box3 ) : Boolean
```

Returns true if intersecting with the provided box.

### .intersectsTriangle

```js
intersectsTriangle( tri : Triangle ) : Boolean
```

Returns true if intersecting with the provided triangle.

### .closestPointToPoint

```js
closestPointToPoint( point : Vector3, target = null : Vector3 ) : Number
```

Returns the distance to the provided point. Sets `target` to the closest point on the surface of the box if provided.


### .distanceToPoint

```js
distanceToPoint( point : Vector3 ) : Number
```

Returns the distance to the provided point.

### .distanceToBox

```js
distanceToBox( box : Box3, threshold = 0 : Number, target1 = null : Vector3, target2 = null : Vector3 ) : Number
```

Returns the distance to the provided box. `threshold` is an optional distance to return early if the distance is found to be within it. `target1` and `target2` are set to the points on the surface of this box and the `box` argument respectively.

## Extensions

### Raycaster.firstHitOnly

```js
firstHitOnly = false : Boolean
```

If the `Raycaster` member `firstHitOnly` is set to true then the [.acceleratedRaycast](#acceleratedRaycast) function will call the [.raycastFirst](#raycastFirst) function to retrieve hits which is generally faster.

### .computeBoundsTree

```js
computeBoundsTree( options? : Object ) : void
```

A pre-made BufferGeometry extension function that builds a new BVH, assigns it to `boundsTree` for BufferGeometry, and applies the new index buffer to the geometry. Comparable to `computeBoundingBox` and `computeBoundingSphere`.

```js
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
```

### .disposeBoundsTree

```js
disposeBoundsTree() : void
```

A BufferGeometry extension function that disposes of the BVH.

```js
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
```

### .computeBatchedBoundsTree

```js
computeBatchedBoundsTree( index = - 1 : Number, options? : Object ) : void
```

Equivalent of `computeBoundsTree` for BatchedMesh. Calling this generates a `BatchedMesh.boundsTrees` array if it doesn't exist and assigns the newly generated BVHs. If `index` is -1 then BVHs for all available geometry are generated. Otherwise only the BVH for the geometry at the given index is generated.

```js
THREE.BatchedMesh.prototype.computeBoundsTree = computeBatchedBoundsTree;
```

### .disposeBatchedBoundsTree

```js
disposeBatchedBoundsTree( index = - 1 : Number, options? : Object ) : void
```

Equivalent of `disposeBoundsTree` for BatchedMesh. Calling this sets entries in `BatchedMesh.boundsTrees` array to null. If `index` is -1 then BVHs are disposed. Otherwise only the BVH for the geometry at the given index is disposed.

```js
THREE.BatchedMesh.prototype.disposeBoundsTree = disposeBatchedBoundsTree;
```

### .acceleratedRaycast

```js
acceleratedRaycast( ... )
```

An accelerated raycast function with the same signature as `THREE.Mesh.raycast`. Uses the BVH for raycasting if it's available otherwise it falls back to the built-in approach. The results of the function are designed to be identical to the results of the conventional `THREE.Mesh.raycast` results.

If the raycaster object being used has a property `firstHitOnly` set to `true`, then the raycasting will terminate as soon as it finds the closest intersection to the ray's origin and return only that intersection. This is typically several times faster than searching for all intersections.

```js
THREE.Mesh.prototype.raycast = acceleratedRaycast;
```

## StaticGeometryGenerator

A utility class for taking a set of SkinnedMeshes or morph target geometry and baking it into a single, static geometry that a BVH can be generated for.

### .useGroups

```js
useGroups = true : Boolean
```

If true then groups are used to support an array of materials on the mesh.

### .attributes

```js
attributes = [ 'position', 'normal', 'tangent', 'uv', 'uv2' ] : Array<String>
```

The set of attributes to copy onto the static geometry.

### .applyWorldTransforms

```js
applyWorldTransforms = true : Boolean
```

Whether to transform the vertices of the geometry by the world transforms of each mesh when generating.

### constructor

```js
constructor( object : Array<Object3D> )
```

Takes an array of object hierarchies to bake into a single static geometry.

### .getMaterials

```js
getMaterials() : Array<Material>
```

Returns an array of materials for the meshes to be merged. These can be used alongside the generated geometry when creating a mesh: `new Mesh( geometry, generator.getMaterials() )`.

### .generate

```js
generate( target = new BufferGeometry() : BufferGeometry ) : BufferGeometry
```

Generates a single, static geometry for the passed meshes. When generating for the first time an empty target geometry is expected. The same generated geometry can be passed into the function on subsequent calls to update the geometry in place to save memory. An error will be thrown if the attributes or geometry on the meshes to bake has been changed and are incompatible lengths, types, etc.

On subsequent calls the "index" buffer will not be modified so any BVH generated for the geometry is unaffected. Once the geometry is updated the `MeshBVH.refit` function can be called to update the BVH.

## GenerateMeshBVHWorker

Helper class for generating a MeshBVH for a given geometry in asynchronously in a worker. The geometry position and index buffer attribute `ArrayBuffers` are transferred to the Worker while the BVH is being generated meaning the geometry will be unavailable to use while the BVH is being processed unless `SharedArrayBuffers` are used. They will be automatically replaced when the MeshBVH is finished generating.

_NOTE It's best to reuse a single instance of this class to avoid the overhead of instantiating a new Worker._

_See note in [Asyncronous Generation](#asynchronous-generation) use snippet._

### .running

```js
running : Boolean;
```

Flag indicating whether or not a BVH is already being generated in the worker.

### .generate

```js
generate( geometry : BufferGeometry, options : Object ) : Promise< MeshBVH >;
```

Generates a MeshBVH instance for the given geometry with the given options in a WebWorker. Returns a promise that resolves with the generated MeshBVH. This function will throw an error if it is already running.

### .dispose

```js
dispose() : void;
```

Terminates the worker.

## Debug Functions

### estimateMemoryInBytes

```js
estimateMemoryInBytes( bvh : MeshBVH ) : Number
```

Roughly estimates the amount of memory in bytes a BVH is using.

### getBVHExtremes

```js
getBVHExtremes( bvh : MeshBVH ) : Array< Object >
```

Measures the min and max extremes of the tree including node depth, leaf triangle count, and number of splits on different axes to show how well a tree is structured. Returns an array of extremes for each group root for the bvh. The objects are structured like so:

```js
{
	// The total number of nodes in the tree including leaf nodes.
	nodeCount: Number,

	// The total number of leaf nodes in the tree.
	leafNodeCount: Number,

	// A total tree score based on the surface area heuristic score
	// useful for comparing the quality and performance capability
	// of the bounds tree. Lower score is better and based on the surface
	// area of bounds and how many triangles are stored within.
	surfaceAreaScore: Number,

	// The min and max of leaf nodes in the tree.
	depth: { min: Number, max: Number },

	// The min and max number of triangles contained within the
	// bounds the leaf nodes.
	tris: { min: Number, max: Number },

	// The number of splits on any given axis.
	splits: [ Number, Number, Number ]
}
```

_NOTE The when using the [refit](#refit) function the `surfaceAreaScore` can be used to check how significantly the structure of the BVH has degraded and rebuild it if it has changed beyond some threshold ratio._

## Individual Functions

Functions exported individually not part of a class.

### getTriangleHitPointInfo

```js
getTriangleHitPointInfo(
	point: Vector3,
	geometry : BufferGeometry,
	triangleIndex: Number
	target: Object
) : Object
```

This function returns information of a point related to a geometry. It returns the `target` object or a new one if passed `undefined`:

```js
target : {
	face: {
		a: Number,
		b: Number,
		c: Number,
		materialIndex: Number,
		normal: Vector3
	},
	uv: Vector2
}
```

- `a`, `b`, `c`: Triangle indices
- `materialIndex`: Face material index or 0 if not available.
- `normal`: Face normal
- `uv`: UV coordinates.

This function can be used after a call to [closestPointPoint](#closestPointToPoint) or [closestPointToGeometry](#closestPointToGeometry) to retrieve more detailed result information.

# Shader and Texture Packing API

In addition to queries in Javascript the BVH can be packed into a series of textures so raycast queries can be performed in a shader using provided WebGL shader functions. See the shader implementation in the [simple GPU Path Tracing example](https://github.com/gkjohnson/three-mesh-bvh/blob/master/example/gpuPathTracingSimple.js) for an example on how to use the functionality.

## *VertexAttributeTexture

### FloatVertexAttributeTexture

### UIntVertexAttributeTexture

### IntVertexAttributeTexture

_extends THREE.DataTexture_

Float, Uint, and Int VertexAttributeTexture implementations are designed to simplify the efficient packing of a three.js BufferAttribute into a texture. An instance can be treated as a texture and when passing as a uniform to a shader they should be used as a `sampler2d`, `usampler2d`, and `isampler2d` when using the Float, Uint, and Int texture types respectively.

### .overrideItemSize

```js
overrideItemSize : Number = null
```

Treats `BufferAttribute.itemSize` as though it were set to this value when packing the buffer attribute texture. Throws an error if the value does not divide evenly into the length of the BufferAttribute buffer (`count * itemSize % overrideItemSize`).

Specifically used to pack geometry indices into an RGB texture rather than an Red texture.

### .updateFrom

```js
updateFrom( attribute : THREE.BufferAttribute ) : void
```

Updates the texture to have the data contained in the passed BufferAttribute using the BufferAttribute `itemSize` field, `normalized` field, and TypedArray layout to determine the appropriate texture layout, format, and type. The texture dimensions will always be square. Because these are intended to be sampled as 1D arrays the width of the texture msut be taken into account to derive a sampling uv. See `texelFetch1D` in [shaderFunctions](#shaderFunctions).

## MeshBVHUniformStruct

A shader uniform object corresponding to the `BVH` shader struct defined in [shaderStructs](#shaderStructs). The object contains four textures containing information about the BVH and geometry so it can be queried in a shader using the bvh intersection functions defined in [shaderFunctions](#shaderFunctions). This object is intended to be used as a shader uniform and read in the shader as a `BVH` struct.

### .updateFrom

```js
updateFrom( bvh : MeshBVH ) : void
```

Updates the object and associated textures with data from the provided BVH.

### .dispose

```js
dispose() : void
```

Dispose of the associated textures.

## Shader Function and Struct Exports

### shaderStructs

```js
shaderStructs : string
```

Set of shaders structs and defined constants used for interacting with the packed BVH in a shader. See [src/gpu/shaderFunctions.js](https://github.com/gkjohnson/three-mesh-bvh/blob/master/src/gpu/shaderFunctions.js) for full implementations and declarations.

### shaderFunctions

```js
shaderFunctions : string
```

Set of shader functions used for interacting with the packed BVH in a shader and sampling [VertexAttributeTextures](#VertexAttributeTexture). See [src/gpu/shaderFunctions.js](https://github.com/gkjohnson/three-mesh-bvh/blob/master/src/gpu/shaderFunctions.js) for full implementations and declarations.

## Gotchas

- When querying the MeshBVH directly all shapes and geometry are expected to be specified in the local frame of the BVH. When using three.js' built in raycasting system all results are implicitly transformed into world coordinates.
- A bounds tree can be generated for either an indexed or non-indexed `BufferGeometry`, but an index will
  be produced and retained as a side effect of the construction unless the "indirect" option is used.
- The bounds hierarchy is _not_ dynamic, so geometry that uses morph targets or skinning cannot be used. Though if vertex positions are modified directly the [refit](#refit) function can be used to adjust the bounds tree.
- If the geometry is changed then a new bounds tree will need to be generated or refit.
- [InterleavedBufferAttributes](https://threejs.org/docs/#api/en/core/InterleavedBufferAttribute) are not supported with the geometry index buffer attribute.
- A separate bounds tree is generated for each [geometry group](https://threejs.org/docs/#api/en/objects/Group), which could result in less than optimal raycast performance on geometry with lots of groups.
- Due to errors related to floating point precision it is recommended that geometry be centered using `BufferGeometry.center()` before creating the BVH if the geometry is sufficiently large or off center so bounds tightly contain the geometry as much as possible.

# Running Examples Locally

To run the examples locally:
- Run `npm start`
- Then visit `localhost:5173/<demo-name>.html`

Where `<demo-name>` is the name of the HTML file from `example` folder.


# Used and Supported by

<a href="https://www.threekit.com/" title="threekit"><img src="https://user-images.githubusercontent.com/734200/162633617-aad48fd1-931e-4e5e-8811-c29e799ee95a.png" width="20%"/></a><a href="https://matterport.com/" title="matterport"><img src="https://user-images.githubusercontent.com/734200/162633614-27f7f1e5-7f3c-4c55-99da-de0e7636dbcf.png" width="20%"/></a><a href="https://www.flux.ai/" title="flux"><img src="https://user-images.githubusercontent.com/734200/162633622-ed1e80b2-ee3b-4998-872c-a690d7b86eaf.png" width="20%"/></a><a href="https://www.resonai.com/" title="resonai"><img src="https://user-images.githubusercontent.com/734200/162694304-57be0ef3-a2d4-4af7-b3e0-6626cbef97a0.png" width="20%"/></a><a href="https://www.sitescape.ai/" title="sitescape"><img src="https://user-images.githubusercontent.com/734200/162633616-2649b441-dca8-490c-891f-f433aad24172.png" width="20%"/></a><a href="https://ifcjs.github.io/info/" title="ifc.js"><img src="https://user-images.githubusercontent.com/734200/162633613-1fa05098-0610-4e93-936a-ea12bcdc62e3.png" width="20%"/></a><a href="https://utsubo.co/" title="utsubo"><img src="https://user-images.githubusercontent.com/734200/162633619-fb6404c0-3a7d-40b2-8e9a-2014d904146c.png" width="20%"/></a><a href="https://github.com/phoenixbf/aton" title="aton"><img src="https://user-images.githubusercontent.com/734200/162633621-d0b49f47-5520-48da-a1fd-1d1fa88459a6.png" width="20%"/></a><a href="https://polygonjs.com/" title="polygonjs"><img src="https://user-images.githubusercontent.com/734200/162633615-b6d136e1-1580-4230-a3e9-2dfbcf8923d1.png" width="20%"/></a><a href="https://vartiste.xyz/" title="vartiste"><img src="https://user-images.githubusercontent.com/734200/162633620-e95f446f-af5d-4579-8ab5-2eeaf00b37ad.png" width="20%"/></a>

...and more!
