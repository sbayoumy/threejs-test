import "./style.css"
import * as THREE from "three"
import { TubePainter } from "three/examples/jsm/misc/TubePainter.js"
import { ARButton } from "three/examples/jsm/webxr/ARButton.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { VertexNormalsHelper } from "three/examples/jsm/helpers/VertexNormalsHelper"
import Delaunator from "delaunator"
import * as Stats from "stats.js"
import * as dat from "dat.gui"
import * as noisejs from "noisejs"
import vulcanoVertexShader from "./shaders/vulcano/vertex.glsl"
import vulcanoFragmentShader from "./shaders/vulcano/fragment.glsl"
import lavaVertexShader from "./shaders/lavaflow/vertex.glsl"
import lavaFragmentShader from "./shaders/lavaflow/fragment.glsl"
import { MathUtils, SphereBufferGeometry } from "three"

// Canvas
let canvas = document.querySelector("canvas.webgl")

/**
 * Sizes
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
}

// Loaders
const textureLoader = new THREE.TextureLoader()

// Textures
const lavaTexture = textureLoader.load("lava.png")
// lavaTexture.wrapT = THREE.RepeatWrapping

// Scene
let scene = new THREE.Scene()

// Cursor
const cursor = new THREE.Vector3()

// XR
let controller = new THREE.Group()
let viewerReferenceSpace
let session

// Hit test source
let hitTestSource
let hitTestSourceRequested = false

// Painter
let painter = new TubePainter()
painter.setSize(1)
painter.mesh.material.side = THREE.DoubleSide
scene.add(painter.mesh)

// Noisejs
var noise = new noisejs.Noise(Math.random())

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
  bevelEnabled: false,
}

// Vulcano
var vulcanoBboxSize = new THREE.Vector3()
var vulcanoHeight = 1.0
var vulcanoDetails = 2.7
var vulcanoCraterSize = 0.7
var vulcanoCraterDepth = 1.0
var isVulcanoFinished = false
var isVulcanoBaseFinished = false
var vulcanoHeightContours = []
var indexAttribute = null
var indices = null
var uvCenters = []
var boundingSphereRadius = []

// Debug
let gui = new dat.GUI()
gui.domElement.style.cssText = "position:absolute;top:40px;left:80px;"
let stats = new Stats()
stats.showPanel(0)
stats.domElement.style.cssText = "position:absolute;top:40px;"
document.body.appendChild(stats.dom)
var debugObject = {
  vulcanoHeight: 1.0,
  vulcanoDetails: 2.7,
  vulcanoCraterSize: 0.7,
  vulcanoCraterDepth: 1.0,
}
gui
  .add(debugObject, "vulcanoHeight")
  .min(0.01)
  .max(3)
  .step(0.001)
  .name("Vulcano Height")
  .onFinishChange(() => {
    vulcanoHeight = debugObject.vulcanoHeight
    applyVulcanoChanges()
  })
gui
  .add(debugObject, "vulcanoDetails")
  .min(0)
  .max(10)
  .step(0.001)
  .name("Vulcano Details")
  .onFinishChange(() => {
    vulcanoDetails = debugObject.vulcanoDetails
    applyVulcanoChanges()
  })
gui
  .add(debugObject, "vulcanoCraterSize")
  .min(0)
  .max(3)
  .step(0.001)
  .name("Crater Size")
  .onFinishChange(() => {
    vulcanoCraterSize = debugObject.vulcanoCraterSize
    applyVulcanoChanges()
  })
gui
  .add(debugObject, "vulcanoCraterDepth")
  .min(0)
  .max(3)
  .step(0.001)
  .name("Crater Depth")
  .onFinishChange(() => {
    vulcanoCraterDepth = debugObject.vulcanoCraterDepth
    applyVulcanoChanges()
  })

let rayCastHelper
const rayCaster = new THREE.Raycaster()
const pointer = new THREE.Vector3()
const clickedFaces = []

// Geometries
// const torusGeometry = new THREE.TorusGeometry( .03, .01, 16, 100 )
const icosahedronGeometry = new THREE.IcosahedronGeometry(20, 20)
const planeGeometry = new THREE.PlaneBufferGeometry(2, 2)
const reticleGeometry = new THREE.RingGeometry(0.01, 0.015, 32).rotateX(-Math.PI / 2)
const vulcanoGeometry = new THREE.BufferGeometry()
const geometryHelper = new THREE.ConeGeometry(0.02, 0.07, 6)
geometryHelper.translate(0, 0, 0)
geometryHelper.rotateY(Math.PI / 2)

// Materials
const icosahedronMaterial = new THREE.ShaderMaterial({
  uniforms: {
    tLava: {
      type: "t",
      value: lavaTexture,
    },
    time: {
      type: "f",
      value: 0.0,
    },
  },
  vertexShader: lavaVertexShader,
  fragmentShader: lavaFragmentShader,
})
const reticleMaterial = new THREE.MeshBasicMaterial()
const contourMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
})
const planeMaterial = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0.0,
})
const pointsMaterial = new THREE.PointsMaterial({ color: 0x99ccff, size: 0.02 })
const vulcanoMaterial = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  vertexShader: vulcanoVertexShader,
  fragmentShader: vulcanoFragmentShader,
  wireframe: false,
  uniforms: {
    tLava: {
      type: "t",
      value: lavaTexture,
    },
    uTime: {
      type: "f",
      value: 0.0,
    },
    uVulcanoHeight: {
      type: "f",
      value: 0.72,
    },
    uVulcanoCraterSize: {
      type: "f",
      value: 0.7,
    },
    uVulcanoDetails: {
      type: "f",
      value: 2.7,
    },
  },
})
// gui.add(vulcanoMaterial.uniforms.uVulcanoHeight, 'value').min(0.1).max(3).step(0.001).name('uVulcanoHeight')
// gui.add(vulcanoMaterial.uniforms.uVulcanoDetails, 'value').min(0.0).max(5).step(0.001).name('uVulcanoDetails')
// gui.add(vulcanoMaterial.uniforms.uVulcanoCraterSize, 'value').min(0.0).max(1).step(0.001).name('uVulcanoCraterSize')

// Meshes
const plane = new THREE.Mesh(planeGeometry, planeMaterial)
scene.add(plane)
plane.position.z = -2
plane.geometry.needsUpdate = true

// Generate first then mesh
// generateVulcano()
// applyVulcanoChanges()
var vulcanoMesh = new THREE.Mesh(
  vulcanoGeometry, // Re-use existing geometry
  vulcanoMaterial
)
vulcanoMesh.matrixAutoUpdate = false


const icosahedron = new THREE.Mesh(icosahedronGeometry, icosahedronMaterial)
icosahedron.position.z = -50
// scene.add(icosahedron)

const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial)
reticle.matrixAutoUpdate = false
reticle.visible = false
scene.add(reticle)
rayCastHelper = new THREE.Mesh(geometryHelper, new THREE.MeshNormalMaterial())
rayCastHelper.name = "raycaster"
// scene.add(rayCastHelper)

// Points
// const points = new THREE.Points(vulcanoGeometry, pointsMaterial)
// vulcanoMesh.add(points)

// const vertexNormalsHelper = new VertexNormalsHelper(vulcanoMesh)
// scene.add(vertexNormalsHelper)

// Lava flow
var lavaFlowPath = []

// Events
window.addEventListener("resize", () => {
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

canvas.addEventListener("mousedown", onMouseDown)
canvas.addEventListener("mousemove", onMouseMove)
canvas.addEventListener("touchstart", onMouseDown)
canvas.addEventListener("touchmove", onTouchMove)

/**
 * Camera
 */
