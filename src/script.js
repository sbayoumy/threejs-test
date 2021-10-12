import './style.css'
import * as THREE from 'three'
import { TubePainter } from 'three/examples/jsm/misc/TubePainter.js'
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VertexNormalsHelper } from 'three/examples/jsm/helpers/VertexNormalsHelper'
import Delaunator from 'delaunator'
import * as Stats from 'stats.js'
import * as dat from 'dat.gui'
import vulcanoVertexShader from './shaders/vulcano/vertex.glsl'
import vulcanoFragmentShader from './shaders/vulcano/fragment.glsl'

// Canvas
let canvas = document.querySelector('canvas.webgl')

// Debug
let gui = new dat.GUI()
let stats = new Stats()
stats.showPanel(0)
gui.domElement.style.cssText = 'position:absolute;top:40px;left:80px;';
stats.domElement.style.cssText = 'position:absolute;top:40px;';
document.body.appendChild(stats.dom)

// Loaders
const textureLoader = new THREE.TextureLoader()

// Textures
const lavaTexture = textureLoader.load("lava.png")

// Scene
let scene = new THREE.Scene()

// Cursor
const cursor = new THREE.Vector3()

// XR
let controller
let viewerReferenceSpace
let session

// Hit test source
let hitTestSource
let hitTestSourceRequested = false

// Painter
let painter = new TubePainter()
painter.setSize(0.74)
painter.mesh.material.side = THREE.DoubleSide
scene.add(painter.mesh)

// Shape
const shape = new THREE.Shape()
// Complex
// shape.lineTo(0, 0.8)
// shape.lineTo(0.2, 1)
// shape.lineTo(0.6, 1.2)
// shape.lineTo(0.9, 1.0)
// shape.lineTo(1.2, 1.0)
// shape.lineTo(1.5, 0.8)
// shape.lineTo(1.8, 0.4)
// shape.lineTo(1.8, 0)
// shape.lineTo(1.2, -0.5)
// shape.lineTo(0.2, -0.5)

const extrudeSettings = {
	curveSegments: 0,
    depth: 0.01,
    bevelEnabled: false
};

// Vulcano
const vulcanoBboxSize = new THREE.Vector3()
let vulcanoHeight = 0.0

// Geometries
// const torusGeometry = new THREE.TorusGeometry( .03, .01, 16, 100 )
const icosahedronGeometry = new THREE.IcosahedronGeometry(20, 20)
const planeGeometry = new THREE.PlaneGeometry(1, 1, 100, 100)
const reticleGeometry = new THREE.RingGeometry( 0.01, 0.015, 32).rotateX(-Math.PI/2)


