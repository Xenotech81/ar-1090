import { CSS2DRenderer, CSS2DObject } from 'https://threejs.org/examples/jsm/renderers/CSS2DRenderer.js';
import { fetchTrackCoordinates } from "./client.js";

const aircraftUrl = "/aircraft"
const apiPollInterval = 2000;

const distanceScaling = 100;

const sceneProps = { objectScaling: 10 };

// Set up GUI
const gui = new dat.GUI()
const scalingFolder = gui.addFolder('Scaling')
scalingFolder.add(sceneProps, 'objectScaling', 1, 100).onChange(populateSky)

// global variables, referenced from render loop
let renderer, scene, camera;

const cameraEl = document.querySelector('a-camera');
const sceneEl = document.querySelector('a-scene');
scene = sceneEl.object3D;
camera = cameraEl.object3D;


// =================== Functions =================
function getLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition);
    } else {
        x.innerHTML = "Geolocation is not supported by this browser.";
    }
}

function showPosition(position) {
    const posDiv = document.getElementById("position");

    posDiv.innerHTML = "Latitude: " + position.coords.latitude +
        "<br>Longitude: " + position.coords.longitude;
}

function deviceOrientationHandler(orientation) {
    const orientationDiv = document.getElementById("orientation");
    orientationDiv.innerHTML = "compass: " + Math.round(360 - orientation.alpha) +
        "<br>pitch: " + Math.round(orientation.beta - 90) +
        "<br>roll: " + Math.round(orientation.gamma);
}

function populateSky() {
    // Initial fetch of aircraft.json from flightfeeder and creation of all aircraft models
    fetch(aircraftUrl)
        .then((res) => res.json())
        .then(aircraft => createAircraftEntities(aircraft));
}


function createAircraftEntity(ac) {
    let aircraftEl = document.createElement('a-box');
    aircraftEl.setAttribute('id', ac.id);
    aircraftEl.setAttribute('class', 'aircraft');
    aircraftEl.setAttribute('my-gps-projected-entity-place', `latitude: ${ac.lat}; longitude: ${ac.lon};`);
    aircraftEl.setAttribute('color', 'red');
    aircraftEl.setAttribute('position', { x: 0, y: ac.altitudeM, z: 0 });
    aircraftEl.setAttribute('scale', `${sceneProps.objectScaling} ${sceneProps.objectScaling} ${sceneProps.objectScaling}`);

    return aircraftEl
}

function createAircraftEntities(aircraft) {
    aircraft.forEach((flight) => {
        const ac = parseAircraftJson(flight)
        if (ac.positionKnown) {
            sceneEl.appendChild(createAircraftEntity(ac));
            // Event 'gps-entity-place-added' is dispatched by the init() of gps-projected-entity-place
        }
    })
};

function parseAircraftJson(json) {
    // Create clean id string
    const id_ = json.hex.startsWith("~") ? json.hex.substring(2) : json.hex
    const id = `id_${id_}`

    const hex = json.hex
    const callsign = json.flight ? json.flight.trim() : null;
    const lon = json.lon;
    const lat = json.lat;
    const altitudeFt = typeof json.alt_geom === 'number' ? json.alt_geom : json.baro
    const altitudeM = typeof altitudeFt === 'number' ? 0.3048 * altitudeFt : null;
    const onGround = altitudeM === 0 ? true : false;

    // True, if positional data is complete (for plotting)
    const positionKnown = hex && lon && lat && (typeof altitudeM === "number") ? true : false;

    return { 'id': id, 'positionKnown': positionKnown, 'hex': hex, 'callsign': callsign, 'lon': lon, 'lat': lat, 'altitudeFt': altitudeFt, 'altitudeM': altitudeM, 'onGround': onGround }
}

function updateAircraftPositions(aircraft) {
    // Update position of aircraft present in the scene or create new aircraft.
    aircraft.forEach((flight) => {
        const ac = parseAircraftJson(flight)

        var flightEl = sceneEl.querySelector(`#${ac.id}`);

        if (ac.positionKnown && flightEl) {
            flightEl.object3D.position.y = ac.altitudeM  // Assign before seeting lat/lon (as this will trigger scaling)
            flightEl.setAttribute('my-gps-projected-entity-place', `latitude: ${ac.lat}; longitude: ${ac.lon};`);
            // console.log(`${ac.callsign}: ${flightEl.getAttribute('distanceMsg')}, ${ac.lon}, ${ac.lat}`)
        } else if (ac.positionKnown) {
            sceneEl.appendChild(createAircraftEntity(ac))
        }
    })
}

// Scale down the x,y,z distances
['gps-entity-place-added', 'gps-entity-place-update-positon'].forEach(evt => {
    window.addEventListener(evt, (ev) => {
        applyDistanceScaling(ev.detail.component);
        addCSSLabel(ev.detail.component);
    })
})

function applyDistanceScaling(el) {
    const pos = el.getAttribute('position');
    const distance = el.getAttribute('distance');

    el.object3D.position.set(pos.x / distanceScaling, pos.y / distanceScaling, pos.z / distanceScaling);

    // Set scale=50 at 300km (500~sqrt(300km)) from origin, and scale=10 for <10km
    const objectScale = distance > 10000 ? 50. / 500. * Math.sqrt(distance) : 10
    el.object3D.scale.set(objectScale, objectScale, objectScale)
}


// const labelRenderer = new CSS2DRenderer();
// labelRenderer.setSize(window.innerWidth, window.innerHeight);
// labelRenderer.domElement.style.position = 'absolute';
// labelRenderer.domElement.style.top = '0px';
// document.body.appendChild(labelRenderer.domElement);

// window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    const camera = document.querySelector('[camera]');
    // camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // renderer.setSize( window.innerWidth, window.innerHeight );
    labelRenderer.setSize(window.innerWidth, window.innerHeight);

}


function addCSSLabel(el) {
    // Adds CSS2DObject label instance to element's object3d.

    const div = document.createElement('div');
    div.className = 'label';
    div.textContent = 'Moon';
    div.style.marginTop = '-1em';

    const label = new CSS2DObject(div);
    label.position.set(0, 100, 0);
    el.object3D.add(label);
}


setInterval(() => fetch(aircraftUrl)
    .then((res) => res.json())
    .then(aircraft => updateAircraftPositions(aircraft)),
    apiPollInterval);


function getDistance() {
    const distanceMsg = document.querySelector('[gps-entity-place]').getAttribute('distanceMsg');
}

var t = 0;
function render() {
    t += 0.01;
    requestAnimationFrame(render);
    // console.log(scene, camera)
    //labelRenderer.render(scene, camera);
}


// ============= Main ================
if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', deviceOrientationHandler, false);
    document.getElementById("doeSupported").innerText = "DeviceOrientationEvent Supported!";
}

getLocation();
populateSky();
fetchTrackCoordinates().then(console.log).catch(err => console.error(err));
render();


