import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js'
import * as dat from 'dat.gui'

// Debug
const gui = new dat.GUI()

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Objects
const geometry = new THREE.CylinderGeometry( 0, 0.05, 0.2, 32 ).rotateX( Math.PI / 2 );

// Materials
const material = new THREE.MeshBasicMaterial()
material.color = new THREE.Color(0xff0000)

// Lights
const pointLight = new THREE.PointLight(0xffffff, 0.1)
pointLight.position.x = 2
pointLight.position.y = 3
pointLight.position.z = 4
scene.add(pointLight)

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
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
camera.position.x = 0
camera.position.y = 0
camera.position.z = 2
scene.add(camera)

// Controls
// const controls = new OrbitControls(camera, canvas)
// controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.xr.enabled = true

// Controller
const controller = renderer.xr.getController(0)
controller.addEventListener('select', () =>
{
    const material = new THREE.MeshPhongMaterial( { color: 0xffffff * Math.random() } )
    const mesh = new THREE.Mesh( geometry, material )
    mesh.position.set( 0, 0, - 0.3 ).applyMatrix4( controller.matrixWorld )
    mesh.quaternion.setFromRotationMatrix( controller.matrixWorld )
    scene.add( mesh )
})
scene.add(controller)

// AR Button
document.body.appendChild(ARButton.createButton(renderer));


/**
 * Animate
 */
const clock = new THREE.Clock()

const tick = () =>
{

    const elapsedTime = clock.getElapsedTime()

    // Update Orbital Controls
    // controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()