// Base camera
// const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.025, 200)
const persCamera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.025, 200)
const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 40)
// const orthoCamera2 = new THREE.OrthographicCamera(sizes.width / -2, sizes.width / 2, sizes.height / 2, sizes.height / -2, -1, 200)
var camera = orthoCamera
scene.add(camera)
camera.position.z = 0.4

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.screenSpacePanning = false
controls.minDistance = 0.1
controls.maxDistance = 1
controls.maxPolarAngle = Math.PI
controls.enabled = false
var isPlaced = false

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  alpha: true,
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(new THREE.Color(0xa8a8a8))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1
renderer.outputEncoding = THREE.sRGBEncoding
renderer.xr.enabled = true

// AR Session
document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["dom-overlay", "dom-overlay-for-handheld-ar"],
    domOverlay: { root: document.body },
  })
)
renderer.xr.addEventListener("sessionstart", () => {
  renderer.setClearAlpha(0)
  session = renderer.xr.getSession()
  viewerReferenceSpace = renderer.xr.getReferenceSpace()
  camera = persCamera
  applyVulcanoChanges()

  // TODO: Fix rotation when placing vulcano in AR
  vulcanoMesh.geometry.rotateX(-90)

  if (hitTestSourceRequested === false) {
    //TODO: Setup local reference space
    session.requestReferenceSpace("viewer").then((referenceSpace) => {
      session.requestHitTestSource({ space: referenceSpace }).then((source) => {
        hitTestSource = source
      })
    })

    hitTestSourceRequested = true
    console.log("Hit test source requested")
  }

  console.log("sessionstart")
})
renderer.xr.addEventListener("sessionend", () => {
  hitTestSourceRequested = false
  hitTestSource = null
  renderer.setClearAlpha(1)
  camera = orthoCamera

  console.log("sessionend")
})

