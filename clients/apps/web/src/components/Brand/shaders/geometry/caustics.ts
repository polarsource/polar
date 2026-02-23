export const CAUSTICS_GLSL = `
  uniform vec2 u_contentSize;

  float computeLuminance(vec2 uv, float aspect, float time) {
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 5.0;
    float t = time * 0.15;

    // Two overlapping refraction layers
    vec2 p1 = p + vec2(sin(t * 0.3), cos(t * 0.2)) * 0.5;
    vec2 p2 = p * 1.1 + vec2(cos(t * 0.4 + 1.0), sin(t * 0.35 + 2.0)) * 0.5;

    // Warped voronoi-like cells via distance to sin grid
    float d1 = length(sin(p1) + sin(p1.yx * 1.4 + t * 0.8));
    float d2 = length(sin(p2 * 0.9 + 1.5) + sin(p2.yx * 1.3 - t * 0.6));

    // Light concentration at cell edges
    float c1 = exp(-d1 * d1 * 1.5);
    float c2 = exp(-d2 * d2 * 1.5);

    float luminance = c1 * 0.6 + c2 * 0.4;
    luminance = smoothstep(0.1, 0.6, luminance);

    // Center fade (radial, content-aware)
    vec2 d3 = (uv - 0.5) / (u_contentSize * 0.5 + 0.05);
    float rContent = length(d3);
    float centerFade = smoothstep(1.2, 2.16, rContent);
    luminance *= centerFade;

    return luminance;
  }
`
