/**
 * The following defined constants and descriptions are directly ported from https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Constants
 *
 * Any copyright is dedicated to the Public Domain. http://creativecommons.org/publicdomain/zero/1.0/
 *
 * Contributors
 *
 * See: https://developer.mozilla.org/en-US/profiles/Sheppy
 * See: https://developer.mozilla.org/en-US/profiles/fscholz
 * See: https://developer.mozilla.org/en-US/profiles/AtiX
 * See: https://developer.mozilla.org/en-US/profiles/Sebastianz
 *
 * These constants are defined on the WebGLRenderingContext / WebGL2RenderingContext interface
 */

// Clearing buffers
// Constants passed to WebGLRenderingContext.clear() to clear buffer masks

/**
 * Passed to clear to clear the current depth buffer
 * @constant {number}
 */
export const GL_DEPTH_BUFFER_BIT: number = 0x00000100;

/**
 * Passed to clear to clear the current stencil buffer
 * @constant {number}
 */
export const GL_STENCIL_BUFFER_BIT: number = 0x00000400;

/**
 * Passed to clear to clear the current color buffer
 * @constant {number}
 */
export const GL_COLOR_BUFFER_BIT: number = 0x00004000;

// Rendering primitives
// Constants passed to WebGLRenderingContext.drawElements() or WebGLRenderingContext.drawArrays() to specify what kind of primitive to render

/**
 * Passed to drawElements or drawArrays to draw single points
 * @constant {number}
 */
export const GL_POINTS: number = 0x0000;

/**
 * Passed to drawElements or drawArrays to draw lines. Each vertex connects to the one after it
 * @constant {number}
 */
export const GL_LINES: number = 0x0001;

/**
 * Passed to drawElements or drawArrays to draw lines. Each set of two vertices is treated as a separate line segment
 * @constant {number}
 */
export const GL_LINE_LOOP: number = 0x0002;

/**
 * Passed to drawElements or drawArrays to draw a connected group of line segments from the first vertex to the last
 * @constant {number}
 */
export const GL_LINE_STRIP: number = 0x0003;

/**
 * Passed to drawElements or drawArrays to draw triangles. Each set of three vertices creates a separate triangle
 * @constant {number}
 */
export const GL_TRIANGLES: number = 0x0004;

/**
 * Passed to drawElements or drawArrays to draw a connected group of triangles
 * @constant {number}
 */
export const GL_TRIANGLE_STRIP: number = 0x0005;

/**
 * Passed to drawElements or drawArrays to draw a connected group of triangles. Each vertex connects to the previous and the first vertex in the fan
 * @constant {number}
 */
export const GL_TRIANGLE_FAN: number = 0x0006;

// Blending modes
// Constants passed to WebGLRenderingContext.blendFunc() or WebGLRenderingContext.blendFuncSeparate() to specify the blending mode (for both, RBG and alpha, or separately)

/**
 * Passed to blendFunc or blendFuncSeparate to turn off a component
 * @constant {number}
 */
export const GL_ZERO: number = 0;

/**
 * Passed to blendFunc or blendFuncSeparate to turn on a component
 * @constant {number}
 */
export const GL_ONE: number = 1;

/**
 * Passed to blendFunc or blendFuncSeparate to multiply a component by the source elements color
 * @constant {number}
 */
export const GL_SRC_COLOR: number = 0x0300;

/**
 * Passed to blendFunc or blendFuncSeparate to multiply a component by one minus the source elements color
 * @constant {number}
 */
export const GL_ONE_MINUS_SRC_COLOR: number = 0x0301;

/**
 * Passed to blendFunc or blendFuncSeparate to multiply a component by the source's alpha
 * @constant {number}
 */
export const GL_SRC_ALPHA: number = 0x0302;

/**
 * Passed to blendFunc or blendFuncSeparate to multiply a component by one minus the source's alpha
 * @constant {number}
 */
export const GL_ONE_MINUS_SRC_ALPHA: number = 0x0303;

/**
 * Passed to blendFunc or blendFuncSeparate to multiply a component by the destination's alpha
 * @constant {number}
 */
export const GL_DST_ALPHA: number = 0x0304;

/**
 * Passed to blendFunc or blendFuncSeparate to multiply a component by one minus the destination's alpha
 * @constant {number}
 */
export const GL_ONE_MINUS_DST_ALPHA: number = 0x0305;

/**
 * Passed to blendFunc or blendFuncSeparate to multiply a component by the destination's color
 * @constant {number}
 */
export const GL_DST_COLOR: number = 0x0306;

/**
 * Passed to blendFunc or blendFuncSeparate to multiply a component by one minus the destination's color
 * @constant {number}
 */
export const GL_ONE_MINUS_DST_COLOR: number = 0x0307;

/**
 * Passed to blendFunc or blendFuncSeparate to multiply a component by the minimum of source's alpha or one minus the destination's alpha
 * @constant {number}
 */
export const GL_SRC_ALPHA_SATURATE: number = 0x0308;

/**
 * Passed to blendFunc or blendFuncSeparate to specify a constant color blend function
 * @constant {number}
 */
export const GL_CONSTANT_COLOR: number = 0x8001;

/**
 * Passed to blendFunc or blendFuncSeparate to specify one minus a constant color blend function
 * @constant {number}
 */
export const GL_ONE_MINUS_CONSTANT_COLOR: number = 0x8002;

/**
 * Passed to blendFunc or blendFuncSeparate to specify a constant alpha blend function
 * @constant {number}
 */
export const GL_CONSTANT_ALPHA: number = 0x8003;

/**
 * Passed to blendFunc or blendFuncSeparate to specify one minus a constant alpha blend function
 * @constant {number}
 */
export const GL_ONE_MINUS_CONSTANT_ALPHA: number = 0x8004;

// Blending equations
// Constants passed to WebGLRenderingContext.blendEquation() or WebGLRenderingContext.blendEquationSeparate() to control how the blending is calculated (for both, RBG and alpha, or separately)

/**
 * Passed to blendEquation or blendEquationSeparate to set an addition blend function
 * @constant {number}
 */
export const GL_FUNC_ADD: number = 0x8006;

/**
 * Passed to blendEquation or blendEquationSeparate to specify a subtraction blend function (source - destination)
 * @constant {number}
 */
export const GL_FUNC_SUBSTRACT: number = 0x800a;

/**
 * Passed to blendEquation or blendEquationSeparate to specify a reverse subtraction blend function (destination - source)
 * @constant {number}
 */
export const GL_FUNC_REVERSE_SUBTRACT: number = 0x800b;

// Getting GL parameter information
// Constants passed to WebGLRenderingContext.getParameter() to specify what information to return

/**
 * Passed to getParameter to get the current RGB blend function
 * @constant {number}
 */
export const GL_BLEND_EQUATION: number = 0x8009;

/**
 * Passed to getParameter to get the current RGB blend function. Same as BLEND_EQUATION
 * @constant {number}
 */
export const GL_BLEND_EQUATION_RGB: number = 0x8009;

/**
 * Passed to getParameter to get the current alpha blend function. Same as BLEND_EQUATION
 * @constant {number}
 */
export const GL_BLEND_EQUATION_ALPHA: number = 0x883d;

/**
 * Passed to getParameter to get the current destination RGB blend function
 * @constant {number}
 */
export const GL_BLEND_DST_RGB: number = 0x80c8;

/**
 * Passed to getParameter to get the current source RGB blend function
 * @constant {number}
 */
export const GL_BLEND_SRC_RGB: number = 0x80c9;

/**
 * Passed to getParameter to get the current destination alpha blend function
 * @constant {number}
 */
export const GL_BLEND_DST_ALPHA: number = 0x80ca;

/**
 * Passed to getParameter to get the current source alpha blend function
 * @constant {number}
 */
export const GL_BLEND_SRC_ALPHA: number = 0x80cb;

/**
 * Passed to getParameter to return a the current blend color
 * @constant {number}
 */
export const GL_BLEND_COLOR: number = 0x8005;

/**
 * Passed to getParameter to get the array buffer binding
 * @constant {number}
 */
export const GL_ARRAY_BUFFER_BINDING: number = 0x8894;

/**
 * Passed to getParameter to get the current element array buffer
 * @constant {number}
 */
export const GL_ELEMENT_ARRAY_BUFFER_BINDING: number = 0x8895;

/**
 * Passed to getParameter to get the current lineWidth (set by the lineWidth method)
 * @constant {number}
 */
export const GL_LINE_WIDTH: number = 0x0b21;

/**
 * Passed to getParameter to get the current size of a point drawn with gl.POINTS
 * @constant {number}
 */
export const GL_ALIASED_POINT_SIZE_RANGE: number = 0x846d;

/**
 * Passed to getParameter to get the range of available widths for a line. Returns a length-2 array with the lo value at 0, and hight at 1
 * @constant {number}
 */
export const GL_ALIASED_LINE_WIDTH_RANGE: number = 0x846e;

/**
 * Passed to getParameter to get the current value of cullFace. Should return FRONT, BACK, or FRONT_AND_BACK
 * @constant {number}
 */
export const GL_CULL_FACE_MODE: number = 0x0b45;

/**
 * Passed to getParameter to determine the current value of frontFace. Should return CW or CCW
 * @constant {number}
 */
export const GL_FRONT_FACE: number = 0x0b46;

/**
 * Passed to getParameter to return a length-2 array of floats giving the current depth range
 * @constant {number}
 */
export const GL_DEPTH_RANGE: number = 0x0b70;

/**
 * Passed to getParameter to determine if the depth write mask is enabled
 * @constant {number}
 */
export const GL_DEPTH_WRITEMASK: number = 0x0b72;

/**
 * Passed to getParameter to determine the current depth clear value
 * @constant {number}
 */
export const GL_DEPTH_CLEAR_VALUE: number = 0x0b73;

/**
 * Passed to getParameter to get the current depth function. Returns NEVER, ALWAYS, LESS, EQUAL, LEQUAL, GREATER, GEQUAL, or NOTEQUAL
 * @constant {number}
 */
export const GL_DEPTH_FUNC: number = 0x0b74;

/**
 * Passed to getParameter to get the value the stencil will be cleared to
 * @constant {number}
 */
export const GL_STENCIL_CLEAR_VALUE: number = 0x0b91;

