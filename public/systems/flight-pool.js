/**
 * flight-pool system
 * 
 * Manages all visible flights:
 * - Retrieves the latest aircraft positions from dump1090-poll-client
 * - Performs initial population of the sky with a-aircraft entities
 * - Periodically updates position of all active aircraft
 * - Adds new appearing aircraft to pool; deletes stale aircraft from pool
 * 
 */
AFRAME.registerSystem('flight-pool', {
    dependencies: ['dump1090-client'], // flight-path, label, fixed-wing

    schema: {
    },

    init: function () {
        let scene = this.el;  // In a system el is a reference to the scene
        this._flightPool = [];

        // Register event listeners
        this.el.addEventListener('dump1090-data-received', ev => this._updateAircraftEntities(ev.detail.aircraftJson))
    },

    _createAircraftEntity: function (ac) {
        let aircraftEl = document.createElement('a-entity');

        aircraftEl.setAttribute('geometry', { primitive: 'aircraft', model: 'arrow' });
        aircraftEl.setAttribute('id', ac.id);
        aircraftEl.setAttribute('flight-path', { newGpsPosition: `${ac.lat} ${ac.lon} ${ac.atitudeM}` });
        aircraftEl.setAttribute('fixed-wing', { onGround: ac.onGround });
        aircraftEl.setAttribute('material', { color: ColorByAlt.unknown })
        aircraftEl.setAttribute('label', { callsign: ac.callsign, altitude: ac.altitudeM, distance: null })

        aircraftEl.setAttribute('class', 'clickable');
        aircraftEl.setAttribute('cursor-listener', {});

        return aircraftEl
    },

    _updateAircraftEntities: function (aircraftJson) {
        // Update positions of known aircraft or create new a-aircraft entities from aircraft.json contents.
        aircraftJson.forEach((json) => {
            const ac = this._fromJson(json)

            var flightEl = this.el.querySelector(`#${ac.id}`);

            // Update only if position is known
            // Note: Event 'gps-entity-place-added' is dispatched by the init() of gps-projected-entity-place
            if (ac.positionKnown && flightEl) {
                flightEl.setAttribute('flight-path', { newGpsPosition: `${ac.lat} ${ac.lon} ${ac.altitudeM}` });
                flightEl.setAttribute('material', { color: altitudeLines(ac.altitudeFt) });
                flightEl.setAttribute('label', { callsign: ac.callsign, altitude: ac.altitudeM, distance: flightEl.getAttribute('distance') })
            } else if (ac.positionKnown) {
                this.el.appendChild(this._createAircraftEntity(ac))
            }
        })
    },

    _fromJson: function (json) {
        // Parse one entry of aircraft.json file to a planeObject.

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
});
