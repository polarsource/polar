/**
 * Copyright 2022 The MediaPipe Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/** Options to configure MediaPipe model loading and processing. */
declare interface BaseOptions_2 {
    /**
     * The model path to the model asset file. Only one of `modelAssetPath` or
     * `modelAssetBuffer` can be set.
     */
    modelAssetPath?: string | undefined;
    /**
     * A buffer containing the model aaset. Only one of `modelAssetPath` or
     * `modelAssetBuffer` can be set.
     */
    modelAssetBuffer?: Uint8Array | undefined;
    /** Overrides the default backend to use for the provided model. */
    delegate?: "CPU" | "GPU" | undefined;
}

/**
 * Copyright 2023 The MediaPipe Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/** An integer bounding box, axis aligned. */
export declare interface BoundingBox {
    /** The X coordinate of the top-left corner, in pixels. */
    originX: number;
    /** The Y coordinate of the top-left corner, in pixels. */
    originY: number;
    /** The width of the bounding box, in pixels. */
    width: number;
    /** The height of the bounding box, in pixels. */
    height: number;
    /**
     * Angle of rotation of the original non-rotated box around the top left
     * corner of the original non-rotated box, in clockwise degrees from the
     * horizontal.
     */
    angle: number;
}

/**
 * A user-defined callback to take input data and map it to a custom output
 * value.
 */
export declare type Callback<I, O> = (input: I) => O;

/**
 * Copyright 2022 The MediaPipe Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/** A classification category. */
export declare interface Category {
    /** The probability score of this label category. */
    score: number;
    /** The index of the category in the corresponding label file. */
    index: number;
    /**
     * The label of this category object. Defaults to an empty string if there is
     * no category.
     */
    categoryName: string;
    /**
     * The display name of the label, which may be translated for different
     * locales. For example, a label, "apple", may be translated into Spanish for
     * display purpose, so that the `display_name` is "manzana". Defaults to an
     * empty string if there is no display name.
     */
    displayName: string;
}

/**
 * A category to color mapping that uses either a map or an array to assign
 * category indexes to RGBA colors.
 */
export declare type CategoryToColorMap = Map<number, RGBAColor> | RGBAColor[];

/** Classification results for a given classifier head. */
export declare interface Classifications {
    /**
     * The array of predicted categories, usually sorted by descending scores,
     * e.g., from high to low probability.
     */
    categories: Category[];
    /**
     * The index of the classifier head these categories refer to. This is
     * useful for multi-head models.
     */
    headIndex: number;
    /**
     * The name of the classifier head, which is the corresponding tensor
     * metadata name. Defaults to an empty string if there is no such metadata.
     */
    headName: string;
}

/**
 * Copyright 2022 The MediaPipe Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/** Options to configure a MediaPipe Classifier Task. */
declare interface ClassifierOptions {
    /**
     * The locale to use for display names specified through the TFLite Model
     * Metadata, if any. Defaults to English.
     */
    displayNamesLocale?: string | undefined;
    /** The maximum number of top-scored detection results to return. */
    maxResults?: number | undefined;
    /**
     * Overrides the value provided in the model metadata. Results below this
     * value are rejected.
     */
    scoreThreshold?: number | undefined;
    /**
     * Allowlist of category names. If non-empty, detection results whose category
     * name is not in this set will be filtered out. Duplicate or unknown category
     * names are ignored. Mutually exclusive with `categoryDenylist`.
     */
    categoryAllowlist?: string[] | undefined;
    /**
     * Denylist of category names. If non-empty, detection results whose category
     * name is in this set will be filtered out. Duplicate or unknown category
     * names are ignored. Mutually exclusive with `categoryAllowlist`.
     */
    categoryDenylist?: string[] | undefined;
}

/** A connection between two landmarks. */
declare interface Connection {
    start: number;
    end: number;
}

/** A color map with 22 classes. Used in our demos. */
export declare const DEFAULT_CATEGORY_TO_COLOR_MAP: number[][];

/** Represents one detection by a detection task. */
export declare interface Detection {
    /** A list of `Category` objects. */
    categories: Category[];
    /** The bounding box of the detected objects. */
    boundingBox?: BoundingBox;
    /**
     * List of keypoints associated with the detection. Keypoints represent
     * interesting points related to the detection. For example, the keypoints
     * represent the eye, ear and mouth from face detection model. Or in the
     * template matching detection, e.g. KNIFT, they can represent the feature
     * points for template matching. Contains an empty list if no keypoints are
     * detected.
     */
    keypoints: NormalizedKeypoint[];
}

/** Detection results of a model. */
declare interface DetectionResult {
    /** A list of Detections. */
    detections: Detection[];
}
export { DetectionResult as FaceDetectorResult }
export { DetectionResult as ObjectDetectorResult }

/**
 * Options for customizing the drawing routines
 */
export declare interface DrawingOptions {
    /** The color that is used to draw the shape. Defaults to white. */
    color?: string | CanvasGradient | CanvasPattern | Callback<LandmarkData, string | CanvasGradient | CanvasPattern>;
    /**
     * The color that is used to fill the shape. Defaults to `.color` (or black
     * if color is not set).
     */
    fillColor?: string | CanvasGradient | CanvasPattern | Callback<LandmarkData, string | CanvasGradient | CanvasPattern>;
    /** The width of the line boundary of the shape. Defaults to 4. */
    lineWidth?: number | Callback<LandmarkData, number>;
    /** The radius of location marker. Defaults to 6. */
    radius?: number | Callback<LandmarkData, number>;
}

/** Helper class to visualize the result of a MediaPipe Vision task. */
export declare class DrawingUtils {
    /**
     * Creates a new DrawingUtils class.
     *
     * @param gpuContext The WebGL canvas rendering context to render into. If
     *     your Task is using a GPU delegate, the context must be obtained from
     * its canvas (provided via `setOptions({ canvas: .. })`).
     */
    constructor(gpuContext: WebGL2RenderingContext);
    /**
     * Creates a new DrawingUtils class.
     *
     * @param cpuContext The 2D canvas rendering context to render into. If
     *     you are rendering GPU data you must also provide `gpuContext` to allow
     *     for data conversion.
     * @param gpuContext A WebGL canvas that is used for GPU rendering and for
     *     converting GPU to CPU data. If your Task is using a GPU delegate, the
     *     context must be obtained from  its canvas (provided via
     *     `setOptions({ canvas: .. })`).
     */
    constructor(cpuContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, gpuContext?: WebGL2RenderingContext);
    /**
     * Restricts a number between two endpoints (order doesn't matter).
     *
     * @export
     * @param x The number to clamp.
     * @param x0 The first boundary.
     * @param x1 The second boundary.
     * @return The clamped value.
     */
    static clamp(x: number, x0: number, x1: number): number;
    /**
     * Linearly interpolates a value between two points, clamping that value to
     * the endpoints.
     *
     * @export
     * @param x The number to interpolate.
     * @param x0 The x coordinate of the start value.
     * @param x1 The x coordinate of the end value.
     * @param y0 The y coordinate of the start value.
     * @param y1 The y coordinate of the end value.
     * @return The interpolated value.
     */
    static lerp(x: number, x0: number, x1: number, y0: number, y1: number): number;
    /**
     * Draws circles onto the provided landmarks.
     *
     * This method can only be used when `DrawingUtils` is initialized with a
     * `CanvasRenderingContext2D`.
     *
     * @export
     * @param landmarks The landmarks to draw.
     * @param style The style to visualize the landmarks.
     */
    drawLandmarks(landmarks?: NormalizedLandmark[], style?: DrawingOptions): void;
    /**
     * Draws lines between landmarks (given a connection graph).
     *
     * This method can only be used when `DrawingUtils` is initialized with a
     * `CanvasRenderingContext2D`.
     *
     * @export
     * @param landmarks The landmarks to draw.
     * @param connections The connections array that contains the start and the
     *     end indices for the connections to draw.
     * @param style The style to visualize the landmarks.
     */
    drawConnectors(landmarks?: NormalizedLandmark[], connections?: Connection[], style?: DrawingOptions): void;
    /**
     * Draws a bounding box.
     *
     * This method can only be used when `DrawingUtils` is initialized with a
     * `CanvasRenderingContext2D`.
     *
     * @export
     * @param boundingBox The bounding box to draw.
     * @param style The style to visualize the boundin box.
     */
    drawBoundingBox(boundingBox: BoundingBox, style?: DrawingOptions): void;
    /**
     * Draws a category mask using the provided category-to-color mapping.
     *
     * @export
     * @param mask A category mask that was returned from a segmentation task.
     * @param categoryToColorMap A map that maps category indices to RGBA
     *     values. You must specify a map entry for each category.
     * @param background A color or image to use as the background. Defaults to
     *     black.
     */
    drawCategoryMask(mask: MPMask, categoryToColorMap: Map<number, RGBAColor>, background?: RGBAColor | ImageSource): void;
    /**
     * Draws a category mask using the provided color array.
     *
     * @export
     * @param mask A category mask that was returned from a segmentation task.
     * @param categoryToColorMap An array that maps indices to RGBA values. The
     *     array's indices must correspond to the category indices of the model
     *     and an entry must be provided for each category.
     * @param background A color or image to use as the background. Defaults to
     *     black.
     */
    drawCategoryMask(mask: MPMask, categoryToColorMap: RGBAColor[], background?: RGBAColor | ImageSource): void;
    /**
     * Frees all WebGL resources held by this class.
     * @export
     */
    close(): void;
}

/**
 * Copyright 2022 The MediaPipe Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/** Options to configure a MediaPipe Embedder Task */
declare interface EmbedderOptions {
    /**
     * Whether to normalize the returned feature vector with L2 norm. Use this
     * option only if the model does not already contain a native L2_NORMALIZATION
     * TF Lite Op. In most cases, this is already the case and L2 norm is thus
     * achieved through TF Lite inference.
     */
    l2Normalize?: boolean | undefined;
    /**
     * Whether the returned embedding should be quantized to bytes via scalar
     * quantization. Embeddings are implicitly assumed to be unit-norm and
     * therefore any dimension is guaranteed to have a value in [-1.0, 1.0]. Use
     * the l2_normalize option if this is not the case.
     */
    quantize?: boolean | undefined;
}

