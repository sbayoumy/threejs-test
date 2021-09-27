import './style.css'
import * as THREE from 'three'
import { TubePainter } from 'three/examples/jsm/misc/TubePainter.js'
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import * as Stats from 'stats.js'
import * as dat from 'dat.gui'
import { Color } from 'three'

// Canvas
let canvas = document.querySelector('canvas.webgl')

// Debug
let gui = new dat.GUI()
let stats = new Stats()
stats.showPanel(0)
document.body.appendChild(stats.dom)

// Scene
let scene = new THREE.Scene()

// Objects
const geometry = new THREE.TorusGeometry( .03, .01, 16, 100 )

// Materials
const material = new THREE.MeshBasicMaterial()
material.color = new THREE.Color(0xffff00)

// Mesh
const torus = new THREE.Mesh(geometry,material)
torus.position.z = -0.25;
scene.add(torus)

// Lights
const directionalLight = new THREE.DirectionalLight(0xffffff, 2)
directionalLight.position.x = 4
directionalLight.position.z = 2
directionalLight.lookAt(torus)
scene.add(directionalLight)


// Cursor
const cursor = new THREE.Vector3()

// XR Controller
let controller

// Painter
let painter


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

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setClearColor(new THREE.Color(0x0f5f0f))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1
renderer.outputEncoding = THREE.sRGBEncoding
renderer.xr.enabled = true

// Loader
const ktx2Loader = new KTX2Loader()
    .setTranscoderPath('basis/')
    .detectSupport(renderer)

const loader = new GLTFLoader().setPath('models/gltf/')
loader.setKTX2Loader(ktx2Loader)
loader.setMeshoptDecoder(MeshoptDecoder)
loader.load('coffeemat.glb', (gltf) => {
    // coffeemat.glb was produced from the source scene using gltfpack:
    // gltfpack -i coffeemat/scene.gltf -o coffeemat.glb -cc -tc
    // The resulting model uses EXT_meshopt_compression (for geometry) and KHR_texture_basisu (for texture compression using ETC1S/BasisLZ)

    gltf.scene.scale.multiplyScalar(1 / 1200)
    gltf.scene.position.z = -0.25;
    gltf.scene.position.y = -0.225;
    // scene.add(gltf.scene)
})

// AR Session
document.body.appendChild(ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"]
}));
renderer.xr.addEventListener('sessionstart', () => {
    renderer.setClearAlpha(0)
    console.log("start")
})
renderer.xr.addEventListener('sessionend', () => {
    renderer.setClearAlpha(1)
    console.log("end")
})

// Painter
painter = new TubePainter()
painter.setSize(0.4)
painter.mesh.material.side = THREE.DoubleSide
scene.add(painter.mesh)

// Controls
// const controls = new OrbitControls(camera, canvas)
// controls.enableDamping = true
function onSelectStart(){
    this.userData.isSelecting = true
    this.userData.skipFrames = 2
}
function onSelectEnd(){
    this.userData.isSelecting = false
}

controller = renderer.xr.getController(0)
controller.addEventListener('selectstart', onSelectStart)
controller.addEventListener('selectend', onSelectEnd)
controller.userData.skipFrames = 0
scene.add(controller)

/**
 * Animate
 */
const clock = new THREE.Clock()

// Handle controller
const handleController = (controller) =>{
    const userData = controller.userData

    cursor.set(0, 0, -0.2).applyMatrix4(controller.matrixWorld)

    if(userData.isSelecting === true){
        if(userData.skipFrames >= 0){
            userData.skipFrames --

            painter.moveTo(cursor)
        }
        else{
            painter.lineTo(cursor)
            painter.update()
        }
    }
}

// Update
const tick = () =>
{
    stats.begin()
    const elapsedTime = clock.getElapsedTime()

    // Update objects
    torus.rotation.y = .5 * elapsedTime

    // Update Controls
    // controls.update()
    handleController(controller)

    stats.end()
}

// Render loop
const loop = () =>
{
    renderer.setAnimationLoop(() => {
        tick()

        renderer.render(scene , camera)
    })
}

loop()