/**
 * Passed to getParameter to get the current stencil function. Returns NEVER, ALWAYS, LESS, EQUAL, LEQUAL, GREATER, GEQUAL, or NOTEQUAL
 * @constant {number}
 */
export const GL_STENCIL_FUNC: number = 0x0b92;

/**
 * Passed to getParameter to get the current stencil fail function. Should return KEEP, REPLACE, INCR, DECR, INVERT, INCR_WRAP, or DECR_WRAP
 * @constant {number}
 */
export const GL_STENCIL_FAIL: number = 0x0b94;

/**
 * Passed to getParameter to get the current stencil fail function should the depth buffer test fail. Should return KEEP, REPLACE, INCR, DECR, INVERT, INCR_WRAP, or DECR_WRAP
 * @constant {number}
 */
export const GL_STENCIL_PASS_DEPTH_FAIL: number = 0x0b95;

/**
 * Passed to getParameter to get the current stencil fail function should the depth buffer test pass. Should return KEEP, REPLACE, INCR, DECR, INVERT, INCR_WRAP, or DECR_WRAP
 * @constant {number}
 */
export const GL_STENCIL_PASS_DEPTH_PASS: number = 0x0b96;

/**
 * Passed to getParameter to get the reference value used for stencil tests
 * @constant {number}
 */
export const GL_STENCIL_REF: number = 0x0b97;

/**
 * @constant {number}
 */
export const GL_STENCIL_VALUE_MASK: number = 0x0b93;

/**
 * @constant {number}
 */
export const GL_STENCIL_WRITEMASK: number = 0x0b98;

/**
 * @constant {number}
 */
export const GL_STENCIL_BACK_FUNC: number = 0x8800;

/**
 * @constant {number}
 */
export const GL_STENCIL_BACK_FAIL: number = 0x8801;

/**
 * @constant {number}
 */
export const GL_STENCIL_BACK_PASS_DEPTH_FAIL: number = 0x8802;

/**
 * @constant {number}
 */
export const GL_STENCIL_BACK_PASS_DEPTH_PASS: number = 0x8803;

/**
 * @constant {number}
 */
export const GL_STENCIL_BACK_REF: number = 0x8ca3;

/**
 * @constant {number}
 */
export const GL_STENCIL_BACK_VALUE_MASK: number = 0x8ca4;

/**
 * @constant {number}
 */
export const GL_STENCIL_BACK_WRITEMASK: number = 0x8ca5;

/**
 * Returns an Int32Array with four elements for the current viewport dimensions
 * @constant {number}
 */
export const GL_VIEWPORT: number = 0x0ba2;

/**
 * Returns an Int32Array with four elements for the current scissor box dimensions
 * @constant {number}
 */
export const GL_SCISSOR_BOX: number = 0x0c10;

/**
 * @constant {number}
 */
export const GL_COLOR_CLEAR_VALUE: number = 0x0c22;

/**
 * @constant {number}
 */
export const GL_COLOR_WRITEMASK: number = 0x0c23;

/**
 * @constant {number}
 */
export const GL_UNPACK_ALIGNMENT: number = 0x0cf5;

/**
 * @constant {number}
 */
export const GL_PACK_ALIGNMENT: number = 0x0d05;

/**
 * @constant {number}
 */
export const GL_MAX_TEXTURE_SIZE: number = 0x0d33;

/**
 * @constant {number}
 */
export const GL_MAX_VIEWPORT_DIMS: number = 0x0d3a;

/**
 * @constant {number}
 */
export const GL_SUBPIXEL_BITS: number = 0x0d50;

/**
 * @constant {number}
 */
export const GL_RED_BITS: number = 0x0d52;

/**
 * @constant {number}
 */
export const GL_GREEN_BITS: number = 0x0d53;

/**
 * @constant {number}
 */
export const GL_BLUE_BITS: number = 0x0d54;

/**
 * @constant {number}
 */
export const GL_ALPHA_BITS: number = 0x0d55;

/**
 * @constant {number}
 */
export const GL_DEPTH_BITS: number = 0x0d56;

/**
 * @constant {number}
 */
export const GL_STENCIL_BITS: number = 0x0d57;

/**
 * @constant {number}
 */
export const GL_POLYGON_OFFSET_UNITS: number = 0x2a00;

/**
 * @constant {number}
 */
export const GL_POLYGON_OFFSET_FACTOR: number = 0x8038;

/**
 * @constant {number}
 */
export const GL_TEXTURE_BINDING_2D: number = 0x8069;

/**
 * @constant {number}
 */
export const GL_SAMPLE_BUFFERS: number = 0x80a8;

/**
 * @constant {number}
 */
export const GL_SAMPLES: number = 0x80a9;

/**
 * @constant {number}
 */
export const GL_SAMPLE_COVERAGE_VALUE: number = 0x80aa;

/**
 * @constant {number}
 */
export const GL_SAMPLE_COVERAGE_INVERT: number = 0x80ab;

/**
 * @constant {number}
 */
export const GL_COMPRESSED_TEXTURE_FORMATS: number = 0x86a3;

/**
 * @constant {number}
 */
export const GL_VENDOR: number = 0x1f00;

/**
 * @constant {number}
 */
export const GL_RENDERER: number = 0x1f01;

/**
 * @constant {number}
 */
export const GL_VERSION: number = 0x1f02;

/**
 * @constant {number}
 */
export const GL_IMPLEMENTATION_COLOR_READ_TYPE: number = 0x8b9a;

/**
 * @constant {number}
 */
export const GL_IMPLEMENTATION_COLOR_READ_FORMAT: number = 0x8b9b;

/**
 * @constant {number}
 */
export const GL_BROWSER_DEFAULT_WEBGL: number = 0x9244;

// Buffers
// Constants passed to WebGLRenderingContext.bufferData(), WebGLRenderingContext.bufferSubData(), WebGLRenderingContext.bindBuffer(), or WebGLRenderingContext.getBufferParameter()

/**
 * Passed to bufferData as a hint about whether the contents of the buffer are likely to be used often and not change often
 * @constant {number}
 */
export const GL_STATIC_DRAW: number = 0x88e4;

/**
 * Passed to bufferData as a hint about whether the contents of the buffer are likely to not be used often
 * @constant {number}
 */
export const GL_STREAM_DRAW: number = 0x88e0;

/**
 * Passed to bufferData as a hint about whether the contents of the buffer are likely to be used often and change often
 * @constant {number}
 */
export const GL_DYNAMIC_DRAW: number = 0x88e8;

/**
 * Passed to bindBuffer or bufferData to specify the type of buffer being used
 * @constant {number}
 */
export const GL_ARRAY_BUFFER: number = 0x8892;

/**
 * Passed to bindBuffer or bufferData to specify the type of buffer being used
 * @constant {number}
 */
export const GL_ELEMENT_ARRAY_BUFFER: number = 0x8893;

/**
 * Passed to getBufferParameter to get a buffer's size
 * @constant {number}
 */
export const GL_BUFFER_SIZE: number = 0x8764;

/**
 * Passed to getBufferParameter to get the hint for the buffer passed in when it was created
 * @constant {number}
 */
export const GL_BUFFER_USAGE: number = 0x8765;

// Vertex attributes
// Constants passed to WebGLRenderingContext.getVertexAttrib()

/**
 * Passed to getVertexAttrib to read back the current vertex attribute
 * @constant {number}
 */
export const GL_CURRENT_VERTEX_ATTRIB: number = 0x8626;

/**
 * @constant {number}
 */
export const GL_VERTEX_ATTRIB_ARRAY_ENABLED: number = 0x8622;

/**
 * @constant {number}
 */
export const GL_VERTEX_ATTRIB_ARRAY_SIZE: number = 0x8623;

/**
 * @constant {number}
 */
export const GL_VERTEX_ATTRIB_ARRAY_STRIDE: number = 0x8624;

/**
 * @constant {number}
 */
export const GL_VERTEX_ATTRIB_ARRAY_TYPE: number = 0x8625;

/**
 * @constant {number}
 */
export const GL_VERTEX_ATTRIB_ARRAY_NORMALIZED: number = 0x886a;

/**
 * @constant {number}
 */
export const GL_VERTEX_ATTRIB_ARRAY_POINTER: number = 0x8645;

/**
 * @constant {number}
 */
export const GL_VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: number = 0x889f;

// Culling
// Constants passed to WebGLRenderingContext.cullFace()

/**
 * Passed to enable/disable to turn on/off culling. Can also be used with getParameter to find the current culling method
 * @constant {number}
 */
export const GL_CULL_FACE: number = 0x0b44;

/**
 * Passed to cullFace to specify that only front faces should be culled
 * @constant {number}
 */
export const GL_FRONT: number = 0x0404;

/**
 * Passed to cullFace to specify that only back faces should be culled
 * @constant {number}
 */
export const GL_BACK: number = 0x0405;

/**
 * Passed to cullFace to specify that front and back faces should be culled
 * @constant {number}
 */
export const GL_FRONT_AND_BACK: number = 0x0408;

// Enabling and disabling
// Constants passed to WebGLRenderingContext.enable() or WebGLRenderingContext.disable()

/**
 * Passed to enable/disable to turn on/off blending. Can also be used with getParameter to find the current blending method
 * @constant {number}
 */
export const GL_BLEND: number = 0x0be2;

/**
 * Passed to enable/disable to turn on/off the depth test. Can also be used with getParameter to query the depth test
 * @constant {number}
 */
export const GL_DEPTH_TEST: number = 0x0b71;

/**
 * Passed to enable/disable to turn on/off dithering. Can also be used with getParameter to find the current dithering method
 * @constant {number}
 */
export const GL_DITHER: number = 0x0bd0;

/**
 * Passed to enable/disable to turn on/off the polygon offset. Useful for rendering hidden-line images, decals, and or solids with highlighted edges. Can also be used with getParameter to query the scissor test
 * @constant {number}
 */
export const GL_POLYGON_OFFSET_FILL: number = 0x8037;

/**
 * Passed to enable/disable to turn on/off the alpha to coverage. Used in multi-sampling alpha channels
 * @constant {number}
 */
export const GL_SAMPLE_ALPHA_TO_COVERAGE: number = 0x809e;

