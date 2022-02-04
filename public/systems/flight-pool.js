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
    // dependencies: ['dump1090-client'], // flight-path, label, fixed-wing

    schema: {
        purgePeriod: { default: 3 }  // sec
    },

    init: function () {
        var scene = this.el;  // In a system el is a reference to the scene
        this.lastPurge = 0;

        // Register event listeners
        scene.addEventListener('dump1090-data-received', ev => this.updateAircraftElements(ev.detail))
    },

    _createAircraftElement: function (id, json) {
        const flight = json.flight ? json.flight.trim() : null;
        console.log("Creating new aircraft: %s (%s)", flight, id)

        let aircraftEl = document.createElement('a-aircraft');

        // aircraftEl.setAttribute('geometry', { primitive: 'aircraft', model: 'arrow' });
        aircraftEl.setAttribute('id', id);
        aircraftEl.setAttribute('material', { color: ColorByAlt.unknown })
        aircraftEl.setAttribute('class', 'clickable');
        aircraftEl.setAttribute('cursor-listener', {});

        aircraftEl.addEventListener('stateadded', ev => this.stateAddedListener(ev));
        aircraftEl.addEventListener('data-updated', ev => this.dataUpdatedListener(ev));

        this.el.appendChild(aircraftEl)
    },

    updateAircraftElements: function (aircraftJson) {
        // Update positions of known aircraft or create new a-aircraft entities from aircraft.json contents.
        aircraftJson.aircraft.forEach((json) => {
            // We need a valid hexid to uniquely identify the aircraft for later updates
            const id = this.idFromHex(json.hex);
            if (id === null) return

            var aircraftEl = this.el.querySelector(`#${id}`); // Check if aircraft element already exists
            if (aircraftEl) {
                aircraftEl.components.aircraft.updateData(aircraftJson.now, json);  // In this moment the aircraft state can change to 'dead' and the stateAddedListener will immediately delete it!
            } else {
                this._createAircraftElement(id, json)
            }
        })
    },

    // Create clean id string ("id_<hex>")
    idFromHex: function (hex) {
        if (hex === null) return null

        const hexCleaned = hex.startsWith("~") ? hex.substring(2) : hex
        return `id_${hexCleaned}`
    },

    stateAddedListener: function (ev) {
        if (ev.detail === 'dead') {
            const entityEl = ev.target;
            console.log("State dead was added to " + entityEl.components.aircraft.id);
            entityEl.parentNode.removeChild(entityEl);
            entityEl.destroy();
        }
    },

    dataUpdatedListener: function (ev) {
        var entityEl = ev.target;
        var aircraft = entityEl.components.aircraft;
        entityEl.setAttribute('label', { flight: aircraft.flight, altitude: aircraft.altitude })
    },

    _purgeFlightPool: function () {
        var aircraftEls = this.el.querySelectorAll('a-aircraft');

        aircraftEls.forEach((aircraft) => {
            if (aircraft.is('dead')) { (console.log(aircraft.components.aircraft)) }
        });

        console.log("Flight pool purged")
    },

    // tick: function (time, timeDelta) {
    //     if (time - this.lastPurge > this.data.purgePeriod * 1000) {
    //         this._purgeFlightPool()
    //         this.lastPurge = time;
    //     }
    // }
});