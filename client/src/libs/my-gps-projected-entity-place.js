/** gps-projected-entity-place
 *
 * based on the original gps-entity-place, modified by nickw 02/04/20
 *
 * Rather than keeping track of position by calculating the distance of
 * entities or the current location to the original location, this version
 * makes use of the "Google" Spherical Mercactor projection, aka epsg:3857.
 *
 * The original location on startup (lat/lon) is projected into Spherical 
 * Mercator and stored.
 *
 * When 'entity-places' are added, their Spherical Mercator coords are 
 * calculated and converted into world coordinates, relative to the original
 * position, using the Spherical Mercator projection calculation in
 * gps-projected-camera.
 *
 * Spherical Mercator units are close to, but not exactly, metres, and are
 * heavily distorted near the poles. Nonetheless they are a good approximation
 * for many areas of the world and appear not to cause unacceptable distortions
 * when used as the units for AR apps.
 */
AFRAME.registerComponent('my-gps-projected-entity-place', {
    _cameraGps: null,
    schema: {
        // Timestamp since Linux epoch
        timestamp: { type: 'number', default: Date.now() },
        longitude: {
            type: 'number',
            default: 0,
        },
        latitude: {
            type: 'number',
            default: 0,
        },
        // Altitude in meters
        altitude: {
            type: 'number',
            default: 0,
        }
    },
    remove: function () {
        // cleaning listeners when the entity is removed from the DOM
        window.removeEventListener('gps-camera-update-position', this.updateCameraPositionListener);
        window.removeEventListener('gps-camera-origin-coord-set', this.coordSetListener);
    },
    init: function () {
        // Used now to get the GPS camera when it's been setup
        this.coordSetListener = () => {
            if (!this._cameraGps) {
                var camera = document.querySelector('[gps-projected-camera]');
                if (!camera.components['gps-projected-camera']) {
                    console.error('gps-projected-camera not initialized')
                    return;
                }
                this._cameraGps = camera.components['gps-projected-camera'];
                this._updatePosition();
            }
        };

        // update position needs to worry about distance but nothing else?
        this.updateCameraPositionListener = (ev) => {
            if (!this.data || !this._cameraGps) {
                return;
            }
            const distanceForMsg = this._updateDistance()

            this.el.dispatchEvent(new CustomEvent('gps-entity-place-update-position', { detail: { component: this.el, distance: distanceForMsg } }));

            var dstCoords = this.el.getAttribute('position');
            var actualDistance = this._cameraGps.computeDistanceMeters(dstCoords, true);

            if (actualDistance === Number.MAX_SAFE_INTEGER) {
                this.hideForMinDistance(this.el, true);
            } else {
                this.hideForMinDistance(this.el, false);
            }
        };

        // Retain as this event is fired when the GPS camera is set up
        window.addEventListener('gps-camera-origin-coord-set', this.coordSetListener);
        window.addEventListener('gps-camera-update-position', this.updateCameraPositionListener);

        this._positionXDebug = 0;

        window.dispatchEvent(new CustomEvent('gps-entity-place-added', { detail: { component: this.el } }));
    },

    update: function () {
        // Update the coordinates of this entity place. 
        this._updatePosition()
        const distanceForMsg = this._updateDistance()
        window.dispatchEvent(new CustomEvent('gps-entity-place-update-position', { detail: { component: this.el, distance: distanceForMsg } }));
    },

    /**
     * Hide entity according to minDistance property
     * @returns {void}
     */
    hideForMinDistance: function (el, hideEntity) {
        if (hideEntity) {
            el.setAttribute('visible', 'false');
        } else {
            el.setAttribute('visible', 'true');
        }
    },
    /**
     * Update place position
     * @returns {void}
     */

    // set position to world coords using the lat/lon 
    _updatePosition: function () {
        var worldPos = this._cameraGps.latLonToWorld(this.data.latitude, this.data.longitude);

        // update element's position in 3D world
        //this.el.setAttribute('position', position);
        this.el.setAttribute('position', {
            x: worldPos[0],
            y: this.data.altitude,
            z: worldPos[1]
        });
    },
    /**
     * Recompute and return distance to camera
     * @returns {number}
     */

    // Compute world distance to camera 
    _updateDistance: function () {
        var dstCoords = this.el.getAttribute('position');

        // it's actually a 'distance place', but we don't call it with last param, because we want to retrieve distance even if it's < minDistance property
        // _computeDistanceMeters is now going to use the projected
        var distanceForMsg = this._cameraGps.computeDistanceMeters(dstCoords);

        this.el.setAttribute('distance', distanceForMsg);
        this.el.setAttribute('distanceMsg', formatDistance(distanceForMsg));

        return distanceForMsg
    },
});

/**
 * Format distances string
 *
 * @param {String} distance
 */
function formatDistance(distance) {
    distance = distance.toFixed(0);

    if (distance >= 1000) {
        return (distance / 1000) + ' kilometers';
    }

    return distance + ' meters';
};
