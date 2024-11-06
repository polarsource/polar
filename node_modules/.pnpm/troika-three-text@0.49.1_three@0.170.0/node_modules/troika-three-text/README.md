# Troika Text for Three.js

The `troika-three-text` package provides high quality text rendering in [Three.js](https://threejs.org) scenes, using signed distance fields (SDF) and antialiasing using standard derivatives.

Rather than relying on pre-generated SDF textures, this parses font files (.ttf, .otf, .woff) directly using [Typr](https://github.com/fredli74/Typr.ts), and generates the SDF atlas for glyphs on-the-fly as they are used. It also handles proper kerning, ligature glyph substitution, right-to-left/bidirectional layout, joined scripts like Arabic, and will automatically load fallback fonts for full unicode coverage. All font parsing, SDF generation, and glyph layout is performed in a web worker to prevent frame drops.

Once the SDFs are generated, it assembles a geometry that positions all the glyphs, and _patches_ any Three.js Material with the proper shader code for rendering the SDFs. This means you can still benefit from all the features of Three.js's built-in materials like lighting, physically-based rendering, shadows, and fog.

## Demos

* [With the Troika scene management framework](https://troika-examples.netlify.com/#text)
* [With react-three-fiber](https://codesandbox.io/embed/troika-3d-text-via-react-three-fiber-ntfx2?fontsize=14)
* [With a video texture](https://bfplr.csb.app/)
* [With the Material Icons font](https://codesandbox.io/s/material-icons-in-troika-three-text-t2mu7?file=/src/index.js)
* [With in-place editing](https://stackblitz.com/edit/vitejs-vite-xq3mug?file=src%2Fmain.js)

## With Other Frameworks

* [In the `drei` utilities for react-three-fiber](https://github.com/pmndrs/drei#text)
* [As an A-Frame component](https://github.com/lojjic/aframe-troika-text)
* [As a Web Component in three-elements](https://www.npmjs.com/package/@three-elements/text)

## Screenshots

![Text Rendering](../../docs/troika-three-text/images/screenshot1.png)

![Zoomed-in](../../docs/troika-three-text/images/screenshot2.png)

![Font with ligatures](../../docs/troika-three-text/images/screenshot3.png)

![Text with a texture](../../docs/troika-three-text/images/screenshot4.png)

![Unicode coverage](../../docs/troika-three-text/images/screenshot5.png)

## Installation

Get it from [NPM](https://www.npmjs.com/package/troika-three-text):

```sh
npm install troika-three-text
```

You will also need to install a compatible version of [Three.js](https://threejs.org); see the [notes on Three.js versions in the Getting Started docs](../../docs/getting-started/setup.md#threejs) for details.

```sh
npm install three
```

## Usage

```js
import {Text} from 'troika-three-text'
```

You can then use the `Text` class like any other Three.js mesh:

```js
// Create:
const myText = new Text()
myScene.add(myText)

// Set properties to configure:
myText.text = 'Hello world!'
myText.fontSize = 0.2
myText.position.z = -2
myText.color = 0x9966FF

// Update the rendering:
myText.sync()
```

It's a good idea to call the `.sync()` method after changing any properties that would affect the text's layout. If you don't, it will be called automatically on the next render frame, but calling it yourself can get the result sooner.

When you're done with the `Text` instance, be sure to call `dispose` on it to prevent a memory leak:

```js
myScene.remove(myText)
myText.dispose()
```

## Supported properties

Instances of `Text` support the following configuration properties:

### `text`

The string of text to be rendered. Newlines and repeating whitespace characters are honored.

Default: _none_

### `anchorX`

Defines the horizontal position in the text block that should line up with the local origin. Can be specified as a numeric `x` position in local units, a string percentage of the total text block width e.g. `'25%'`, or one of the following keyword strings: `'left'`, `'center'`, or `'right'`.

Default: `0`

### `anchorY`

Defines the vertical position in the text block that should line up with the local origin. Can be specified as a numeric `y` position in local units (note: down is negative y), a string percentage of the total text block height e.g. `'25%'`, or one of the following keyword strings: `'top'`, `'top-baseline'`, `'top-cap'`, `'top-ex'`, `'middle'`, `'bottom-baseline'`, or `'bottom'`.

Default: `0`

### `clipRect`

If specified, defines the `[minX, minY, maxX, maxY]` of a rectangle outside of which all pixels will be discarded. This can be used for example to clip overflowing text when `whiteSpace='nowrap'`.

Default: _none_

### `color`

This is a shortcut for setting the `color` of the text's `material`. You can use this if you don't want to specify a whole custom `material` and just want to change its color.

Use the `material` property if you want to control aspects of the material other than its color.

Default: _none_ - uses the color of the `material`

### `curveRadius`

Defines a cylindrical radius along which the text's plane will be curved. Positive numbers put the cylinder's centerline (oriented vertically) that distance in front of the text, for a concave curvature, while negative numbers put it behind the text for a convex curvature. The centerline will be aligned with the text's local origin; you can use `anchorX` to offset it.

Since each glyph is by default rendered with a simple quad, each glyph remains a flat plane internally. You can use [`glyphGeometryDetail`](#glyphgeometrydetail) to add more vertices for curvature inside glyphs.

Default: `0`

### `depthOffset`

This is a shortcut for setting the material's [`polygonOffset` and related properties](https://threejs.org/docs/#api/en/materials/Material.polygonOffset), which can be useful in preventing z-fighting when this text is laid on top of another plane in the scene. Positive numbers are further from the camera, negatives closer.

Be aware that while this can help with z-fighting, it does not affect the rendering order; if the text renders before the content behind it, you may see antialiasing pixels that appear too dark or light. You may need to also change the text mesh's `renderOrder`, or set its `z` position a fraction closer to the camera, to ensure the text renders after background objects.

Default: `0`

### `direction`

Sets the base direction for the text. The default value of "auto" will choose a direction based on the text's content according to the bidi spec. A value of "ltr" or "rtl" will force the direction.

Default: `'auto'`

### `fillOpacity`

Controls the opacity of just the glyph's fill area, separate from any configured `strokeOpacity`, `outlineOpacity`, and the material's `opacity`. A `fillOpacity` of `0` will make the fill invisible, leaving just the stroke and/or outline.

Default: `1`

### `font`

The URL of a custom font file to be used. Supported font formats are:
* .ttf
* .otf
* .woff (.woff2 is _not_ supported)

Default: The *Roboto* font loaded from Google Fonts CDN

### `fontSize`

The em-height at which to render the font, in local world units.

Default: `0.1`

### `fontStyle`

Either `"italic"` or `"normal"`. Currently only used to select the preferred style for the [fallback Unicode fonts](#unicode-fallback-fonts).

Default: `"normal"`

### `fontWeight`

A numeric font weight, `"normal"`, or `"bold"`. Currently only used to select the preferred weight for the [fallback Unicode fonts](#unicode-fallback-fonts).

Default: `"normal"`

### `glyphGeometryDetail`

The number of vertical/horizontal segments that make up each glyph's rectangular plane. This can be increased to provide more geometrical detail for custom vertex shader effects, for example.

Default: `1`

### `gpuAccelerateSDF`

When `true`, the SDF generation process will be GPU-accelerated with WebGL when possible, making it much faster especially for complex glyphs, and falling back to a JavaScript version executed in web workers when support isn't available. It should automatically detect support, but it's still somewhat experimental, so you can set it to `false` to force it to use the JS version if you encounter issues with it.

Default: `true`

### `letterSpacing`

Sets a uniform adjustment to spacing between letters after kerning is applied, in local world units. Positive numbers increase spacing and negative numbers decrease it.

Default: `0`

### `lineHeight`

Sets the height of each line of text. Can either be `'normal'` which chooses a reasonable height based on the chosen font's ascender/descender metrics, or a number that is interpreted as a multiple of the `fontSize`.

Default: `'normal'`

### `material`

Defines a Three.js Material _instance_ to be used as a base when rendering the text. This material will be automatically replaced with a new material derived from it, that adds shader code to decrease the alpha for each fragment (pixel) outside the text glyphs, with antialiasing.

By default it will derive from a simple white `MeshBasicMaterial, but you can use any of the other mesh materials to gain other features like lighting, texture maps, etc.

Also see the `color` shortcut property.

Note that because your material instance is _replaced_ by a derived material instance, any changes you make to your original material will _not_ be reflected in the derived version. If you need to modify properties of the material afterward, be sure you get a new reference to the derived version:

```js
// Bad:
text.material = myOrigMaterial
myOrigMaterial.opacity = 0.5

// Good:
text.material = myOrigMaterial
text.material.opacity = 0.5
```

Default: a `MeshBasicMaterial` instance

### `maxWidth`

The maximum width of the text block, above which text may start wrapping according to the `whiteSpace` and `overflowWrap` properties.

Default: `Infinity`, meaning text will never wrap

### `outlineBlur`

Specifies a blur radius applied to the outer edge of the text's `outlineWidth`. If the `outlineWidth` is zero, the blur will be applied at the glyph edge, like CSS's `text-shadow` blur radius. A blur plus a nonzero `outlineWidth` can give a solid outline with a fuzzy outer edge.

The blur radius can be specified as either an absolute number in local units, or as a percentage string e.g. `"12%"` which is treated as a percentage of the `fontSize`.

Default: `0`

### `outlineColor`

The color to use for the text outline when `outlineWidth`, `outlineBlur`, and/or `outlineOffsetX/Y` are set. Accepts a ThreeJS `Color` object, or a number/string accepted by `Color#set`.

Default: black

### `outlineOffsetX`, `outlineOffsetY`

These define a horizontal and vertical offset of the text outline. Using an offset with `outlineWidth: 0` creates a drop-shadow effect like CSS's `text-shadow`; also see `outlineBlur`. 

The offsets can be specified as either an absolute number in local units, or as a percentage string e.g. `"12%"` which is treated as a percentage of the `fontSize`.

Default: `0`

### `outlineOpacity`

Sets the opacity of a configured text outline, in the range `0` to `1`.

Default: `1`

### `outlineWidth`

The width of an outline/halo to be drawn around each text glyph using the `outlineColor` and `outlineOpacity`. This can help improve readability when the text is displayed against a background of low or varying contrast. 

The width can be specified as either an absolute number in local units, or as a percentage string e.g. `"10%"` which is interpreted as a percentage of the `fontSize`.

Default: `0`

### `overflowWrap`

Defines how text wraps if the `whiteSpace` property is `'normal'`. Can be either `'normal'` to break at whitespace characters, or `'break-word'` to allow breaking within words.

Default: `'normal'`

### `sdfGlyphSize`

Allows overriding the default size of each glyph's SDF (signed distance field) used when rendering this text instance. This must be a power-of-two number. Larger sizes can improve the quality of glyph rendering by increasing the sharpness of corners and preventing loss of very thin lines, at the expense of increased memory footprint and longer SDF generation time.

Default: `64`

### `strokeColor`

The color of the text stroke, when `strokeWidth` is nonzero. Accepts a ThreeJS `Color` object, or a number/string accepted by `Color#set`.

Default: grey

### `strokeOpacity`

The opacity of the text stroke, when `strokeWidth` is nonzero. Accepts a number from `0` to `1`.

Default: `1`

### `strokeWidth`

Sets the width of a stroke drawn inside the edge of each text glyph, using the `strokeColor` and `strokeOpacity`.

The width can be specified as either an absolute number in local units, or as a percentage string e.g. `"10%"` which is interpreted as a percentage of the `fontSize`.

Default: `0`

### `textAlign`

The horizontal alignment of each line of text within the overall text bounding box. Can be one of `'left'`, `'right'`, `'center'`, or `'justify'`.

Default: `'left'`

### `textIndent`

An indentation applied to the first character of each _hard_ newline. Behaves like CSS `text-indent`.

Default: `0`

### `unicodeFontsUrl`

A custom hosting location for [unicode-font-resolver](https://github.com/lojjic/unicode-font-resolver/) data index and font files, if you want to self-host them rather than using the default CDN. See [Unicode Fallback Fonts](#unicode-fallback-fonts) below for details.

### `whiteSpace`

Defines whether text should wrap when a line reaches the `maxWidth`. Can be either `'normal'`, to allow wrapping according to the `overflowWrap` property, or `'nowrap'` to prevent wrapping.

Note that `'normal'` in this context _does_ honor newline characters to manually break lines, making it behave more like `'pre-wrap'` does in CSS.

Default: `'normal'`

## Unicode Fallback Fonts

When a character is not covered by the configured `font` file, [unicode-font-resolver](https://github.com/lojjic/unicode-font-resolver/) will be used to query for an appropriate fallback font. All Unicode character ranges supported by the [Google Noto Fonts](https://fonts.google.com/noto) are covered this way.

By default, the unicode-font-resolver data index and font files are loaded from the [jsDelivr CDN](https://www.jsdelivr.com/). If you wish to self-host those files you can do so; however be aware the full set of data and fonts is nearly 300MB.

To self-host the files:

- Go to the [unicode-font-resolver Github tags page](https://github.com/lojjic/unicode-font-resolver/tags)
- Find the tag matching the version of `@unicode-font-resolver/client` declared in `troika-three-text/package.json`'s `devDependencies`.
- Download the source code .zip or .tar.gz for that release and unpack it.
- Copy the contents of the `packages/data/` directory to your server where you want to host it.
- Configure troika-three-text to load from that server URL:
    - Per Text instance:
      ```js
      text.unicodeFontsURL = 'https://my.host/unicode-fonts-data'
      ```
    - Globally:
      ```js
      import {configureTextBuilder} from 'troika-three-text'

      configureTextBuilder({
        unicodeFontsURL: 'https://my.host/unicode-fonts-data'
      })
      ```

## Handling Asynchronous Updates

Since the text processing occurs in a web worker, it is by definition asynchronous. This means that you can't rely on the text being visible or having a complete geometry immediately. If you need to do things like access the geometry's `boundingSphere` or the `textRenderInfo`, you will have to listen for completion. You can do this two ways:

1. Pass a callback function when you call the `sync` method:

    ```js
    myText.sync(() => {
      // code to execute after sync completes...
    })
    ```
   
    This is best when you want to only react to _that specific_ sync call. Keep in mind that the callback will not execute if the text is already fully synced.
   
2. Add a listener for the `synccomplete` event:

    ```js
    myText.addEventListener('synccomplete', () => {
      // code to execute after sync completes...
    })
    ```

    This will fire after _every_ sync, no matter who invoked it. This is best if you need to react to all syncs, for example to trigger a manual canvas render.
    
    You can also listen for the `syncstart` event if you need to react to the initiation of a sync call, e.g. to set some sort of "waiting" state while the text is being processed.


## Preloading

To avoid long pauses when first displaying a piece of text in your scene, you can preload fonts and optionally pre-generate the SDF textures for particular glyphs up front:

```js
import {preloadFont} from 'troika-three-text'

myApp.showLoadingScreen()

preloadFont(
  {
    font: 'path/to/myfontfile.woff', 
    characters: 'abcdefghijklmnopqrstuvwxyz'
  },
  () => {
    myApp.showScene()
  }
)
```

The arguments are:

- `options`
  
  - `options.font` - The URL of the font file to preload. If `null` is passed, this will preload the default font.
  
  - `options.characters` - A string or array of string character sequences for which to pre-generate glyph SDF textures. Note that this _will_ honor ligature substitution, so you may need to specify ligature sequences in addition to their individual characters to get all possible glyphs, e.g. `["t", "h", "th"]` to get the "t" and "h" glyphs plus the "th" glyph.

  - `options.sdfGlyphSize` - The size at which to prerender the SDFs for the `characters` glyphs. See the `sdfGlyphSize` config property on `Text` for details about SDF sizes. If not specified, will use the default SDF size.

- `callback` - A function that will be called when the preloading is complete.


## Postprocessing

It is possible to use `Text` within scenes that utilize the [postprocessing](https://github.com/vanruesc/postprocessing) library for applying image effects. However, you must enable a special mode in that library that allows `Text`'s custom material to be honored. Just do the following once somewhere in your code:

```js
import { OverrideMaterialManager } from 'postprocessing'

OverrideMaterialManager.workaroundEnabled = true
```


## Carets and Selection Ranges

In addition to rendering text, it is possible to access positioning information for caret placement and selection ranges. To access that info, use the `getCaretAtPoint` and `getSelectionRects` utility functions. Both of these functions take a `textRenderInfo` object as input, which you can get from the `Text` object's `textRenderInfo` property after sync has completed. See "Handling Asynchronous Updates" above for how to react to sync completion events.

### `getCaretAtPoint(textRenderInfo, x, y)`

This returns the caret position nearest to a given x/y position in the local text plane. This is useful for placing an editing caret based on a click or ther raycasted event. The return value is an object with the following properties:

- `x` - x position of the caret
- `y` - y position of the caret's bottom
- `height` - height of the caret, based on the current fontSize and lineHeight
- `charIndex` - the index in the original input string of this caret's target character. The caret will be for the position _before_ that character. For the final caret position, this will be equal to the string length. For ligature glyphs, this will be for the first character in the ligature sequence.

### `getSelectionRects(textRenderInfo, start, end)`

This returns a list of rectangles covering all the characters within a given character range. This is useful for highlighting a selection range. The return value is an array of objects, each with `{left, top, right, bottom}` properties in the local text plane.
