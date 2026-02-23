export const HASH_GLSL = `
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
`

export const BAYER8_GLSL = `
  float bayer8(vec2 p) {
    ivec2 ip = ivec2(mod(p, 8.0));
    int index = ip.x + ip.y * 8;

    float m[64];
    m[0]  =  0.0; m[1]  = 32.0; m[2]  =  8.0; m[3]  = 40.0;
    m[4]  =  2.0; m[5]  = 34.0; m[6]  = 10.0; m[7]  = 42.0;
    m[8]  = 48.0; m[9]  = 16.0; m[10] = 56.0; m[11] = 24.0;
    m[12] = 50.0; m[13] = 18.0; m[14] = 58.0; m[15] = 26.0;
    m[16] = 12.0; m[17] = 44.0; m[18] =  4.0; m[19] = 36.0;
    m[20] = 14.0; m[21] = 46.0; m[22] =  6.0; m[23] = 38.0;
    m[24] = 60.0; m[25] = 28.0; m[26] = 52.0; m[27] = 20.0;
    m[28] = 62.0; m[29] = 30.0; m[30] = 54.0; m[31] = 22.0;
    m[32] =  3.0; m[33] = 35.0; m[34] = 11.0; m[35] = 43.0;
    m[36] =  1.0; m[37] = 33.0; m[38] =  9.0; m[39] = 41.0;
    m[40] = 51.0; m[41] = 19.0; m[42] = 59.0; m[43] = 27.0;
    m[44] = 49.0; m[45] = 17.0; m[46] = 57.0; m[47] = 25.0;
    m[48] = 15.0; m[49] = 47.0; m[50] =  7.0; m[51] = 39.0;
    m[52] = 13.0; m[53] = 45.0; m[54] =  5.0; m[55] = 37.0;
    m[56] = 63.0; m[57] = 31.0; m[58] = 55.0; m[59] = 23.0;
    m[60] = 61.0; m[61] = 29.0; m[62] = 53.0; m[63] = 21.0;

    float threshold = 0.0;
    for (int i = 0; i < 64; i++) {
      if (i == index) {
        threshold = m[i];
        break;
      }
    }
    return threshold / 64.0;
  }
`

export const FILM_GRAIN_GLSL = `
  float filmGrain(vec2 fragCoord, float time) {
    return (hash(fragCoord + fract(time * 0.7)) * 2.0 - 1.0) * 0.18;
  }
`
