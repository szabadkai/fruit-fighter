import { Filter, GlProgram } from 'pixi.js';

// Full-screen "printed comic" pass: CMY misregistration, Ben-Day halftone dots in the
// darker tones, paper grain, and the black/white impact-frame mode.

const vertex = `in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

const fragment = `in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform float uDotSize;
uniform float uMisregister;
uniform float uImpact;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main(void) {
  vec2 px = uInputSize.zw * uMisregister;
  vec4 base = texture(uTexture, vTextureCoord);
  float r = texture(uTexture, vTextureCoord + vec2(px.x, 0.0)).r;
  float b = texture(uTexture, vTextureCoord - vec2(px.x * 0.7, px.y * 0.7)).b;
  vec3 col = vec3(r, base.g, b);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));

  if (uImpact > 0.5) {
    float s = step(0.16, dot(base.rgb, vec3(0.299, 0.587, 0.114)));
    vec3 c = uImpact > 1.5 ? vec3(1.0 - s) : vec3(s);
    finalColor = vec4(c, 1.0);
    return;
  }

  // 45-degree dot grid in screen pixels. Only the darker tones get dots (mostly the
  // backdrop's outer rings), so characters and the stage stay flat and readable.
  vec2 p = gl_FragCoord.xy / uDotSize;
  p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
  float d = length(fract(p) - 0.5);
  float radius = clamp((0.5 - lum) * 1.0, 0.0, 0.5);
  float aa = 1.5 / uDotSize;
  float dotMask = 1.0 - smoothstep(radius - aa, radius + aa, d);
  float notInk = step(0.1, lum);
  col = mix(col, col * 0.72, dotMask * notInk);

  float grain = hash(floor(gl_FragCoord.xy * 0.5)) - 0.5;
  col += grain * 0.05;
  col *= vec3(1.0, 0.985, 0.94);
  finalColor = vec4(col, 1.0);
}
`;

export class ComicFilter extends Filter {
  constructor(resolution: number) {
    super({
      glProgram: GlProgram.from({ vertex, fragment, name: 'comic-filter' }),
      resources: {
        comicUniforms: {
          uDotSize: { value: 6 * resolution, type: 'f32' },
          uMisregister: { value: 1.2 * resolution, type: 'f32' },
          uImpact: { value: 0, type: 'f32' },
        },
      },
      resolution,
      antialias: 'on',
    });
  }

  set impact(mode: number) {
    this.resources.comicUniforms.uniforms.uImpact = mode;
  }
}