/**
 * Copyright 2022 The MediaPipe Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * List of embeddings with an optional timestamp.
 *
 * One and only one of the two 'floatEmbedding' and 'quantizedEmbedding' will
 * contain data, based on whether or not the embedder was configured to perform
 * scalar quantization.
 */
export declare interface Embedding {
    /**
     *  Floating-point embedding. Empty if the embedder was configured to perform
     * scalar-quantization.
     */
    floatEmbedding?: number[];
    /**
     * Scalar-quantized embedding. Empty if the embedder was not configured to
     * perform scalar quantization.
     */
    quantizedEmbedding?: Uint8Array;
    /**
     * The index of the classifier head these categories refer to. This is
     * useful for multi-head models.
     */
    headIndex: number;
    /**
     * The name of the classifier head, which is the corresponding tensor
     * metadata name.
     */
    headName: string;
}

/** Performs face detection on images. */
export declare class FaceDetector extends VisionTaskRunner {
    /**
     * Initializes the Wasm runtime and creates a new face detector from the
     * provided options.
     *
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param faceDetectorOptions The options for the FaceDetector. Note that
     *     either a path to the model asset or a model buffer needs to be
     *     provided (via `baseOptions`).
     */
    static createFromOptions(wasmFileset: WasmFileset, faceDetectorOptions: FaceDetectorOptions): Promise<FaceDetector>;
    /**
     * Initializes the Wasm runtime and creates a new face detector based on the
     * provided model asset buffer.
     *
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetBuffer A binary representation of the model.
     */
    static createFromModelBuffer(wasmFileset: WasmFileset, modelAssetBuffer: Uint8Array): Promise<FaceDetector>;
    /**
     * Initializes the Wasm runtime and creates a new face detector based on the
     * path to the model asset.
     *
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetPath The path to the model asset.
     */
    static createFromModelPath(wasmFileset: WasmFileset, modelAssetPath: string): Promise<FaceDetector>;
    private constructor();
    /**
     * Sets new options for the FaceDetector.
     *
     * Calling `setOptions()` with a subset of options only affects those options.
     * You can reset an option back to its default value by explicitly setting it
     * to `undefined`.
     *
     * @export
     * @param options The options for the FaceDetector.
     */
    setOptions(options: FaceDetectorOptions): Promise<void>;
    /**
     * Performs face detection on the provided single image and waits
     * synchronously for the response. Only use this method when the
     * FaceDetector is created with running mode `image`.
     *
     * @export
     * @param image An image to process.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return A result containing the list of detected faces.
     */
    detect(image: ImageSource, imageProcessingOptions?: ImageProcessingOptions): DetectionResult;
    /**
     * Performs face detection on the provided video frame and waits
     * synchronously for the response. Only use this method when the
     * FaceDetector is created with running mode `video`.
     *
     * @export
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return A result containing the list of detected faces.
     */
    detectForVideo(videoFrame: ImageSource, timestamp: number, imageProcessingOptions?: ImageProcessingOptions): DetectionResult;
}

/** Options to configure the MediaPipe Face Detector Task */
export declare interface FaceDetectorOptions extends VisionTaskOptions {
    /**
     * The minimum confidence score for the face detection to be considered
     * successful. Defaults to 0.5.
     */
    minDetectionConfidence?: number | undefined;
    /**
     * The minimum non-maximum-suppression threshold for face detection to be
     * considered overlapped. Defaults to 0.3.
     */
    minSuppressionThreshold?: number | undefined;
}

/**
 * Performs face landmarks detection on images.
 *
 * This API expects a pre-trained face landmarker model asset bundle.
 */
export declare class FaceLandmarker extends VisionTaskRunner {
    /**
     * Initializes the Wasm runtime and creates a new `FaceLandmarker` from the
     * provided options.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param faceLandmarkerOptions The options for the FaceLandmarker.
     *     Note that either a path to the model asset or a model buffer needs to
     *     be provided (via `baseOptions`).
     */
    static createFromOptions(wasmFileset: WasmFileset, faceLandmarkerOptions: FaceLandmarkerOptions): Promise<FaceLandmarker>;
    /**
     * Initializes the Wasm runtime and creates a new `FaceLandmarker` based on
     * the provided model asset buffer.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetBuffer A binary representation of the model.
     */
    static createFromModelBuffer(wasmFileset: WasmFileset, modelAssetBuffer: Uint8Array): Promise<FaceLandmarker>;
    /**
     * Initializes the Wasm runtime and creates a new `FaceLandmarker` based on
     * the path to the model asset.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetPath The path to the model asset.
     */
    static createFromModelPath(wasmFileset: WasmFileset, modelAssetPath: string): Promise<FaceLandmarker>;
    /**
     * Landmark connections to draw the connection between a face's lips.
     * @export
     * @nocollapse
     */
    static FACE_LANDMARKS_LIPS: Connection[];
    /**
     * Landmark connections to draw the connection between a face's left eye.
     * @export
     * @nocollapse
     */
    static FACE_LANDMARKS_LEFT_EYE: Connection[];
    /**
     * Landmark connections to draw the connection between a face's left eyebrow.
     * @export
     * @nocollapse
     */
    static FACE_LANDMARKS_LEFT_EYEBROW: Connection[];
    /**
     * Landmark connections to draw the connection between a face's left iris.
     * @export
     * @nocollapse
     */
    static FACE_LANDMARKS_LEFT_IRIS: Connection[];
    /**
     * Landmark connections to draw the connection between a face's right eye.
     * @export
     * @nocollapse
     */
    static FACE_LANDMARKS_RIGHT_EYE: Connection[];
    /**
     * Landmark connections to draw the connection between a face's right
     * eyebrow.
     * @export
     * @nocollapse
     */
    static FACE_LANDMARKS_RIGHT_EYEBROW: Connection[];
    /**
     * Landmark connections to draw the connection between a face's right iris.
     * @export
     * @nocollapse
     */
    static FACE_LANDMARKS_RIGHT_IRIS: Connection[];
    /**
     * Landmark connections to draw the face's oval.
     * @export
     * @nocollapse
     */
    static FACE_LANDMARKS_FACE_OVAL: Connection[];
    /**
     * Landmark connections to draw the face's contour.
     * @export
     * @nocollapse
     */
    static FACE_LANDMARKS_CONTOURS: Connection[];
    /**
     * Landmark connections to draw the face's tesselation.
     * @export
     * @nocollapse
     */
    static FACE_LANDMARKS_TESSELATION: Connection[];
    private constructor();
    /**
     * Sets new options for this `FaceLandmarker`.
     *
     * Calling `setOptions()` with a subset of options only affects those options.
     * You can reset an option back to its default value by explicitly setting it
     * to `undefined`.
     *
     * @export
     * @param options The options for the face landmarker.
     */
    setOptions(options: FaceLandmarkerOptions): Promise<void>;
    /**
     * Performs face landmarks detection on the provided single image and waits
     * synchronously for the response. Only use this method when the
     * FaceLandmarker is created with running mode `image`.
     *
     * @export
     * @param image An image to process.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The detected face landmarks.
     */
    detect(image: ImageSource, imageProcessingOptions?: ImageProcessingOptions): FaceLandmarkerResult;
    /**
     * Performs face landmarks detection on the provided video frame and waits
     * synchronously for the response. Only use this method when the
     * FaceLandmarker is created with running mode `video`.
     *
     * @export
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The detected face landmarks.
     */
    detectForVideo(videoFrame: ImageSource, timestamp: number, imageProcessingOptions?: ImageProcessingOptions): FaceLandmarkerResult;
}

/** Options to configure the MediaPipe FaceLandmarker Task */
export declare interface FaceLandmarkerOptions extends VisionTaskOptions {
    /**
     * The maximum number of faces can be detected by the FaceLandmarker.
     * Defaults to 1.
     */
    numFaces?: number | undefined;
    /**
     * The minimum confidence score for the face detection to be considered
     * successful. Defaults to 0.5.
     */
    minFaceDetectionConfidence?: number | undefined;
    /**
     * The minimum confidence score of face presence score in the face landmark
     * detection. Defaults to 0.5.
     */
    minFacePresenceConfidence?: number | undefined;
    /**
     * The minimum confidence score for the face tracking to be considered
     * successful. Defaults to 0.5.
     */
    minTrackingConfidence?: number | undefined;
    /**
     * Whether FaceLandmarker outputs face blendshapes classification. Face
     * blendshapes are used for rendering the 3D face model.
     */
    outputFaceBlendshapes?: boolean | undefined;
    /**
     * Whether FaceLandmarker outputs facial transformation_matrix. Facial
     * transformation matrix is used to transform the face landmarks in canonical
     * face to the detected face, so that users can apply face effects on the
     * detected landmarks.
     */
    outputFacialTransformationMatrixes?: boolean | undefined;
}

/**
 * Represents the face landmarks deection results generated by `FaceLandmarker`.
 */
export declare interface FaceLandmarkerResult {
    /** Detected face landmarks in normalized image coordinates. */
    faceLandmarks: NormalizedLandmark[][];
    /** Optional face blendshapes results. */
    faceBlendshapes: Classifications[];
    /** Optional facial transformation matrix. */
    facialTransformationMatrixes: Matrix[];
}