// Controls
function onSelectStart() {
  controller.userData.isSelecting = true
  controller.userData.skipFrames = 10
  if (isVulcanoBaseFinished === true && isVulcanoFinished === false) {
    let vulcanoHeightContour = new TubePainter()
    vulcanoHeightContour.setSize(0.4)
    vulcanoHeightContour.mesh.material.side = THREE.DoubleSide
    scene.add(vulcanoHeightContour.mesh)
    vulcanoHeightContours.push(vulcanoHeightContour)
  }
}
function onSelectEnd() {
  controller.userData.isSelecting = false
  if (isVulcanoBaseFinished === true && isVulcanoFinished === false) {
    // let geometry = vulcanoHeightContours.at(-1).mesh.geometry
    let geometry = vulcanoHeightContours[vulcanoHeightContours.length - 1].mesh.geometry
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    // let centerPos = getCenterPoint(vulcanoHeightContours.at(-1).mesh)
    let centerPos = getCenterPoint(vulcanoHeightContours[vulcanoHeightContours.length - 1].mesh)
    let bboxSize = new THREE.Vector3()
    // vulcanoHeightContours.at(-1).mesh.geometry.boundingBox.getSize(bboxSize)
    vulcanoHeightContours[vulcanoHeightContours.length - 1].mesh.geometry.boundingBox.getSize(bboxSize)

    // Debug position
    var material = new THREE.MeshBasicMaterial({
      color: "yellow",
      side: THREE.DoubleSide,
    })
    var sphere = new THREE.Mesh(new SphereBufferGeometry(0.02), material)
    sphere.position.set(centerPos.x * 2, centerPos.y * 2, 100)
    // scene.add(sphere)

    let dir = new THREE.Vector3(0, 0, -1).normalize()
    rayCaster.set(sphere.position, dir)
    let intersect = rayCaster.intersectObject(vulcanoMesh, false)
    if (intersect.length > 0 && centerPos.length() > 0) {
      uvCenters.push(intersect[0].uv)
      boundingSphereRadius.push(
        // vulcanoHeightContours.at(-1).mesh.geometry.boundingSphere.radius
        vulcanoHeightContours[vulcanoHeightContours.length - 1].mesh.geometry.boundingSphere.radius
      )
    }

    // applyVulcanoChanges()
  }
  if (isVulcanoBaseFinished === false) {
    // When the vulcano hasn't been generated yet
    generateVulcano()
    // applyVulcanoChanges()
    isVulcanoBaseFinished = true
  }
}

controller = renderer.xr.getController(0)
// controller.addEventListener('selectstart', onSelectStart)
// controller.addEventListener('selectend', onSelectEnd)
canvas.addEventListener("touchstart", onSelectStart)
canvas.addEventListener("touchend", onSelectEnd)
canvas.addEventListener("mousedown", onSelectStart)
canvas.addEventListener("mouseup", onSelectEnd)
controller.userData.skipFrames = 10
scene.add(controller)

// Handle controller
const handleController = (controller) => {
  const userData = controller.userData

  if (userData.isSelecting === true) {
    if (userData.skipFrames >= 0) {
      userData.skipFrames--

      if (isVulcanoBaseFinished === false) {
        painter.moveTo(pointer)
        shape.moveTo(pointer.x, pointer.y)
        console.log(pointer.x)
      }

      if (isVulcanoFinished === false && isVulcanoBaseFinished === true) {
        // Move position of latest vulcano height contour lines
        console.log(pointer.x)
        // vulcanoHeightContours.at(-1).moveTo(pointer)
        vulcanoHeightContours[vulcanoHeightContours.length - 1].moveTo(pointer)
      }
    } else {
      if (isVulcanoBaseFinished === false) {
        painter.lineTo(pointer)
        shape.lineTo(pointer.x, pointer.y)
        painter.update()
      }

      if (isVulcanoFinished === false && isVulcanoBaseFinished === true) {
        // Move position of latest vulcano height contour lines
        // vulcanoHeightContours.at(-1).lineTo(pointer)
        vulcanoHeightContours[vulcanoHeightContours.length - 1].lineTo(pointer)
        // vulcanoHeightContours.at(-1).update()
        vulcanoHeightContours[vulcanoHeightContours.length - 1].update()
      }
    }
  }
}

/**
 * Animate
 */
const clock = new THREE.Clock()

// Update
const tick = () => {
  stats.begin()
  const elapsedTime = clock.getElapsedTime()

  // Update objects
  camera.updateMatrixWorld()
  icosahedron.rotation.y = 0.5 * elapsedTime
  icosahedronMaterial.uniforms["time"].value = 0.02 * elapsedTime
  vulcanoMaterial.uniforms["uTime"].value = 0.124 * elapsedTime
  // getGradientDescent()

  // Update controls
  handleController(controller)
  controls.update()

  stats.end()
}

