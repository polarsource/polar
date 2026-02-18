export const WAVES_GLSL = `
  float computeLuminance(vec2 uv, float aspect, float time) {
    float t = time * 0.08;
    float x = uv.x;
    float y = uv.y;

    // Multiple layers of sinusoidal displacement
    float warp = 0.0;
    warp += sin(y * 4.0 + t * 1.2) * 0.3;
    warp += sin(y * 7.0 - t * 0.8 + 1.5) * 0.15;
    warp += sin(y * 13.0 + t * 0.5 + 3.0) * 0.08;
    warp += sin(y * 2.5 - t * 1.5) * 0.2;

    // Additional y-dependent warping for organic flow
    float warp2 = 0.0;
    warp2 += cos(y * 3.0 + t * 0.7 + x * 2.0) * 0.15;
    warp2 += sin(y * 9.0 - t * 0.4 + 2.0) * 0.06;

    float wx = x + warp + warp2;

    // Create stripe pattern from warped x
    float stripe = sin(wx * 10.0) * 0.5 + 0.5;

    // Add secondary stripe layer for complexity
    float stripe2 = sin(wx * 6.0 + 1.5) * 0.5 + 0.5;
    float stripe3 = sin(wx * 16.0 + 0.8) * 0.5 + 0.5;

    // Blend stripes with varying weights
    return stripe * 0.55 + stripe2 * 0.3 + stripe3 * 0.15;
  }
`
