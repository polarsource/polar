"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
const THREE = require("three");
class TGALoader extends THREE.DataTextureLoader {
  constructor(manager) {
    super(manager);
  }
  parse(buffer) {
    function tgaCheckHeader(header2) {
      switch (header2.image_type) {
        case TGA_TYPE_INDEXED:
        case TGA_TYPE_RLE_INDEXED:
          if (header2.colormap_length > 256 || header2.colormap_size !== 24 || header2.colormap_type !== 1) {
            console.error("THREE.TGALoader: Invalid type colormap data for indexed type.");
          }
          break;
        case TGA_TYPE_RGB:
        case TGA_TYPE_GREY:
        case TGA_TYPE_RLE_RGB:
        case TGA_TYPE_RLE_GREY:
          if (header2.colormap_type) {
            console.error("THREE.TGALoader: Invalid type colormap data for colormap type.");
          }
          break;
        case TGA_TYPE_NO_DATA:
          console.error("THREE.TGALoader: No data.");
        default:
          console.error('THREE.TGALoader: Invalid type "%s".', header2.image_type);
      }
      if (header2.width <= 0 || header2.height <= 0) {
        console.error("THREE.TGALoader: Invalid image size.");
      }
      if (header2.pixel_size !== 8 && header2.pixel_size !== 16 && header2.pixel_size !== 24 && header2.pixel_size !== 32) {
        console.error('THREE.TGALoader: Invalid pixel size "%s".', header2.pixel_size);
      }
    }
    function tgaParse(use_rle2, use_pal2, header2, offset2, data) {
      let pixel_data, palettes;
      const pixel_size = header2.pixel_size >> 3;
      const pixel_total = header2.width * header2.height * pixel_size;
      if (use_pal2) {
        palettes = data.subarray(offset2, offset2 += header2.colormap_length * (header2.colormap_size >> 3));
      }
      if (use_rle2) {
        pixel_data = new Uint8Array(pixel_total);
        let c, count, i;
        let shift = 0;
        const pixels = new Uint8Array(pixel_size);
        while (shift < pixel_total) {
          c = data[offset2++];
          count = (c & 127) + 1;
          if (c & 128) {
            for (i = 0; i < pixel_size; ++i) {
              pixels[i] = data[offset2++];
            }
            for (i = 0; i < count; ++i) {
              pixel_data.set(pixels, shift + i * pixel_size);
            }
            shift += pixel_size * count;
          } else {
            count *= pixel_size;
            for (i = 0; i < count; ++i) {
              pixel_data[shift + i] = data[offset2++];
            }
            shift += count;
          }
        }
      } else {
        pixel_data = data.subarray(offset2, offset2 += use_pal2 ? header2.width * header2.height : pixel_total);
      }
      return {
        pixel_data,
        palettes
      };
    }
    function tgaGetImageData8bits(imageData2, y_start, y_step, y_end, x_start, x_step, x_end, image, palettes) {
      const colormap = palettes;
      let color, i = 0, x, y;
      const width = header.width;
      for (y = y_start; y !== y_end; y += y_step) {
        for (x = x_start; x !== x_end; x += x_step, i++) {
          color = image[i];
          imageData2[(x + width * y) * 4 + 3] = 255;
          imageData2[(x + width * y) * 4 + 2] = colormap[color * 3 + 0];
          imageData2[(x + width * y) * 4 + 1] = colormap[color * 3 + 1];
          imageData2[(x + width * y) * 4 + 0] = colormap[color * 3 + 2];
        }
      }
      return imageData2;
    }
    function tgaGetImageData16bits(imageData2, y_start, y_step, y_end, x_start, x_step, x_end, image) {
      let color, i = 0, x, y;
      const width = header.width;
      for (y = y_start; y !== y_end; y += y_step) {
        for (x = x_start; x !== x_end; x += x_step, i += 2) {
          color = image[i + 0] + (image[i + 1] << 8);
          imageData2[(x + width * y) * 4 + 0] = (color & 31744) >> 7;
          imageData2[(x + width * y) * 4 + 1] = (color & 992) >> 2;
          imageData2[(x + width * y) * 4 + 2] = (color & 31) >> 3;
          imageData2[(x + width * y) * 4 + 3] = color & 32768 ? 0 : 255;
        }
      }
      return imageData2;
    }
    function tgaGetImageData24bits(imageData2, y_start, y_step, y_end, x_start, x_step, x_end, image) {
      let i = 0, x, y;
      const width = header.width;
      for (y = y_start; y !== y_end; y += y_step) {
        for (x = x_start; x !== x_end; x += x_step, i += 3) {
          imageData2[(x + width * y) * 4 + 3] = 255;
          imageData2[(x + width * y) * 4 + 2] = image[i + 0];
          imageData2[(x + width * y) * 4 + 1] = image[i + 1];
          imageData2[(x + width * y) * 4 + 0] = image[i + 2];
        }
      }
      return imageData2;
    }
    function tgaGetImageData32bits(imageData2, y_start, y_step, y_end, x_start, x_step, x_end, image) {
      let i = 0, x, y;
      const width = header.width;
      for (y = y_start; y !== y_end; y += y_step) {
        for (x = x_start; x !== x_end; x += x_step, i += 4) {
          imageData2[(x + width * y) * 4 + 2] = image[i + 0];
          imageData2[(x + width * y) * 4 + 1] = image[i + 1];
          imageData2[(x + width * y) * 4 + 0] = image[i + 2];
          imageData2[(x + width * y) * 4 + 3] = image[i + 3];
        }
      }
      return imageData2;
    }
    function tgaGetImageDataGrey8bits(imageData2, y_start, y_step, y_end, x_start, x_step, x_end, image) {
      let color, i = 0, x, y;
      const width = header.width;
      for (y = y_start; y !== y_end; y += y_step) {
        for (x = x_start; x !== x_end; x += x_step, i++) {
          color = image[i];
          imageData2[(x + width * y) * 4 + 0] = color;
          imageData2[(x + width * y) * 4 + 1] = color;
          imageData2[(x + width * y) * 4 + 2] = color;
          imageData2[(x + width * y) * 4 + 3] = 255;
        }
      }
      return imageData2;
    }
    function tgaGetImageDataGrey16bits(imageData2, y_start, y_step, y_end, x_start, x_step, x_end, image) {
      let i = 0, x, y;
      const width = header.width;
      for (y = y_start; y !== y_end; y += y_step) {
        for (x = x_start; x !== x_end; x += x_step, i += 2) {
          imageData2[(x + width * y) * 4 + 0] = image[i + 0];
          imageData2[(x + width * y) * 4 + 1] = image[i + 0];
          imageData2[(x + width * y) * 4 + 2] = image[i + 0];
          imageData2[(x + width * y) * 4 + 3] = image[i + 1];
        }
      }
      return imageData2;
    }
    function getTgaRGBA(data, width, height, image, palette) {
      let x_start, y_start, x_step, y_step, x_end, y_end;
      switch ((header.flags & TGA_ORIGIN_MASK) >> TGA_ORIGIN_SHIFT) {
        default:
        case TGA_ORIGIN_UL:
          x_start = 0;
          x_step = 1;
          x_end = width;
          y_start = 0;
          y_step = 1;
          y_end = height;
          break;
        case TGA_ORIGIN_BL:
          x_start = 0;
          x_step = 1;
          x_end = width;
          y_start = height - 1;
          y_step = -1;
          y_end = -1;
          break;
        case TGA_ORIGIN_UR:
          x_start = width - 1;
          x_step = -1;
          x_end = -1;
          y_start = 0;
          y_step = 1;
          y_end = height;
          break;
        case TGA_ORIGIN_BR:
          x_start = width - 1;
          x_step = -1;
          x_end = -1;
          y_start = height - 1;
          y_step = -1;
          y_end = -1;
          break;
      }
      if (use_grey) {
        switch (header.pixel_size) {
          case 8:
            tgaGetImageDataGrey8bits(data, y_start, y_step, y_end, x_start, x_step, x_end, image);
            break;
          case 16:
            tgaGetImageDataGrey16bits(data, y_start, y_step, y_end, x_start, x_step, x_end, image);
            break;
          default:
            console.error("THREE.TGALoader: Format not supported.");
            break;
        }
      } else {
        switch (header.pixel_size) {
          case 8:
            tgaGetImageData8bits(data, y_start, y_step, y_end, x_start, x_step, x_end, image, palette);
            break;
          case 16:
            tgaGetImageData16bits(data, y_start, y_step, y_end, x_start, x_step, x_end, image);
            break;
          case 24:
            tgaGetImageData24bits(data, y_start, y_step, y_end, x_start, x_step, x_end, image);
            break;
          case 32:
            tgaGetImageData32bits(data, y_start, y_step, y_end, x_start, x_step, x_end, image);
            break;
          default:
            console.error("THREE.TGALoader: Format not supported.");
            break;
        }
      }
      return data;
    }
    const TGA_TYPE_NO_DATA = 0, TGA_TYPE_INDEXED = 1, TGA_TYPE_RGB = 2, TGA_TYPE_GREY = 3, TGA_TYPE_RLE_INDEXED = 9, TGA_TYPE_RLE_RGB = 10, TGA_TYPE_RLE_GREY = 11, TGA_ORIGIN_MASK = 48, TGA_ORIGIN_SHIFT = 4, TGA_ORIGIN_BL = 0, TGA_ORIGIN_BR = 1, TGA_ORIGIN_UL = 2, TGA_ORIGIN_UR = 3;
    if (buffer.length < 19)
      console.error("THREE.TGALoader: Not enough data to contain header.");
    let offset = 0;
    const content = new Uint8Array(buffer), header = {
      id_length: content[offset++],
      colormap_type: content[offset++],
      image_type: content[offset++],
      colormap_index: content[offset++] | content[offset++] << 8,
      colormap_length: content[offset++] | content[offset++] << 8,
      colormap_size: content[offset++],
      origin: [content[offset++] | content[offset++] << 8, content[offset++] | content[offset++] << 8],
      width: content[offset++] | content[offset++] << 8,
      height: content[offset++] | content[offset++] << 8,
      pixel_size: content[offset++],
      flags: content[offset++]
    };
    tgaCheckHeader(header);
    if (header.id_length + offset > buffer.length) {
      console.error("THREE.TGALoader: No data.");
    }
    offset += header.id_length;
    let use_rle = false, use_pal = false, use_grey = false;
    switch (header.image_type) {
      case TGA_TYPE_RLE_INDEXED:
        use_rle = true;
        use_pal = true;
        break;
      case TGA_TYPE_INDEXED:
        use_pal = true;
        break;
      case TGA_TYPE_RLE_RGB:
        use_rle = true;
        break;
      case TGA_TYPE_RGB:
        break;
      case TGA_TYPE_RLE_GREY:
        use_rle = true;
        use_grey = true;
        break;
      case TGA_TYPE_GREY:
        use_grey = true;
        break;
    }
    const imageData = new Uint8Array(header.width * header.height * 4);
    const result = tgaParse(use_rle, use_pal, header, offset, content);
    getTgaRGBA(imageData, header.width, header.height, result.pixel_data, result.palettes);
    return {
      data: imageData,
      width: header.width,
      height: header.height,
      flipY: true,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter
    };
  }
}
exports.TGALoader = TGALoader;
//# sourceMappingURL=TGALoader.cjs.map
