/**
 * Sets `BufferAttribute.updateRange` since r159.
 */
const setUpdateRange = (attribute, updateRange) => {
  if ('updateRanges' in attribute) {
    // r159
    // @ts-ignore
    attribute.updateRanges[0] = updateRange;
  } else {
    attribute.updateRange = updateRange;
  }
};
const LinearEncoding = 3000;
const sRGBEncoding = 3001;

/**
 * TextureEncoding was deprecated in r152, and removed in r162.
 */

export { LinearEncoding, sRGBEncoding, setUpdateRange };
