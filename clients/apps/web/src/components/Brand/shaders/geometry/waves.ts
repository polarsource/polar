export const WAVES_GLSL = `
  uniform vec2 u_contentSize;

  float computeLuminance(vec2 uv, float aspect, float time) {
    float t = time * 0.12;
    vec2 p = uv - 0.5;
    p.x *= aspect;

    // Slowly rotating coordinate frame for organic drift
    float rot = t * 0.3;
    float cs = cos(rot), sn = sin(rot);
    vec2 rp = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);

    // Flowing displacement field
    float flow = 0.0;
    flow += sin(rp.y * 4.0 + t * 1.4) * 0.35;
    flow += sin(rp.y * 6.4 - t * 0.9 + rp.x * 2.4) * 0.2;
    flow += cos(rp.x * 3.2 + rp.y * 2.4 + t * 0.6) * 0.25;
    flow += sin(length(p) * 4.8 - t * 1.8) * 0.15;

    float wx = rp.x + flow;

    // Soft, wide bands
    float wave1 = sin(wx * 4.8) * 0.5 + 0.5;
    float wave2 = sin(wx * 2.8 + 1.2) * 0.5 + 0.5;
    float wave3 = sin(wx * 8.0 - 0.7) * 0.5 + 0.5;

    // Smooth blend with softer power curve
    float luminance = wave1 * 0.5 + wave2 * 0.35 + wave3 * 0.15;
    luminance = smoothstep(0.25, 0.75, luminance);

    // Center fade (radial, content-aware)
    vec2 d2 = (uv - 0.5) / (u_contentSize * 0.5 + 0.05);
    float rContent = length(d2);
    float centerFade = smoothstep(1.2, 2.16, rContent);
    luminance *= centerFade;

    return luminance;
  }
`