// Render loop
const loop = () => {
  renderer.setAnimationLoop((number, xrFrame) => {
    tick()
    if (xrFrame) {
      if (hitTestSource) {
        var hitTestResults = xrFrame.getHitTestResults(hitTestSource)
        // Checks if a raycast has been hit and picks the closest to the camera
        if (hitTestResults.length) {
          var hit = hitTestResults[0]

          reticle.visible = true
          var pose = hit.getPose(viewerReferenceSpace).transform.matrix
          reticle.matrix.fromArray(pose)

          if (!isPlaced) {
            vulcanoMesh.matrix.fromArray(pose)
            applyVulcanoChanges()
          }

          // Create and apply transform matrix to cursor
          var m4 = new THREE.Matrix4().fromArray(pose)
          cursor.set(0, 0, 0).applyMatrix4(m4)
        } else {
          reticle.visible = false
        }
      }
    }

    renderer.render(scene, camera)
  })
}

loop()

function generateVulcano() {
  // Contour base
  const contourGeometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
  // const contour = new THREE.Mesh(contourGeometry, contourMaterial)
  // scene.add(contour)

  var pointsAndUvs = generatePointsAndUvOnGeo(contourGeometry, 3000) // <-- 0 Is points && 1 is UVs
  var pointsArray = pointsAndUvs[0]

  vulcanoGeometry.setFromPoints(pointsArray)

  // Vulcano
  var indexDelaunay = Delaunator.from(
    pointsArray.map((v) => {
      return [v.x, v.y]
    })
  )
  // UVs
  var uvs = new Float32Array(pointsArray.length * 3 * 2)
  var pointsIndex = [] // Delaunay index => Three.js index

  for (let i = 0; i < indexDelaunay.triangles.length; i++) {
    pointsIndex.push(indexDelaunay.triangles[i])
  }

  vulcanoGeometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2))
  vulcanoGeometry.uvsNeedUpdate = true
  vulcanoGeometry.setIndex(pointsIndex) // Add Three.js index to existing geometry

  vulcanoGeometry.computeBoundingBox()
  vulcanoGeometry.boundingBox.getSize(vulcanoBboxSize)
  var uvMapSize = Math.max(vulcanoBboxSize.x, vulcanoBboxSize.y, vulcanoBboxSize.z)

  let boxGeometry = new THREE.BoxBufferGeometry(uvMapSize, uvMapSize, uvMapSize)
  let material = new THREE.MeshBasicMaterial({
    color: 0x10f0f0,
    transparent: true,
    opacity: 0.5,
  })
  let cube = new THREE.Mesh(boxGeometry, material)
  // scene.add(cube)
  var center = new THREE.Vector3()
  vulcanoGeometry.boundingBox.getCenter(center)
  vulcanoGeometry.center()
  applyBoxUV(vulcanoGeometry, new THREE.Matrix4().invert(cube.matrix), uvMapSize)
  vulcanoGeometry.translate(center.x, center.y, center.z)

  // vulcanoMesh.rotateX(Math.PI/2)
  // vulcanoMesh.position.setY(cursor.y)
  scene.add(vulcanoMesh)
  vulcanoMesh.geometry.attributes.uv.needsUpdate = true

  // Index to position data
  // console.log(vulcanoGeometry)
  // var sphereGeometry = new THREE.SphereGeometry( 0.02, 8, 8)
  // var sphereMaterial = new THREE.MeshBasicMaterial({ color: "red", side: THREE.DoubleSide })
  // for(let i = 0; i < vulcanoGeometry.index.array.length; i++){
  //   // console.log(vulcanoGeometry.index.array[i], vulcanoGeometry.index.array[i + 1], vulcanoGeometry.index.array[i + 2])
  //   var position = new THREE.Vector3(vulcanoGeometry.attributes.position.getX(vulcanoGeometry.index.array[i]), vulcanoGeometry.attributes.position.getY(vulcanoGeometry.index.array[i]), vulcanoGeometry.attributes.position.getZ(vulcanoGeometry.index.array[i]))

  //   var sphere = new Mesh(sphereGeometry, sphereMaterial)
  //   sphere.position.set(position.x, -position.z, position.y)
  //   scene.add(sphere)
  //   i++
  //   i++
  // }

  vulcanoGeometry.computeVertexNormals()
  vulcanoGeometry.normalizeNormals()
}

function generatePointsAndUvOnGeo(geometry, count) {
  var dummyTarget = new THREE.Vector3() // to prevent logging of warnings from ray.at() method
  var ray = new THREE.Ray()
  geometry.computeBoundingBox()
  let bbox = geometry.boundingBox
  let points = []
  let uvs = []
  var dir = new THREE.Vector3(0, 0, -1).normalize()

  let counter = 0
  while (counter < count) {
    let v = new THREE.Vector3(
      THREE.Math.randFloat(bbox.min.x, bbox.max.x),
      THREE.Math.randFloat(bbox.min.y, bbox.max.y),
      bbox.min.z
    )
    if (isInside(v)) {
      points.push(v)
      counter++
    }
  }

  function isInside(v) {
    ray.set(v, dir)
    let counter = 0
    let pos = geometry.attributes.position
    let faces = pos.count / 3
    let vA = new THREE.Vector3(),
      vB = new THREE.Vector3(),
      vC = new THREE.Vector3()
    for (let i = 0; i < faces; i++) {
      vA.fromBufferAttribute(pos, i * 3 + 0)
      vB.fromBufferAttribute(pos, i * 3 + 1)
      vC.fromBufferAttribute(pos, i * 3 + 2)

      if (ray.intersectTriangle(vA, vB, vC, false, dummyTarget)) {
        counter++
      }
    }

    return counter % 2 == 1
  }
  return [points, uvs]
}

