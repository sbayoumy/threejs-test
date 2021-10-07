varying vec2 vUv;
varying float vElevation;
varying float vVulcanoBase;
varying float vVulcanoCrater;
varying float vHighNoise;

uniform sampler2D uLava;

void main()
{
    vec3 color = vec3(vVulcanoBase - vVulcanoCrater - vElevation);

    gl_FragColor = vec4(color, 1.0);
}