// Materials
const icosahedronMaterial = new THREE.ShaderMaterial({
    uniforms: {
        tLava: {
            type: "t",
            value: lavaTexture
        },
        time: {
            type: "f",
            value: 0.0
        }
    },
    vertexShader:
        `
        //
        // GLSL textureless classic 3D noise "cnoise",
        // with an RSL-style periodic variant "pnoise".
        // Author:  Stefan Gustavson (stefan.gustavson@liu.se)
        // Version: 2011-10-11
        //
        // Many thanks to Ian McEwan of Ashima Arts for the
        // ideas for permutation and gradient selection.
        //
        // Copyright (c) 2011 Stefan Gustavson. All rights reserved.
        // Distributed under the MIT license. See LICENSE file.
        // https://github.com/stegu/webgl-noise
        //
        vec3 mod289(vec3 x)
        {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec4 mod289(vec4 x)
        {
        return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec4 permute(vec4 x)
        {
        return mod289(((x*34.0)+10.0)*x);
        }

        vec4 taylorInvSqrt(vec4 r)
        {
        return 1.79284291400159 - 0.85373472095314 * r;
        }

        vec3 fade(vec3 t) {
        return t*t*t*(t*(t*6.0-15.0)+10.0);
        }

        // Classic Perlin noise
        float cnoise(vec3 P)
        {
        vec3 Pi0 = floor(P); // Integer part for indexing
        vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
        Pi0 = mod289(Pi0);
        Pi1 = mod289(Pi1);
        vec3 Pf0 = fract(P); // Fractional part for interpolation
        vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
        vec4 iy = vec4(Pi0.yy, Pi1.yy);
        vec4 iz0 = Pi0.zzzz;
        vec4 iz1 = Pi1.zzzz;

        vec4 ixy = permute(permute(ix) + iy);
        vec4 ixy0 = permute(ixy + iz0);
        vec4 ixy1 = permute(ixy + iz1);

        vec4 gx0 = ixy0 * (1.0 / 7.0);
        vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
        gx0 = fract(gx0);
        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
        vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5);
        gy0 -= sz0 * (step(0.0, gy0) - 0.5);

        vec4 gx1 = ixy1 * (1.0 / 7.0);
        vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
        gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
        vec4 sz1 = step(gz1, vec4(0.0));
        gx1 -= sz1 * (step(0.0, gx1) - 0.5);
        gy1 -= sz1 * (step(0.0, gy1) - 0.5);

        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
        vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
        vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
        vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
        vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
        vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
        vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
        vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
        g000 *= norm0.x;
        g010 *= norm0.y;
        g100 *= norm0.z;
        g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
        g001 *= norm1.x;
        g011 *= norm1.y;
        g101 *= norm1.z;
        g111 *= norm1.w;

        float n000 = dot(g000, Pf0);
        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
        float n111 = dot(g111, Pf1);

        vec3 fade_xyz = fade(Pf0);
        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
        return 2.2 * n_xyz;
        }

        // Classic Perlin noise, periodic variant
        float pnoise(vec3 P, vec3 rep)
        {
        vec3 Pi0 = mod(floor(P), rep); // Integer part, modulo period
        vec3 Pi1 = mod(Pi0 + vec3(1.0), rep); // Integer part + 1, mod period
        Pi0 = mod289(Pi0);
        Pi1 = mod289(Pi1);
        vec3 Pf0 = fract(P); // Fractional part for interpolation
        vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
        vec4 iy = vec4(Pi0.yy, Pi1.yy);
        vec4 iz0 = Pi0.zzzz;
        vec4 iz1 = Pi1.zzzz;

        vec4 ixy = permute(permute(ix) + iy);
        vec4 ixy0 = permute(ixy + iz0);
        vec4 ixy1 = permute(ixy + iz1);

        vec4 gx0 = ixy0 * (1.0 / 7.0);
        vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
        gx0 = fract(gx0);
        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
        vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5);
        gy0 -= sz0 * (step(0.0, gy0) - 0.5);

        vec4 gx1 = ixy1 * (1.0 / 7.0);
        vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
        gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
        vec4 sz1 = step(gz1, vec4(0.0));
        gx1 -= sz1 * (step(0.0, gx1) - 0.5);
        gy1 -= sz1 * (step(0.0, gy1) - 0.5);

        vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
        vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
        vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
        vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
        vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
        vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
        vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
        vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
        g000 *= norm0.x;
        g010 *= norm0.y;
        g100 *= norm0.z;
        g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
        g001 *= norm1.x;
        g011 *= norm1.y;
        g101 *= norm1.z;
        g111 *= norm1.w;

        float n000 = dot(g000, Pf0);
        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
        float n111 = dot(g111, Pf1);

        vec3 fade_xyz = fade(Pf0);
        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x); 
        return 2.2 * n_xyz;
        }

        // Start vertex shader

        varying vec2 vUv;
        varying float high_noise;
        uniform float time;

        float turbulence(vec3 p){
            float w = 10.0;
            float t = -0.1;

            for(float f = 1.0; f <= 10.0; f++){
                float power = pow(2.0, f);
                t += abs(pnoise(vec3(power * p), vec3(10.0, 10.0, 10.0)) / power);
            }
            return t;
        }

        void main() {
            vUv = uv;

            // Get turbulent noise using normal (high frequency)
            high_noise = 12.0 * -0.07 * turbulence(1.2 * normal + time);
            // Get noise using vertex position (low frequency)
            float low_noise = 1.5 * pnoise(0.19 * position, vec3(100.0));
            // Combine noises
            float displacement = -12.0 * high_noise + low_noise;

            // Transform vertex position along the normal
            vec3 newPosition = position + normal * displacement;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
        }
        `, 
    fragmentShader:
        `
        varying vec2 vUv;
        varying float high_noise;
        uniform sampler2D tLava;

        void main() {
            
            // Apply color in the texture using noise
            vec2 tPos = vec2(0.0, -1.5 * high_noise + 0.43);
            vec4 color = texture2D(tLava, tPos);
            gl_FragColor = vec4( color.rgb, 1.0);
        }
        `
})
const reticleMaterial = new THREE.MeshBasicMaterial()
const contourMaterial = new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true})
const pointsMaterial = new THREE.PointsMaterial({color: "yellow", size: 0.02})
const vulcanoMaterial = new THREE.ShaderMaterial({
    vertexShader: vulcanoVertexShader,
    fragmentShader: vulcanoFragmentShader,
    uniforms: {
      tLava: {
          type: "t",
          value: lavaTexture
      },
      uTime: {
          type: "f",
          value: 0.0
      },
      uVulcanoHeight: {
        type: "f",
        value: 0.72
      },
      uVulcanoCraterSize: {
        type: "f",
        value: 0.7
      },
      uVulcanoDetails: {
        type: "f",
        value: 2.7
      }
  },
})
gui.add(vulcanoMaterial.uniforms.uVulcanoHeight, 'value').min(0.1).max(1).step(0.001).name('uVulcanoHeight')
gui.add(vulcanoMaterial.uniforms.uVulcanoDetails, 'value').min(0.0).max(5).step(0.001).name('uVulcanoDetails')
gui.add(vulcanoMaterial.uniforms.uVulcanoCraterSize, 'value').min(0.0).max(1).step(0.001).name('uVulcanoCraterSize')

