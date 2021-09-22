import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TubePainter } from 'three/examples/jsm/misc/TubePainter.js'
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js'
import * as dat from 'dat.gui'

// Debug
let gui = new dat.GUI()

// Canvas
let canvas = document.querySelector('canvas.webgl')

// Scene
let scene = new THREE.Scene()

// Objects
const geometry = new THREE.TorusGeometry( .7, .2, 16, 100 )

// Materials
const material = new THREE.MeshBasicMaterial()
material.color = new THREE.Color(0x00ff00)

// Mesh
const torus = new THREE.Mesh(geometry,material)
torus.position.z = -2
scene.add(torus)

// Lights
const pointLight = new THREE.PointLight(0xffffff, 0.1)
pointLight.position.x = 2
pointLight.position.y = 3
pointLight.position.z = 4
scene.add(pointLight)

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
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 20)
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
renderer.xr.enabled = true

// AR Button
document.body.appendChild(ARButton.createButton(renderer));

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

const tick = () =>
{
    const elapsedTime = clock.getElapsedTime()

    // Update objects
    torus.rotation.y = .5 * elapsedTime

    // Update Orbital Controls
    // controls.update()

    // Render
    renderer.render(scene, camera)
    
    // Call tick again on the next frame
    // WebXR can only update frames within setAnimationLoop
    if(renderer.xr.isPresenting)
    {   
        // Update controller handling
        handleController(controller)

        renderer.setAnimationLoop(tick)
        console.log("xr")
    }
    else
    {
        window.requestAnimationFrame(tick)
        console.log("normal")
    }
}

tick()