/** Performs face stylization on images. */
export declare class FaceStylizer extends VisionTaskRunner {
    /**
     * Initializes the Wasm runtime and creates a new Face Stylizer from the
     * provided options.
     * @export
     * @param wasmFileset A configuration object that provides the location of
     *     the Wasm binary and its loader.
     * @param faceStylizerOptions The options for the Face Stylizer. Note
     *     that either a path to the model asset or a model buffer needs to be
     *     provided (via `baseOptions`).
     */
    static createFromOptions(wasmFileset: WasmFileset, faceStylizerOptions: FaceStylizerOptions): Promise<FaceStylizer>;
    /**
     * Initializes the Wasm runtime and creates a new Face Stylizer based on
     * the provided model asset buffer.
     * @export
     * @param wasmFileset A configuration object that provides the location of
     *     the Wasm binary and its loader.
     * @param modelAssetBuffer A binary representation of the model.
     */
    static createFromModelBuffer(wasmFileset: WasmFileset, modelAssetBuffer: Uint8Array): Promise<FaceStylizer>;
    /**
     * Initializes the Wasm runtime and creates a new Face Stylizer based on
     * the path to the model asset.
     * @export
     * @param wasmFileset A configuration object that provides the location of
     *     the Wasm binary and its loader.
     * @param modelAssetPath The path to the model asset.
     */
    static createFromModelPath(wasmFileset: WasmFileset, modelAssetPath: string): Promise<FaceStylizer>;
    private constructor();
    /**
     * Sets new options for the Face Stylizer.
     *
     * Calling `setOptions()` with a subset of options only affects those
     * options. You can reset an option back to its default value by
     * explicitly setting it to `undefined`.
     *
     * @export
     * @param options The options for the Face Stylizer.
     */
    setOptions(options: FaceStylizerOptions): Promise<void>;
    /**
     * Performs face stylization on the provided single image and invokes the
     * callback with result. The method returns synchronously once the callback
     * returns. Only use this method when the FaceStylizer is created with the
     * image running mode.
     *
     * @param image An image to process.
     * @param callback The callback that is invoked with the stylized image or
     *    `null` if no face was detected. The lifetime of the returned data is
     *     only guaranteed for the duration of the callback.
     */
    stylize(image: ImageSource, callback: FaceStylizerCallback): void;
    /**
     * Performs face stylization on the provided single image and invokes the
     * callback with result. The method returns synchronously once the callback
     * returns. Only use this method when the FaceStylizer is created with the
     * image running mode.
     *
     * The 'imageProcessingOptions' parameter can be used to specify one or all
     * of:
     *  - the rotation to apply to the image before performing stylization, by
     *    setting its 'rotationDegrees' property.
     *  - the region-of-interest on which to perform stylization, by setting its
     *   'regionOfInterest' property. If not specified, the full image is used.
     *  If both are specified, the crop around the region-of-interest is extracted
     *  first, then the specified rotation is applied to the crop.
     *
     * @param image An image to process.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @param callback The callback that is invoked with the stylized image or
     *    `null` if no face was detected. The lifetime of the returned data is
     *    only guaranteed for the duration of the callback.
     */
    stylize(image: ImageSource, imageProcessingOptions: ImageProcessingOptions, callback: FaceStylizerCallback): void;
    /**
     * Performs face stylization on the provided single image and returns the
     * result. This method creates a copy of the resulting image and should not be
     * used in high-throughput applications. Only use this method when the
     * FaceStylizer is created with the image running mode.
     *
     * @param image An image to process.
     * @return A stylized face or `null` if no face was detected. The result is
     *     copied to avoid lifetime issues.
     */
    stylize(image: ImageSource): MPImage | null;
    /**
     * Performs face stylization on the provided single image and returns the
     * result. This method creates a copy of the resulting image and should not be
     * used in high-throughput applications. Only use this method when the
     * FaceStylizer is created with the image running mode.
     *
     * The 'imageProcessingOptions' parameter can be used to specify one or all
     * of:
     *  - the rotation to apply to the image before performing stylization, by
     *    setting its 'rotationDegrees' property.
     *  - the region-of-interest on which to perform stylization, by setting its
     *   'regionOfInterest' property. If not specified, the full image is used.
     *  If both are specified, the crop around the region-of-interest is extracted
     *  first, then the specified rotation is applied to the crop.
     *
     * @param image An image to process.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return A stylized face or `null` if no face was detected. The result is
     *     copied to avoid lifetime issues.
     */
    stylize(image: ImageSource, imageProcessingOptions: ImageProcessingOptions): MPImage | null;
}

/**
 * A callback that receives an `MPImage` object from the face stylizer, or
 * `null` if no face was detected. The lifetime of the underlying data is
 * limited to the duration of the callback. If asynchronous processing is
 * needed, all data needs to be copied before the callback returns (via
 * `image.clone()`).
 */
export declare type FaceStylizerCallback = (image: MPImage | null) => void;

/** Options to configure the MediaPipe Face Stylizer Task */
export declare interface FaceStylizerOptions extends VisionTaskOptions {
}

/**
 * Resolves the files required for the MediaPipe Task APIs.
 *
 * This class verifies whether SIMD is supported in the current environment and
 * loads the SIMD files only if support is detected. The returned filesets
 * require that the Wasm files are published without renaming. If this is not
 * possible, you can invoke the MediaPipe Tasks APIs using a manually created
 * `WasmFileset`.
 */
export declare class FilesetResolver {
    /**
     * Returns whether SIMD is supported in the current environment.
     *
     * If your environment requires custom locations for the MediaPipe Wasm files,
     * you can use `isSimdSupported()` to decide whether to load the SIMD-based
     * assets.
     *
     * @export
     * @return Whether SIMD support was detected in the current environment.
     */
    static isSimdSupported(): Promise<boolean>;
    /**
     * Creates a fileset for the MediaPipe Audio tasks.
     *
     * @export
     * @param basePath An optional base path to specify the directory the Wasm
     *    files should be loaded from. If not specified, the Wasm files are
     *    loaded from the host's root directory.
     * @return A `WasmFileset` that can be used to initialize MediaPipe Audio
     *    tasks.
     */
    static forAudioTasks(basePath?: string): Promise<WasmFileset>;
    /**
     * Creates a fileset for the MediaPipe Text tasks.
     *
     * @export
     * @param basePath An optional base path to specify the directory the Wasm
     *    files should be loaded from. If not specified, the Wasm files are
     *    loaded from the host's root directory.
     * @return A `WasmFileset` that can be used to initialize MediaPipe Text
     *    tasks.
     */
    static forTextTasks(basePath?: string): Promise<WasmFileset>;
    /**
     * Creates a fileset for the MediaPipe Vision tasks.
     *
     * @export
     * @param basePath An optional base path to specify the directory the Wasm
     *    files should be loaded from. If not specified, the Wasm files are
     *    loaded from the host's root directory.
     * @return A `WasmFileset` that can be used to initialize MediaPipe Vision
     *    tasks.
     */
    static forVisionTasks(basePath?: string): Promise<WasmFileset>;
}

/** Performs hand gesture recognition on images. */
export declare class GestureRecognizer extends VisionTaskRunner {
    /**
     * An array containing the pairs of hand landmark indices to be rendered with
     * connections.
     * @export
     * @nocollapse
     */
    static HAND_CONNECTIONS: Connection[];
    /**
     * Initializes the Wasm runtime and creates a new gesture recognizer from the
     * provided options.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param gestureRecognizerOptions The options for the gesture recognizer.
     *     Note that either a path to the model asset or a model buffer needs to
     *     be provided (via `baseOptions`).
     */
    static createFromOptions(wasmFileset: WasmFileset, gestureRecognizerOptions: GestureRecognizerOptions): Promise<GestureRecognizer>;
    /**
     * Initializes the Wasm runtime and creates a new gesture recognizer based on
     * the provided model asset buffer.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetBuffer A binary representation of the model.
     */
    static createFromModelBuffer(wasmFileset: WasmFileset, modelAssetBuffer: Uint8Array): Promise<GestureRecognizer>;
    /**
     * Initializes the Wasm runtime and creates a new gesture recognizer based on
     * the path to the model asset.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetPath The path to the model asset.
     */
    static createFromModelPath(wasmFileset: WasmFileset, modelAssetPath: string): Promise<GestureRecognizer>;
    private constructor();
    /**
     * Sets new options for the gesture recognizer.
     *
     * Calling `setOptions()` with a subset of options only affects those options.
     * You can reset an option back to its default value by explicitly setting it
     * to `undefined`.
     *
     * @export
     * @param options The options for the gesture recognizer.
     */
    setOptions(options: GestureRecognizerOptions): Promise<void>;
    /**
     * Performs gesture recognition on the provided single image and waits
     * synchronously for the response. Only use this method when the
     * GestureRecognizer is created with running mode `image`.
     *
     * @export
     * @param image A single image to process.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The detected gestures.
     */
    recognize(image: ImageSource, imageProcessingOptions?: ImageProcessingOptions): GestureRecognizerResult;
    /**
     * Performs gesture recognition on the provided video frame and waits
     * synchronously for the response. Only use this method when the
     * GestureRecognizer is created with running mode `video`.
     *
     * @export
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The detected gestures.
     */
    recognizeForVideo(videoFrame: ImageSource, timestamp: number, imageProcessingOptions?: ImageProcessingOptions): GestureRecognizerResult;
}

/** Options to configure the MediaPipe Gesture Recognizer Task */
export declare interface GestureRecognizerOptions extends VisionTaskOptions {
    /**
     * The maximum number of hands can be detected by the GestureRecognizer.
     * Defaults to 1.
     */
    numHands?: number | undefined;
    /**
     * The minimum confidence score for the hand detection to be considered
     * successful. Defaults to 0.5.
     */
    minHandDetectionConfidence?: number | undefined;
    /**
     * The minimum confidence score of hand presence score in the hand landmark
     * detection. Defaults to 0.5.
     */
    minHandPresenceConfidence?: number | undefined;
    /**
     * The minimum confidence score for the hand tracking to be considered
     * successful. Defaults to 0.5.
     */
    minTrackingConfidence?: number | undefined;
    /**
     * Sets the optional `ClassifierOptions` controlling the canned gestures
     * classifier, such as score threshold, allow list and deny list of gestures.
     * The categories for canned gesture
     * classifiers are: ["None", "Closed_Fist", "Open_Palm", "Pointing_Up",
     * "Thumb_Down", "Thumb_Up", "Victory", "ILoveYou"]
     */
    cannedGesturesClassifierOptions?: ClassifierOptions | undefined;
    /**
     * Options for configuring the custom gestures classifier, such as score
     * threshold, allow list and deny list of gestures.
     */
    customGesturesClassifierOptions?: ClassifierOptions | undefined;
}

