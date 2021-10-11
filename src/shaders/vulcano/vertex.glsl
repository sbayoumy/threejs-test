const float PI = 3.141592653589793;

#pragma glslify: getPerlinNoise2d = require('../partials/perlinNoise2d.glsl')
#pragma glslify: pnoise = require('../partials/perlinNoise3d.glsl')

varying vec2 vUv;
varying float vElevation;
varying float vVulcanoBase;
varying float vVulcanoCrater;
varying float vHighNoise;

uniform float uTime;

float draw_circle(vec2 _coord, float _radius, float _fallOff) {
    return 1.0 - pow(length(_coord), _radius * 3.2) * _fallOff;
}

float getElevation(vec2 _position, float _frequency)
{
    float elevation = 0.0;
    for(float i = 1.0; i < _frequency; i++)
    {
        float frequency = i;
        elevation += getPerlinNoise2d(_position * frequency * 40.0) / 6.0;
    }
    return elevation;
}

float turbulence(vec3 p){
    float w = 10.0;
    float t = -0.1;

    for(float f = 1.0; f <= 10.0; f++){
        float power = pow(2.0, f);
        t += abs(pnoise(vec3(power * p), vec3(10.0, 10.0, 10.0)) / power);
    }
    return t;
}

void main()
{
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    vec2 coord = uv;
    vec2 offset = vec2(0.5, 0.5);
    float vulcanoBase = clamp(draw_circle(coord - offset, 0.4, 3.5), 0.0, 1.0);
    float vulcanoCrater = clamp(draw_circle(coord - offset, 0.15, 3.4), 0.0, 1.0);
    float vulcanoFinal = vulcanoCrater - vulcanoBase;
    float elevationZ = getElevation(modelPosition.xy, 2.0) * 0.3;

    // Get turbulent noise using normal (high frequency)
    vHighNoise = 12.0 * -0.07 * turbulence(1.2 * normal);
    // Get noise using vertex position (low frequency)
    float low_noise = 1.5 * pnoise(0.19 * position, vec3(100.0));
    // Combine noises
    float displacement = -12.0 * vHighNoise + low_noise;

    // Transform vertex position along the normal
    vec3 newPosition = normal * displacement;

    modelPosition.y *= vulcanoBase;
    // modelPosition.y *= elevationZ + 0.8;
    
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectionPosition = projectionMatrix * viewPosition;
    
    gl_Position = projectionPosition;

    vUv = uv;
    vElevation = elevationZ;
    vVulcanoBase = vulcanoBase;
    vVulcanoCrater = vulcanoCrater;
}