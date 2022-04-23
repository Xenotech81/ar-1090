import { ColorByAlt, SpecialSquawks } from '../libs/flightaware/styles';


var extendDeep = AFRAME.utils.extendDeep;

// The mesh mixin provides common material properties for creating mesh-based primitives.
// This makes the material component a default component and maps all the base material properties.
var meshMixin = AFRAME.primitives.getMeshMixin();

// Constants overwrite
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
 * Example use from HTML:
 * <a-aircraft id='id_123' lat=46.104 lon=-1.533 altitude=1000 onground=false material='color: red'>
 * 
 * Note: When used with flight-pool system, flight-pool updates the component by calling its updateData() method
 * with json data delivered by dump1090-client, and NOT by updating it through the schema.
 */
AFRAME.registerComponent('aircraft', {
    // dependencies: ['my-gps-projected-entity-place', 'flight-path'],

    schema: {
        // Will be used as unique id of this entity
        id: {
            default: ''
        },
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
        this.STALE_TIMEOUT = 15;  // sec
        this.DEAD_TIMEOUT = 58;  // sec
        this.dead_since = 0;  // Age of last dead state declaration

        // Unique id of this aircraft entity
        this.id = this.data.id;

        // Info about the plane
        // this.icao = icao;
        this.icao = null;
        // this.icaorange = findICAORange(icao);
        this.flight = null;
        this.squawk = null;
        this.selected = false;
        this.category = null;

        // Basic location information
        this.altitude = null;  // ft
        this.alt_baro = null;  // ft
        this.alt_geom = null;  // ft

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
        this.last_message_timestamp = null;
        this.last_position_timestamp = null;

        // When was this last updated (seconds before last update)
        this.seen = null;
        this.seen_pos = null;

        // Display info
        this.visible = true;  // TODO: This status does not belong in this component; it must be managed globally
        this.filter = {};  // TODO: This object does not belong in this component; it must be managed globally

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

    remove: function () {
        this.el.removeAttribute('my-gps-projected-entity-place')
        this.el.removeAttribute('flight-path')
        console.log("REMOVED")
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
        this.last_message_timestamp = receiver_timestamp;

        this.seen = data.seen;
        this.seen_pos = data.seen_pos;

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
            this.last_position_timestamp = receiver_timestamp - data.seen_pos;

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

        // todo: Switch between onground and airborne states instead
        if (this.altitude === "ground") { this.el.addState('onground') }

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

        if (this.position) {
            this.el.setAttribute('my-gps-projected-entity-place', `latitude: ${this.position[1]}; longitude: ${this.position[0]}; altitude: ${this.f2m(this.altitude)}`);
        }

        if (!this.el.is('dead')) {
            this.el.dispatchEvent(new CustomEvent('data-updated'));
        }

        this.updateMaterial();
        this.updateState();

        // if (this.position) {
        //     this.el.setAttribute('flight-path', {
        //         newGpsPosition: `${this.position[1]} ${this.position[0]} ${this.f2m(this.altitude)}`
        //     });
        // }
    },

    /**
     * updateState
     * 
     * Add stale and dead state to this Aircraft element depending on the values of
     * seen and seen_pos attributes.
     * 
     */
    updateState() {

        if (this.seen >= this.STALE_TIMEOUT && !this.el.is('stale')) {
            // console.log("Adding stale state to " + this.flight + " seen: " + this.seen)
            this.el.addState('stale');
        } else if (this.seen < this.STALE_TIMEOUT && this.el.is('stale')) {
            // console.log("Removing stale state from " + this.flight + " seen: " + this.seen)
            this.el.removeState('stale');
        }

        // If no packet in over DEAD_TIMEOUT seconds, mark as dead and ready for removal.
        if (this.seen_pos >= this.DEAD_TIMEOUT && !this.el.is('dead')) {
            console.log("Adding dead state to " + this.flight + " seen_pos: " + this.seen_pos)
            this.el.addState('dead');
            this.dead_since = this.seen_pos;
        } else if (this.seen_pos < this.DEAD_TIMEOUT && this.el.is('dead')) {
            console.log("Removing dead state from " + this.flight + " seen_pos: " + this.seen_pos)
            this.el.removeState('dead');
            this.dead_since = this.seen_pos;
        }
    },

    /**
    * Transform altitude from feet to meter, or return 'ground' string.
    */
    f2m(ft) {
        return ft === "ground" ? 0 : ft * 0.3048;
    },

    /**
    * Return altitude in meter, by calling f2m().
    */
    getAltitude() {
        return this.f2m(this.altitude);
    },

    /**
    * Determine from current and previous time stamps and positions if airplance has moved.
    * 
    * todo: prev_position is not stored anywhere, use it for geometry orientation
    */
    moved: function () {
        if (!this.position)
            return false;
        if (this.prev_position && this.position[0] == this.prev_position[0] && this.position[1] == this.prev_position[1])
            return false;
        else return true
    },

    /**
    * Update material properties.
    */
    updateMaterial: function () {
        if (this.position == null || this.isFiltered()) {
            this.el.visible = false;
            return;
        } else {
            this.el.visible = true;
        }

        // this.el.setAttribute('material', { color: altitudeLines(this.altitude) });
        this.el.setAttribute('material', { color: this.getMarkerColor() });
    },

    /**
    * Return airplane color as HSL string.
    * 
    * Color criteria:
    * - Squawk code
    * - Altitude; calls getAltitudeColor()
    * - Last position update age (stale)
    * - Selection status by user
    * - Mlat position
    */
    getMarkerColor: function () {
        // Emergency squawks override everything else
        if (this.squawk in SpecialSquawks)
            return SpecialSquawks[this.squawk].markerColor;

        var h, s, l;

        var colorArr = this.getAltitudeColor();

        h = colorArr[0];
        s = colorArr[1];
        l = colorArr[2];

        // If we have not seen a recent position update, change color
        if (this.seen_pos > this.STALE_TIMEOUT) {
            h += ColorByAlt.stale.h;
            s += ColorByAlt.stale.s;
            l += ColorByAlt.stale.l;
        }

        // If this marker is selected, change color
        if (this.selected && !SelectedAllPlanes) {
            h += ColorByAlt.selected.h;
            s += ColorByAlt.selected.s;
            l += ColorByAlt.selected.l;
        }

        // If this marker is a mlat position, change color
        if (this.position_from_mlat) {
            h += ColorByAlt.mlat.h;
            s += ColorByAlt.mlat.s;
            l += ColorByAlt.mlat.l;
        }

        if (h < 0) {
            h = (h % 360) + 360;
        } else if (h >= 360) {
            h = h % 360;
        }

        if (s < 5) s = 5;
        else if (s > 95) s = 95;

        if (l < 5) l = 5;
        else if (l > 95) l = 95;

        return 'hsl(' + (h / 5).toFixed(0) * 5 + ',' + (s / 5).toFixed(0) * 5 + '%,' + (l / 5).toFixed(0) * 5 + '%)'
    },

    /**
    * Return color as array of h,s,l values as function of altitude (in feet).
    * 
    * If altitude is:
    * - null: unknown color
    * - "ground": ground color
    * - else: air color
    * 
    * Uses styles.ColorByAlt object
    */
    getAltitudeColor: function (altitude) {
        var h, s, l;

        if (typeof altitude === 'undefined') {
            altitude = this.altitude;
        }

        if (altitude === null) {
            h = ColorByAlt.unknown.h;
            s = ColorByAlt.unknown.s;
            l = ColorByAlt.unknown.l;
        } else if (altitude === "ground") {
            h = ColorByAlt.ground.h;
            s = ColorByAlt.ground.s;
            l = ColorByAlt.ground.l;
        } else {
            s = ColorByAlt.air.s;
            l = ColorByAlt.air.l;

            // find the pair of points the current altitude lies between,
            // and interpolate the hue between those points
            var hpoints = ColorByAlt.air.h;
            h = hpoints[0].val;
            for (var i = hpoints.length - 1; i >= 0; --i) {
                if (altitude > hpoints[i].alt) {
                    if (i == hpoints.length - 1) {
                        h = hpoints[i].val;
                    } else {
                        h = hpoints[i].val + (hpoints[i + 1].val - hpoints[i].val) * (altitude - hpoints[i].alt) / (hpoints[i + 1].alt - hpoints[i].alt)
                    }
                    break;
                }
            }
        }

        if (h < 0) {
            h = (h % 360) + 360;
        } else if (h >= 360) {
            h = h % 360;
        }

        if (s < 5) s = 5;
        else if (s > 95) s = 95;

        if (l < 5) l = 5;
        else if (l > 95) l = 95;

        return [h, s, l];
    },
});



/**
 * <a-aircraft>
 */
AFRAME.registerPrimitive('a-aircraft', extendDeep({}, meshMixin, {
    defaultComponents: {
        aircraft: {},
        geometry: { primitive: 'aircraft', model: 'arrow' },
        //geometry: { primitive: 'sphere', radius: 15 },
    },

    mappings: {
        'id': 'aircraft.id',
        'lat': 'aircraft.lat',
        'lon': 'aircraft.lon',
        'altitude': 'aircraft.altitude',
        'onground': 'aircraft.onground'
    }
}));