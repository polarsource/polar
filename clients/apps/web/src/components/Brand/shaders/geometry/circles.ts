export const CIRCLES_GLSL = `
  uniform vec2 u_contentSize;

  float computeLuminance(vec2 uv, float aspect, float time) {
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float t = time * 0.15;

    // Slowly rotating coordinate frame
    float rot = t * 0.4;
    float cs = cos(rot), sn = sin(rot);
    vec2 rp = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);

    // Uneven circular distance — warped L2 norm
    float angle = atan(rp.y, rp.x);
    float warp = 1.0 + 0.15 * sin(angle * 3.0 + t) + 0.1 * sin(angle * 5.0 - t * 0.7);
    float d = length(rp) * warp;

    // Expanding repeating rings
    float rings = fract(d * 8.0 - t);

    // Thin outlines
    float outline = smoothstep(0.0, 0.1, rings) * (1.0 - smoothstep(0.9, 1.0, rings));
    float luminance = 1.0 - outline;

    // Center fade (radial, content-aware)
    vec2 d2 = (uv - 0.5) / (u_contentSize * 0.5 + 0.05);
    float rContent = length(d2);
    float centerFade = smoothstep(1.2, 2.16, rContent);
    luminance *= centerFade;

    return luminance;
  }
`
