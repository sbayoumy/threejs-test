varying vec2 vUv;
varying float vElevation;
varying float vVulcanoBase;
varying float vVulcanoCrater;
varying float vHighNoise;

uniform sampler2D tLava;

void main()
{
    // Apply color in the texture using noise
    vec2 tPos = vec2(0.0, -1.5 * vHighNoise + 0.43);
    vec4 lavaColor = texture2D(tLava, tPos);
    // vec3 color = vec3(vVulcanoBase - vVulcanoCrater - vElevation);
    vec3 color = vec3(vVulcanoBase - vVulcanoCrater + vElevation);

    // gl_FragColor = vec4(vVulcanoBase - vVulcanoCrater * 0.8 , vVulcanoBase - vVulcanoCrater * 0.8 , vVulcanoBase - vVulcanoCrater * 0.8, 1.0);
    gl_FragColor = vec4(color, 1.0);
}