/**
 * Passed to enable/disable to turn on/off the sample coverage. Used in multi-sampling
 * @constant {number}
 */
export const GL_SAMPLE_COVERAGE: number = 0x80a0;

/**
 * Passed to enable/disable to turn on/off the scissor test. Can also be used with getParameter to query the scissor test
 * @constant {number}
 */
export const GL_SCISSOR_TEST: number = 0x0c11;

/**
 * Passed to enable/disable to turn on/off the stencil test. Can also be used with getParameter to query the stencil test
 * @constant {number}
 */
export const GL_STENCIL_TEST: number = 0x0b90;

// Errors
// Constants returned from WebGLRenderingContext.getError()

/**
 * Returned from getError
 * @constant {number}
 */
export const GL_NO_ERROR: number = 0;

/**
 * Returned from getError
 * @constant {number}
 */
export const GL_INVALID_ENUM: number = 0x0500;

/**
 * Returned from getError
 * @constant {number}
 */
export const GL_INVALID_VALUE: number = 0x0501;

/**
 * Returned from getError
 * @constant {number}
 */
export const GL_INVALID_OPERATION: number = 0x0502;

/**
 * Returned from getError
 * @constant {number}
 */
export const GL_OUT_OF_MEMORY: number = 0x0505;

/**
 * Returned from getError
 * @constant {number}
 */
export const GL_CONTEXT_LOST_WEBGL: number = 0x9242;

// Front face directions
// Constants passed to WebGLRenderingContext.frontFace()

/**
 * Passed to frontFace to specify the front face of a polygon is drawn in the clockwise direction,
 * @constant {number}
 */
export const GL_CW: number = 0x0900;

/**
 * Passed to frontFace to specify the front face of a polygon is drawn in the counter clockwise direction
 * @constant {number}
 */
export const GL_CCW: number = 0x0901;

// Hints
// Constants passed to WebGLRenderingContext.hint()

/**
 * There is no preference for this behavior
 * @constant {number}
 */
export const GL_DONT_CARE: number = 0x1100;

/**
 * The most efficient behavior should be used
 * @constant {number}
 */
export const GL_FASTEST: number = 0x1101;

/**
 * The most correct or the highest quality option should be used
 * @constant {number}
 */
export const GL_NICEST: number = 0x1102;

/**
 * Hint for the quality of filtering when generating mipmap images with WebGLRenderingContext.generateMipmap()
 * @constant {number}
 */
export const GL_GENERATE_MIPMAP_HINT: number = 0x8192;

// Data types

/**
 * @constant {number}
 */
export const GL_BYTE: number = 0x1400;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_BYTE: number = 0x1401;

/**
 * @constant {number}
 */
export const GL_SHORT: number = 0x1402;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_SHORT: number = 0x1403;

/**
 * @constant {number}
 */
export const GL_INT: number = 0x1404;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_INT: number = 0x1405;

/**
 * @constant {number}
 */
export const GL_FLOAT: number = 0x1406;

// Pixel formats

/**
 * @constant {number}
 */
export const GL_DEPTH_COMPONENT: number = 0x1902;

/**
 * @constant {number}
 */
export const GL_ALPHA: number = 0x1906;

/**
 * @constant {number}
 */
export const GL_RGB: number = 0x1907;

/**
 * @constant {number}
 */
export const GL_RGBA: number = 0x1908;

/**
 * @constant {number}
 */
export const GL_LUMINANCE: number = 0x1909;

/**
 * @constant {number}
 */
export const GL_LUMINANCE_ALPHA: number = 0x190a;

// Pixel types

/**
 * @constant {number}
 */
export const GL_UNSIGNED_SHORT_4_4_4_4: number = 0x8033;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_SHORT_5_5_5_1: number = 0x8034;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_SHORT_5_6_5: number = 0x8363;

// Shaders
// Constants passed to WebGLRenderingContext.getShaderParameter()

/**
 * Passed to createShader to define a fragment shader
 * @constant {number}
 */
export const GL_FRAGMENT_SHADER: number = 0x8b30;

/**
 * Passed to createShader to define a vertex shader
 * @constant {number}
 */
export const GL_VERTEX_SHADER: number = 0x8b31;

/**
 * Passed to getShaderParamter to get the status of the compilation. Returns false if the shader was not compiled. You can then query getShaderInfoLog to find the exact error
 * @constant {number}
 */
export const GL_COMPILE_STATUS: number = 0x8b81;

/**
 * Passed to getShaderParamter to determine if a shader was deleted via deleteShader. Returns true if it was, false otherwise
 * @constant {number}
 */
export const GL_DELETE_STATUS: number = 0x8b80;

/**
 * Passed to getProgramParameter after calling linkProgram to determine if a program was linked correctly. Returns false if there were errors. Use getProgramInfoLog to find the exact error
 * @constant {number}
 */
export const GL_LINK_STATUS: number = 0x8b82;

/**
 * Passed to getProgramParameter after calling validateProgram to determine if it is valid. Returns false if errors were found
 * @constant {number}
 */
export const GL_VALIDATE_STATUS: number = 0x8b83;

/**
 * Passed to getProgramParameter after calling attachShader to determine if the shader was attached correctly. Returns false if errors occurred
 * @constant {number}
 */
export const GL_ATTACHED_SHADERS: number = 0x8b85;

/**
 * Passed to getProgramParameter to get the number of attributes active in a program
 * @constant {number}
 */
export const GL_ACTIVE_ATTRIBUTES: number = 0x8b89;

/**
 * Passed to getProgramParamter to get the number of uniforms active in a program
 * @constant {number}
 */
export const GL_ACTIVE_UNIFORMS: number = 0x8b86;

/**
 * The maximum number of entries possible in the vertex attribute list
 * @constant {number}
 */
export const GL_MAX_VERTEX_ATTRIBS: number = 0x8869;

/**
 * @constant {number}
 */
export const GL_MAX_VERTEX_UNIFORM_VECTORS: number = 0x8dfb;

/**
 * @constant {number}
 */
export const GL_MAX_VARYING_VECTORS: number = 0x8dfc;

/**
 * @constant {number}
 */
export const GL_MAX_COMBINED_TEXTURE_IMAGE_UNITS: number = 0x8b4d;

/**
 * @constant {number}
 */
export const GL_MAX_VERTEX_TEXTURE_IMAGE_UNITS: number = 0x8b4c;

/**
 * Implementation dependent number of maximum texture units. At least 8
 * @constant {number}
 */
export const GL_MAX_TEXTURE_IMAGE_UNITS: number = 0x8872;

/**
 * @constant {number}
 */
export const GL_MAX_FRAGMENT_UNIFORM_VECTORS: number = 0x8dfd;

/**
 * @constant {number}
 */
export const GL_SHADER_TYPE: number = 0x8b4f;

/**
 * @constant {number}
 */
export const GL_SHADING_LANGUAGE_VERSION: number = 0x8b8c;

/**
 * @constant {number}
 */
export const GL_CURRENT_PROGRAM: number = 0x8b8d;

// Depth or stencil tests
// Constants passed to WebGLRenderingContext.stencilFunc()

/**
 * Passed to depthFunction or stencilFunction to specify depth or stencil tests will never pass. i.e. Nothing will be drawn
 * @constant {number}
 */
export const GL_NEVER: number = 0x0200;

/**
 * Passed to depthFunction or stencilFunction to specify depth or stencil tests will always pass. i.e. Pixels will be drawn in the order they are drawn
 * @constant {number}
 */
export const GL_ALWAYS: number = 0x0207;

/**
 * Passed to depthFunction or stencilFunction to specify depth or stencil tests will pass if the new depth value is less than the stored value
 * @constant {number}
 */
export const GL_LESS: number = 0x0201;

/**
 * Passed to depthFunction or stencilFunction to specify depth or stencil tests will pass if the new depth value is equals to the stored value
 * @constant {number}
 */
export const GL_EQUAL: number = 0x0202;

/**
 *  Passed to depthFunction or stencilFunction to specify depth or stencil tests will pass if the new depth value is less than or equal to the stored value
 * @constant {number}
 */
export const GL_LEQUAL: number = 0x0203;

/**
 * Passed to depthFunction or stencilFunction to specify depth or stencil tests will pass if the new depth value is greater than the stored value
 * @constant {number}
 */
export const GL_GREATER: number = 0x0204;

/**
 * Passed to depthFunction or stencilFunction to specify depth or stencil tests will pass if the new depth value is greater than or equal to the stored value
 * @constant {number}
 */
export const GL_GEQUAL: number = 0x0206;

/**
 * Passed to depthFunction or stencilFunction to specify depth or stencil tests will pass if the new depth value is not equal to the stored value
 * @constant {number}
 */
export const GL_NOTEQUAL: number = 0x0205;

// Stencil actions
// Constants passed to WebGLRenderingContext.stencilOp()

/**
 * @constant {number}
 */
export const GL_KEEP: number = 0x1e00;

/**
 * @constant {number}
 */
export const GL_REPLACE: number = 0x1e01;

/**
 * @constant {number}
 */
export const GL_INCR: number = 0x1e02;

/**
 * @constant {number}
 */
export const GL_DECR: number = 0x1e03;

/**
 * @constant {number}
 */
export const GL_INVERT: number = 0x150a;

/**
 * @constant {number}
 */
export const GL_INCR_WRAP: number = 0x8507;

/**
 * @constant {number}
 */
export const GL_DECR_WRAP: number = 0x8508;

// Textures
// Constants passed to WebGLRenderingContext.texParameteri(), WebGLRenderingContext.texParameterf(), WebGLRenderingContext.bindTexture(), WebGLRenderingContext.texImage2D(), and others

/**
 * @constant {number}
 */
export const GL_NEAREST: number = 0x2600;

/**
 * @constant {number}
 */
export const GL_LINEAR: number = 0x2601;

/**
 * @constant {number}
 */
export const GL_NEAREST_MIPMAP_NEAREST: number = 0x2700;

/**
 * @constant {number}
 */
export const GL_LINEAR_MIPMAP_NEAREST: number = 0x2701;

/**
 * @constant {number}
 */
export const GL_NEAREST_MIPMAP_LINEAR: number = 0x2702;

/**
 * @constant {number}
 */
