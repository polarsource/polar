export const RIPPLES_GLSL = `
  uniform vec2 u_contentSize;

  float computeLuminance(vec2 uv, float aspect, float time) {
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
    float t = time * 0.15;

    // Multiple ripple sources
    vec2 c1 = vec2(0.15, 0.1) * vec2(aspect, 1.0);
    vec2 c2 = vec2(-0.2, -0.15) * vec2(aspect, 1.0);
    vec2 c3 = vec2(0.1, -0.2) * vec2(aspect, 1.0);

    float r1 = length(p - c1);
    float r2 = length(p - c2);
    float r3 = length(p - c3);

    float wave1 = sin(r1 * 18.0 - t * 3.0) * 0.5 + 0.5;
    float wave2 = sin(r2 * 14.0 - t * 2.5 + 1.0) * 0.5 + 0.5;
    float wave3 = sin(r3 * 20.0 - t * 3.5 + 2.0) * 0.5 + 0.5;

    // Interference pattern
    float luminance = wave1 * 0.45 + wave2 * 0.35 + wave3 * 0.2;
    luminance = smoothstep(0.3, 0.7, luminance);

    // Decay from each source
    float decay = exp(-r1 * 1.5) * 0.5 + exp(-r2 * 1.5) * 0.3 + exp(-r3 * 1.5) * 0.2;
    luminance *= smoothstep(0.0, 0.3, decay);

    // Center fade (radial, content-aware)
    vec2 d2 = (uv - 0.5) / (u_contentSize * 0.5 + 0.05);
    float rContent = length(d2);
    float centerFade = smoothstep(1.2, 2.16, rContent);
    luminance *= centerFade;

    return luminance;
  }
`