/**
 * Represents the gesture recognition results generated by `GestureRecognizer`.
 */
export declare interface GestureRecognizerResult {
    /** Hand landmarks of detected hands. */
    landmarks: NormalizedLandmark[][];
    /** Hand landmarks in world coordinates of detected hands. */
    worldLandmarks: Landmark[][];
    /** Handedness of detected hands. */
    handedness: Category[][];
    /**
     * Handedness of detected hands.
     * @deprecated Use `.handedness` instead.
     */
    handednesses: Category[][];
    /**
     * Recognized hand gestures of detected hands. Note that the index of the
     * gesture is always -1, because the raw indices from multiple gesture
     * classifiers cannot consolidate to a meaningful index.
     */
    gestures: Category[][];
}

/** Performs hand landmarks detection on images. */
export declare class HandLandmarker extends VisionTaskRunner {
    /**
     * An array containing the pairs of hand landmark indices to be rendered with
     * connections.
     * @export
     * @nocollapse
     */
    static HAND_CONNECTIONS: Connection[];
    /**
     * Initializes the Wasm runtime and creates a new `HandLandmarker` from the
     * provided options.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param handLandmarkerOptions The options for the HandLandmarker.
     *     Note that either a path to the model asset or a model buffer needs to
     *     be provided (via `baseOptions`).
     */
    static createFromOptions(wasmFileset: WasmFileset, handLandmarkerOptions: HandLandmarkerOptions): Promise<HandLandmarker>;
    /**
     * Initializes the Wasm runtime and creates a new `HandLandmarker` based on
     * the provided model asset buffer.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetBuffer A binary representation of the model.
     */
    static createFromModelBuffer(wasmFileset: WasmFileset, modelAssetBuffer: Uint8Array): Promise<HandLandmarker>;
    /**
     * Initializes the Wasm runtime and creates a new `HandLandmarker` based on
     * the path to the model asset.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetPath The path to the model asset.
     */
    static createFromModelPath(wasmFileset: WasmFileset, modelAssetPath: string): Promise<HandLandmarker>;
    private constructor();
    /**
     * Sets new options for this `HandLandmarker`.
     *
     * Calling `setOptions()` with a subset of options only affects those options.
     * You can reset an option back to its default value by explicitly setting it
     * to `undefined`.
     *
     * @export
     * @param options The options for the hand landmarker.
     */
    setOptions(options: HandLandmarkerOptions): Promise<void>;
    /**
     * Performs hand landmarks detection on the provided single image and waits
     * synchronously for the response. Only use this method when the
     * HandLandmarker is created with running mode `image`.
     *
     * @export
     * @param image An image to process.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The detected hand landmarks.
     */
    detect(image: ImageSource, imageProcessingOptions?: ImageProcessingOptions): HandLandmarkerResult;
    /**
     * Performs hand landmarks detection on the provided video frame and waits
     * synchronously for the response. Only use this method when the
     * HandLandmarker is created with running mode `video`.
     *
     * @export
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The detected hand landmarks.
     */
    detectForVideo(videoFrame: ImageSource, timestamp: number, imageProcessingOptions?: ImageProcessingOptions): HandLandmarkerResult;
}

/** Options to configure the MediaPipe HandLandmarker Task */
export declare interface HandLandmarkerOptions extends VisionTaskOptions {
    /**
     * The maximum number of hands can be detected by the HandLandmarker.
     * Defaults to 1.
     */
    numHands?: number | undefined;
    /**
     * The minimum confidence score for the hand detection to be considered
     * successful. Defaults to 0.5.
     */
    minHandDetectionConfidence?: number | undefined;
    /**
     * The minimum confidence score of hand presence score in the hand landmark
     * detection. Defaults to 0.5.
     */
    minHandPresenceConfidence?: number | undefined;
    /**
     * The minimum confidence score for the hand tracking to be considered
     * successful. Defaults to 0.5.
     */
    minTrackingConfidence?: number | undefined;
}

/**
 * Represents the hand landmarks deection results generated by `HandLandmarker`.
 */
export declare interface HandLandmarkerResult {
    /** Hand landmarks of detected hands. */
    landmarks: NormalizedLandmark[][];
    /** Hand landmarks in world coordinates of detected hands. */
    worldLandmarks: Landmark[][];
    /**
     * Handedness of detected hands.
     * @deprecated Use `.handedness` instead.
     */
    handednesses: Category[][];
    /** Handedness of detected hands. */
    handedness: Category[][];
}

/** Performs classification on images. */
export declare class ImageClassifier extends VisionTaskRunner {
    /**
     * Initializes the Wasm runtime and creates a new image classifier from the
     * provided options.
     * @export
     * @param wasmFileset A configuration object that provides the location
     *     Wasm binary and its loader.
     * @param imageClassifierOptions The options for the image classifier. Note
     *     that either a path to the model asset or a model buffer needs to be
     *     provided (via `baseOptions`).
     */
    static createFromOptions(wasmFileset: WasmFileset, imageClassifierOptions: ImageClassifierOptions): Promise<ImageClassifier>;
    /**
     * Initializes the Wasm runtime and creates a new image classifier based on
     * the provided model asset buffer.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetBuffer A binary representation of the model.
     */
    static createFromModelBuffer(wasmFileset: WasmFileset, modelAssetBuffer: Uint8Array): Promise<ImageClassifier>;
    /**
     * Initializes the Wasm runtime and creates a new image classifier based on
     * the path to the model asset.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetPath The path to the model asset.
     */
    static createFromModelPath(wasmFileset: WasmFileset, modelAssetPath: string): Promise<ImageClassifier>;
    private constructor();
    /**
     * Sets new options for the image classifier.
     *
     * Calling `setOptions()` with a subset of options only affects those options.
     * You can reset an option back to its default value by explicitly setting it
     * to `undefined`.
     *
     * @export
     * @param options The options for the image classifier.
     */
    setOptions(options: ImageClassifierOptions): Promise<void>;
    /**
     * Performs image classification on the provided single image and waits
     * synchronously for the response. Only use this method when the
     * ImageClassifier is created with running mode `image`.
     *
     * @export
     * @param image An image to process.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The classification result of the image
     */
    classify(image: ImageSource, imageProcessingOptions?: ImageProcessingOptions): ImageClassifierResult;
    /**
     * Performs image classification on the provided video frame and waits
     * synchronously for the response. Only use this method when the
     * ImageClassifier is created with running mode `video`.
     *
     * @export
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The classification result of the image
     */
    classifyForVideo(videoFrame: ImageSource, timestamp: number, imageProcessingOptions?: ImageProcessingOptions): ImageClassifierResult;
}

/** Options to configure the MediaPipe Image Classifier Task. */
export declare interface ImageClassifierOptions extends ClassifierOptions, VisionTaskOptions {
}

/** Classification results of a model. */
export declare interface ImageClassifierResult {
    /** The classification results for each head of the model. */
    classifications: Classifications[];
    /**
     * The optional timestamp (in milliseconds) of the start of the chunk of data
     * corresponding to these results.
     *
     * This is only used for classification on time series (e.g. audio
     * classification). In these use cases, the amount of data to process might
     * exceed the maximum size that the model can process: to solve this, the
     * input data is split into multiple chunks starting at different timestamps.
     */
    timestampMs?: number;
}

/** Performs embedding extraction on images. */
export declare class ImageEmbedder extends VisionTaskRunner {
    /**
     * Initializes the Wasm runtime and creates a new image embedder from the
     * provided options.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param imageEmbedderOptions The options for the image embedder. Note that
     *     either a path to the TFLite model or the model itself needs to be
     *     provided (via `baseOptions`).
     */
    static createFromOptions(wasmFileset: WasmFileset, imageEmbedderOptions: ImageEmbedderOptions): Promise<ImageEmbedder>;
    /**
     * Initializes the Wasm runtime and creates a new image embedder based on the
     * provided model asset buffer.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetBuffer A binary representation of the TFLite model.
     */
    static createFromModelBuffer(wasmFileset: WasmFileset, modelAssetBuffer: Uint8Array): Promise<ImageEmbedder>;
    /**
     * Initializes the Wasm runtime and creates a new image embedder based on the
     * path to the model asset.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetPath The path to the TFLite model.
     */
    static createFromModelPath(wasmFileset: WasmFileset, modelAssetPath: string): Promise<ImageEmbedder>;
    private constructor();
    /**
     * Sets new options for the image embedder.
     *
     * Calling `setOptions()` with a subset of options only affects those options.
     * You can reset an option back to its default value by explicitly setting it
     * to `undefined`.
     *
     * @export
     * @param options The options for the image embedder.
     */
    setOptions(options: ImageEmbedderOptions): Promise<void>;
    /**
     * Performs embedding extraction on the provided single image and waits
     * synchronously for the response. Only use this method when the
     * ImageEmbedder is created with running mode `image`.
     *
     * @export
     * @param image The image to process.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The classification result of the image
     */
    embed(image: ImageSource, imageProcessingOptions?: ImageProcessingOptions): ImageEmbedderResult;
    /**
     * Performs embedding extraction on the provided video frame and waits
     * synchronously for the response. Only use this method when the
     * ImageEmbedder is created with running mode `video`.
     *
     * @export
     * @param imageFrame The image frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The classification result of the image
     */
    embedForVideo(imageFrame: ImageSource, timestamp: number, imageProcessingOptions?: ImageProcessingOptions): ImageEmbedderResult;
    /**
     * Utility function to compute cosine similarity[1] between two `Embedding`
     * objects.
     *
     * [1]: https://en.wikipedia.org/wiki/Cosine_similarity
     *
     * @export
     * @throws if the embeddings are of different types(float vs. quantized), have
     *     different sizes, or have an L2-norm of 0.
     */
    static cosineSimilarity(u: Embedding, v: Embedding): number;
}

