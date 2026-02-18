export const MESH_GLSL = `
  // Simplex-style 2D noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289v2(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // sRGB <-> linear
  float srgbToLinear(float c) {
    return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
  }
  float linearToSrgb(float c) {
    return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
  }
  vec3 srgb2linear(vec3 c) {
    return vec3(srgbToLinear(c.x), srgbToLinear(c.y), srgbToLinear(c.z));
  }
  vec3 linear2srgb(vec3 c) {
    return vec3(linearToSrgb(c.x), linearToSrgb(c.y), linearToSrgb(c.z));
  }

  // Linear RGB -> OKLab
  vec3 rgb2oklab(vec3 c) {
    float l = 0.4122214708 * c.x + 0.5363325363 * c.y + 0.0514459929 * c.z;
    float m = 0.2119034982 * c.x + 0.6806995451 * c.y + 0.1073969566 * c.z;
    float s = 0.0883024619 * c.x + 0.2817188376 * c.y + 0.6299787005 * c.z;
    l = pow(l, 1.0 / 3.0); m = pow(m, 1.0 / 3.0); s = pow(s, 1.0 / 3.0);
    return vec3(
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    );
  }

  // OKLab -> Linear RGB
  vec3 oklab2rgb(vec3 c) {
    float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
    float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
    float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
    l = l * l * l; m = m * m * m; s = s * s * s;
    return vec3(
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    );
  }

  // OKLab <-> OKLCH
  vec3 oklab2oklch(vec3 lab) {
    float C = length(lab.yz);
    float h = atan(lab.z, lab.y);
    return vec3(lab.x, C, h);
  }
  vec3 oklch2oklab(vec3 lch) {
    return vec3(lch.x, lch.y * cos(lch.z), lch.y * sin(lch.z));
  }

  // Full pipeline
  vec3 srgb2oklch(vec3 c) { return oklab2oklch(rgb2oklab(srgb2linear(c))); }
  vec3 oklch2srgb(vec3 c) { return linear2srgb(oklab2rgb(oklch2oklab(c))); }

  // Interpolate hue on shortest arc
  float lerpHue(float a, float b, float t) {
    float diff = mod(b - a + 3.14159265, 6.28318530) - 3.14159265;
    return a + diff * t;
  }

  // Gaussian blob weight
  float gauss(vec2 p, vec2 center, float spread) {
    vec2 d = p - center;
    return exp(-dot(d, d) / (2.0 * spread * spread));
  }

  vec3 computeColor(vec2 uv, float aspect, float time) {
    float t = time * 0.08;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

    // Flowing distortion
    float dx = snoise(p * 0.3 + vec2(t * 0.3, t * 0.5)) * 0.35;
    float dy = snoise(p * 0.3 + vec2(t * 0.5 + 50.0, t * 0.3 + 50.0)) * 0.35;
    vec2 q = p + vec2(dx, dy);

    // Drifting blob centers
    vec2 b1 = vec2(snoise(vec2(t * 0.2, 0.0)) * 0.5, snoise(vec2(0.0, t * 0.25)) * 0.4);
    vec2 b2 = vec2(snoise(vec2(t * 0.15 + 10.0, 5.0)) * 0.6, snoise(vec2(5.0, t * 0.2 + 10.0)) * 0.4);
    vec2 b3 = vec2(snoise(vec2(t * 0.25 + 20.0, 10.0)) * 0.5, snoise(vec2(10.0, t * 0.18 + 20.0)) * 0.5);
    vec2 b4 = vec2(snoise(vec2(t * 0.18 + 30.0, 15.0)) * 0.6, snoise(vec2(15.0, t * 0.22 + 30.0)) * 0.4);
    vec2 b5 = vec2(snoise(vec2(t * 0.22 + 40.0, 20.0)) * 0.5, snoise(vec2(20.0, t * 0.15 + 40.0)) * 0.5);

    // Gaussian weights
    float w1 = gauss(q, b1, 0.28);
    float w2 = gauss(q, b2, 0.30);
    float w3 = gauss(q, b3, 0.26);
    float w4 = gauss(q, b4, 0.30);
    float w5 = gauss(q, b5, 0.28);

    // Square weights to sharpen peaks
    w1 *= w1; w2 *= w2; w3 *= w3; w4 *= w4; w5 *= w5;
    float wTotal = w1 + w2 + w3 + w4 + w5 + 0.001;

    // Detect dark/light mode from background uniform
    float isDark = step(0.5, 1.0 - dot(u_colorA, vec3(0.333)));

    // Base color flips between deep ocean and white
    vec3 base = mix(vec3(0.95, 0.96, 0.98), vec3(0.05, 0.12, 0.25), isDark);

    // Aurora palette in OKLCH
    vec3 lch1 = srgb2oklch(base);
    vec3 lch2 = srgb2oklch(vec3(0.05, 0.85, 0.70));   // bright teal
    vec3 lch3 = srgb2oklch(vec3(0.30, 1.00, 0.55));   // aurora green
    vec3 lch4 = srgb2oklch(vec3(0.60, 0.25, 0.95));   // electric violet
    vec3 lch5 = srgb2oklch(vec3(0.95, 0.35, 0.65));   // aurora pink

    // Weighted blend in OKLCH — shortest-arc hue interpolation
    float L = (lch1.x * w1 + lch2.x * w2 + lch3.x * w3 + lch4.x * w4 + lch5.x * w5) / wTotal;
    float C = (lch1.y * w1 + lch2.y * w2 + lch3.y * w3 + lch4.y * w4 + lch5.y * w5) / wTotal;

    // Blend hue via cartesian average to handle wrapping
    float hx = (cos(lch1.z) * w1 + cos(lch2.z) * w2 + cos(lch3.z) * w3 + cos(lch4.z) * w4 + cos(lch5.z) * w5) / wTotal;
    float hy = (sin(lch1.z) * w1 + sin(lch2.z) * w2 + sin(lch3.z) * w3 + sin(lch4.z) * w4 + sin(lch5.z) * w5) / wTotal;
    float H = atan(hy, hx);

    vec3 color = oklch2srgb(vec3(L, C * 0.7, H));
    return clamp(color, 0.0, 1.0);
  }
`