export const GL_LINEAR_MIPMAP_LINEAR: number = 0x2703;

/**
 * @constant {number}
 */
export const GL_TEXTURE_MAG_FILTER: number = 0x2800;

/**
 * @constant {number}
 */
export const GL_TEXTURE_MIN_FILTER: number = 0x2801;

/**
 * @constant {number}
 */
export const GL_TEXTURE_WRAP_S: number = 0x2802;

/**
 * @constant {number}
 */
export const GL_TEXTURE_WRAP_T: number = 0x2803;

/**
 * @constant {number}
 */
export const GL_TEXTURE_2D: number = 0x0de1;

/**
 * @constant {number}
 */
export const GL_TEXTURE: number = 0x1702;

/**
 * @constant {number}
 */
export const GL_TEXTURE_CUBE_MAP: number = 0x8513;

/**
 * @constant {number}
 */
export const GL_TEXTURE_BINDING_CUBE_MAP: number = 0x8514;

/**
 * @constant {number}
 */
export const GL_TEXTURE_CUBE_MAP_POSITIVE_X: number = 0x8515;

/**
 * @constant {number}
 */
export const GL_TEXTURE_CUBE_MAP_NEGATIVE_X: number = 0x8516;

/**
 * @constant {number}
 */
export const GL_TEXTURE_CUBE_MAP_POSITIVE_Y: number = 0x8517;

/**
 * @constant {number}
 */
export const GL_TEXTURE_CUBE_MAP_NEGATIVE_Y: number = 0x8518;

/**
 * @constant {number}
 */
export const GL_TEXTURE_CUBE_MAP_POSITIVE_Z: number = 0x8519;

/**
 * @constant {number}
 */
export const GL_TEXTURE_CUBE_MAP_NEGATIVE_Z: number = 0x851a;

/**
 * @constant {number}
 */
export const GL_MAX_CUBE_MAP_TEXTURE_SIZE: number = 0x851c;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE0: number = 0x84c0;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE1: number = 0x84c1;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE2: number = 0x84c2;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE3: number = 0x84c3;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE4: number = 0x84c4;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE5: number = 0x84c5;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE6: number = 0x84c6;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE7: number = 0x84c7;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE8: number = 0x84c8;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE9: number = 0x84c9;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE10: number = 0x84ca;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE11: number = 0x84cb;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE12: number = 0x84cc;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE13: number = 0x84cd;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE14: number = 0x84ce;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE15: number = 0x84cf;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE16: number = 0x84d0;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE17: number = 0x84d1;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE18: number = 0x84d2;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE19: number = 0x84d3;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE20: number = 0x84d4;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE21: number = 0x84d5;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE22: number = 0x84d6;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE23: number = 0x84d7;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE24: number = 0x84d8;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE25: number = 0x84d9;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE26: number = 0x84da;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE27: number = 0x84db;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE28: number = 0x84dc;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE29: number = 0x84dd;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE30: number = 0x84de;

/**
 * A texture unit
 * @constant {number}
 */
export const GL_TEXTURE31: number = 0x84df;

/**
 * The current active texture unit
 * @constant {number}
 */
export const GL_ACTIVE_TEXTURE: number = 0x84e0;

/**
 * @constant {number}
 */
export const GL_REPEAT: number = 0x2901;

/**
 * @constant {number}
 */
export const GL_CLAMP_TO_EDGE: number = 0x812f;

/**
 * @constant {number}
 */
export const GL_MIRRORED_REPEAT: number = 0x8370;

// Uniform types

/**
 * @constant {number}
 */
export const GL_FLOAT_VEC2: number = 0x8b50;

/**
 * @constant {number}
 */
export const GL_FLOAT_VEC3: number = 0x8b51;

/**
 * @constant {number}
 */
export const GL_FLOAT_VEC4: number = 0x8b52;

/**
 * @constant {number}
 */
export const GL_INT_VEC2: number = 0x8b53;

/**
 * @constant {number}
 */
export const GL_INT_VEC3: number = 0x8b54;

/**
 * @constant {number}
 */
export const GL_INT_VEC4: number = 0x8b55;

/**
 * @constant {number}
 */
export const GL_BOOL: number = 0x8b56;

/**
 * @constant {number}
 */
export const GL_BOOL_VEC2: number = 0x8b57;

/**
 * @constant {number}
 */
export const GL_BOOL_VEC3: number = 0x8b58;

/**
 * @constant {number}
 */
export const GL_BOOL_VEC4: number = 0x8b59;

/**
 * @constant {number}
 */
export const GL_FLOAT_MAT2: number = 0x8b5a;

/**
 * @constant {number}
 */
export const GL_FLOAT_MAT3: number = 0x8b5b;

/**
 * @constant {number}
 */
export const GL_FLOAT_MAT4: number = 0x8b5c;

/**
 * @constant {number}
 */
export const GL_SAMPLER_2D: number = 0x8b5e;

/**
 * @constant {number}
 */
export const GL_SAMPLER_CUBE: number = 0x8b60;

// Shader precision-specified types

/**
 * @constant {number}
 */
export const GL_LOW_FLOAT: number = 0x8df0;

/**
 * @constant {number}
 */
export const GL_MEDIUM_FLOAT: number = 0x8df1;

/**
 * @constant {number}
 */
export const GL_HIGH_FLOAT: number = 0x8df2;

/**
 * @constant {number}
 */
export const GL_LOW_INT: number = 0x8df3;

/**
 * @constant {number}
 */
export const GL_MEDIUM_INT: number = 0x8df4;

/**
 * @constant {number}
 */
export const GL_HIGH_INT: number = 0x8df5;

// Framebuffers and renderbuffers

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER: number = 0x8d40;

/**
 * @constant {number}
 */
export const GL_RENDERBUFFER: number = 0x8d41;

/**
 * @constant {number}
 */
export const GL_RGBA4: number = 0x8056;

/**
 * @constant {number}
 */
export const GL_RGB5_A1: number = 0x8057;

/**
 * @constant {number}
 */
export const GL_RGB565: number = 0x8d62;

/**
 * @constant {number}
 */
export const GL_DEPTH_COMPONENT16: number = 0x81a5;

/**
 * @constant {number}
 */
export const GL_STENCIL_INDEX: number = 0x1901;

/**
 * @constant {number}
 */
export const GL_STENCIL_INDEX8: number = 0x8d48;

/**
 * @constant {number}
 */
export const GL_DEPTH_STENCIL: number = 0x84f9;

/**
 * @constant {number}
 */
export const GL_RENDERBUFFER_WIDTH: number = 0x8d42;

/**
 * @constant {number}
 */
export const GL_RENDERBUFFER_HEIGHT: number = 0x8d43;

/**
 * @constant {number}
 */
export const GL_RENDERBUFFER_INTERNAL_FORMAT: number = 0x8d44;

/**
 * @constant {number}
 */
export const GL_RENDERBUFFER_RED_SIZE: number = 0x8d50;

/**
 * @constant {number}
 */
export const GL_RENDERBUFFER_GREEN_SIZE: number = 0x8d51;

/**
 * @constant {number}
 */
export const GL_RENDERBUFFER_BLUE_SIZE: number = 0x8d52;

/**
 * @constant {number}
 */
export const GL_RENDERBUFFER_ALPHA_SIZE: number = 0x8d53;

/**
 * @constant {number}
 */
export const GL_RENDERBUFFER_DEPTH_SIZE: number = 0x8d54;

/**
 * @constant {number}
 */
export const GL_RENDERBUFFER_STENCIL_SIZE: number = 0x8d55;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE: number = 0x8cd0;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_OBJECT_NAME: number = 0x8cd1;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL: number = 0x8cd2;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE: number = 0x8cd3;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT0: number = 0x8ce0;

/**
 * @constant {number}
 */
export const GL_DEPTH_ATTACHMENT: number = 0x8d00;

/**
 * @constant {number}
 */
export const GL_STENCIL_ATTACHMENT: number = 0x8d20;

/**
 * @constant {number}
 */
export const GL_DEPTH_STENCIL_ATTACHMENT: number = 0x821a;

/**
 * @constant {number}
 */
export const GL_NONE: number = 0;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_COMPLETE: number = 0x8cd5;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_INCOMPLETE_ATTACHMENT: number = 0x8cd6;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: number = 0x8cd7;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_INCOMPLETE_DIMENSIONS: number = 0x8cd9;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_UNSUPPORTED: number = 0x8cdd;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_BINDING: number = 0x8ca6;

/**
 * @constant {number}
 */
export const GL_RENDERBUFFER_BINDING: number = 0x8ca7;

/**
 * @constant {number}
 */
export const GL_MAX_RENDERBUFFER_SIZE: number = 0x84e8;

/**
 * @constant {number}
 */
export const GL_INVALID_FRAMEBUFFER_OPERATION: number = 0x0506;

// Pixel storage modes
// Constants passed to WebGLRenderingContext.pixelStorei()

/**
 * @constant {number}
 */
export const GL_UNPACK_FLIP_Y_WEBGL: number = 0x9240;

/**
 * @constant {number}
 */
export const GL_UNPACK_PREMULTIPLY_ALPHA_WEBGL: number = 0x9241;

/**
 * @constant {number}
 */
export const GL_UNPACK_COLORSPACE_CONVERSION_WEBGL: number = 0x9243;

// Additional constants defined WebGL 2
// These constants are defined on the WebGL2RenderingContext interface. All WebGL 1 constants are also available in a WebGL 2 context

// Getting GL parameter information
// Constants passed to WebGLRenderingContext.getParameter() to specify what information to return

/**
 * @constant {number}
 */
export const GL_READ_BUFFER: number = 0x0c02;

/**
 * @constant {number}
 */
export const GL_UNPACK_ROW_LENGTH: number = 0x0cf2;

/**
 * @constant {number}
 */
export const GL_UNPACK_SKIP_ROWS: number = 0x0cf3;

/**
 * @constant {number}
 */
export const GL_UNPACK_SKIP_PIXELS: number = 0x0cf4;

/**
 * @constant {number}
 */
export const GL_PACK_ROW_LENGTH: number = 0x0d02;

/**
 * @constant {number}
 */
export const GL_PACK_SKIP_ROWS: number = 0x0d03;

/**
 * @constant {number}
 */
