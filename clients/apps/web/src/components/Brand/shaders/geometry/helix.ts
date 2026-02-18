export const HELIX_GLSL = `
  uniform vec2 u_contentSize;

  float computeLuminance(vec2 uv, float aspect, float time) {
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float t = time * 0.15;

    // Two spiraling arms offset by PI
    float angle = atan(p.y, p.x);
    float r = length(p);

    float arm1 = sin(angle * 1.0 - r * 12.0 + t * 3.0);
    float arm2 = sin(angle * 1.0 - r * 12.0 + t * 3.0 + 3.14159);

    // Sharp bands
    float line1 = 1.0 - smoothstep(0.05, 0.3, abs(arm1));
    float line2 = 1.0 - smoothstep(0.05, 0.3, abs(arm2));

    float luminance = max(line1, line2);

    // Center fade (radial, content-aware)
    vec2 d2 = (uv - 0.5) / (u_contentSize * 0.5 + 0.05);
    float rContent = length(d2);
    float centerFade = smoothstep(1.2, 2.16, rContent);
    luminance *= centerFade;

    return luminance;
  }
`