// Meshes
const plane = new THREE.Mesh(planeGeometry, vulcanoMaterial)
plane.position.z = -1
// scene.add(plane)
const icosahedron = new THREE.Mesh(icosahedronGeometry, icosahedronMaterial)
icosahedron.position.z = -50
// scene.add(icosahedron)
const reticle = new THREE.Mesh(reticleGeometry,reticleMaterial)
reticle.matrixAutoUpdate = false
reticle.visible = false
scene.add(reticle)

/**
 * Sizes
 */
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Camera
 */
// Base camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.025, 200)
scene.add(camera)

// Controls
// const controls = new OrbitControls(camera, canvas);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(new THREE.Color(0x2f2f2f))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1
renderer.outputEncoding = THREE.sRGBEncoding
renderer.xr.enabled = true

// AR Session
document.body.appendChild(ARButton.createButton(renderer, {
  requiredFeatures: ["hit-test"],
  optionalFeatures: ['dom-overlay', 'dom-overlay-for-handheld-ar'],
  domOverlay: { root: document.body }
}));
renderer.xr.addEventListener('sessionstart', () => {
  renderer.setClearAlpha(0)
  session = renderer.xr.getSession()
  viewerReferenceSpace = renderer.xr.getReferenceSpace()

  if (hitTestSourceRequested === false){
      //TODO: Setup local reference space
      session.requestReferenceSpace('viewer').then((referenceSpace) =>{
          session.requestHitTestSource( {space: referenceSpace}).then((source) =>{
              hitTestSource = source
          })
      })

      hitTestSourceRequested = true
      console.log("Hit test source requested")
  }

  console.log("sessionstart")
})
renderer.xr.addEventListener('sessionend', () => {
  hitTestSourceRequested = false
  hitTestSource = null
  renderer.setClearAlpha(1)
  console.log("sessionend")
})

// Controls
function onSelectStart(){
  this.userData.isSelecting = true
  this.userData.skipFrames = 2
}
function onSelectEnd(){
  this.userData.isSelecting = false
  generateVulcano()
}

controller = renderer.xr.getController(0)
controller.addEventListener('selectstart', onSelectStart)
controller.addEventListener('selectend', onSelectEnd)
controller.userData.skipFrames = 0
scene.add(controller)

// Handle controller
const handleController = (controller) =>{
  const userData = controller.userData

  if(userData.isSelecting === true){
      if(userData.skipFrames >= 0){
          userData.skipFrames --

          painter.moveTo(cursor)
          shape.moveTo(cursor.x, cursor.z)
      }
      else{
          painter.lineTo(cursor)
          shape.lineTo(cursor.x, cursor.z)
          painter.update()
      }
  }
}

/**
 * Animate
 */
const clock = new THREE.Clock()

