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
 * TODO: Update worldPath if camera position changes
 */
AFRAME.registerComponent('flight-path', {
    dependencies: ['my-gps-projected-entity-place'],

    schema: {
        newGpsPosition: {
            type: 'vec3',
        },  // lat lon altitude [m ASL]
        linewidth: { default: 1 },
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

    init_old: function () {
        this.gpsPath = []; // Coordinates along flight path as vec3 of lat, lon, altitude[m ASL], ordered oldest to newest
        this.worldPath = []; // Same as gpsPath, but in world coordinates (attention: Will need update on gps-camera-update-position)
        this.orientation = new THREE.Vector3(0, 0, -1);  // Normalized orientation vector of newest path segment

        // Grab camera from gps-projected-entity-place, as it will be always initialized
        this._cameraGps = this.el.components['my-gps-projected-entity-place']._cameraGps;

        this.gpsPath = this.data.initialFlightPath;

        const fligthId = this.el.getAttribute('id')
        let curve = document.createElement('a-curve');
        this.curveId = `${fligthId}_curve`;
        curve.setAttribute('id', this.curveId)
        this.el.sceneEl.appendChild(curve);

        let drawCurve = document.createElement('a-draw-curve');
        this.drawCurveId = `${fligthId}_draw-curve`;
        drawCurve.setAttribute('id', this.drawCurveId)
        drawCurve.setAttribute('curveref', `#${this.curveId}`)
        drawCurve.setAttribute('material', { shader: 'line', color: 'red' }) //ColorByAlt.unknown
        this.el.sceneEl.appendChild(drawCurve);
    },

    init: function () {
        this.gpsPath = []; // Coordinates along flight path as vec3 of lat, lon, altitude[m ASL], ordered oldest to newest
        this.worldPath = []; // Same as gpsPath, but in world coordinates (attention: Will need update on gps-camera-update-position)
        this.orientation = new THREE.Vector3(0, 0, -1);  // Normalized orientation vector of newest path segment

        // Grab camera from gps-projected-entity-place, as it will be always initialized
        this._cameraGps = this.el.components['my-gps-projected-entity-place']._cameraGps;

        this.gpsPath = this.data.initialFlightPath;

        // Create mathematical curve
        // CurveID will be referenced later by a-draw-curve
        this.curve = document.createElement('a-curve');
        const fligthId = this.el.getAttribute('id')
        this.curveId = `${fligthId}_curve`;
        this.curve.setAttribute('id', this.curveId)
        this.el.appendChild(this.curve);

        // Create the actual material curve
        this.drawCurve = document.createElement('a-draw-curve');
        this.drawCurveId = `${fligthId}_draw-curve`;
        this.drawCurve.setAttribute('curveref', `#${this.curveId}`)
        this.drawCurve.setAttribute('material', { shader: 'line', color: 'red' }) //ColorByAlt.unknown
        this.el.appendChild(this.drawCurve);
    },

    update: function (oldData) {
        // Note: update will not be called if same vector is provided twice in a row as newGpsPosition

        const newGpsPosition = this.data.newGpsPosition;

        // On initialization, my-gps-projected-entity-place pushes lat/lon=(0,0) and altitude=Nan -> Do not save this
        if (newGpsPosition && newGpsPosition.x != 0 && newGpsPosition.y != 0 && !isNaN(newGpsPosition.z)) {
            const lat = newGpsPosition.x;
            const lon = newGpsPosition.y;
            const alt = newGpsPosition.z;  // m

            let gpsVec = new THREE.Vector3(lat, lon, alt);
            this.gpsPath.push(gpsVec);
            this.worldPath.push(this._gps2world(gpsVec));

            this._addCurvePoint(lat, lon, alt);

            this._updateEntityOrientation();

            // this._setCurveColor(alt / 0.3048);
        }
        else return
    },

    /**
    * Transform feet into meter; pay attention to 'ground' altitude
    */
    f2m(ft) {
        return ft === "ground" ? 0 : ft * 0.3048;
    },

    _updateEntityOrientation: function () {
        // Derive orientation vector in world coordinates from latest lat/lon positions of gps track
        if (this.worldPath.length < 2) { return }  // min 2 positions needed

        var oldWorldPos = this.worldPath[this.worldPath.length - 2];
        var newWorldPos = this.worldPath[this.worldPath.length - 1];

        // Assume that geometry was originally pointing north: THREE.Vector3(0, 0, -1)
        this.orientation.copy(newWorldPos).sub(oldWorldPos).normalize();
        this.el.object3D.setRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), this.orientation));
    },

    _addCurvePoint(lat, lon, alt) {
        let newestCurvePoint = document.createElement('a-curve-point');

        // TODO: fix!npm 
        newestCurvePoint.setAttribute('my-gps-projected-entity-place', `latitude: ${lat}; longitude: ${lon}; altitude: ${alt}`);

        //let newestWorldPathPosition = this._newestWorldPathPosition();
        // newestCurvePoint.setAttribute('position', { x: newestWorldPathPosition.x / 100, y: newestWorldPathPosition.y / 100, z: newestWorldPathPosition.z / 100 });
        this.curve.appendChild(newestCurvePoint);
    },

    _setCurveColor(altitudeFt) {
        // drawCurve.setAttribute('material', { color: altitudeLines(altitudeFt) });

        // For color gradients see: https://stackoverflow.com/questions/26790345/vertex-colors-in-three-line
        this.drawCurve.components.material.material.color = new THREE.Color(altitudeLines(altitudeFt));
    },

    _gps2world: function (gpsVec) {
        const alt = gpsVec.z;
        const [x, z] = this._cameraGps.latLonToWorld(gpsVec.x, gpsVec.y);
        return new THREE.Vector3(x, alt, z);
    },

    _reprojectWorldPath: function () {
        this.worldPath = this.gpsPath.map(gpsVec => _gps2world(gpsVec));
    },

    _newestGpsPathPosition: function () {
        return { lat: this.gpsPath[this.gpsPath.length - 1].x, lon: this.gpsPath[this.gpsPath.length - 1].y, alt: this.gpsPath[this.gpsPath.length - 1].z }
    },

    _newestWorldPathPosition: function () {
        return { x: this.worldPath[this.worldPath.length - 1].x, y: this.worldPath[this.worldPath.length - 1].y, z: this.worldPath[this.worldPath.length - 1].z }
    }
});