/** Options for configuring a MediaPipe Image Embedder task. */
export declare interface ImageEmbedderOptions extends EmbedderOptions, VisionTaskOptions {
}

/**  Embedding results for a given embedder model. */
export declare interface ImageEmbedderResult {
    /**
     * The embedding results for each model head, i.e. one for each output tensor.
     */
    embeddings: Embedding[];
    /**
     * The optional timestamp (in milliseconds) of the start of the chunk of
     * data corresponding to these results.
     *
     * This is only used for embedding extraction on time series (e.g. audio
     * embedding). In these use cases, the amount of data to process might
     * exceed the maximum size that the model can process: to solve this, the
     * input data is split into multiple chunks starting at different timestamps.
     */
    timestampMs?: number;
}

/**
 * Options for image processing.
 *
 * If both region-or-interest and rotation are specified, the crop around the
 * region-of-interest is extracted first, then the specified rotation is applied
 * to the crop.
 */
declare interface ImageProcessingOptions {
    /**
     * The optional region-of-interest to crop from the image. If not specified,
     * the full image is used.
     *
     * Coordinates must be in [0,1] with 'left' < 'right' and 'top' < bottom.
     */
    regionOfInterest?: RectF;
    /**
     * The rotation to apply to the image (or cropped region-of-interest), in
     * degrees clockwise.
     *
     * The rotation must be a multiple (positive or negative) of 90°.
     */
    rotationDegrees?: number;
}

/** Performs image segmentation on images. */
export declare class ImageSegmenter extends VisionTaskRunner {
    /**
     * Initializes the Wasm runtime and creates a new image segmenter from the
     * provided options.
     * @export
     * @param wasmFileset A configuration object that provides the location of
     *     the Wasm binary and its loader.
     * @param imageSegmenterOptions The options for the Image Segmenter. Note
     *     that either a path to the model asset or a model buffer needs to be
     *     provided (via `baseOptions`).
     */
    static createFromOptions(wasmFileset: WasmFileset, imageSegmenterOptions: ImageSegmenterOptions): Promise<ImageSegmenter>;
    /**
     * Initializes the Wasm runtime and creates a new image segmenter based on
     * the provided model asset buffer.
     * @export
     * @param wasmFileset A configuration object that provides the location of
     *     the Wasm binary and its loader.
     * @param modelAssetBuffer A binary representation of the model.
     */
    static createFromModelBuffer(wasmFileset: WasmFileset, modelAssetBuffer: Uint8Array): Promise<ImageSegmenter>;
    /**
     * Initializes the Wasm runtime and creates a new image segmenter based on
     * the path to the model asset.
     * @export
     * @param wasmFileset A configuration object that provides the location of
     *     the Wasm binary and its loader.
     * @param modelAssetPath The path to the model asset.
     */
    static createFromModelPath(wasmFileset: WasmFileset, modelAssetPath: string): Promise<ImageSegmenter>;
    private constructor();
    /**
     * Sets new options for the image segmenter.
     *
     * Calling `setOptions()` with a subset of options only affects those
     * options. You can reset an option back to its default value by
     * explicitly setting it to `undefined`.
     *
     * @export
     * @param options The options for the image segmenter.
     */
    setOptions(options: ImageSegmenterOptions): Promise<void>;
    /**
     * Performs image segmentation on the provided single image and invokes the
     * callback with the response. The method returns synchronously once the
     * callback returns. Only use this method when the ImageSegmenter is
     * created with running mode `image`.
     *
     * @param image An image to process.
     * @param callback The callback that is invoked with the segmented masks. The
     *    lifetime of the returned data is only guaranteed for the duration of the
     *    callback.
     */
    segment(image: ImageSource, callback: ImageSegmenterCallback): void;
    /**
     * Performs image segmentation on the provided single image and invokes the
     * callback with the response. The method returns synchronously once the
     * callback returns. Only use this method when the ImageSegmenter is
     * created with running mode `image`.
     *
     * @param image An image to process.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @param callback The callback that is invoked with the segmented masks. The
     *    lifetime of the returned data is only guaranteed for the duration of the
     *    callback.
     */
    segment(image: ImageSource, imageProcessingOptions: ImageProcessingOptions, callback: ImageSegmenterCallback): void;
    /**
     * Performs image segmentation on the provided single image and returns the
     * segmentation result. This method creates a copy of the resulting masks and
     * should not be used in high-throughput applications. Only use this method
     * when the ImageSegmenter is created with running mode `image`.
     *
     * @param image An image to process.
     * @return The segmentation result. The data is copied to avoid lifetime
     *     issues.
     */
    segment(image: ImageSource): ImageSegmenterResult;
    /**
     * Performs image segmentation on the provided single image and returns the
     * segmentation result. This method creates a copy of the resulting masks and
     * should not be used in high-v applications. Only use this method when
     * the ImageSegmenter is created with running mode `image`.
     *
     * @param image An image to process.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The segmentation result. The data is copied to avoid lifetime
     *     issues.
     */
    segment(image: ImageSource, imageProcessingOptions: ImageProcessingOptions): ImageSegmenterResult;
    /**
     * Performs image segmentation on the provided video frame and invokes the
     * callback with the response. The method returns synchronously once the
     * callback returns. Only use this method when the ImageSegmenter is
     * created with running mode `video`.
     *
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param callback The callback that is invoked with the segmented masks. The
     *    lifetime of the returned data is only guaranteed for the duration of the
     *    callback.
     */
    segmentForVideo(videoFrame: ImageSource, timestamp: number, callback: ImageSegmenterCallback): void;
    /**
     * Performs image segmentation on the provided video frame and invokes the
     * callback with the response. The method returns synchronously once the
     * callback returns. Only use this method when the ImageSegmenter is
     * created with running mode `video`.
     *
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input frame before running inference.
     * @param callback The callback that is invoked with the segmented masks. The
     *    lifetime of the returned data is only guaranteed for the duration of the
     *    callback.
     */
    segmentForVideo(videoFrame: ImageSource, timestamp: number, imageProcessingOptions: ImageProcessingOptions, callback: ImageSegmenterCallback): void;
    /**
     * Performs image segmentation on the provided video frame and returns the
     * segmentation result. This method creates a copy of the resulting masks and
     * should not be used in high-throughput applications. Only use this method
     * when the ImageSegmenter is created with running mode `video`.
     *
     * @param videoFrame A video frame to process.
     * @return The segmentation result. The data is copied to avoid lifetime
     *     issues.
     */
    segmentForVideo(videoFrame: ImageSource, timestamp: number): ImageSegmenterResult;
    /**
     * Performs image segmentation on the provided video frame and returns the
     * segmentation result. This method creates a copy of the resulting masks and
     * should not be used in high-v applications. Only use this method when
     * the ImageSegmenter is created with running mode `video`.
     *
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input frame before running inference.
     * @return The segmentation result. The data is copied to avoid lifetime
     *     issues.
     */
    segmentForVideo(videoFrame: ImageSource, timestamp: number, imageProcessingOptions: ImageProcessingOptions): ImageSegmenterResult;
    /**
     * Get the category label list of the ImageSegmenter can recognize. For
     * `CATEGORY_MASK` type, the index in the category mask corresponds to the
     * category in the label list. For `CONFIDENCE_MASK` type, the output mask
     * list at index corresponds to the category in the label list.
     *
     * If there is no labelmap provided in the model file, empty label array is
     * returned.
     *
     * @export
     * @return The labels used by the current model.
     */
    getLabels(): string[];
}

/**
 * A callback that receives the computed masks from the image segmenter. The
 * returned data is only valid for the duration of the callback. If
 * asynchronous processing is needed, all data needs to be copied before the
 * callback returns.
 */
export declare type ImageSegmenterCallback = (result: ImageSegmenterResult) => void;

/** Options to configure the MediaPipe Image Segmenter Task */
export declare interface ImageSegmenterOptions extends VisionTaskOptions {
    /**
     * The locale to use for display names specified through the TFLite Model
     * Metadata, if any. Defaults to English.
     */
    displayNamesLocale?: string | undefined;
    /** Whether to output confidence masks. Defaults to true. */
    outputConfidenceMasks?: boolean | undefined;
    /** Whether to output the category masks. Defaults to false. */
    outputCategoryMask?: boolean | undefined;
}

/** The output result of ImageSegmenter. */
export declare class ImageSegmenterResult {
    /**
     * Multiple masks represented as `Float32Array` or `WebGLTexture`-backed
     * `MPImage`s where, for each mask, each pixel represents the prediction
     * confidence, usually in the [0, 1] range.
     * @export
     */
    readonly confidenceMasks?: MPMask[] | undefined;
    /**
     * A category mask represented as a `Uint8ClampedArray` or
     * `WebGLTexture`-backed `MPImage` where each pixel represents the class
     * which the pixel in the original image was predicted to belong to.
     * @export
     */
    readonly categoryMask?: MPMask | undefined;
    /**
     * The quality scores of the result masks, in the range of [0, 1].
     * Defaults to `1` if the model doesn't output quality scores. Each
     * element corresponds to the score of the category in the model outputs.
     * @export
     */
    readonly qualityScores?: number[] | undefined;
    constructor(
    /**
     * Multiple masks represented as `Float32Array` or `WebGLTexture`-backed
     * `MPImage`s where, for each mask, each pixel represents the prediction
     * confidence, usually in the [0, 1] range.
     * @export
     */
    confidenceMasks?: MPMask[] | undefined, 
    /**
     * A category mask represented as a `Uint8ClampedArray` or
     * `WebGLTexture`-backed `MPImage` where each pixel represents the class
     * which the pixel in the original image was predicted to belong to.
     * @export
     */
    categoryMask?: MPMask | undefined, 
    /**
     * The quality scores of the result masks, in the range of [0, 1].
     * Defaults to `1` if the model doesn't output quality scores. Each
     * element corresponds to the score of the category in the model outputs.
     * @export
     */
    qualityScores?: number[] | undefined);
    /**
     * Frees the resources held by the category and confidence masks.
     * @export
     */
    close(): void;
}