// Update
const tick = () =>
{
    stats.begin()
    const elapsedTime = clock.getElapsedTime()

    // Update objects
    icosahedron.rotation.y = .5 * elapsedTime
    icosahedronMaterial.uniforms['time'].value = 0.124 * elapsedTime

    // Update controls
    handleController(controller)

    stats.end()
}

// Render loop
const loop = () =>
{
  renderer.setAnimationLoop((number, xrFrame) => {
    tick()
    if(xrFrame){
        if(hitTestSource){
            const hitTestResults = xrFrame.getHitTestResults(hitTestSource)
            // Checks if a raycast has been hit and picks the closest to the camera
            if(hitTestResults.length){
                const hit = hitTestResults[0]
                
                reticle.visible = true
                const pose = hit.getPose(viewerReferenceSpace).transform.matrix
                reticle.matrix.fromArray(pose)

                // Create and apply transform matrix to cursor
                const m4 = new THREE.Matrix4().fromArray(pose)
                cursor.set(0, 0, 0).applyMatrix4(m4)
            }
            else{
                reticle.visible = false
            }
        }
    }

    renderer.render(scene , camera)
  })
}

loop()

function generateVulcano()
{
  const contourGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  var pointsAndUvs = generatePointsAndUvOnGeo(contourGeometry, 500)// <-- 0 Is points && 1 is UVs
  var pointsArray = pointsAndUvs[0]

  const vulcanoGeometry = new THREE.BufferGeometry().setFromPoints(pointsArray)

  // Contour
  const contour = new THREE.Mesh(contourGeometry, contourMaterial)
  contour.rotateX(Math.PI/2)
  contour.position.setY(cursor.y)
  scene.add(contour)


  // Vulcano
  var indexDelaunay = Delaunator.from(
    pointsArray.map(v => {
        return [v.x, v.y]
    })
  )
  // UVs
  var uvs = new Float32Array(pointsArray.length * 3 * 2)
  var pointsIndex = [] // Delaunay index => Three.js index

  for (let i = 0; i < indexDelaunay.triangles.length; i++){
    pointsIndex.push(indexDelaunay.triangles[i])
  }
  
  vulcanoGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  vulcanoGeometry.uvsNeedUpdate = true
  vulcanoGeometry.setIndex(pointsIndex) // Add Three.js index to existing geometry

  vulcanoGeometry.computeBoundingBox()
  vulcanoGeometry.boundingBox.getSize(vulcanoBboxSize)
  var uvMapSize = Math.max(vulcanoBboxSize.x, vulcanoBboxSize.y, vulcanoBboxSize.z);
  
  let boxGeometry = new THREE.BoxBufferGeometry(uvMapSize, uvMapSize, uvMapSize);
  let material = new THREE.MeshBasicMaterial({
    color: 0x10f0f0,
    transparent: true,
    opacity: 0.5
  });
  let cube = new THREE.Mesh(boxGeometry, material);
  // scene.add(cube);
  var center = new THREE.Vector3()
  vulcanoGeometry.boundingBox.getCenter(center)
  vulcanoGeometry.center()
  applyBoxUV(vulcanoGeometry, new THREE.Matrix4().invert(cube.matrix), uvMapSize)
  vulcanoGeometry.translate(center.x, center.y, center.z)
  vulcanoGeometry.attributes.uv.needsUpdate = true

  vulcanoGeometry.computeVertexNormals()
  vulcanoGeometry.normalizeNormals()
  var vulcanoMesh = new THREE.Mesh(
    vulcanoGeometry, // Re-use existing geometry
    vulcanoMaterial
  )
  vulcanoMesh.rotateX(Math.PI/2)
  vulcanoMesh.position.setY(cursor.y)
  scene.add(vulcanoMesh)

  // Points
  const points = new THREE.Points(vulcanoGeometry, pointsMaterial)
  // contour.add(points)

  const vertexNormalsHelper = new VertexNormalsHelper(vulcanoMesh)
  // scene.add(vertexNormalsHelper)
  
}