function _applyBoxUV(geom, transformMatrix, bbox, bbox_max_size) {
  let coords = []
  coords.length = (2 * geom.attributes.position.array.length) / 3

  if (geom.attributes.uv === undefined) {
    geom.addAttribute("uv", new THREE.Float32BufferAttribute(coords, 2))
  }

  //maps 3 verts of 1 face on the better side of the cube
  //side of the cube can be XY, XZ or YZ
  let makeUVs = function (v0, v1, v2) {
    //pre-rotate the model so that cube sides match world axis
    v0.applyMatrix4(transformMatrix)
    v1.applyMatrix4(transformMatrix)
    v2.applyMatrix4(transformMatrix)

    //get normal of the face, to know into which cube side it maps better
    let n = new THREE.Vector3()
    n.crossVectors(v1.clone().sub(v0), v1.clone().sub(v2)).normalize()

    n.x = Math.abs(n.x)
    n.y = Math.abs(n.y)
    n.z = Math.abs(n.z)

    let uv0 = new THREE.Vector2()
    let uv1 = new THREE.Vector2()
    let uv2 = new THREE.Vector2()
    // xz mapping
    if (n.y > n.x && n.y > n.z) {
      uv0.x = (v0.x - bbox.min.x) / bbox_max_size
      uv0.y = (bbox.max.z - v0.z) / bbox_max_size

      uv1.x = (v1.x - bbox.min.x) / bbox_max_size
      uv1.y = (bbox.max.z - v1.z) / bbox_max_size

      uv2.x = (v2.x - bbox.min.x) / bbox_max_size
      uv2.y = (bbox.max.z - v2.z) / bbox_max_size
    } else if (n.x > n.y && n.x > n.z) {
      uv0.x = (v0.z - bbox.min.z) / bbox_max_size
      uv0.y = (v0.y - bbox.min.y) / bbox_max_size

      uv1.x = (v1.z - bbox.min.z) / bbox_max_size
      uv1.y = (v1.y - bbox.min.y) / bbox_max_size

      uv2.x = (v2.z - bbox.min.z) / bbox_max_size
      uv2.y = (v2.y - bbox.min.y) / bbox_max_size
    } else if (n.z > n.y && n.z > n.x) {
      uv0.x = (v0.x - bbox.min.x) / bbox_max_size
      uv0.y = (v0.y - bbox.min.y) / bbox_max_size

      uv1.x = (v1.x - bbox.min.x) / bbox_max_size
      uv1.y = (v1.y - bbox.min.y) / bbox_max_size

      uv2.x = (v2.x - bbox.min.x) / bbox_max_size
      uv2.y = (v2.y - bbox.min.y) / bbox_max_size
    }

    return {
      uv0: uv0,
      uv1: uv1,
      uv2: uv2,
    }
  }

  if (geom.index) {
    // is it indexed buffer geometry?
    for (let vi = 0; vi < geom.index.array.length; vi += 3) {
      let idx0 = geom.index.array[vi]
      let idx1 = geom.index.array[vi + 1]
      let idx2 = geom.index.array[vi + 2]

      let vx0 = geom.attributes.position.array[3 * idx0]
      let vy0 = geom.attributes.position.array[3 * idx0 + 1]
      let vz0 = geom.attributes.position.array[3 * idx0 + 2]

      let vx1 = geom.attributes.position.array[3 * idx1]
      let vy1 = geom.attributes.position.array[3 * idx1 + 1]
      let vz1 = geom.attributes.position.array[3 * idx1 + 2]

      let vx2 = geom.attributes.position.array[3 * idx2]
      let vy2 = geom.attributes.position.array[3 * idx2 + 1]
      let vz2 = geom.attributes.position.array[3 * idx2 + 2]

      let v0 = new THREE.Vector3(vx0, vy0, vz0)
      let v1 = new THREE.Vector3(vx1, vy1, vz1)
      let v2 = new THREE.Vector3(vx2, vy2, vz2)

      let uvs = makeUVs(v0, v1, v2, coords)

      coords[2 * idx0] = uvs.uv0.x
      coords[2 * idx0 + 1] = uvs.uv0.y

      coords[2 * idx1] = uvs.uv1.x
      coords[2 * idx1 + 1] = uvs.uv1.y

      coords[2 * idx2] = uvs.uv2.x
      coords[2 * idx2 + 1] = uvs.uv2.y
    }
  } else {
    for (let vi = 0; vi < geom.attributes.position.array.length; vi += 9) {
      let vx0 = geom.attributes.position.array[vi]
      let vy0 = geom.attributes.position.array[vi + 1]
      let vz0 = geom.attributes.position.array[vi + 2]

      let vx1 = geom.attributes.position.array[vi + 3]
      let vy1 = geom.attributes.position.array[vi + 4]
      let vz1 = geom.attributes.position.array[vi + 5]

      let vx2 = geom.attributes.position.array[vi + 6]
      let vy2 = geom.attributes.position.array[vi + 7]
      let vz2 = geom.attributes.position.array[vi + 8]

      let v0 = new THREE.Vector3(vx0, vy0, vz0)
      let v1 = new THREE.Vector3(vx1, vy1, vz1)
      let v2 = new THREE.Vector3(vx2, vy2, vz2)

      let uvs = makeUVs(v0, v1, v2, coords)

      let idx0 = vi / 3
      let idx1 = idx0 + 1
      let idx2 = idx0 + 2

      coords[2 * idx0] = uvs.uv0.x
      coords[2 * idx0 + 1] = uvs.uv0.y

      coords[2 * idx1] = uvs.uv1.x
      coords[2 * idx1 + 1] = uvs.uv1.y

      coords[2 * idx2] = uvs.uv2.x
      coords[2 * idx2 + 1] = uvs.uv2.y
    }
  }

  geom.attributes.uv.array = new Float32Array(coords)
}

