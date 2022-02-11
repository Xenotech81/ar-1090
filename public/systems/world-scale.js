/**
 * world-scale component
 * 
 * Allows to scale down (or up) the world distances/coordinates. Required for GPS based coordinates 
 * which can reach hundred thousands of meters.
 */
AFRAME.registerSystem('world-scale', {

    schema: {
        distanceScale:
            { type: 'number', default: 1 },
        objectScale: { default: 1 },
        enlargeFarObjects: { default: false }
    },

    init: function () {
        this.distanceScale = this.data.distanceScale;
        this.objectScale = this.data.objectScale;

        window.addEventListener('gps-entity-place-added', ev =>
            this.applyDistanceScaling(ev.detail.component));

        window.addEventListener('gps-entity-place-update-position', ev =>
            this.applyDistanceScaling(ev.detail.component));
    },

    update: function () {
        this.distanceScale = this.data.distanceScale;
        this.objectScale = this.data.objectScale;
    },

    remove: function () {
        window.removeEventListener(this.applyDistanceScaling);
    },

    applyDistanceScaling: function (el) {
        // Listener to scale down the x,y,z coordinates of entity 'el'
        const pos = el.getAttribute('position');
        const distance = el.getAttribute('distance');

        el.object3D.position.set(pos.x * this.data.distanceScale, pos.y * this.data.distanceScale, pos.z * this.data.distanceScale);

        if (this.data.enlargeFarObjects && distance) {
            const scale = this._distanceDependentLinScale(distance) * this.data.objectScale * this.data.distanceScale;
            el.object3D.scale.set(scale, scale, scale);
        } else {
            el.object3D.scale.set(this.data.objectScale, this.data.objectScale, this.data.objectScale);
        }
    },

    _distanceDependentLinScale: function (dst) {
        // Return scale factor dependent on distance dst from camera to make objects visible also at large distances.
        // Increase scale as a linear function from value MIN_SCALE at MIN_SCALE_RANGE upto MAX_SCALE at MAX_SCALE_RANGE.
        // Keep scale constant equal MIN_SCALE for dst<MIN_SCALE_RANGE.

        const MIN_SCALE = 1;
        const MAX_SCALE = 50;

        const MIN_SCALE_RANGE = 5000;  // m
        const MAX_SCALE_RANGE = 300000;  // m

        if (dst < MIN_SCALE_RANGE) {
            return MIN_SCALE;
        } else {
            const a = (MAX_SCALE - MIN_SCALE) / (MAX_SCALE_RANGE - MIN_SCALE_RANGE);
            return a * (dst - MIN_SCALE_RANGE) + MIN_SCALE;
        }
    }
});