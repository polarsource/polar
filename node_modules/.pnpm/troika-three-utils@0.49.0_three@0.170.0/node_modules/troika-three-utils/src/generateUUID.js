/*
 * This is a direct copy of MathUtils.generateUUID from Three.js, to preserve compatibility with three
 * versions before 0.113.0 as it was changed from Math to MathUtils in that version.
 * https://github.com/mrdoob/three.js/blob/dd8b5aa3b270c17096b90945cd2d6d1b13aaec53/src/math/MathUtils.js#L16
 */

const _lut = []

for (let i = 0; i < 256; i++) {
  _lut[i] = (i < 16 ? '0' : '') + (i).toString(16)
}

export function generateUUID() {

  // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript/21963136#21963136

  const d0 = Math.random() * 0xffffffff | 0
  const d1 = Math.random() * 0xffffffff | 0
  const d2 = Math.random() * 0xffffffff | 0
  const d3 = Math.random() * 0xffffffff | 0
  const uuid = _lut[d0 & 0xff] + _lut[d0 >> 8 & 0xff] + _lut[d0 >> 16 & 0xff] + _lut[d0 >> 24 & 0xff] + '-' +
    _lut[d1 & 0xff] + _lut[d1 >> 8 & 0xff] + '-' + _lut[d1 >> 16 & 0x0f | 0x40] + _lut[d1 >> 24 & 0xff] + '-' +
    _lut[d2 & 0x3f | 0x80] + _lut[d2 >> 8 & 0xff] + '-' + _lut[d2 >> 16 & 0xff] + _lut[d2 >> 24 & 0xff] +
    _lut[d3 & 0xff] + _lut[d3 >> 8 & 0xff] + _lut[d3 >> 16 & 0xff] + _lut[d3 >> 24 & 0xff]

  // .toUpperCase() here flattens concatenated strings to save heap memory space.
  return uuid.toUpperCase()

}
