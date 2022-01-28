const AIRCRAFT_ROUTE = "/aircraft";
// const RECEIVER_ROUTE = "/receiver";
// const HISTORY_ROUTE = "/history";



AFRAME.registerSystem('dump1090-poll-client', {
    schema: {
        interval: { default: 2 }, aircraftScale: { default: 10 },
        sceneScale: { default: 1 / 100 }
    },

    init: function () {
        let scene = this.el;  // In a system el is a reference to the scene
        let _poller = null;
        let sceneScale = this.data.sceneScale;  // Scaling down all positions and 3D object sizes

        // Register event listeners
        ['gps-entity-place-added', 'gps-entity-place-update-positon'].forEach(evt => {
            window.addEventListener(evt, (ev) => {
                this._applyDistanceScalingLst(ev.detail.component);
            })
        });

        // scene.addEventListener('loaded', this.play)
        this._populateSky();
    },

    update: function () {
        this.sceneScale = this.data.sceneScale;

        if (this._poller) {
            clearInterval(this._poller)
        }

        this._poller = setInterval(() => fetch(AIRCRAFT_ROUTE)
            .then((res) => res.json())
            .then(aircraft => this._updateAircraftEntities(aircraft)),
            this.data.interval * 1000);
    },

    play: function () {
        this._populateSky();

        this._poller = setInterval(() => fetch(AIRCRAFT_ROUTE)
            .then((res) => res.json())
            .then(aircraft => this._updateAircraftEntities(aircraft)),
            this.data.interval * 1000);
    },

    pause: function () {
        if (this._poller) clearInterval(this._poller);
    },

    _populateSky: function () {
        // Promise of initial fetch of aircraft.json from flightfeeder and creation of all aircraft models
        fetch(AIRCRAFT_ROUTE)
            .then((res) => res.json())
            .then(aircraftJson => this._createAircraftEntities(aircraftJson));
    },

    _createAircraftEntities: function (aircraftJson) {
        // Create a-frame entities from aircraft.json file contents
        aircraftJson.forEach((json) => {
            const ac = this._parseAircraftJson(json)
            if (ac.positionKnown) {
                this.el.appendChild(this._createAircraftEntity(ac));
                // Event 'gps-entity-place-added' is dispatched by the init() of gps-projected-entity-place
            }
        })
    },

    _updateAircraftEntities: function (aircraftJson) {
        // Update positions of aircraft present in the scene or create new aircraft from aircraft.json contents.
        // This is the update equivalent of _createAircraftEntities()
        aircraftJson.forEach((json) => {
            const ac = this._parseAircraftJson(json)

            var flightEl = this.el.querySelector(`#${ac.id}`);

            // Update only if position is known
            if (ac.positionKnown && flightEl) {
                flightEl.setAttribute('flight-path', { newGpsPosition: `${ac.lat} ${ac.lon} ${ac.altitudeM}` });
                flightEl.setAttribute('material', { color: altitudeLines(ac.altitudeFt) });
                flightEl.setAttribute('label', { callsign: ac.callsign, altitude: ac.altitudeM, distance: flightEl.getAttribute('distance') })
            } else if (ac.positionKnown) {
                this.el.appendChild(this._createAircraftEntity(ac))
            }
        })
    },

    _createAircraftEntity: function (ac) {
        let aircraftEl = document.createElement('a-entity');

        aircraftEl.setAttribute('geometry', { primitive: 'aircraft', model: 'arrow' });
        aircraftEl.setAttribute('id', ac.id);
        aircraftEl.setAttribute('flight-path', { newGpsPosition: `${ac.lat} ${ac.lon} ${ac.atitudeM}` });
        aircraftEl.setAttribute('fixed-wing', { onGround: ac.onGround });
        aircraftEl.setAttribute('material', { color: ColorByAlt.unknown })
        aircraftEl.setAttribute('info-label', { callsign: ac.callsign, altitude: ac.altitudeM, distance: null })

        return aircraftEl
    },

    _parseAircraftJson: function (json) {
        // Parse one entry of aircraft.json file to an aircraft object.

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
    },

    _applyDistanceScalingLst: function (el) {
        // Listener to scale down the x,y,z coordinates of entity 'el'
        const pos = el.getAttribute('position');
        const distance = el.getAttribute('distance');

        el.object3D.position.set(pos.x * this.sceneScale, pos.y * this.sceneScale, pos.z * this.sceneScale);

        const variableObjectScale = this.distanceDependentLinScale(distance) * this.data.aircraftScale * this.sceneScale;
        el.object3D.scale.set(variableObjectScale, variableObjectScale, variableObjectScale)
    },

    distanceDependentLinScale: function (dst) {
        // Return scale factor dependent on distance dst (usually from camera).
        // Increase scale as a linear function from value MIN_SCALE at MIN_SCALE_RANGE upto MAX_SCALE at MAX_SCALE_RANGE.
        // Keep scale constant equal MIN_SCALE for dst<MIN_SCALE_RANGE.

        const MIN_SCALE = 1;
        const MAX_SCALE = 30;

        const MIN_SCALE_RANGE = 10000;  // m
        const MAX_SCALE_RANGE = 300000;  // m

        if (dst < MIN_SCALE_RANGE) {
            return MIN_SCALE;
        } else {
            const a = (MAX_SCALE - MIN_SCALE) / (MAX_SCALE_RANGE - MIN_SCALE_RANGE);
            return a * (dst - MIN_SCALE_RANGE) + MIN_SCALE;
        }
    }
});