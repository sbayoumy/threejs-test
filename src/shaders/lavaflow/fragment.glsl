varying vec2 vUv;
varying float high_noise;
uniform sampler2D tLava;

void main() {
    
    // Apply color in the texture using noise
    vec2 tPos = vec2(0.0, -1.5 * high_noise + 0.43);
    vec4 color = texture2D(tLava, tPos);
    gl_FragColor = vec4( color.rgb, 1.0);
}