function generatePointsAndUvOnGeo(geometry, count) {   
    var dummyTarget = new THREE.Vector3() // to prevent logging of warnings from ray.at() method
    var ray = new THREE.Ray()
    var size = new THREE.Vector3()
    geometry.computeBoundingBox()
    let bbox = geometry.boundingBox
    let points = []
    let uvs = []
    var dir = new THREE.Vector3(0, 0, -1).normalize()
    
    let counter = 0
    while(counter < count){
        let v = new THREE.Vector3(
            THREE.Math.randFloat(bbox.min.x, bbox.max.x),
            THREE.Math.randFloat(bbox.min.y, bbox.max.y),
            bbox.min.z
        );
        if (isInside(v)){
            points.push(v)
            counter++
          }
    }

    function isInside(v){
        ray.set(v, dir)
        let counter = 0
        let pos = geometry.attributes.position
        let offset = new THREE.Vector2(0 - bbox.min.x, 0 - bbox.min.y);
        let range = new THREE.Vector2(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y);
        let faces = pos.count / 3
        let vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3()
        for(let i = 0; i < faces; i++){
            vA.fromBufferAttribute(pos, i * 3 + 0)
            vB.fromBufferAttribute(pos, i * 3 + 1)
            vC.fromBufferAttribute(pos, i * 3 + 2)
            if (ray.intersectTriangle(vA, vB, vC, false, dummyTarget)){
                uvs.push([
                    new THREE.Vector2((vA.x + offset.x)/range.x ,(vA.y + offset.y)/range.y),
                    new THREE.Vector2((vB.x + offset.x)/range.x ,(vB.y + offset.y)/range.y),
                    new THREE.Vector2((vC.x + offset.x)/range.x ,(vC.y + offset.y)/range.y)
                ])
                counter++
            }
      }
      
      return counter % 2 == 1
    }
    return [points, uvs]
}