export const GL_PACK_SKIP_PIXELS: number = 0x0d04;

/**
 * @constant {number}
 */
export const GL_TEXTURE_BINDING_3D: number = 0x806a;

/**
 * @constant {number}
 */
export const GL_UNPACK_SKIP_IMAGES: number = 0x806d;

/**
 * @constant {number}
 */
export const GL_UNPACK_IMAGE_HEIGHT: number = 0x806e;

/**
 * @constant {number}
 */
export const GL_MAX_3D_TEXTURE_SIZE: number = 0x8073;

/**
 * @constant {number}
 */
export const GL_MAX_ELEMENTS_VERTICES: number = 0x80e8;

/**
 * @constant {number}
 */
export const GL_MAX_ELEMENTS_INDICES: number = 0x80e9;

/**
 * @constant {number}
 */
export const GL_MAX_TEXTURE_LOD_BIAS: number = 0x84fd;

/**
 * @constant {number}
 */
export const GL_MAX_FRAGMENT_UNIFORM_COMPONENTS: number = 0x8b49;

/**
 * @constant {number}
 */
export const GL_MAX_VERTEX_UNIFORM_COMPONENTS: number = 0x8b4a;

/**
 * @constant {number}
 */
export const GL_MAX_ARRAY_TEXTURE_LAYERS: number = 0x88ff;

/**
 * @constant {number}
 */
export const GL_MIN_PROGRAM_TEXEL_OFFSET: number = 0x8904;

/**
 * @constant {number}
 */
export const GL_MAX_PROGRAM_TEXEL_OFFSET: number = 0x8905;

/**
 * @constant {number}
 */
export const GL_MAX_VARYING_COMPONENTS: number = 0x8b4b;

/**
 * @constant {number}
 */
export const GL_FRAGMENT_SHADER_DERIVATIVE_HINT: number = 0x8b8b;

/**
 * @constant {number}
 */
export const GL_RASTERIZER_DISCARD: number = 0x8c89;

/**
 * @constant {number}
 */
export const GL_VERTEX_ARRAY_BINDING: number = 0x85b5;

/**
 * @constant {number}
 */
export const GL_MAX_VERTEX_OUTPUT_COMPONENTS: number = 0x9122;

/**
 * @constant {number}
 */
export const GL_MAX_FRAGMENT_INPUT_COMPONENTS: number = 0x9125;

/**
 * @constant {number}
 */
export const GL_MAX_SERVER_WAIT_TIMEOUT: number = 0x9111;

/**
 * @constant {number}
 */
export const GL_MAX_ELEMENT_INDEX: number = 0x8d6b;

// Textures
// Constants passed to WebGLRenderingContext.texParameteri(), WebGLRenderingContext.texParameterf(), WebGLRenderingContext.bindTexture(), WebGLRenderingContext.texImage2D(), and others

/**
 * @constant {number}
 */
export const GL_RED: number = 0x1903;

/**
 * @constant {number}
 */
export const GL_RGB8: number = 0x8051;

/**
 * @constant {number}
 */
export const GL_RGBA8: number = 0x8058;

/**
 * @constant {number}
 */
export const GL_RGB10_A2: number = 0x8059;

/**
 * @constant {number}
 */
export const GL_TEXTURE_3D: number = 0x806f;

/**
 * @constant {number}
 */
export const GL_TEXTURE_WRAP_R: number = 0x8072;

/**
 * @constant {number}
 */
export const GL_TEXTURE_MIN_LOD: number = 0x813a;

/**
 * @constant {number}
 */
export const GL_TEXTURE_MAX_LOD: number = 0x813b;

/**
 * @constant {number}
 */
export const GL_TEXTURE_BASE_LEVEL: number = 0x813c;

/**
 * @constant {number}
 */
export const GL_TEXTURE_MAX_LEVEL: number = 0x813d;

/**
 * @constant {number}
 */
export const GL_TEXTURE_COMPARE_MODE: number = 0x884c;

/**
 * @constant {number}
 */
export const GL_TEXTURE_COMPARE_FUNC: number = 0x884d;

/**
 * @constant {number}
 */
export const GL_SRGB: number = 0x8c40;

/**
 * @constant {number}
 */
export const GL_SRGB8: number = 0x8c41;

/**
 * @constant {number}
 */
export const GL_SRGB8_ALPHA8: number = 0x8c43;

/**
 * @constant {number}
 */
export const GL_COMPARE_REF_TO_TEXTURE: number = 0x884e;

/**
 * @constant {number}
 */
export const GL_RGBA32F: number = 0x8814;

/**
 * @constant {number}
 */
export const GL_RGB32F: number = 0x8815;

/**
 * @constant {number}
 */
export const GL_RGBA16F: number = 0x881a;

/**
 * @constant {number}
 */
export const GL_RGB16F: number = 0x881b;

/**
 * @constant {number}
 */
export const GL_TEXTURE_2D_ARRAY: number = 0x8c1a;

/**
 * @constant {number}
 */
export const GL_TEXTURE_BINDING_2D_ARRAY: number = 0x8c1d;

/**
 * @constant {number}
 */
export const GL_R11F_G11F_B10F: number = 0x8c3a;

/**
 * @constant {number}
 */
export const GL_RGB9_E5: number = 0x8c3d;

/**
 * @constant {number}
 */
export const GL_RGBA32UI: number = 0x8d70;

/**
 * @constant {number}
 */
export const GL_RGB32UI: number = 0x8d71;

/**
 * @constant {number}
 */
export const GL_RGBA16UI: number = 0x8d76;

/**
 * @constant {number}
 */
export const GL_RGB16UI: number = 0x8d77;

/**
 * @constant {number}
 */
export const GL_RGBA8UI: number = 0x8d7c;

/**
 * @constant {number}
 */
export const GL_RGB8UI: number = 0x8d7d;

/**
 * @constant {number}
 */
export const GL_RGBA32I: number = 0x8d82;

/**
 * @constant {number}
 */
export const GL_RGB32I: number = 0x8d83;

/**
 * @constant {number}
 */
export const GL_RGBA16I: number = 0x8d88;

/**
 * @constant {number}
 */
export const GL_RGB16I: number = 0x8d89;

/**
 * @constant {number}
 */
export const GL_RGBA8I: number = 0x8d8e;

/**
 * @constant {number}
 */
export const GL_RGB8I: number = 0x8d8f;

/**
 * @constant {number}
 */
export const GL_RED_INTEGER: number = 0x8d94;

/**
 * @constant {number}
 */
export const GL_RGB_INTEGER: number = 0x8d98;

/**
 * @constant {number}
 */
export const GL_RGBA_INTEGER: number = 0x8d99;

/**
 * @constant {number}
 */
export const GL_R8: number = 0x8229;

/**
 * @constant {number}
 */
export const GL_RG8: number = 0x822b;

/**
 * @constant {number}
 */
export const GL_R16F: number = 0x822d;

/**
 * @constant {number}
 */
export const GL_R32F: number = 0x822e;

/**
 * @constant {number}
 */
export const GL_RG16F: number = 0x822f;

/**
 * @constant {number}
 */
export const GL_RG32F: number = 0x8230;

/**
 * @constant {number}
 */
export const GL_R8I: number = 0x8231;

/**
 * @constant {number}
 */
export const GL_R8UI: number = 0x8232;

/**
 * @constant {number}
 */
export const GL_R16I: number = 0x8233;

/**
 * @constant {number}
 */
export const GL_R16UI: number = 0x8234;

/**
 * @constant {number}
 */
export const GL_R32I: number = 0x8235;

/**
 * @constant {number}
 */
export const GL_R32UI: number = 0x8236;

/**
 * @constant {number}
 */
export const GL_RG8I: number = 0x8237;

/**
 * @constant {number}
 */
export const GL_RG8UI: number = 0x8238;

/**
 * @constant {number}
 */
export const GL_RG16I: number = 0x8239;

/**
 * @constant {number}
 */
export const GL_RG16UI: number = 0x823a;

/**
 * @constant {number}
 */
export const GL_RG32I: number = 0x823b;

/**
 * @constant {number}
 */
export const GL_RG32UI: number = 0x823c;

/**
 * @constant {number}
 */
export const GL_R8_SNORM: number = 0x8f94;

/**
 * @constant {number}
 */
export const GL_RG8_SNORM: number = 0x8f95;

/**
 * @constant {number}
 */
export const GL_RGB8_SNORM: number = 0x8f96;

/**
 * @constant {number}
 */
export const GL_RGBA8_SNORM: number = 0x8f97;

/**
 * @constant {number}
 */
export const GL_RGB10_A2UI: number = 0x906f;

/**
 * @constant {number}
 */
export const GL_TEXTURE_IMMUTABLE_FORMAT: number = 0x912f;

/**
 * @constant {number}
 */
export const GL_TEXTURE_IMMUTABLE_LEVELS: number = 0x82df;

// Pixel types

/**
 * @constant {number}
 */
export const GL_UNSIGNED_INT_2_10_10_10_REV: number = 0x8368;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_INT_10F_11F_11F_REV: number = 0x8c3b;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_INT_5_9_9_9_REV: number = 0x8c3e;

/**
 * @constant {number}
 */
export const GL_FLOAT_32_UNSIGNED_INT_24_8_REV: number = 0x8dad;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_INT_24_8: number = 0x84fa;

/**
 * @constant {number}
 */
export const GL_HALF_FLOAT: number = 0x140b;

/**
 * @constant {number}
 */
export const GL_RG: number = 0x8227;

/**
 * @constant {number}
 */
export const GL_RG_INTEGER: number = 0x8228;

/**
 * @constant {number}
 */
export const GL_INT_2_10_10_10_REV: number = 0x8d9f;

// Queries

/**
 * @constant {number}
 */
export const GL_CURRENT_QUERY: number = 0x8865;

/**
 * @constant {number}
 */
export const GL_QUERY_RESULT: number = 0x8866;

/**
 * @constant {number}
 */
export const GL_QUERY_RESULT_AVAILABLE: number = 0x8867;

/**
 * @constant {number}
 */
export const GL_ANY_SAMPLES_PASSED: number = 0x8c2f;

/**
 * @constant {number}
 */
export const GL_ANY_SAMPLES_PASSED_CONSERVATIVE: number = 0x8d6a;