function applyBoxUV(bufferGeometry, transformMatrix, boxSize) {
  if (transformMatrix === undefined) {
    transformMatrix = new THREE.Matrix4()
  }

  if (boxSize === undefined) {
    let geom = bufferGeometry
    geom.computeBoundingBox()
    let bbox = geom.boundingBox

    let bbox_size_x = bbox.max.x - bbox.min.x
    let bbox_size_z = bbox.max.z - bbox.min.z
    let bbox_size_y = bbox.max.y - bbox.min.y

    boxSize = Math.max(bbox_size_x, bbox_size_y, bbox_size_z)
  }

  let uvBbox = new THREE.Box3(
    new THREE.Vector3(-boxSize / 2, -boxSize / 2, -boxSize / 2),
    new THREE.Vector3(boxSize / 2, boxSize / 2, boxSize / 2)
  )

  _applyBoxUV(bufferGeometry, transformMatrix, uvBbox, boxSize)
}

function onMouseDown(event) {
  pointer.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1
  pointer.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
  rayCaster.setFromCamera(pointer, camera)

  // See if the ray from the camera into the world hits our mesh
  var intersects = rayCaster.intersectObject(vulcanoMesh, false)

  // Toggle rotation bool for meshes that we clicked
  if (intersects.length > 0) {
    clickedFaces.push(intersects[0].face)

    // Comptute gradient descent when vulcano is ready
    if (isVulcanoFinished) {
      // Neighbor
      var intersection = intersects[0]
      var faceIndex = intersection.faceIndex
      indexAttribute = vulcanoGeometry.getIndex()
      indices = indexAttribute.array
      var vertIds = indices.slice(faceIndex * 3, faceIndex * 3 + 3)

      getGradientDescent(vertIds)
      drawLavaFlow(lavaFlowPath)
    }

    // rayCastHelper.position.set( 0, 0, 0 )
    // rayCastHelper.lookAt( intersects[ 0 ].face.normal )
    // rayCastHelper.position.copy( intersects[ 0 ].point )
  }

  if (hitTestSource != null) {
    isPlaced = true
  }
}

function onMouseMove(event) {
  if (controller.userData.isSelecting === true) {
    pointer.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1
    pointer.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
    cursor.set(pointer.x, pointer.y, 0)
  }
}

function onTouchMove(event) {
  if (controller.userData.isSelecting === true) {
    pointer.x = (event.touches[0].pageX / renderer.domElement.clientWidth) * 2 - 1
    pointer.y = -(event.touches[0].pageY / renderer.domElement.clientHeight) * 2 + 1
    cursor.set(pointer.x, pointer.y, 0)
  }
}

