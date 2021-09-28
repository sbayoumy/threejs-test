import './style.css'
import * as THREE from 'three'
import { TubePainter } from 'three/examples/jsm/misc/TubePainter.js'
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import * as Stats from 'stats.js'
import * as dat from 'dat.gui'
import { Color, Matrix4 } from 'three'

// Canvas
let canvas = document.querySelector('canvas.webgl')

// Debug
let gui = new dat.GUI()
let stats = new Stats()
stats.showPanel(0)
document.body.appendChild(stats.dom)

// Scene
let scene = new THREE.Scene()

// Geometries
const torusGeometry = new THREE.TorusGeometry( .03, .01, 16, 100 )
const reticleGeometry = new THREE.RingGeometry( 0.01, 0.015, 32).rotateX(-Math.PI/2)

// Materials
const torusMaterial = new THREE.MeshBasicMaterial()
torusMaterial.color = new THREE.Color(0xffff00)
const reticleMaterial = new THREE.MeshBasicMaterial()

// Meshes
const torus = new THREE.Mesh(torusGeometry,torusMaterial)
torus.position.z = -0.25

const reticle = new THREE.Mesh(reticleGeometry,reticleMaterial)
// reticle.position.z = -0.5
// reticle.position.y = -0.2
reticle.matrixAutoUpdate = false
reticle.visible = false

scene.add(torus)
scene.add(reticle)

// Lights
const directionalLight = new THREE.DirectionalLight(0xffffff, 2)
directionalLight.position.x = 4
directionalLight.position.z = 2
directionalLight.lookAt(torus)
scene.add(directionalLight)


// Cursor
const cursor = new THREE.Vector3()

// XR
let controller
let localReferenceSpace
let viewerReferenceSpace
let session

// Hit test source
let hitTestSource
let hitTestSourceRequested = false

// Painter
let painter
painter = new TubePainter()
painter.setSize(0.74)
painter.mesh.material.side = THREE.DoubleSide
scene.add(painter.mesh)

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
loader.load('Horse.glb', (gltf) => {
    // coffeemat.glb was produced from the source scene using gltfpack:
    // gltfpack -i coffeemat/scene.gltf -o coffeemat.glb -cc -tc
    // The resulting model uses EXT_meshopt_compression (for geometry) and KHR_texture_basisu (for texture compression using ETC1S/BasisLZ)

    gltf.scene.scale.multiplyScalar(1 / 1200)
    gltf.scene.rotateY(-Math.PI/3)
    gltf.scene.position.z = -0.25;
    gltf.scene.position.y = -0.2;
    // scene.add(gltf.scene)
})

// AR Session
document.body.appendChild(ARButton.createButton(renderer, {
    requiredFeatures: ["hit-test"]
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

const handleController = (controller) =>{
    const userData = controller.userData

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
    torus.rotation.y = .5 * elapsedTime

    // Update Controls
    // controls.update()
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
                    const m4 = new Matrix4().fromArray(pose)
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