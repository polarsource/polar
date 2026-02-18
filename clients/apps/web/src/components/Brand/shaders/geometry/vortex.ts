export const VORTEX_GLSL = `
  float computeLuminance(vec2 uv, float aspect, float time) {
    vec2 d = uv - vec2(0.5, 0.5);
    d.x *= aspect;

    float r = length(d);
    float angle = atan(d.y, d.x);
    float rNorm = r / (aspect * 0.5);
    float logR = log(max(r, 0.001));

    float t = time * 0.15;
    float warp = sin(r * 10.0 - t * 2.5) * 0.12;

    float spiral = angle + logR * 2.5 - t * 1.8;
    float arms = sin(spiral * 3.0 + warp) * 0.5 + 0.5;
    arms = pow(arms, 0.5);

    float spiral2 = angle - logR * 1.8 + t * 0.9;
    float arms2 = sin(spiral2 * 2.0) * 0.5 + 0.5;

    float luminance = arms * 0.75 + arms2 * 0.25;
    luminance = smoothstep(0.2, 0.8, luminance);

    float centerFade = smoothstep(0.5, 0.85, rNorm);
    luminance *= centerFade;

    float edgeFade = 1.0 - smoothstep(0.85, 1.1, rNorm);
    luminance *= edgeFade;

    return luminance;
  }
`
