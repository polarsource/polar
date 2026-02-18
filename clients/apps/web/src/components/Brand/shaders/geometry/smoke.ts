export const SMOKE_GLSL = `
  uniform vec2 u_contentSize;

  // Smooth value noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
    float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
    float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
    float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Fractal Brownian motion
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  float computeLuminance(vec2 uv, float aspect, float time) {
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float t = time * 0.08;

    // Domain warping — fbm drives the input of another fbm
    vec2 q = vec2(
      fbm(p * 2.5 + vec2(0.0, t * 0.4)),
      fbm(p * 2.5 + vec2(5.2, t * 0.3 + 1.3))
    );

    vec2 r = vec2(
      fbm(p * 2.5 + q * 4.0 + vec2(1.7, t * 0.2 + 9.2)),
      fbm(p * 2.5 + q * 4.0 + vec2(8.3, t * 0.25 + 2.8))
    );

    float luminance = fbm(p * 2.5 + r * 3.0);
    luminance = smoothstep(0.2, 0.8, luminance);

    // Center fade (radial, content-aware)
    vec2 d2 = (uv - 0.5) / (u_contentSize * 0.5 + 0.05);
    float rContent = length(d2);
    float centerFade = smoothstep(1.2, 2.16, rContent);
    luminance *= centerFade;

    return luminance;
  }
`
