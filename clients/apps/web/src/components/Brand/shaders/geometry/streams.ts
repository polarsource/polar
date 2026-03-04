export const STREAMS_GLSL = `
  float computeLuminance(vec2 uv, float aspect, float time) {
    float t = time * 0.06;
    vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

    // 14 horizontal transaction streams
    float rows = 14.0;
    float yScaled = p.y * rows;
    float rowIdx = floor(yScaled + 0.5);
    float localY = yScaled - rowIdx;

    // Stable per-row random offset
    float rng = fract(sin(rowIdx * 127.1 + 311.7) * 43758.5);
    float phase = rng * 6.2832;
    float driftSpeed = 0.12 + rng * 0.16;

    // Gently undulating stream path
    float curve = sin(p.x * 1.6 + t * driftSpeed + phase) * 0.065;
    curve += cos(p.x * 3.4 + t * driftSpeed * 0.55 + phase * 1.5) * 0.028;

    float dist = abs(localY - curve);
    float line = 1.0 - smoothstep(0.0, 0.075, dist);

    // Sharp blips flowing along each stream (individual transactions)
    float blipSpeed = 1.0 + rng * 1.8;
    float blip = sin(p.x * 3.2 - t * blipSpeed + phase * 2.1) * 0.5 + 0.5;
    blip = pow(blip, 7.0);

    // Dim baseline + bright blip
    float baseAlpha = 0.07 + rng * 0.11;
    line *= baseAlpha + blip * (1.0 - baseAlpha);

    // Soft edge vignette
    float xFade = 1.0 - smoothstep(0.45, 0.85, abs(uv.x - 0.5) * 2.0);
    float yFade = 1.0 - smoothstep(0.45, 0.85, abs(uv.y - 0.5) * 2.0);

    return line * xFade * yFade;
  }
`