/**
 * Valid types of image sources which we can run our GraphRunner over.
 */
export declare type ImageSource = HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | ImageData | ImageBitmap;

/**
 * Performs interactive segmentation on images.
 *
 * Users can represent user interaction through `RegionOfInterest`, which gives
 * a hint to InteractiveSegmenter to perform segmentation focusing on the given
 * region of interest.
 *
 * The API expects a TFLite model with mandatory TFLite Model Metadata.
 *
 * Input tensor:
 *   (kTfLiteUInt8/kTfLiteFloat32)
 *   - image input of size `[batch x height x width x channels]`.
 *   - batch inference is not supported (`batch` is required to be 1).
 *   - RGB inputs is supported (`channels` is required to be 3).
 *   - if type is kTfLiteFloat32, NormalizationOptions are required to be
 *     attached to the metadata for input normalization.
 * Output tensors:
 *  (kTfLiteUInt8/kTfLiteFloat32)
 *   - list of segmented masks.
 *   - if `output_type` is CATEGORY_MASK, uint8 Image, Image vector of size 1.
 *   - if `output_type` is CONFIDENCE_MASK, float32 Image list of size
 *     `channels`.
 *   - batch is always 1
 */
export declare class InteractiveSegmenter extends VisionTaskRunner {
    /**
     * Initializes the Wasm runtime and creates a new interactive segmenter from
     * the provided options.
     * @export
     * @param wasmFileset A configuration object that provides the location of
     *     the Wasm binary and its loader.
     * @param interactiveSegmenterOptions The options for the Interactive
     *     Segmenter. Note that either a path to the model asset or a model buffer
     *     needs to be provided (via `baseOptions`).
     * @return A new `InteractiveSegmenter`.
     */
    static createFromOptions(wasmFileset: WasmFileset, interactiveSegmenterOptions: InteractiveSegmenterOptions): Promise<InteractiveSegmenter>;
    /**
     * Initializes the Wasm runtime and creates a new interactive segmenter based
     * on the provided model asset buffer.
     * @export
     * @param wasmFileset A configuration object that provides the location of
     *     the Wasm binary and its loader.
     * @param modelAssetBuffer A binary representation of the model.
     * @return A new `InteractiveSegmenter`.
     */
    static createFromModelBuffer(wasmFileset: WasmFileset, modelAssetBuffer: Uint8Array): Promise<InteractiveSegmenter>;
    /**
     * Initializes the Wasm runtime and creates a new interactive segmenter based
     * on the path to the model asset.
     * @export
     * @param wasmFileset A configuration object that provides the location of
     *     the Wasm binary and its loader.
     * @param modelAssetPath The path to the model asset.
     * @return A new `InteractiveSegmenter`.
     */
    static createFromModelPath(wasmFileset: WasmFileset, modelAssetPath: string): Promise<InteractiveSegmenter>;
    private constructor();
    /**
     * Sets new options for the interactive segmenter.
     *
     * Calling `setOptions()` with a subset of options only affects those
     * options. You can reset an option back to its default value by
     * explicitly setting it to `undefined`.
     *
     * @export
     * @param options The options for the interactive segmenter.
     * @return A Promise that resolves when the settings have been applied.
     */
    setOptions(options: InteractiveSegmenterOptions): Promise<void>;
    /**
     * Performs interactive segmentation on the provided single image and invokes
     * the callback with the response. The method returns synchronously once the
     * callback returns. The `roi` parameter is used to represent a user's region
     * of interest for segmentation.
     *
     * @param image An image to process.
     * @param roi The region of interest for segmentation.
     * @param callback The callback that is invoked with the segmented masks. The
     *    lifetime of the returned data is only guaranteed for the duration of the
     *    callback.
     */
    segment(image: ImageSource, roi: RegionOfInterest, callback: InteractiveSegmenterCallback): void;
    /**
     * Performs interactive segmentation on the provided single image and invokes
     * the callback with the response. The method returns synchronously once the
     * callback returns. The `roi` parameter is used to represent a user's region
     * of interest for segmentation.
     *
     * The 'image_processing_options' parameter can be used to specify the
     * rotation to apply to the image before performing segmentation, by setting
     * its 'rotationDegrees' field. Note that specifying a region-of-interest
     * using the 'regionOfInterest' field is NOT supported and will result in an
     * error.
     *
     * @param image An image to process.
     * @param roi The region of interest for segmentation.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @param callback The callback that is invoked with the segmented masks. The
     *    lifetime of the returned data is only guaranteed for the duration of the
     *    callback.
     */
    segment(image: ImageSource, roi: RegionOfInterest, imageProcessingOptions: ImageProcessingOptions, callback: InteractiveSegmenterCallback): void;
    /**
     * Performs interactive segmentation on the provided video frame and returns
     * the segmentation result. This method creates a copy of the resulting masks
     * and should not be used in high-throughput applications. The `roi` parameter
     * is used to represent a user's region of interest for segmentation.
     *
     * @param image An image to process.
     * @param roi The region of interest for segmentation.
     * @return The segmentation result. The data is copied to avoid lifetime
     *     limits.
     */
    segment(image: ImageSource, roi: RegionOfInterest): InteractiveSegmenterResult;
    /**
     * Performs interactive segmentation on the provided video frame and returns
     * the segmentation result. This method creates a copy of the resulting masks
     * and should not be used in high-throughput applications. The `roi` parameter
     * is used to represent a user's region of interest for segmentation.
     *
     * The 'image_processing_options' parameter can be used to specify the
     * rotation to apply to the image before performing segmentation, by setting
     * its 'rotationDegrees' field. Note that specifying a region-of-interest
     * using the 'regionOfInterest' field is NOT supported and will result in an
     * error.
     *
     * @param image An image to process.
     * @param roi The region of interest for segmentation.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The segmentation result. The data is copied to avoid lifetime
     *     limits.
     */
    segment(image: ImageSource, roi: RegionOfInterest, imageProcessingOptions: ImageProcessingOptions): InteractiveSegmenterResult;
}

/**
 * A callback that receives the computed masks from the interactive segmenter.
 * The returned data is only valid for the duration of the callback. If
 * asynchronous processing is needed, all data needs to be copied before the
 * callback returns.
 */
export declare type InteractiveSegmenterCallback = (result: InteractiveSegmenterResult) => void;

/** Options to configure the MediaPipe Interactive Segmenter Task */
export declare interface InteractiveSegmenterOptions extends TaskRunnerOptions {
    /** Whether to output confidence masks. Defaults to true. */
    outputConfidenceMasks?: boolean | undefined;
    /** Whether to output the category masks. Defaults to false. */
    outputCategoryMask?: boolean | undefined;
}

/** The output result of InteractiveSegmenter. */
export declare class InteractiveSegmenterResult {
    /**
     * Multiple masks represented as `Float32Array` or `WebGLTexture`-backed
     * `MPImage`s where, for each mask, each pixel represents the prediction
     * confidence, usually in the [0, 1] range.
     * @export
     */
    readonly confidenceMasks?: MPMask[] | undefined;
    /**
     * A category mask represented as a `Uint8ClampedArray` or
     * `WebGLTexture`-backed `MPImage` where each pixel represents the class
     * which the pixel in the original image was predicted to belong to.
     * @export
     */
    readonly categoryMask?: MPMask | undefined;
    /**
     * The quality scores of the result masks, in the range of [0, 1].
     * Defaults to `1` if the model doesn't output quality scores. Each
     * element corresponds to the score of the category in the model outputs.
     * @export
     */
    readonly qualityScores?: number[] | undefined;
    constructor(
    /**
     * Multiple masks represented as `Float32Array` or `WebGLTexture`-backed
     * `MPImage`s where, for each mask, each pixel represents the prediction
     * confidence, usually in the [0, 1] range.
     * @export
     */
    confidenceMasks?: MPMask[] | undefined, 
    /**
     * A category mask represented as a `Uint8ClampedArray` or
     * `WebGLTexture`-backed `MPImage` where each pixel represents the class
     * which the pixel in the original image was predicted to belong to.
     * @export
     */
    categoryMask?: MPMask | undefined, 
    /**
     * The quality scores of the result masks, in the range of [0, 1].
     * Defaults to `1` if the model doesn't output quality scores. Each
     * element corresponds to the score of the category in the model outputs.
     * @export
     */
    qualityScores?: number[] | undefined);
    /**
     * Frees the resources held by the category and confidence masks.
     * @export
     */
    close(): void;
}

/**
 * Landmark represents a point in 3D space with x, y, z coordinates. The
 * landmark coordinates are in meters. z represents the landmark depth,
 * and the smaller the value the closer the world landmark is to the camera.
 */
export declare interface Landmark {
    /** The x coordinates of the landmark. */
    x: number;
    /** The y coordinates of the landmark. */
    y: number;
    /** The z coordinates of the landmark. */
    z: number;
}

/** Data that a user can use to specialize drawing options. */
export declare interface LandmarkData {
    index?: number;
    from?: NormalizedLandmark;
    to?: NormalizedLandmark;
}

/**
 * Copyright 2023 The MediaPipe Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/** A two-dimensional matrix. */
declare interface Matrix {
    /** The number of rows. */
    rows: number;
    /** The number of columns. */
    columns: number;
    /** The values as a flattened one-dimensional array. */
    data: number[];
}

/**
 * The wrapper class for MediaPipe Image objects.
 *
 * Images are stored as `ImageData`, `ImageBitmap` or `WebGLTexture` objects.
 * You can convert the underlying type to any other type by passing the
 * desired type to `getAs...()`. As type conversions can be expensive, it is
 * recommended to limit these conversions. You can verify what underlying
 * types are already available by invoking `has...()`.
 *
 * Images that are returned from a MediaPipe Tasks are owned by by the
 * underlying C++ Task. If you need to extend the lifetime of these objects,
 * you can invoke the `clone()` method. To free up the resources obtained
 * during any clone or type conversion operation, it is important to invoke
 * `close()` on the `MPImage` instance.
 *
 * Converting to and from ImageBitmap requires that the MediaPipe task is
 * initialized with an `OffscreenCanvas`. As we require WebGL2 support, this
 * places some limitations on Browser support as outlined here:
 * https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/getContext
 */