// Draw buffers

/**
 * @constant {number}
 */
export const GL_MAX_DRAW_BUFFERS: number = 0x8824;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER0: number = 0x8825;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER1: number = 0x8826;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER2: number = 0x8827;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER3: number = 0x8828;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER4: number = 0x8829;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER5: number = 0x882a;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER6: number = 0x882b;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER7: number = 0x882c;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER8: number = 0x882d;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER9: number = 0x882e;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER10: number = 0x882f;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER11: number = 0x8830;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER12: number = 0x8831;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER13: number = 0x8832;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER14: number = 0x8833;

/**
 * @constant {number}
 */
export const GL_DRAW_BUFFER15: number = 0x8834;

/**
 * @constant {number}
 */
export const GL_MAX_COLOR_ATTACHMENTS: number = 0x8cdf;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT1: number = 0x8ce1;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT2: number = 0x8ce2;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT3: number = 0x8ce3;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT4: number = 0x8ce4;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT5: number = 0x8ce5;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT6: number = 0x8ce6;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT7: number = 0x8ce7;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT8: number = 0x8ce8;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT9: number = 0x8ce9;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT10: number = 0x8cea;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT11: number = 0x8ceb;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT12: number = 0x8cec;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT13: number = 0x8ced;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT14: number = 0x8cee;

/**
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT15: number = 0x8cef;

// Samplers

/**
 * @constant {number}
 */
export const GL_SAMPLER_3D: number = 0x8b5f;

/**
 * @constant {number}
 */
export const GL_SAMPLER_2D_SHADOW: number = 0x8b62;

/**
 * @constant {number}
 */
export const GL_SAMPLER_2D_ARRAY: number = 0x8dc1;

/**
 * @constant {number}
 */
export const GL_SAMPLER_2D_ARRAY_SHADOW: number = 0x8dc4;

/**
 * @constant {number}
 */
export const GL_SAMPLER_CUBE_SHADOW: number = 0x8dc5;

/**
 * @constant {number}
 */
export const GL_INT_SAMPLER_2D: number = 0x8dca;

/**
 * @constant {number}
 */
export const GL_INT_SAMPLER_3D: number = 0x8dcb;

/**
 * @constant {number}
 */
export const GL_INT_SAMPLER_CUBE: number = 0x8dcc;

/**
 * @constant {number}
 */
export const GL_INT_SAMPLER_2D_ARRAY: number = 0x8dcf;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_INT_SAMPLER_2D: number = 0x8dd2;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_INT_SAMPLER_3D: number = 0x8dd3;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_INT_SAMPLER_CUBE: number = 0x8dd4;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_INT_SAMPLER_2D_ARRAY: number = 0x8dd7;

/**
 * @constant {number}
 */
export const GL_MAX_SAMPLES: number = 0x8d57;

/**
 * @constant {number}
 */
export const GL_SAMPLER_BINDING: number = 0x8919;

// Buffers

/**
 * @constant {number}
 */
export const GL_PIXEL_PACK_BUFFER: number = 0x88eb;

/**
 * @constant {number}
 */
export const GL_PIXEL_UNPACK_BUFFER: number = 0x88ec;

/**
 * @constant {number}
 */
export const GL_PIXEL_PACK_BUFFER_BINDING: number = 0x88ed;

/**
 * @constant {number}
 */
export const GL_PIXEL_UNPACK_BUFFER_BINDING: number = 0x88ef;

/**
 * @constant {number}
 */
export const GL_COPY_READ_BUFFER: number = 0x8f36;

/**
 * @constant {number}
 */
export const GL_COPY_WRITE_BUFFER: number = 0x8f37;

/**
 * @constant {number}
 */
export const GL_COPY_READ_BUFFER_BINDING: number = 0x8f36;

/**
 * @constant {number}
 */
export const GL_COPY_WRITE_BUFFER_BINDING: number = 0x8f37;

// Data types

/**
 * @constant {number}
 */
export const GL_FLOAT_MAT2X3: number = 0x8b65;

/**
 * @constant {number}
 */
export const GL_FLOAT_MAT2X4: number = 0x8b66;

/**
 * @constant {number}
 */
export const GL_FLOAT_MAT3X2: number = 0x8b67;

/**
 * @constant {number}
 */
export const GL_FLOAT_MAT3X4: number = 0x8b68;

/**
 * @constant {number}
 */
export const GL_FLOAT_MAT4X2: number = 0x8b69;

/**
 * @constant {number}
 */
export const GL_FLOAT_MAT4X3: number = 0x8b6a;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_INT_VEC2: number = 0x8dc6;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_INT_VEC3: number = 0x8dc7;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_INT_VEC4: number = 0x8dc8;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_NORMALIZED: number = 0x8c17;

/**
 * @constant {number}
 */
export const GL_SIGNED_NORMALIZED: number = 0x8f9c;

// Vertex attributes

/**
 * @constant {number}
 */
export const GL_VERTEX_ATTRIB_ARRAY_INTEGER: number = 0x88fd;

/**
 * @constant {number}
 */
export const GL_VERTEX_ATTRIB_ARRAY_DIVISOR: number = 0x88fe;

// Transform feedback

/**
 * @constant {number}
 */
export const GL_TRANSFORM_FEEDBACK_BUFFER_MODE: number = 0x8c7f;

/**
 * @constant {number}
 */
export const GL_MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS: number = 0x8c80;

/**
 * @constant {number}
 */
export const GL_TRANSFORM_FEEDBACK_VARYINGS: number = 0x8c83;

/**
 * @constant {number}
 */
export const GL_TRANSFORM_FEEDBACK_BUFFER_START: number = 0x8c84;

/**
 * @constant {number}
 */
export const GL_TRANSFORM_FEEDBACK_BUFFER_SIZE: number = 0x8c85;

/**
 * @constant {number}
 */
export const GL_TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN: number = 0x8c88;

/**
 * @constant {number}
 */
export const GL_MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS: number = 0x8c8a;

/**
 * @constant {number}
 */
export const GL_MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS: number = 0x8c8b;

/**
 * @constant {number}
 */
export const GL_INTERLEAVED_ATTRIBS: number = 0x8c8c;

/**
 * @constant {number}
 */
export const GL_SEPARATE_ATTRIBS: number = 0x8c8d;

/**
 * @constant {number}
 */
export const GL_TRANSFORM_FEEDBACK_BUFFER: number = 0x8c8e;

/**
 * @constant {number}
 */
export const GL_TRANSFORM_FEEDBACK_BUFFER_BINDING: number = 0x8c8f;

/**
 * @constant {number}
 */
export const GL_TRANSFORM_FEEDBACK: number = 0x8e22;

/**
 * @constant {number}
 */
export const GL_TRANSFORM_FEEDBACK_PAUSED: number = 0x8e23;

/**
 * @constant {number}
 */
export const GL_TRANSFORM_FEEDBACK_ACTIVE: number = 0x8e24;

/**
 * @constant {number}
 */
export const GL_TRANSFORM_FEEDBACK_BINDING: number = 0x8e25;

// Framebuffers and renderbuffers

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING: number = 0x8210;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE: number = 0x8211;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_RED_SIZE: number = 0x8212;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_GREEN_SIZE: number = 0x8213;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_BLUE_SIZE: number = 0x8214;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE: number = 0x8215;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE: number = 0x8216;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE: number = 0x8217;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_DEFAULT: number = 0x8218;

/**
 * @constant {number}
 */
export const GL_DEPTH24_STENCIL8: number = 0x88f0;

/**
 * @constant {number}
 */
export const GL_DRAW_FRAMEBUFFER_BINDING: number = 0x8ca6;

/**
 * @constant {number}
 */
export const GL_READ_FRAMEBUFFER: number = 0x8ca8;

/**
 * @constant {number}
 */
export const GL_DRAW_FRAMEBUFFER: number = 0x8ca9;

/**
 * @constant {number}
 */
export const GL_READ_FRAMEBUFFER_BINDING: number = 0x8caa;

/**
 * @constant {number}
 */
export const GL_RENDERBUFFER_SAMPLES: number = 0x8cab;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER: number = 0x8cd4;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_INCOMPLETE_MULTISAMPLE: number = 0x8d56;

// Uniforms

/**
 * @constant {number}
 */
export const GL_UNIFORM_BUFFER: number = 0x8a11;

/**
 * @constant {number}
 */
export const GL_UNIFORM_BUFFER_BINDING: number = 0x8a28;

/**
 * @constant {number}
 */
export const GL_UNIFORM_BUFFER_START: number = 0x8a29;

/**
 * @constant {number}
 */
export const GL_UNIFORM_BUFFER_SIZE: number = 0x8a2a;

/**
 * @constant {number}
 */
export const GL_MAX_VERTEX_UNIFORM_BLOCKS: number = 0x8a2b;

/**
 * @constant {number}
 */
export const GL_MAX_FRAGMENT_UNIFORM_BLOCKS: number = 0x8a2d;

/**
 * @constant {number}
 */
export const GL_MAX_COMBINED_UNIFORM_BLOCKS: number = 0x8a2e;

/**
 * @constant {number}
 */
export const GL_MAX_UNIFORM_BUFFER_BINDINGS: number = 0x8a2f;

/**
 * @constant {number}
 */
export const GL_MAX_UNIFORM_BLOCK_SIZE: number = 0x8a30;

/**
 * @constant {number}
 */
export const GL_MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS: number = 0x8a31;

/**
 * @constant {number}
 */
export const GL_MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS: number = 0x8a33;

/**
 * @constant {number}
 */
export const GL_UNIFORM_BUFFER_OFFSET_ALIGNMENT: number = 0x8a34;

/**
 * @constant {number}
 */
export const GL_ACTIVE_UNIFORM_BLOCKS: number = 0x8a36;

/**
 * @constant {number}
 */
export const GL_UNIFORM_TYPE: number = 0x8a37;

/**
 * @constant {number}
 */
export const GL_UNIFORM_SIZE: number = 0x8a38;

/**
 * @constant {number}
 */
export const GL_UNIFORM_BLOCK_INDEX: number = 0x8a3a;

/**
 * @constant {number}
 */
export const GL_UNIFORM_OFFSET: number = 0x8a3b;

