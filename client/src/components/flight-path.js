import { ColorByAlt, altitudeLines } from '../libs/flightaware/styles'


/** Flight path history component
 *
 * based on the original gps-entity-place, modified by Xenotech81 17/02/22
 *
 * Spherical Mercator units are close to, but not exactly, metres, and are
 * heavily distorted near the poles. Nonetheless they are a good approximation
 * for many areas of the world and appear not to cause unacceptable distortions
 * when used as the units for AR apps.
 * 
 * todo: 
 * - update worldPositions if camera position changes
 */
AFRAME.registerComponent('flight-path', {

    schema: {
        aircraft: { type: 'selector' },
        // Provide coordinates as string array with space separated values: 'lat lon alt lat lon alt ...' 
        initialFlightPath: {
            default: '',
            parse: function (arr) {
                const tupleElements = 3;
                const intArray = arr.split(' ').map(i => Number(i));
                if (intArray.length % tupleElements !== 0) { return [] }  // must be multiple of 3
                arrayOfTuples = [];
                for (let i = 0; i < intArray.length / tupleElements; i++)
                    arrayOfTuples.push(new THREE.Vector3().fromArray(intArray, i *
                        tupleElements));
                return arrayOfTuples;
            },
            stringify: function (value) {
                return value.join(' ');
            }
        }
    },

    init: function () {
        console.log("Initializing flight path for: %s", this.data.aircraft.id)
        this.gpsPositions = this.data.initialFlightPath; // Coordinates along flight path as vec3 of lat, lon, altitude[m ASL], ordered oldest to newest
        this.worldPositions = []; // Same as gpsPositions, but in world coordinates (attention: Will need update on gps-camera-update-position)
        this.colors = [];

        // Reference to world-scale system to apply scaling of position coordinates later
        this.worldScale = document.querySelector('a-scene').systems['world-scale'];
        // Grab camera from gps-projected-entity-place of aircraft, as it will be always initialized
        this._cameraGps = this.data.aircraft.components['my-gps-projected-entity-place']._cameraGps;

        // Register listeners
        this.data.aircraft.addEventListener('new-gps-position', this.update.bind(this));
    },

    update: function () {
        const aircraft = this.data.aircraft.components.aircraft;

        const newGpsPosition = {
            x: aircraft.latitude,
            y: aircraft.longitude,
            z: aircraft.getAltitude(),
        }

        // On initialization, my-gps-projected-entity-place pushes lat/lon=(0,0) and altitude=Nan -> Do not save this
        if (newGpsPosition && newGpsPosition.x != null && newGpsPosition.y != null && !isNaN(newGpsPosition.z)) {
            const lat = newGpsPosition.x;
            const lon = newGpsPosition.y;
            const alt = newGpsPosition.z;  // m

            let gpsVec = new THREE.Vector3(lat, lon, alt);
            this.gpsPositions.push(gpsVec);

            var worldPosition = this._gps2world(gpsVec)

            if (this.worldScale) {
                worldPosition = this.worldScale.scalePosition(worldPosition);
            }

            this.worldPositions.push(worldPosition)

            // Colors
            // https://github.com/mrdoob/three.js/blob/master/examples/webgl_lines_colors.html
            const color = new THREE.Color();
            const [h, s, l] = aircraft.getAltitudeColor();
            color.setHSL(h / 360, s / 100, l / 100);
            this.colors.push(color.r, color.g, color.b);

            if (this.worldPositions.length <= 1) {
                return
            }
            else {
                // https://threejs.org/docs/index.html?q=CatmullRomCurve3#api/en/extras/curves/CatmullRomCurve3
                // Note: CatmullRomCurve creates interpolated points, such that the number of points does not
                // match number of colors any more! Coulors would need to be interpolated too...
                //
                // const spline = new THREE.CatmullRomCurve3(this.worldPositions);
                // const points = spline.getPoints(this.worldPositions.length * 5);
                const points = this.worldPositions;
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
                const material = new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: true });
                this.el.setObject3D('mesh', new THREE.Line(geometry, material));
            }
        }
    },

    remove: function () {
        this.data.aircraft.removeEventListener('new-gps-position', this.update.bind(this));
        console.log("Flight-path for %s removed", this.data.aircraft.id)
    },

    /**
    * Transform feet into meter; pay attention to 'ground' altitude
    */
    f2m(ft) {
        return ft === "ground" ? 0 : ft * 0.3048;
    },

    _setCurveColor(altitudeFt) {
        // drawCurve.setAttribute('material', { color: altitudeLines(altitudeFt) });

        // For color gradients see: https://stackoverflow.com/questions/26790345/vertex-colors-in-three-line
        this.drawCurve.components.material.material.color = new THREE.Color(altitudeLines(altitudeFt));
    },

    /** Transform from GPS to world coordinates by calling the GpsCamera latLonToWorld() method.
     * Attention: The resulting world coordinates are NOT scaled down yet! Use world-scale system for this.
    */
    _gps2world: function (gpsVec) {
        const alt = gpsVec.z;
        const [x, z] = this._cameraGps.latLonToWorld(gpsVec.x, gpsVec.y);
        return new THREE.Vector3(x, alt, z);
    },

    _reprojectWorldPath: function () {
        this.worldPositions = this.gpsPositions.map(gpsVec => _gps2world(gpsVec));
    },

    _newestGpsPathPosition: function () {
        return { lat: this.gpsPositions[this.gpsPositions.length - 1].x, lon: this.gpsPositions[this.gpsPositions.length - 1].y, alt: this.gpsPositions[this.gpsPositions.length - 1].z }
    },

    _newestWorldPathPosition: function () {
        return { x: this.worldPositions[this.worldPositions.length - 1].x, y: this.worldPositions[this.worldPositions.length - 1].y, z: this.worldPositions[this.worldPositions.length - 1].z }
    }
});

/**
 * <a-flight-path>
 */
AFRAME.registerPrimitive('a-flight-path', {
    defaultComponents: {
        'flight-path': {},
        mappings: {
            'aircraftref': 'flight-path.aircraft',
        }
    }
});