export declare class MPImage {
    /** Returns the canvas element that the image is bound to. */
    readonly canvas: HTMLCanvasElement | OffscreenCanvas | undefined;
    /** Returns the width of the image. */
    readonly width: number;
    /** Returns the height of the image. */
    readonly height: number;
    private constructor();
    /**
     * Returns whether this `MPImage` contains a mask of type `ImageData`.
     * @export
     */
    hasImageData(): boolean;
    /**
     * Returns whether this `MPImage` contains a mask of type `ImageBitmap`.
     * @export
     */
    hasImageBitmap(): boolean;
    /**
     * Returns whether this `MPImage` contains a mask of type `WebGLTexture`.
     * @export
     */
    hasWebGLTexture(): boolean;
    /**
     * Returns the underlying image as an `ImageData` object. Note that this
     * involves an expensive GPU to CPU transfer if the current image is only
     * available as an `ImageBitmap` or `WebGLTexture`.
     *
     * @export
     * @return The current image as an ImageData object.
     */
    getAsImageData(): ImageData;
    /**
     * Returns the underlying image as an `ImageBitmap`. Note that
     * conversions to `ImageBitmap` are expensive, especially if the data
     * currently resides on CPU.
     *
     * Processing with `ImageBitmap`s requires that the MediaPipe Task was
     * initialized with an `OffscreenCanvas` with WebGL2 support. See
     * https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/getContext
     * for a list of supported platforms.
     *
     * @export
     * @return The current image as an ImageBitmap object.
     */
    getAsImageBitmap(): ImageBitmap;
    /**
     * Returns the underlying image as a `WebGLTexture` object. Note that this
     * involves a CPU to GPU transfer if the current image is only available as
     * an `ImageData` object. The returned texture is bound to the current
     * canvas (see `.canvas`).
     *
     * @export
     * @return The current image as a WebGLTexture.
     */
    getAsWebGLTexture(): WebGLTexture;
    /**
     * Creates a copy of the resources stored in this `MPImage`. You can invoke
     * this method to extend the lifetime of an image returned by a MediaPipe
     * Task. Note that performance critical applications should aim to only use
     * the `MPImage` within the MediaPipe Task callback so that copies can be
     * avoided.
     *
     * @export
     */
    clone(): MPImage;
    /**
     * Frees up any resources owned by this `MPImage` instance.
     *
     * Note that this method does not free images that are owned by the C++
     * Task, as these are freed automatically once you leave the MediaPipe
     * callback. Additionally, some shared state is freed only once you invoke the
     * Task's `close()` method.
     *
     * @export
     */
    close(): void;
}

/**
 * The wrapper class for MediaPipe segmentation masks.
 *
 * Masks are stored as `Uint8Array`, `Float32Array` or `WebGLTexture` objects.
 * You can convert the underlying type to any other type by passing the desired
 * type to `getAs...()`. As type conversions can be expensive, it is recommended
 * to limit these conversions. You can verify what underlying types are already
 * available by invoking `has...()`.
 *
 * Masks that are returned from a MediaPipe Tasks are owned by by the
 * underlying C++ Task. If you need to extend the lifetime of these objects,
 * you can invoke the `clone()` method. To free up the resources obtained
 * during any clone or type conversion operation, it is important to invoke
 * `close()` on the `MPMask` instance.
 */
export declare class MPMask {
    /** Returns the canvas element that the mask is bound to. */
    readonly canvas: HTMLCanvasElement | OffscreenCanvas | undefined;
    /** Returns the width of the mask. */
    readonly width: number;
    /** Returns the height of the mask. */
    readonly height: number;
    private constructor();
    /**
     * Returns whether this `MPMask` contains a mask of type `Uint8Array`.
     * @export
     */
    hasUint8Array(): boolean;
    /**
     * Returns whether this `MPMask` contains a mask of type `Float32Array`.
     * @export
     */
    hasFloat32Array(): boolean;
    /**
     * Returns whether this `MPMask` contains a mask of type `WebGLTexture`.
     * @export
     */
    hasWebGLTexture(): boolean;
    /**
     * Returns the underlying mask as a Uint8Array`. Note that this involves an
     * expensive GPU to CPU transfer if the current mask is only available as a
     * `WebGLTexture`.
     *
     * @export
     * @return The current data as a Uint8Array.
     */
    getAsUint8Array(): Uint8Array;
    /**
     * Returns the underlying mask as a single channel `Float32Array`. Note that
     * this involves an expensive GPU to CPU transfer if the current mask is
     * only available as a `WebGLTexture`.
     *
     * @export
     * @return The current mask as a Float32Array.
     */
    getAsFloat32Array(): Float32Array;
    /**
     * Returns the underlying mask as a `WebGLTexture` object. Note that this
     * involves a CPU to GPU transfer if the current mask is only available as
     * a CPU array. The returned texture is bound to the current canvas (see
     * `.canvas`).
     *
     * @export
     * @return The current mask as a WebGLTexture.
     */
    getAsWebGLTexture(): WebGLTexture;
    /**
     * Creates a copy of the resources stored in this `MPMask`. You can
     * invoke this method to extend the lifetime of a mask returned by a
     * MediaPipe Task. Note that performance critical applications should aim to
     * only use the `MPMask` within the MediaPipe Task callback so that
     * copies can be avoided.
     *
     * @export
     */
    clone(): MPMask;
    /**
     * Frees up any resources owned by this `MPMask` instance.
     *
     * Note that this method does not free masks that are owned by the C++
     * Task, as these are freed automatically once you leave the MediaPipe
     * callback. Additionally, some shared state is freed only once you invoke
     * the Task's `close()` method.
     *
     * @export
     */
    close(): void;
}

/**
 * Copyright 2023 The MediaPipe Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * A keypoint, defined by the coordinates (x, y), normalized by the image
 * dimensions.
 */
declare interface NormalizedKeypoint {
    /** X in normalized image coordinates. */
    x: number;
    /** Y in normalized image coordinates. */
    y: number;
    /** Optional label of the keypoint. */
    label?: string;
    /** Optional score of the keypoint. */
    score?: number;
}

/**
 * Copyright 2022 The MediaPipe Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
 * Normalized Landmark represents a point in 3D space with x, y, z coordinates.
 * x and y are normalized to [0.0, 1.0] by the image width and height
 * respectively. z represents the landmark depth, and the smaller the value the
 * closer the landmark is to the camera. The magnitude of z uses roughly the
 * same scale as x.
 */
export declare interface NormalizedLandmark {
    /** The x coordinates of the normalized landmark. */
    x: number;
    /** The y coordinates of the normalized landmark. */
    y: number;
    /** The z coordinates of the normalized landmark. */
    z: number;
}

/**
 * Performs object detection on images.
 */
export declare class ObjectDetector extends VisionTaskRunner {
    /**
     * Initializes the Wasm runtime and creates a new object detector from the
     * provided options.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param objectDetectorOptions The options for the Object Detector. Note that
     *     either a path to the model asset or a model buffer needs to be
     *     provided (via `baseOptions`).
     */
    static createFromOptions(wasmFileset: WasmFileset, objectDetectorOptions: ObjectDetectorOptions): Promise<ObjectDetector>;
    /**
     * Initializes the Wasm runtime and creates a new object detector based on the
     * provided model asset buffer.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetBuffer A binary representation of the model.
     */
    static createFromModelBuffer(wasmFileset: WasmFileset, modelAssetBuffer: Uint8Array): Promise<ObjectDetector>;
    /**
     * Initializes the Wasm runtime and creates a new object detector based on the
     * path to the model asset.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetPath The path to the model asset.
     */
    static createFromModelPath(wasmFileset: WasmFileset, modelAssetPath: string): Promise<ObjectDetector>;
    private constructor();
    /**
     * Sets new options for the object detector.
     *
     * Calling `setOptions()` with a subset of options only affects those options.
     * You can reset an option back to its default value by explicitly setting it
     * to `undefined`.
     *
     * @export
     * @param options The options for the object detector.
     */
    setOptions(options: ObjectDetectorOptions): Promise<void>;
    /**
     * Performs object detection on the provided single image and waits
     * synchronously for the response. Only use this method when the
     * ObjectDetector is created with running mode `image`.
     *
     * @export
     * @param image An image to process.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return A result containing a list of detected objects.
     */
    detect(image: ImageSource, imageProcessingOptions?: ImageProcessingOptions): DetectionResult;
    /**
     * Performs object detection on the provided video frame and waits
     * synchronously for the response. Only use this method when the
     * ObjectDetector is created with running mode `video`.
     *
     * @export
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return A result containing a list of detected objects.
     */
    detectForVideo(videoFrame: ImageSource, timestamp: number, imageProcessingOptions?: ImageProcessingOptions): DetectionResult;
}

/** Options to configure the MediaPipe Object Detector Task */
export declare interface ObjectDetectorOptions extends VisionTaskOptions, ClassifierOptions {
}

