var extendDeep = AFRAME.utils.extendDeep;

// The mesh mixin provides common material properties for creating mesh-based primitives.
// This makes the material component a default component and maps all the base material properties.
var meshMixin = AFRAME.primitives.getMeshMixin();

// var planeObject = require('../lib/planeObject');


/**
 * aircraft component
 * 
 * Defines the aircraft position in space and some metadata.
 * Reuses planeObject from https://github.com/flightaware/dump1090
 * Uses an extended version of gps-projected-entity-place
 * (https://github.com/AR-js-org/AR.js/blob/master/aframe/src/location-based/gps-projected-entity-place.js)
 * to ranslat the GPS position to three.js world position.
 * 
 * Example:
 * <a-aircraft callsign='abc123' lat=46.104 lon=-1.533 altitude=1000 onground=false material='color: red'>
 */
AFRAME.registerComponent('aircraft', {
    dependencies: ['my-gps-projected-entity-place'],

    schema: {
        // Timestamp since Linux epoch
        callsign: { default: '' },
        lon: {
            default: 0,
        },
        lat: {
            default: 0,
        },
        // Altitude in meters
        altitude: {
            default: 0,
        },
        onground: {
            default: false,
        }
    },

    init: function () {
        this.id = `id_${this.data.callsign}`;
    },

    update: function () {
        // this.addEventListener('componentinitialized', function tryRemoveLater (evt) {

        // Let gps-projected-entity-place handle the position update; it has side effects
        this.el.setAttribute('my-gps-projected-entity-place', `latitude: ${this.data.lat}; longitude: ${this.data.lon}; altitude: ${this.data.altitude}`);
    }

});



/**
 * <a-aircraft>
 */
AFRAME.registerPrimitive('a-aircraft', extendDeep({}, meshMixin, {
    defaultComponents: {
        aircraft: {},
        // geometry: { primitive: 'aircraft', model: 'arrow' },
        geometry: { primitive: 'sphere', radius: 15 },
    },

    mappings: {
        'callsign': 'aircraft.callsign',
        'lat': 'aircraft.lat',
        'lon': 'aircraft.lon',
        'altitude': 'aircraft.altitude',
        'onground': 'aircraft.onground'
    }
}));