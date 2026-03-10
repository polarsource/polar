export const MESH_GLSL = `
  // ── Simplex noise ─────────────────────────────────────────────────────────
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289v2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1  = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289v2(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x  = 2.0 * fract(p * C.www) - 1.0;
    vec3 h  = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x  * x0.x   + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // 3-octave fBm — used only for field distortion, not blob centers
  float fbm3(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 rot = mat2(0.8660, 0.5000, -0.5000, 0.8660);
    for (int i = 0; i < 3; i++) {
      v += a * snoise(p);
      p  = rot * p * 2.1;
      a *= 0.5;
    }
    return v;
  }

  // ── sRGB <-> linear ───────────────────────────────────────────────────────
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

  // ── OKLab / OKLCH ─────────────────────────────────────────────────────────
  vec3 rgb2oklab(vec3 c) {
    float l = 0.4122214708*c.x + 0.5363325363*c.y + 0.0514459929*c.z;
    float m = 0.2119034982*c.x + 0.6806995451*c.y + 0.1073969566*c.z;
    float s = 0.0883024619*c.x + 0.2817188376*c.y + 0.6299787005*c.z;
    l = pow(l, 1.0/3.0); m = pow(m, 1.0/3.0); s = pow(s, 1.0/3.0);
    return vec3(
       0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
       1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
       0.0259040371*l + 0.7827717662*m - 0.8086757660*s
    );
  }
  vec3 oklab2rgb(vec3 c) {
    float l = c.x + 0.3963377774*c.y + 0.2158037573*c.z;
    float m = c.x - 0.1055613458*c.y - 0.0638541728*c.z;
    float s = c.x - 0.0894841775*c.y - 1.2914855480*c.z;
    l = l*l*l; m = m*m*m; s = s*s*s;
    return vec3(
       4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
      -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
      -0.0041960863*l - 0.7034186147*m + 1.7076147010*s
    );
  }
  vec3 oklab2oklch(vec3 lab) { return vec3(lab.x, length(lab.yz), atan(lab.z, lab.y)); }
  vec3 oklch2oklab(vec3 lch) { return vec3(lch.x, lch.y*cos(lch.z), lch.y*sin(lch.z)); }
  vec3 oklch2srgb(vec3 c)    { return linear2srgb(oklab2rgb(oklch2oklab(c))); }

  // ── Gaussian blob ─────────────────────────────────────────────────────────
  float gauss(vec2 p, vec2 center, float spread) {
    vec2 d = p - center;
    return exp(-dot(d, d) / (2.0 * spread * spread));
  }

  // ── OKLCH palette: vec3(L, C, H_radians) ─────────────────────────────────
  vec3 pal(int i) {
    if (i == 0) return vec3(0.60, 0.32, 4.19);  // indigo
    if (i == 1) return vec3(0.55, 0.34, 5.50);  // violet
    if (i == 2) return vec3(0.72, 0.30, 2.80);  // sky-cyan
    if (i == 3) return vec3(0.65, 0.31, 1.75);  // emerald
    if (i == 4) return vec3(0.52, 0.36, 5.00);  // electric-purple
    if (i == 5) return vec3(0.75, 0.30, 0.35);  // coral
    if (i == 6) return vec3(0.58, 0.32, 3.50);  // deep-teal
    if (i == 7) return vec3(0.58, 0.34, 4.71);  // deep-blue
    return vec3(0.75, 0.0, 0.0);
  }

  vec3 computeColor(vec2 uv, float aspect, float time) {
    float t = time * 0.22 + 120.0;
    vec2  p = (uv - 0.5) * vec2(aspect, 1.0);

    // Two-layer fBm domain warp — 3 octaves each, cheap
    float dx = fbm3(p * 0.40 + vec2(t * 0.25, t * 0.17));
    float dy = fbm3(p * 0.40 + vec2(t * 0.17 + 3.7, t * 0.25 + 2.1));
    vec2  q  = p + vec2(dx, dy) * 0.38;

    float ex = fbm3(q * 0.60 + vec2(t * 0.13, t * 0.20 + 5.3));
    float ey = fbm3(q * 0.60 + vec2(t * 0.20 + 8.1, t * 0.13 + 1.7));
    vec2  r  = q + vec2(ex, ey) * 0.20;

    // 8 blob centers driven by cheap snoise (not fbm)
    vec2 b0 = vec2(snoise(vec2(t*0.17,        0.0)) * 0.55, snoise(vec2(0.0,        t*0.21)) * 0.42);
    vec2 b1 = vec2(snoise(vec2(t*0.13 + 10.0, 5.0)) * 0.60, snoise(vec2(5.0,  t*0.18+10.0)) * 0.46);
    vec2 b2 = vec2(snoise(vec2(t*0.19 + 20.0,10.0)) * 0.48, snoise(vec2(10.0, t*0.14+20.0)) * 0.52);
    vec2 b3 = vec2(snoise(vec2(t*0.15 + 30.0,15.0)) * 0.58, snoise(vec2(15.0, t*0.19+30.0)) * 0.42);
    vec2 b4 = vec2(snoise(vec2(t*0.20 + 40.0,20.0)) * 0.52, snoise(vec2(20.0, t*0.12+40.0)) * 0.50);
    vec2 b5 = vec2(snoise(vec2(t*0.11 + 50.0,25.0)) * 0.62, snoise(vec2(25.0, t*0.22+50.0)) * 0.44);
    vec2 b6 = vec2(snoise(vec2(t*0.22 + 60.0,30.0)) * 0.46, snoise(vec2(30.0, t*0.16+60.0)) * 0.54);
    vec2 b7 = vec2(snoise(vec2(t*0.16 + 70.0,35.0)) * 0.54, snoise(vec2(35.0, t*0.10+70.0)) * 0.48);

    // Breathing spreads
    float w0 = gauss(r, b0, 0.27 + 0.06*sin(t*1.10+0.0));
    float w1 = gauss(r, b1, 0.30 + 0.05*sin(t*0.90+1.0));
    float w2 = gauss(r, b2, 0.25 + 0.07*sin(t*1.30+2.0));
    float w3 = gauss(r, b3, 0.28 + 0.05*sin(t*1.00+3.0));
    float w4 = gauss(r, b4, 0.32 + 0.06*sin(t*0.80+4.0));
    float w5 = gauss(r, b5, 0.25 + 0.07*sin(t*1.20+5.0));
    float w6 = gauss(r, b6, 0.29 + 0.05*sin(t*1.40+6.0));
    float w7 = gauss(r, b7, 0.27 + 0.06*sin(t*1.10+7.0));

    // Cube weights
    w0=w0*w0*w0; w1=w1*w1*w1; w2=w2*w2*w2; w3=w3*w3*w3;
    w4=w4*w4*w4; w5=w5*w5*w5; w6=w6*w6*w6; w7=w7*w7*w7;
    float wT = w0+w1+w2+w3+w4+w5+w6+w7 + 0.001;

    float isDark = step(0.5, 1.0 - dot(u_colorA, vec3(0.333)));

    vec3 c0=pal(0); vec3 c1=pal(1); vec3 c2=pal(2); vec3 c3=pal(3);
    vec3 c4=pal(4); vec3 c5=pal(5); vec3 c6=pal(6); vec3 c7=pal(7);

    float L = (c0.x*w0+c1.x*w1+c2.x*w2+c3.x*w3+c4.x*w4+c5.x*w5+c6.x*w6+c7.x*w7) / wT;
    float C = (c0.y*w0+c1.y*w1+c2.y*w2+c3.y*w3+c4.y*w4+c5.y*w5+c6.y*w6+c7.y*w7) / wT;
    float hx = (cos(c0.z)*w0+cos(c1.z)*w1+cos(c2.z)*w2+cos(c3.z)*w3+
                cos(c4.z)*w4+cos(c5.z)*w5+cos(c6.z)*w6+cos(c7.z)*w7) / wT;
    float hy = (sin(c0.z)*w0+sin(c1.z)*w1+sin(c2.z)*w2+sin(c3.z)*w3+
                sin(c4.z)*w4+sin(c5.z)*w5+sin(c6.z)*w6+sin(c7.z)*w7) / wT;
    float H = atan(hy, hx);

    float chromaScale = mix(1.10, 0.80, isDark);
    return clamp(oklch2srgb(vec3(L, C * chromaScale, H)), 0.0, 1.0);
  }
`