/** Performs pose landmarks detection on images. */
export declare class PoseLandmarker extends VisionTaskRunner {
    /**
     * An array containing the pairs of pose landmark indices to be rendered with
     * connections.
     * @export
     * @nocollapse
     */
    static POSE_CONNECTIONS: Connection[];
    /**
     * Initializes the Wasm runtime and creates a new `PoseLandmarker` from the
     * provided options.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param poseLandmarkerOptions The options for the PoseLandmarker.
     *     Note that either a path to the model asset or a model buffer needs to
     *     be provided (via `baseOptions`).
     */
    static createFromOptions(wasmFileset: WasmFileset, poseLandmarkerOptions: PoseLandmarkerOptions): Promise<PoseLandmarker>;
    /**
     * Initializes the Wasm runtime and creates a new `PoseLandmarker` based on
     * the provided model asset buffer.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetBuffer A binary representation of the model.
     */
    static createFromModelBuffer(wasmFileset: WasmFileset, modelAssetBuffer: Uint8Array): Promise<PoseLandmarker>;
    /**
     * Initializes the Wasm runtime and creates a new `PoseLandmarker` based on
     * the path to the model asset.
     * @export
     * @param wasmFileset A configuration object that provides the location of the
     *     Wasm binary and its loader.
     * @param modelAssetPath The path to the model asset.
     */
    static createFromModelPath(wasmFileset: WasmFileset, modelAssetPath: string): Promise<PoseLandmarker>;
    private constructor();
    /**
     * Sets new options for this `PoseLandmarker`.
     *
     * Calling `setOptions()` with a subset of options only affects those options.
     * You can reset an option back to its default value by explicitly setting it
     * to `undefined`.
     *
     * @export
     * @param options The options for the pose landmarker.
     */
    setOptions(options: PoseLandmarkerOptions): Promise<void>;
    /**
     * Performs pose detection on the provided single image and invokes the
     * callback with the response. The method returns synchronously once the
     * callback returns. Only use this method when the PoseLandmarker is created
     * with running mode `image`.
     *
     * @param image An image to process.
     * @param callback The callback that is invoked with the result. The
     *    lifetime of the returned masks is only guaranteed for the duration of
     *    the callback.
     */
    detect(image: ImageSource, callback: PoseLandmarkerCallback): void;
    /**
     * Performs pose detection on the provided single image and invokes the
     * callback with the response. The method returns synchronously once the
     * callback returns. Only use this method when the PoseLandmarker is created
     * with running mode `image`.
     *
     * @param image An image to process.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @param callback The callback that is invoked with the result. The
     *    lifetime of the returned masks is only guaranteed for the duration of
     *    the callback.
     */
    detect(image: ImageSource, imageProcessingOptions: ImageProcessingOptions, callback: PoseLandmarkerCallback): void;
    /**
     * Performs pose detection on the provided single image and waits
     * synchronously for the response. This method creates a copy of the resulting
     * masks and should not be used in high-throughput applications. Only
     * use this method when the PoseLandmarker is created with running mode
     * `image`.
     *
     * @param image An image to process.
     * @return The landmarker result. Any masks are copied to avoid lifetime
     *     limits.
     * @return The detected pose landmarks.
     */
    detect(image: ImageSource): PoseLandmarkerResult;
    /**
     * Performs pose detection on the provided single image and waits
     * synchronously for the response. This method creates a copy of the resulting
     * masks and should not be used in high-throughput applications. Only
     * use this method when the PoseLandmarker is created with running mode
     * `image`.
     *
     * @param image An image to process.
     * @return The landmarker result. Any masks are copied to avoid lifetime
     *     limits.
     * @return The detected pose landmarks.
     */
    detect(image: ImageSource, imageProcessingOptions: ImageProcessingOptions): PoseLandmarkerResult;
    /**
     * Performs pose detection on the provided video frame and invokes the
     * callback with the response. The method returns synchronously once the
     * callback returns. Only use this method when the PoseLandmarker is created
     * with running mode `video`.
     *
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param callback The callback that is invoked with the result. The
     *    lifetime of the returned masks is only guaranteed for the duration of
     *    the callback.
     */
    detectForVideo(videoFrame: ImageSource, timestamp: number, callback: PoseLandmarkerCallback): void;
    /**
     * Performs pose detection on the provided video frame and invokes the
     * callback with the response. The method returns synchronously once the
     * callback returns. Only use this method when the PoseLandmarker is created
     * with running mode `video`.
     *
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @param callback The callback that is invoked with the result. The
     *    lifetime of the returned masks is only guaranteed for the duration of
     *    the callback.
     */
    detectForVideo(videoFrame: ImageSource, timestamp: number, imageProcessingOptions: ImageProcessingOptions, callback: PoseLandmarkerCallback): void;
    /**
     * Performs pose detection on the provided video frame and returns the result.
     * This method creates a copy of the resulting masks and should not be used
     * in high-throughput applications. Only use this method when the
     * PoseLandmarker is created with running mode `video`.
     *
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @return The landmarker result. Any masks are copied to extend the
     *     lifetime of the returned data.
     */
    detectForVideo(videoFrame: ImageSource, timestamp: number): PoseLandmarkerResult;
    /**
     * Performs pose detection on the provided video frame and returns the result.
     * This method creates a copy of the resulting masks and should not be used
     * in high-throughput applications. The method returns synchronously once the
     * callback returns. Only use this method when the PoseLandmarker is created
     * with running mode `video`.
     *
     * @param videoFrame A video frame to process.
     * @param timestamp The timestamp of the current frame, in ms.
     * @param imageProcessingOptions the `ImageProcessingOptions` specifying how
     *    to process the input image before running inference.
     * @return The landmarker result. Any masks are copied to extend the lifetime
     *     of the returned data.
     */
    detectForVideo(videoFrame: ImageSource, timestamp: number, imageProcessingOptions: ImageProcessingOptions): PoseLandmarkerResult;
}

/**
 * A callback that receives the result from the pose detector. The returned
 * masks are only valid for the duration of the callback. If asynchronous
 * processing is needed, the masks need to be copied before the callback
 * returns.
 */
export declare type PoseLandmarkerCallback = (result: PoseLandmarkerResult) => void;

/** Options to configure the MediaPipe PoseLandmarker Task */
export declare interface PoseLandmarkerOptions extends VisionTaskOptions {
    /**
     * The maximum number of poses can be detected by the PoseLandmarker.
     * Defaults to 1.
     */
    numPoses?: number | undefined;
    /**
     * The minimum confidence score for the pose detection to be considered
     * successful. Defaults to 0.5.
     */
    minPoseDetectionConfidence?: number | undefined;
    /**
     * The minimum confidence score of pose presence score in the pose landmark
     * detection. Defaults to 0.5.
     */
    minPosePresenceConfidence?: number | undefined;
    /**
     * The minimum confidence score for the pose tracking to be considered
     * successful. Defaults to 0.5.
     */
    minTrackingConfidence?: number | undefined;
    /** Whether to output segmentation masks. Defaults to false. */
    outputSegmentationMasks?: boolean | undefined;
}

/**
 * Represents the pose landmarks deection results generated by `PoseLandmarker`.
 * Each vector element represents a single pose detected in the image.
 */
export declare class PoseLandmarkerResult {
    readonly landmarks: NormalizedLandmark[][];
    /** Pose landmarks in world coordinates of detected poses. */
    readonly worldLandmarks: Landmark[][];
    /** Segmentation mask for the detected pose. */
    readonly segmentationMasks?: MPMask[] | undefined;
    constructor(/** Pose landmarks of detected poses. */ landmarks: NormalizedLandmark[][], 
    /** Pose landmarks in world coordinates of detected poses. */
    worldLandmarks: Landmark[][], 
    /** Segmentation mask for the detected pose. */
    segmentationMasks?: MPMask[] | undefined);
    /** Frees the resources held by the segmentation masks. */
    close(): void;
}

/**
 * Defines a rectangle, used e.g. as part of detection results or as input
 * region-of-interest.
 *
 * The coordinates are normalized with respect to the image dimensions, i.e.
 * generally in [0,1] but they may exceed these bounds if describing a region
 * overlapping the image. The origin is on the top-left corner of the image.
 */
declare interface RectF {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

/** A Region-Of-Interest (ROI) to represent a region within an image. */
export declare interface RegionOfInterest {
    /** The ROI in keypoint format. */
    keypoint?: NormalizedKeypoint;
    /** The ROI as scribbles over the object that the user wants to segment. */
    scribble?: NormalizedKeypoint[];
}

/**
 * A four channel color with values for red, green, blue and alpha
 * respectively.
 */
export declare type RGBAColor = [
number,
number,
number,
number
] | number[];

/**
 * The two running modes of a vision task.
 * 1) The image mode for processing single image inputs.
 * 2) The video mode for processing decoded frames of a video.
 */
declare type RunningMode = "IMAGE" | "VIDEO";

/** Base class for all MediaPipe Tasks. */
declare abstract class TaskRunner {
    protected constructor();
    /** Configures the task with custom options. */
    abstract setOptions(options: TaskRunnerOptions): Promise<void>;
    /**
     * Closes and cleans up the resources held by this task.
     * @export
     */
    close(): void;
}

/** Options to configure MediaPipe Tasks in general. */
declare interface TaskRunnerOptions {
    /** Options to configure the loading of the model assets. */
    baseOptions?: BaseOptions_2;
}

/** The options for configuring a MediaPipe vision task. */
declare interface VisionTaskOptions extends TaskRunnerOptions {
    /**
     * The canvas element to bind textures to. This has to be set for GPU
     * processing. The task will initialize a WebGL context and throw an error if
     * this fails (e.g. if you have already initialized a different type of
     * context).
     */
    canvas?: HTMLCanvasElement | OffscreenCanvas;
    /**
     * The running mode of the task. Default to the image mode.
     * Vision tasks have two running modes:
     * 1) The image mode for processing single image inputs.
     * 2) The video mode for processing decoded frames of a video.
     */
    runningMode?: RunningMode;
}

/** Base class for all MediaPipe Vision Tasks. */
declare abstract class VisionTaskRunner extends TaskRunner {
    protected constructor();
    /**
     * Closes and cleans up the resources held by this task.
     * @export
     */
    close(): void;
}

/**
 * Copyright 2022 The MediaPipe Authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/** An object containing the locations of the Wasm assets */
declare interface WasmFileset {
    /** The path to the Wasm loader script. */
    wasmLoaderPath: string;
    /** The path to the Wasm binary. */
    wasmBinaryPath: string;
    /** The optional path to the asset loader script. */
    assetLoaderPath?: string;
    /** The optional path to the assets binary. */
    assetBinaryPath?: string;
}

export { }