/**
 * @constant {number}
 */
export const GL_UNIFORM_ARRAY_STRIDE: number = 0x8a3c;

/**
 * @constant {number}
 */
export const GL_UNIFORM_MATRIX_STRIDE: number = 0x8a3d;

/**
 * @constant {number}
 */
export const GL_UNIFORM_IS_ROW_MAJOR: number = 0x8a3e;

/**
 * @constant {number}
 */
export const GL_UNIFORM_BLOCK_BINDING: number = 0x8a3f;

/**
 * @constant {number}
 */
export const GL_UNIFORM_BLOCK_DATA_SIZE: number = 0x8a40;

/**
 * @constant {number}
 */
export const GL_UNIFORM_BLOCK_ACTIVE_UNIFORMS: number = 0x8a42;

/**
 * @constant {number}
 */
export const GL_UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES: number = 0x8a43;

/**
 * @constant {number}
 */
export const GL_UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER: number = 0x8a44;

/**
 * @constant {number}
 */
export const GL_UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER: number = 0x8a46;

// Sync objects

/**
 * @constant {number}
 */
export const GL_OBJECT_TYPE: number = 0x9112;

/**
 * @constant {number}
 */
export const GL_SYNC_CONDITION: number = 0x9113;

/**
 * @constant {number}
 */
export const GL_SYNC_STATUS: number = 0x9114;

/**
 * @constant {number}
 */
export const GL_SYNC_FLAGS: number = 0x9115;

/**
 * @constant {number}
 */
export const GL_SYNC_FENCE: number = 0x9116;

/**
 * @constant {number}
 */
export const GL_SYNC_GPU_COMMANDS_COMPLETE: number = 0x9117;

/**
 * @constant {number}
 */
export const GL_UNSIGNALED: number = 0x9118;

/**
 * @constant {number}
 */
export const GL_SIGNALED: number = 0x9119;

/**
 * @constant {number}
 */
export const GL_ALREADY_SIGNALED: number = 0x911a;

/**
 * @constant {number}
 */
export const GL_TIMEOUT_EXPIRED: number = 0x911b;

/**
 * @constant {number}
 */
export const GL_CONDITION_SATISFIED: number = 0x911c;

/**
 * @constant {number}
 */
export const GL_WAIT_FAILED: number = 0x911d;

/**
 * @constant {number}
 */
export const GL_SYNC_FLUSH_COMMANDS_BIT: number = 0x00000001;

// Miscellaneous constants

/**
 * @constant {number}
 */
export const GL_COLOR: number = 0x1800;

/**
 * @constant {number}
 */
export const GL_DEPTH: number = 0x1801;

/**
 * @constant {number}
 */
export const GL_STENCIL: number = 0x1802;

/**
 * @constant {number}
 */
export const GL_MIN: number = 0x8007;

/**
 * @constant {number}
 */
export const GL_MAX: number = 0x8008;

/**
 * @constant {number}
 */
export const GL_DEPTH_COMPONENT24: number = 0x81a6;

/**
 * @constant {number}
 */
export const GL_STREAM_READ: number = 0x88e1;

/**
 * @constant {number}
 */
export const GL_STREAM_COPY: number = 0x88e2;

/**
 * @constant {number}
 */
export const GL_STATIC_READ: number = 0x88e5;

/**
 * @constant {number}
 */
export const GL_STATIC_COPY: number = 0x88e6;

/**
 * @constant {number}
 */
export const GL_DYNAMIC_READ: number = 0x88e9;

/**
 * @constant {number}
 */
export const GL_DYNAMIC_COPY: number = 0x88ea;

/**
 * @constant {number}
 */
export const GL_DEPTH_COMPONENT32F: number = 0x8cac;

/**
 * @constant {number}
 */
export const GL_DEPTH32F_STENCIL8: number = 0x8cad;

/**
 * @constant {number}
 */
export const GL_INVALID_INDEX: number = 0xffffffff;

/**
 * @constant {number}
 */
export const GL_TIMEOUT_IGNORED: number = -1;

/**
 * @constant {number}
 */
export const GL_MAX_CLIENT_WAIT_TIMEOUT_WEBGL: number = 0x9247;

// Constants defined in WebGL extensions

// ANGLE_instanced_arrays
// The ANGLE_instanced_arrays extension is part of the WebGL API and allows to draw the same object, or groups of similar objects multiple times, if they share the same vertex data, primitive count and type
/**
 * Describes the frequency divisor used for instanced rendering
 * @constant {number}
 */
export const GL_VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE: number = 0x88fe;

// WEBGL_debug_renderer_info
// The WEBGL_debug_renderer_info extension is part of the WebGL API and exposes two constants with information about the graphics driver for debugging purposes
/**
 * Passed to getParameter to get the vendor string of the graphics driver
 * @constant {number}
 */
export const GL_UNMASKED_VENDOR_WEBGL: number = 0x9245;

/**
 * Passed to getParameter to get the renderer string of the graphics driver
 * @constant {number}
 */
export const GL_UNMASKED_RENDERER_WEBGL: number = 0x9246;

// EXT_texture_filter_anisotropic
// The EXT_texture_filter_anisotropic extension is part of the WebGL API and exposes two constants for anisotropic filtering (AF)
/**
 * Returns the maximum available anisotropy
 * @constant {number}
 */
export const GL_MAX_TEXTURE_MAX_ANISOTROPY_EXT: number = 0x84ff;

/**
 * Passed to texParameter to set the desired maximum anisotropy for a texture
 * @constant {number}
 */
export const GL_TEXTURE_MAX_ANISOTROPY_EXT: number = 0x84fe;

// WEBGL_compressed_texture_s3tc
// The WEBGL_compressed_texture_s3tc extension is part of the WebGL API and exposes four S3TC compressed texture formats
/**
 * A DXT1-compressed image in an RGB image format
 * @constant {number}
 */
export const GL_COMPRESSED_RGB_S3TC_DXT1_EXT: number = 0x83f0;

/**
 * A DXT1-compressed image in an RGB image format with a simple on/off alpha value
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_S3TC_DXT1_EXT: number = 0x83f1;

/**
 * A DXT3-compressed image in an RGBA image format. Compared to a 32-bit RGBA texture, it offers 4:1 compression
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_S3TC_DXT3_EXT: number = 0x83f2;

/**
 * A DXT5-compressed image in an RGBA image format. It also provides a 4:1 compression, but differs to the DXT3 compression in how the alpha compression is done
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_S3TC_DXT5_EXT: number = 0x83f3;

// WEBGL_compressed_texture_s3tc_srgb
// The WEBGL_compressed_texture_s3tc_srgb extension is part of the WebGL API and exposes four S3TC compressed texture formats for the sRGB colorspace
/**
 * A DXT1-compressed image in an sRGB image format
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB_S3TC_DXT1_EXT: number = 0x8c4c;

/**
 * A DXT1-compressed image in an sRGB image format with a simple on/off alpha value
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT: number = 0x8c4d;

/**
 * A DXT3-compressed image in an sRGBA image format
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT: number = 0x8c4e;

/**
 * A DXT5-compressed image in an sRGBA image format
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT: number = 0x8c4f;

// WEBGL_compressed_texture_etc
// The WEBGL_compressed_texture_etc extension is part of the WebGL API and exposes 10 ETC/EAC compressed texture formats
/**
 * One-channel (red) unsigned format compression
 * @constant {number}
 */
export const GL_COMPRESSED_R11_EAC: number = 0x9270;

/**
 * One-channel (red) signed format compression
 * @constant {number}
 */
export const GL_COMPRESSED_SIGNED_R11_EAC: number = 0x9271;

/**
 * Two-channel (red and green) unsigned format compression
 * @constant {number}
 */
export const GL_COMPRESSED_RG11_EAC: number = 0x9272;

/**
 * Two-channel (red and green) signed format compression
 * @constant {number}
 */
export const GL_COMPRESSED_SIGNED_RG11_EAC: number = 0x9273;

/**
 * Compresses RBG8 data with no alpha channel
 * @constant {number}
 */
export const GL_COMPRESSED_RGB8_ETC2: number = 0x9274;

/**
 * Compresses RGBA8 data. The RGB part is encoded the same as RGB_ETC2, but the alpha part is encoded separately
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA8_ETC2_EAC: number = 0x9275;

/**
 * Compresses sRBG8 data with no alpha channel
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ETC2: number = 0x9276;

/**
 * Compresses sRGBA8 data. The sRGB part is encoded the same as SRGB_ETC2, but the alpha part is encoded separately
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ETC2_EAC: number = 0x9277;

/**
 * Similar to RGB8_ETC, but with ability to punch through the alpha channel, which means to make it completely opaque or transparent
 * @constant {number}
 */
export const GL_COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2: number = 0x9278;

/**
 * Similar to SRGB8_ETC, but with ability to punch through the alpha channel, which means to make it completely opaque or transparent
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2: number = 0x9279;

// WEBGL_compressed_texture_pvrtc
// The WEBGL_compressed_texture_pvrtc extension is part of the WebGL API and exposes four PVRTC compressed texture formats
/**
 * RGB compression in 4-bit mode. One block for each 4×4 pixels
 * @constant {number}
 */
export const GL_COMPRESSED_RGB_PVRTC_4BPPV1_IMG: number = 0x8c00;

/**
 * RGBA compression in 4-bit mode. One block for each 4×4 pixels
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_PVRTC_4BPPV1_IMG: number = 0x8c02;

/**
 * RGB compression in 2-bit mode. One block for each 8×4 pixels
 * @constant {number}
 */
export const GL_COMPRESSED_RGB_PVRTC_2BPPV1_IMG: number = 0x8c01;

/**
 * RGBA compression in 2-bit mode. One block for each 8×4 pixels
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_PVRTC_2BPPV1_IMG: number = 0x8c03;

// WEBGL_compressed_texture_etc1
// The WEBGL_compressed_texture_etc1 extension is part of the WebGL API and exposes the ETC1 compressed texture format
/**
 * Compresses 24-bit RGB data with no alpha channel
 * @constant {number}
 */
export const GL_COMPRESSED_RGB_ETC1_WEBGL: number = 0x8d64;

