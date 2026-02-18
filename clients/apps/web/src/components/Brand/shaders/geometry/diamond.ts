export const DIAMOND_GLSL = `
  uniform vec2 u_contentSize;

  float computeLuminance(vec2 uv, float aspect, float time) {
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float t = time * 0.15;

    // Diamond distance (L1 norm)
    float d = abs(p.x) + abs(p.y);

    // Expanding repeating diamond rings
    float rings = fract(d * 5.0 - t);

    // Thin outlines
    float outline = smoothstep(0.0, 0.25, rings) * (1.0 - smoothstep(0.75, 1.0, rings));
    float luminance = 1.0 - outline;

    // Center fade (radial, content-aware)
    vec2 d2 = (uv - 0.5) / (u_contentSize * 0.5 + 0.05);
    float rContent = length(d2);
    float centerFade = smoothstep(1.2, 2.16, rContent);
    luminance *= centerFade;

    return luminance;
  }
`