function _applyBoxUV(geom, transformMatrix, bbox, bbox_max_size) {

    let coords = [];
    coords.length = 2 * geom.attributes.position.array.length / 3;
  
    // geom.removeAttribute('uv');
    if (geom.attributes.uv === undefined) {
      geom.addAttribute('uv', new THREE.Float32BufferAttribute(coords, 2));
    }
    
    //maps 3 verts of 1 face on the better side of the cube
    //side of the cube can be XY, XZ or YZ
    let makeUVs = function(v0, v1, v2) {
  
      //pre-rotate the model so that cube sides match world axis
      v0.applyMatrix4(transformMatrix);
      v1.applyMatrix4(transformMatrix);
      v2.applyMatrix4(transformMatrix);
  
      //get normal of the face, to know into which cube side it maps better
      let n = new THREE.Vector3();
      n.crossVectors(v1.clone().sub(v0), v1.clone().sub(v2)).normalize();
  
      n.x = Math.abs(n.x);
      n.y = Math.abs(n.y);
      n.z = Math.abs(n.z);
  
      let uv0 = new THREE.Vector2();
      let uv1 = new THREE.Vector2();
      let uv2 = new THREE.Vector2();
      // xz mapping
      if (n.y > n.x && n.y > n.z) {
        uv0.x = (v0.x - bbox.min.x) / bbox_max_size;
        uv0.y = (bbox.max.z - v0.z) / bbox_max_size;
  
        uv1.x = (v1.x - bbox.min.x) / bbox_max_size;
        uv1.y = (bbox.max.z - v1.z) / bbox_max_size;
  
        uv2.x = (v2.x - bbox.min.x) / bbox_max_size;
        uv2.y = (bbox.max.z - v2.z) / bbox_max_size;
      } else
      if (n.x > n.y && n.x > n.z) {
        uv0.x = (v0.z - bbox.min.z) / bbox_max_size;
        uv0.y = (v0.y - bbox.min.y) / bbox_max_size;
  
        uv1.x = (v1.z - bbox.min.z) / bbox_max_size;
        uv1.y = (v1.y - bbox.min.y) / bbox_max_size;
  
        uv2.x = (v2.z - bbox.min.z) / bbox_max_size;
        uv2.y = (v2.y - bbox.min.y) / bbox_max_size;
      } else
      if (n.z > n.y && n.z > n.x) {
        uv0.x = (v0.x - bbox.min.x) / bbox_max_size;
        uv0.y = (v0.y - bbox.min.y) / bbox_max_size;
  
        uv1.x = (v1.x - bbox.min.x) / bbox_max_size;
        uv1.y = (v1.y - bbox.min.y) / bbox_max_size;
  
        uv2.x = (v2.x - bbox.min.x) / bbox_max_size;
        uv2.y = (v2.y - bbox.min.y) / bbox_max_size;
      }
  
      return {
        uv0: uv0,
        uv1: uv1,
        uv2: uv2
      };
    };
  
    if (geom.index) { // is it indexed buffer geometry?
      for (let vi = 0; vi < geom.index.array.length; vi += 3) {
        let idx0 = geom.index.array[vi];
        let idx1 = geom.index.array[vi + 1];
        let idx2 = geom.index.array[vi + 2];
  
        let vx0 = geom.attributes.position.array[3 * idx0];
        let vy0 = geom.attributes.position.array[3 * idx0 + 1];
        let vz0 = geom.attributes.position.array[3 * idx0 + 2];
  
        let vx1 = geom.attributes.position.array[3 * idx1];
        let vy1 = geom.attributes.position.array[3 * idx1 + 1];
        let vz1 = geom.attributes.position.array[3 * idx1 + 2];
  
        let vx2 = geom.attributes.position.array[3 * idx2];
        let vy2 = geom.attributes.position.array[3 * idx2 + 1];
        let vz2 = geom.attributes.position.array[3 * idx2 + 2];
  
        let v0 = new THREE.Vector3(vx0, vy0, vz0);
        let v1 = new THREE.Vector3(vx1, vy1, vz1);
        let v2 = new THREE.Vector3(vx2, vy2, vz2);
  
        let uvs = makeUVs(v0, v1, v2, coords);
  
        coords[2 * idx0] = uvs.uv0.x;
        coords[2 * idx0 + 1] = uvs.uv0.y;
  
        coords[2 * idx1] = uvs.uv1.x;
        coords[2 * idx1 + 1] = uvs.uv1.y;
  
        coords[2 * idx2] = uvs.uv2.x;
        coords[2 * idx2 + 1] = uvs.uv2.y;
      }
    } else {
      for (let vi = 0; vi < geom.attributes.position.array.length; vi += 9) {
        let vx0 = geom.attributes.position.array[vi];
        let vy0 = geom.attributes.position.array[vi + 1];
        let vz0 = geom.attributes.position.array[vi + 2];
  
        let vx1 = geom.attributes.position.array[vi + 3];
        let vy1 = geom.attributes.position.array[vi + 4];
        let vz1 = geom.attributes.position.array[vi + 5];
  
        let vx2 = geom.attributes.position.array[vi + 6];
        let vy2 = geom.attributes.position.array[vi + 7];
        let vz2 = geom.attributes.position.array[vi + 8];
  
        let v0 = new THREE.Vector3(vx0, vy0, vz0);
        let v1 = new THREE.Vector3(vx1, vy1, vz1);
        let v2 = new THREE.Vector3(vx2, vy2, vz2);
  
        let uvs = makeUVs(v0, v1, v2, coords);
  
        let idx0 = vi / 3;
        let idx1 = idx0 + 1;
        let idx2 = idx0 + 2;
  
        coords[2 * idx0] = uvs.uv0.x;
        coords[2 * idx0 + 1] = uvs.uv0.y;
  
        coords[2 * idx1] = uvs.uv1.x;
        coords[2 * idx1 + 1] = uvs.uv1.y;
  
        coords[2 * idx2] = uvs.uv2.x;
        coords[2 * idx2 + 1] = uvs.uv2.y;
      }
    }
  
    geom.attributes.uv.array = new Float32Array(coords);
  }
  
  function applyBoxUV(bufferGeometry, transformMatrix, boxSize) {
  
    if (transformMatrix === undefined) {
      transformMatrix = new THREE.Matrix4();
    }
  
    if (boxSize === undefined) {
      let geom = bufferGeometry;
      geom.computeBoundingBox();
      let bbox = geom.boundingBox;
  
      let bbox_size_x = bbox.max.x - bbox.min.x;
      let bbox_size_z = bbox.max.z - bbox.min.z;
      let bbox_size_y = bbox.max.y - bbox.min.y;
  
      boxSize = Math.max(bbox_size_x, bbox_size_y, bbox_size_z);
    }
  
    let uvBbox = new THREE.Box3(new THREE.Vector3(-boxSize / 2, -boxSize / 2, -boxSize / 2), new THREE.Vector3(boxSize / 2, boxSize / 2, boxSize / 2));
  
    _applyBoxUV(bufferGeometry, transformMatrix, uvBbox, boxSize);
  
  }