function applyVulcanoChanges() {
  // let vulcanoBase = Math.max(0, 1-uv.distanceTo(new THREE.Vector2(0.5, 0.5)) * 4.4)
  // let vulcanoCrater = Math.max(0, 1-uv.distanceTo(new THREE.Vector2(0.5, 0.5)) * 3.7 + -vulcanoCraterSize)

  // Apply Z noise
  for (let k = 0; k < vulcanoGeometry.attributes.position.count; k++) {
    let uv = new THREE.Vector2(
      vulcanoGeometry.attributes.uv.getX(k),
      vulcanoGeometry.attributes.uv.getY(k)
    )
    let position = new THREE.Vector3(
      vulcanoGeometry.attributes.position.getX(k),
      vulcanoGeometry.attributes.position.getY(k),
      vulcanoGeometry.attributes.position.getZ(k)
    )

    let vulcanoBase = 0
    let vulcanoCrater = 0
    for (let j = 0; j < uvCenters.length; j++) {
      vulcanoBase += Math.max(0, 1 - uv.distanceTo(uvCenters[j]) * 4.4)
      vulcanoCrater += Math.max(
        0,
        1 - uv.distanceTo(uvCenters[j]) * 3.7 + -vulcanoCraterSize
      )
    }
    let vulcanoFinal = MathUtils.lerp(
      vulcanoBase,
      -vulcanoCrater * vulcanoCraterDepth,
      0.5
    )
    let elevationZ = getElevation(position, 3)
    let z = vulcanoFinal * vulcanoHeight + elevationZ * vulcanoDetails
    vulcanoGeometry.attributes.position.setZ(k, z)
    // vulcanoGeometry.attributes.position.setZ(k, vulcanoGeometry.attributes.position.getZ(k) + z)
  }

  // vulcanoMesh.rotation.x = -Math.PI / 4
  if (isVulcanoFinished === false) {
    controls.enabled = true
    
    camera.position.y = -1
    // Turn off painted lines
    for (var i = 0; i < vulcanoHeightContours.length; i++) {
      vulcanoHeightContours[i].mesh.visible = false
    }
    painter.mesh.visible = false
  }
  isVulcanoFinished = true
  vulcanoGeometry.computeBoundingBox()
  vulcanoGeometry.computeBoundingSphere()
  vulcanoGeometry.attributes.uv.needsUpdate = true
  vulcanoGeometry.attributes.position.needsUpdate = true
}

function getElevation(_position, _frequency) {
  var elevation = 0.0
  for (var i = 1.0; i < _frequency; i++) {
    var frequency = i
    elevation +=
      noise.perlin2(_position.x * frequency * 20.0, _position.y * frequency * 20) / 85.0
  }
  return elevation
}

