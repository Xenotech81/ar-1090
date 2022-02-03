var extendDeep = AFRAME.utils.extendDeep;

// The mesh mixin provides common material properties for creating mesh-based primitives.
// This makes the material component a default component and maps all the base material properties.
var meshMixin = AFRAME.primitives.getMeshMixin();

// var planeObject = require('../lib/planeObject');

// Receiver position overwrite
const SitePosition = null;


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

        // Info about the plane
        // this.icao = icao;
        this.icao = null;
        // this.icaorange = findICAORange(icao);
        this.flight = null;
        this.squawk = null;
        this.selected = false;
        this.category = null;

        // Basic location information
        this.altitude = null;
        this.alt_baro = null;
        this.alt_geom = null;

        this.speed = null;
        this.gs = null;
        this.ias = null;
        this.tas = null;

        this.track = null;
        this.track_rate = null;
        this.mag_heading = null;
        this.true_heading = null;
        this.mach = null;
        this.roll = null;
        this.nav_altitude = null;
        this.nav_heading = null;
        this.nav_modes = null;
        this.nav_qnh = null;
        this.rc = null;

        this.nac_p = null;
        this.nac_v = null;
        this.nic_baro = null;
        this.sil_type = null;
        this.sil = null;

        this.baro_rate = null;
        this.geom_rate = null;
        this.vert_rate = null;

        this.version = null;

        this.position = null; // [lon, lat]

        // Data packet numbers
        this.messages = null;
        this.rssi = null;


        // When was this last updated (receiver timestamp)
        this.last_message_time = null;
        this.last_position_time = null;

        // When was this last updated (seconds before last update)
        this.seen = null;
        this.seen_pos = null;

        // Display info
        this.visible = true;
        this.marker = null;
        this.markerStyle = null;
        this.markerIcon = null;
        this.markerStaticStyle = null;
        this.markerStaticIcon = null;
        this.markerStyleKey = null;
        this.markerSvgKey = null;
        this.filter = {};

        // start from a computed registration, let the DB override it
        // if it has something else.
        this.registration = null // registration_from_hexid(this.icao);
        this.icaotype = null;
        this.typeDescription = null;
        this.wtc = null;

        // request metadata
        // getAircraftData(this.icao).done(function (data) {
        //     if ("r" in data) {
        //         this.registration = data.r;
        //     }

        //     if ("t" in data) {
        //         this.icaotype = data.t;
        //     }

        //     if ("desc" in data) {
        //         this.typeDescription = data.desc;
        //     }

        //     if ("wtc" in data) {
        //         this.wtc = data.wtc;
        //     }

        //     if (this.selected) {
        //         refreshSelected();
        //     }
        // }.bind(this));
    },

    update: function () {
        // this.addEventListener('componentinitialized', function tryRemoveLater (evt) {

        // Let gps-projected-entity-place handle the position update; it has side effects
        this.el.setAttribute('my-gps-projected-entity-place', `latitude: ${this.data.lat}; longitude: ${this.data.lon}; altitude: ${this.data.altitude}`);
    },

    /**
    * Return true if entity is filtered out from view, eg due to altitude filter.
    * 
    * Possible criteria:
    * - min/max altitude
    * - groundVehicle
    * - MLAT source
    */
    isFiltered: function () {
        // filter out based on altitude range
        if (this.filter.minAltitude !== undefined && this.filter.maxAltitude !== undefined) {
            if (this.altitude === null || this.altitude === undefined) {
                return true;
            }
            var planeAltitude = this.altitude === "ground" ? 0 : convert_altitude(this.altitude, this.filter.altitudeUnits);
            return planeAltitude < this.filter.minAltitude || planeAltitude > this.filter.maxAltitude;
        }

        // filter out ground vehicles
        if (typeof this.filter.groundVehicles !== 'undefined' && this.filter.groundVehicles === 'filtered') {
            if (typeof this.category === 'string' && this.category.startsWith('C')) {
                return true;
            }
        }

        // filter out blocked MLAT flights
        if (typeof this.filter.blockedMLAT !== 'undefined' && this.filter.blockedMLAT === 'filtered') {
            if (typeof this.icao === 'string' && this.icao.startsWith('~')) {
                return true;
            }
        }

        return false;
    },

    /**
    * Return message data source as string.
    * 
    */
    getDataSource: function () {
        // MLAT
        if (this.position_from_mlat) {
            return 'mlat';
        }

        // Not MLAT, but position reported - ADSB or variants
        if (this.position !== null) {
            return this.addrtype;
        }

        // Otherwise Mode S
        return 'mode_s';
    },

    /**
    * Update the component state from JSON data received from dump1090 instance.
    */
    updateData: function (receiver_timestamp, data) {
        // Update all of our data
        this.messages = data.messages;
        this.rssi = data.rssi;
        this.last_message_time = receiver_timestamp - data.seen;

        // simple fields

        var fields = ["alt_baro", "alt_geom", "gs", "ias", "tas", "track",
            "track_rate", "mag_heading", "true_heading", "mach",
            "roll", "nav_heading", "nav_modes",
            "nac_p", "nac_v", "nic_baro", "sil_type", "sil",
            "nav_qnh", "baro_rate", "geom_rate", "rc",
            "squawk", "category", "version"];

        for (var i = 0; i < fields.length; ++i) {
            if (fields[i] in data) {
                this[fields[i]] = data[fields[i]];
            } else {
                this[fields[i]] = null;
            }
        }

        // fields with more complex behaviour

        if ('type' in data)
            this.addrtype = data.type;
        else
            this.addrtype = 'adsb_icao';

        // don't expire callsigns
        if ('flight' in data)
            this.flight = data.flight;

        if ('lat' in data && 'lon' in data) {
            this.position = [data.lon, data.lat];
            this.last_position_time = receiver_timestamp - data.seen_pos;

            if (SitePosition !== null) {
                this.sitedist = ol.sphere.getDistance(SitePosition, this.position);
            }

            this.position_from_mlat = false;
            if (typeof data.mlat !== "undefined") {
                for (var i = 0; i < data.mlat.length; ++i) {
                    if (data.mlat[i] === "lat" || data.mlat[i] == "lon") {
                        this.position_from_mlat = true;
                        break;
                    }
                }
            }
        }

        // Pick an altitude
        if ('alt_baro' in data) {
            this.altitude = data.alt_baro;
        } else if ('alt_geom' in data) {
            this.altitude = data.alt_geom;
        } else {
            this.altitude = null;
        }

        // Pick a selected altitude
        if ('nav_altitude_fms' in data) {
            this.nav_altitude = data.nav_altitude_fms;
        } else if ('nav_altitude_mcp' in data) {
            this.nav_altitude = data.nav_altitude_mcp;
        } else {
            this.nav_altitude = null;
        }

        // Pick vertical rate from either baro or geom rate
        // geometric rate is generally more reliable (smoothed etc)
        if ('geom_rate' in data) {
            this.vert_rate = data.geom_rate;
        } else if ('baro_rate' in data) {
            this.vert_rate = data.baro_rate;
        } else {
            this.vert_rate = null;
        }

        // Pick a speed
        if ('gs' in data) {
            this.speed = data.gs;
        } else if ('tas' in data) {
            this.speed = data.tas;
        } else if ('ias' in data) {
            this.speed = data.ias;
        } else {
            this.speed = null;
        }
    },

    /**
    * Based on age of last update, manage airplane and track visibility. 
    */
    updateTick: function (receiver_timestamp, last_timestamp) {
        // recompute seen and seen_pos
        this.seen = receiver_timestamp - this.last_message_time;
        this.seen_pos = (this.last_position_time === null ? null : receiver_timestamp - this.last_position_time);

        // If no packet in over 58 seconds, clear the plane.
        if (this.seen > 58) {
            if (this.visible) {
                //console.log("hiding " + this.icao);
                this.clearMarker();
                this.visible = false;
                if (SelectedPlane == this.icao)
                    selectPlaneByHex(null, false);
            }
        } else {
            if (this.position !== null && (this.selected || this.seen_pos < 60)) {
                this.visible = true;
                if (this.updateTrack(receiver_timestamp, last_timestamp)) {
                    this.updateLines();
                    this.updateMarker(true);
                } else {
                    this.updateMarker(false); // didn't move
                }
            } else {
                this.clearMarker();
                this.visible = false;
            }
        }
    },

    /**
    * Delete plane icon from PlaneIconFeatures pool and and silent click listener.
    */
    clearMarker: function () {
        if (this.marker) {
            PlaneIconFeatures.remove(this.marker);
            PlaneIconFeatures.remove(this.markerStatic);
            /* FIXME google.maps.event.clearListeners(this.marker, 'click'); */
            this.marker = this.markerStatic = null;
        }
    },

    /**
    * Update our marker on the map.
    */
    updateMarker: function (moved) {
        if (!this.visible || this.position == null || this.isFiltered()) {
            this.clearMarker();
            return;
        }

        this.updateIcon();
        if (this.marker) {
            if (moved) {
                this.marker.setGeometry(new ol.geom.Point(ol.proj.fromLonLat(this.position)));
                this.markerStatic.setGeometry(new ol.geom.Point(ol.proj.fromLonLat(this.position)));
            }
        } else {
            this.marker = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(this.position)));
            this.marker.hex = this.icao;
            this.marker.setStyle(this.markerStyle);
            PlaneIconFeatures.push(this.marker);

            this.markerStatic = new ol.Feature(new ol.geom.Point(ol.proj.fromLonLat(this.position)));
            this.markerStatic.hex = this.icao;
            this.markerStatic.setStyle(this.markerStaticStyle);
            PlaneIconFeatures.push(this.markerStatic);
        }
    },


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