// WEBGL_compressed_texture_atc
// The WEBGL_compressed_texture_atc extension is part of the WebGL API and exposes 3 ATC compressed texture formats. ATC is a proprietary compression algorithm for compressing textures on handheld devices
/**
 * Compresses RGB textures with no alpha channel
 * @constant {number}
 */
export const GL_COMPRESSED_RGB_ATC_WEBGL: number = 0x8c92;

/**
 * Compresses RGBA textures using explicit alpha encoding (useful when alpha transitions are sharp)
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ATC_EXPLICIT_ALPHA_WEBGL: number = 0x8c92;

/**
 * Compresses RGBA textures using interpolated alpha encoding (useful when alpha transitions are gradient)
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL: number = 0x87ee;

// WEBGL_compressed_texture_astc
// The WEBGL_compressed_texture_astc extension is part of the WebGL API and exposes Adaptive Scalable Texture Compression (ASTC) compressed texture formats to WebGL
// https://www.khronos.org/registry/webgl/extensions/WEBGL_compressed_texture_astc/
// https://developer.nvidia.com/astc-texture-compression-for-game-assets
/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 4x4
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_4X4_KHR: number = 0x93b0;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 5x4
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_5X4_KHR: number = 0x93b1;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 5x5
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_5X5_KHR: number = 0x93b2;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 6x5
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_6X5_KHR: number = 0x93b3;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 6x6
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_6X6_KHR: number = 0x93b4;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 8x5
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_8X5_KHR: number = 0x93b5;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 8x6
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_8X6_KHR: number = 0x93b6;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 8x8
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_8X8_KHR: number = 0x93b7;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 10x5
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_10X5_KHR: number = 0x93b8;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 10x6
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_10X6_KHR: number = 0x93b9;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 10x8
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_10X8_KHR: number = 0x93ba;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 10x10
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_10X10_KHR: number = 0x93bb;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 12x10
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_12X10_KHR: number = 0x93bc;

/**
 * Compresses RGBA textures using ASTC compression in a blocksize of 12x12
 * @constant {number}
 */
export const GL_COMPRESSED_RGBA_ASTC_12X12_KHR: number = 0x93bd;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 4x4
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_4X4_KHR: number = 0x93d0;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 5x4
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_5X4_KHR: number = 0x93d1;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 5x5
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_5X5_KHR: number = 0x93d2;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 6x5
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_6X5_KHR: number = 0x93d3;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 6x6
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_6X6_KHR: number = 0x93d4;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 8x5
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_8X5_KHR: number = 0x93d5;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 8x6
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_8X6_KHR: number = 0x93d6;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 8x8
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_8X8_KHR: number = 0x93d7;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 10x5
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_10X5_KHR: number = 0x93d8;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 10x6
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_10X6_KHR: number = 0x93d9;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 10x8
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_10X8_KHR: number = 0x93da;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 10x10
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_10X10_KHR: number = 0x93db;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 12x10
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_12X10_KHR: number = 0x93dc;

/**
 * Compresses SRGB8 textures using ASTC compression in a blocksize of 12x12
 * @constant {number}
 */
export const GL_COMPRESSED_SRGB8_ALPHA8_ASTC_12X12_KHR: number = 0x93dd;

// WEBGL_depth_texture
// The WEBGL_depth_texture extension is part of the WebGL API and defines 2D depth and depth-stencil textures
/**
 * Unsigned integer type for 24-bit depth texture data
 * @constant {number}
 */
export const GL_UNSIGNED_INT_24_8_WEBGL: number = 0x84fa;

// OES_texture_half_float
// The OES_texture_half_float extension is part of the WebGL API and adds texture formats with 16- (aka half float) and 32-bit floating-point components
/**
 * Half floating-point type (16-bit)
 * @constant {number}
 */
export const GL_HALF_FLOAT_OES: number = 0x8d61;

// WEBGL_color_buffer_float
// The WEBGL_color_buffer_float extension is part of the WebGL API and adds the ability to render to 32-bit floating-point color buffers
/**
 * RGBA 32-bit floating-point color-renderable format
 * @constant {number}
 */
export const GL_RGBA32F_EXT: number = 0x8814;

/**
 * RGB 32-bit floating-point color-renderable format
 * @constant {number}
 */
export const GL_RGB32F_EXT: number = 0x8815;

/**
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE_EXT: number = 0x8211;

/**
 * @constant {number}
 */
export const GL_UNSIGNED_NORMALIZED_EXT: number = 0x8c17;

// EXT_blend_minmax
// The EXT_blend_minmax extension is part of the WebGL API and extends blending capabilities by adding two new blend equations: the minimum or maximum color components of the source and destination colors
/**
 * Produces the minimum color components of the source and destination colors
 * @constant {number}
 */
export const GL_MIN_EXT: number = 0x8007;

/**
 * Produces the maximum color components of the source and destination colors
 * @constant {number}
 */
export const GL_MAX_EXT: number = 0x8008;

// EXT_sRGB
// The EXT_sRGB extension is part of the WebGL API and adds sRGB support to textures and framebuffer objects
/**
 * Unsized sRGB format that leaves the precision up to the driver
 * @constant {number}
 */
export const GL_SRGB_EXT: number = 0x8c40;

/**
 * Unsized sRGB format with unsized alpha component
 * @constant {number}
 */
export const GL_SRGB_ALPHA_EXT: number = 0x8c42;

/**
 * Sized (8-bit) sRGB and alpha formats
 * @constant {number}
 */
export const GL_SRGB8_ALPHA8_EXT: number = 0x8c43;

/**
 * Returns the framebuffer color encoding
 * @constant {number}
 */
export const GL_FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING_EXT: number = 0x8210;

// OES_standard_derivatives
// The OES_standard_derivatives extension is part of the WebGL API and adds the GLSL derivative functions dFdx, dFdy, and fwidth
/**
 * Indicates the accuracy of the derivative calculation for the GLSL built-in functions: dFdx, dFdy, and fwidth
 * @constant {number}
 */
export const GL_FRAGMENT_SHADER_DERIVATIVE_HINT_OES: number = 0x8b8b;

// WEBGL_draw_buffers
// The WEBGL_draw_buffers extension is part of the WebGL API and enables a fragment shader to write to several textures, which is useful for deferred shading, for example
/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT0_WEBGL: number = 0x8ce0;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT1_WEBGL: number = 0x8ce1;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT2_WEBGL: number = 0x8ce2;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT3_WEBGL: number = 0x8ce3;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT4_WEBGL: number = 0x8ce4;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT5_WEBGL: number = 0x8ce5;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT6_WEBGL: number = 0x8ce6;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT7_WEBGL: number = 0x8ce7;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT8_WEBGL: number = 0x8ce8;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT9_WEBGL: number = 0x8ce9;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT10_WEBGL: number = 0x8cea;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT11_WEBGL: number = 0x8ceb;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT12_WEBGL: number = 0x8cec;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT13_WEBGL: number = 0x8ced;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT14_WEBGL: number = 0x8cee;

/**
 * Framebuffer color attachment point
 * @constant {number}
 */
export const GL_COLOR_ATTACHMENT15_WEBGL: number = 0x8cef;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER0_WEBGL: number = 0x8825;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER1_WEBGL: number = 0x8826;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER2_WEBGL: number = 0x8827;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER3_WEBGL: number = 0x8828;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER4_WEBGL: number = 0x8829;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER5_WEBGL: number = 0x882a;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER6_WEBGL: number = 0x882b;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER7_WEBGL: number = 0x882c;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER8_WEBGL: number = 0x882d;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER9_WEBGL: number = 0x882e;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER10_WEBGL: number = 0x882f;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER11_WEBGL: number = 0x8830;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER12_WEBGL: number = 0x8831;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER13_WEBGL: number = 0x8832;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER14_WEBGL: number = 0x8833;

/**
 * Draw buffer
 * @constant {number}
 */
export const GL_DRAW_BUFFER15_WEBGL: number = 0x8834;

/**
 * Maximum number of framebuffer color attachment points
 * @constant {number}
 */
export const GL_MAX_COLOR_ATTACHMENTS_WEBGL: number = 0x8cdf;

/**
 * Maximum number of draw buffers
 * @constant {number}
 */
export const GL_MAX_DRAW_BUFFERS_WEBGL: number = 0x8824;

// OES_vertex_array_object
// The OES_vertex_array_object extension is part of the WebGL API and provides vertex array objects (VAOs) which encapsulate vertex array states. These objects keep pointers to vertex data and provide names for different sets of vertex data
/**
 * The bound vertex array object (VAO)
 * @constant {number}
 */
export const GL_VERTEX_ARRAY_BINDING_OES: number = 0x85b5;

// EXT_disjoint_timer_query
// The EXT_disjoint_timer_query extension is part of the WebGL API and provides a way to measure the duration of a set of GL commands, without stalling the rendering pipeline
/**
 * The number of bits used to hold the query result for the given target
 * @constant {number}
 */
export const GL_QUERY_COUNTER_BITS_EXT: number = 0x8864;

/**
 * The currently active query
 * @constant {number}
 */
export const GL_CURRENT_QUERY_EXT: number = 0x8865;

/**
 * The query result
 * @constant {number}
 */
export const GL_QUERY_RESULT_EXT: number = 0x8866;

/**
 * A Boolean indicating whether or not a query result is available
 * @constant {number}
 */
export const GL_QUERY_RESULT_AVAILABLE_EXT: number = 0x8867;

/**
 * Elapsed time (in nanoseconds)
 * @constant {number}
 */
export const GL_TIME_ELAPSED_EXT: number = 0x88bf;

/**
 * The current time
 * @constant {number}
 */
export const GL_TIMESTAMP_EXT: number = 0x8e28;

/**
 * A Boolean indicating whether or not the GPU performed any disjoint operation
 * @constant {number}
 */
export const GL_GPU_DISJOINT_EXT: number = 0x8fbb;

// Constants defined in WebGL draft extensions

// KHR_parallel_shader_compile
// The KHR_parallel_shader_compile extension is part of the WebGL draft API and provides multithreaded asynchronous shader compilation
/**
 * Query to determine if the compilation process is complete
 * @constant {number}
 */
export const GL_COMPLETION_STATUS_KHR: number = 0x91b1;