function getGradientDescent(_estimate) {
  var oldEstimate = Object.assign({}, _estimate)
  var faceIndex = 0
  var vertIds = oldEstimate
  var newEstimateCentroidPos = new THREE.Vector3()

  // Old estimated face positions
  var oldEstimatePositionA = new THREE.Vector3(
    vulcanoGeometry.attributes.position.getX(oldEstimate[0]),
    vulcanoGeometry.attributes.position.getY(oldEstimate[0]),
    vulcanoGeometry.attributes.position.getZ(oldEstimate[0])
  )
  var oldEstimatePositionB = new THREE.Vector3(
    vulcanoGeometry.attributes.position.getX(oldEstimate[1]),
    vulcanoGeometry.attributes.position.getY(oldEstimate[1]),
    vulcanoGeometry.attributes.position.getZ(oldEstimate[1])
  )
  var oldEstimatePositionC = new THREE.Vector3(
    vulcanoGeometry.attributes.position.getX(oldEstimate[2]),
    vulcanoGeometry.attributes.position.getY(oldEstimate[2]),
    vulcanoGeometry.attributes.position.getZ(oldEstimate[2])
  )
  // console.log("Old estimate positions:", oldEstimatePositionA, oldEstimatePositionB, oldEstimatePositionC, oldEstimate);
  // Old estimated face centroid position
  var oldEstimateCentroidPosition = computeFaceCentroidPosition(
    oldEstimatePositionA,
    oldEstimatePositionB,
    oldEstimatePositionC
  )

  // Finding neighbors around old estimate face
  var neighbors = []
  for (let i = 0; i < indices.length; i += 3) {
    for (let j = 0; j < 3; ++j) {
      var p0Ndx = indices[i + j]
      var p1Ndx = indices[i + ((j + 1) % 3)]
      if (
        (p0Ndx === vertIds[0] && p1Ndx === vertIds[1]) ||
        (p0Ndx === vertIds[1] && p1Ndx === vertIds[0]) ||
        (p0Ndx === vertIds[1] && p1Ndx === vertIds[2]) ||
        (p0Ndx === vertIds[2] && p1Ndx === vertIds[1]) ||
        (p0Ndx === vertIds[2] && p1Ndx === vertIds[0]) ||
        (p0Ndx === vertIds[0] && p1Ndx === vertIds[2])
      ) {
        neighbors.push(...indices.slice(i, i + 3))
        break
      }
    }
  }
  // Remove current vertIds from neighbor
  for (let i = 0; i < neighbors.length; i += 3) {
    if (
      vertIds[0] == neighbors[i] &&
      vertIds[1] == neighbors[i + 1] &&
      vertIds[2] == neighbors[i + 2]
    ) {
      neighbors.splice(i, 3)
    }
  }

  // Calculate gradient for every neighbor faces and update face index
  for (var i = 0; i < neighbors.length; i += 3) {
    var positionA = new THREE.Vector3(
      vulcanoGeometry.attributes.position.getX(neighbors[i + 0]),
      vulcanoGeometry.attributes.position.getY(neighbors[i + 0]),
      vulcanoGeometry.attributes.position.getZ(neighbors[i + 0])
    )
    var positionB = new THREE.Vector3(
      vulcanoGeometry.attributes.position.getX(neighbors[i + 1]),
      vulcanoGeometry.attributes.position.getY(neighbors[i + 1]),
      vulcanoGeometry.attributes.position.getZ(neighbors[i + 1])
    )
    var positionC = new THREE.Vector3(
      vulcanoGeometry.attributes.position.getX(neighbors[i + 2]),
      vulcanoGeometry.attributes.position.getY(neighbors[i + 2]),
      vulcanoGeometry.attributes.position.getZ(neighbors[i + 2])
    )
    var centroidPosition = computeFaceCentroidPosition(positionA, positionB, positionC)

    // Debug neighbors
    // console.log(
    //   "New neighbors found nearby estimate: ",
    //   centroidPosition,
    //   "Old estimate: ",
    //   oldEstimateCentroidPosition
    // )
    // var geometry = new THREE.SphereGeometry(0.015, 8, 8)
    // var material = new THREE.MeshBasicMaterial({
    //   color: "red",
    //   side: THREE.DoubleSide,
    // })
    // var sphere = new THREE.Mesh(geometry, material)
    // sphere.position.set(
    //   centroidPosition.x,
    //   centroidPosition.y,
    //   centroidPosition.z
    // )
    // vulcanoMesh.add(sphere)

    if (centroidPosition.z < oldEstimateCentroidPosition.z) {
      // Found lower valued centroid position in neighbors
      faceIndex = i
      newEstimateCentroidPos = centroidPosition
    }
  }

  // Define new estimate position
  if (newEstimateCentroidPos.z < oldEstimateCentroidPosition.z) {
    _estimate = neighbors.slice(faceIndex, faceIndex + 3)

    // Debug new estimate
    // var estimatePositionA = new THREE.Vector3(
    //   vulcanoGeometry.attributes.position.getX(_estimate[0]),
    //   vulcanoGeometry.attributes.position.getY(_estimate[0]),
    //   vulcanoGeometry.attributes.position.getZ(_estimate[0])
    // )
    // var estimatePositionB = new THREE.Vector3(
    //   vulcanoGeometry.attributes.position.getX(_estimate[0 + 1]),
    //   vulcanoGeometry.attributes.position.getY(_estimate[0 + 1]),
    //   vulcanoGeometry.attributes.position.getZ(_estimate[0 + 1])
    // )
    // var estimatePositionC = new THREE.Vector3(
    //   vulcanoGeometry.attributes.position.getX(_estimate[0 + 2]),
    //   vulcanoGeometry.attributes.position.getY(_estimate[0 + 2]),
    //   vulcanoGeometry.attributes.position.getZ(_estimate[0 + 2])
    // )
    // var estimateCentroidPosition = computeFaceCentroidPosition(
    //   estimatePositionA,
    //   estimatePositionB,
    //   estimatePositionC
    // )
    // Debug estimated centroid position
    // console.log(
    //   "New estimate centroid position: ",
    //   estimateCentroidPosition,
    //   _estimate
    // )
    // var material = new THREE.MeshBasicMaterial({
    //   color: "green",
    //   side: THREE.DoubleSide,
    // })
    // var sphere = new THREE.Mesh(geometry, material)
    // sphere.position.set(
    //   estimateCentroidPosition.x,
    //   estimateCentroidPosition.y,
    //   estimateCentroidPosition.z
    // )
    // vulcanoMesh.add(sphere)

    // setTimeout(function() {
    getGradientDescent(_estimate)
    // }, Math.abs(1) * 10)
  }

  lavaFlowPath.push(oldEstimateCentroidPosition)
}

function computeFaceCentroidPosition(facePosA, facePosB, facePosC) {
  var centroidPosition = new THREE.Vector3()
  centroidPosition.x = (facePosA.x + facePosB.x + facePosC.x) / 3
  centroidPosition.y = (facePosA.y + facePosB.y + facePosC.y) / 3
  centroidPosition.z = (facePosA.z + facePosB.z + facePosC.z) / 3
  return centroidPosition
}

function drawLavaFlow(path) {
  let lavaFlowPainter = new TubePainter()
  lavaFlowPainter.setSize(1)
  lavaFlowPainter.mesh.material = icosahedronMaterial
  vulcanoMesh.add(lavaFlowPainter.mesh)
  lavaFlowPainter.moveTo(path[0])

  for (var i = 1; i < path.length; i++) {
    lavaFlowPainter.lineTo(path[i])
  }
  lavaFlowPainter.update()
  // Clear lava flow path
  lavaFlowPath = []
}

function getCenterPoint(mesh) {
  var geometry = mesh.geometry
  var center = new THREE.Vector3()
  geometry.boundingBox.getCenter(center)
  mesh.localToWorld(center)

  return center
}
