/**
 * flight-pool system
 * 
 * Manages all visible flights:
 * - Listens to latest aircraft position update events from dump1090-poll-client system
 * - Performs initial population of the sky with a-aircraft entities
 * - Periodically updates position of all active aircraft
 * - Adds new appearing aircraft to pool; deletes stale aircraft from pool
 * 
 */

import { ColorByAlt } from '../libs/flightaware/styles'


AFRAME.registerSystem('flight-pool', {
    // dependencies: ['dump1090-client'], // flight-path, label, fixed-wing

    schema: {
        purgePeriod: { default: 3 }  // sec
    },

    init: function () {
        this.scene = this.el;  // In a system el is a reference to the scene
        // Delete Aircraft element only after its dead state (seen_pos attribute) has this age
        this.DEAD_GRACE_PERIOD = 300;  // sec

        // Register event listeners
        this.scene.addEventListener('dump1090-data-received', ev => this.updateAircraftElements(ev.detail))
    },

    _createAircraftElement: function (id, json) {
        const flight = json.flight ? json.flight.trim() : null;
        console.log("Creating new aircraft: %s (%s)", flight, id)

        let aircraftEl = document.createElement('a-aircraft');

        aircraftEl.setAttribute('geometry', { primitive: 'aircraft', model: 'arrow' });
        aircraftEl.setAttribute('id', id);
        aircraftEl.setAttribute('material', { color: ColorByAlt.unknown })
        aircraftEl.setAttribute('class', 'clickable');
        aircraftEl.setAttribute('cursor-listener', {});
        // todo: Add label as component: aircraftEl.setAttribute('label', {});
        // aircraftEl.addEventListener('stateadded', ev => this.stateAddedListener(ev));
        aircraftEl.addEventListener('data-updated', ev => this.updateLabel(ev));

        this.el.appendChild(aircraftEl)
    },

    updateAircraftElements: function (aircraftJson) {

        // todo: Update ALL aircraft in the pool, even if not update came in from dump1090. Because each 
        // aircraft must keep its seen and seen_pos attributes up-to date such that its stale and dead states can change

        // Update positions of known aircraft or create new a-aircraft entities from aircraft.json
        aircraftJson.aircraft.forEach((json) => {
            // We need a valid hexid to uniquely identify the aircraft for later updates
            const id = this.idFromHex(json.hex);
            if (id === null) return

            var aircraftEl = this.el.querySelector(`#${id}`); // Check if aircraft element already exists
            if (aircraftEl) {
                aircraftEl.components.aircraft.updateData(aircraftJson.now, json);
            } else {
                this._createAircraftElement(id, json)
            }
        })

        this.purge();  // Delete dead aircraft
    },

    purge: function () {
        const aircraftEls = this.el.querySelectorAll('a-aircraft');

        aircraftEls.forEach((aircraftEl) => {
            if (aircraftEl.components.aircraft.seen_pos > this.DEAD_GRACE_PERIOD) {
                this._destroyAircraft(aircraftEl);
            }
        })
    },

    // Create clean id string ("id_<hex>")
    idFromHex: function (hex) {
        if (hex === null) return null

        const hexCleaned = hex.startsWith("~") ? hex.substring(2) : hex
        return `id_${hexCleaned}`
    },

    updateLabel: function (ev) {
        // todo: Add label as component to the aircraft element: aircraftEl.setAttribute('label', {});
        var aircraftEl = ev.target;
        var aircraft = aircraftEl.components.aircraft;
        aircraftEl.setAttribute('label', {
            flight: aircraft.flight,
            altitude: aircraft.altitude,
            distance: aircraftEl.getAttribute('distance')
        })
    },

    _destroyAircraft: function (aircraftEl) {
        this.el.removeChild(aircraftEl);  // remove from scene
        aircraftEl.destroy();
        console.log("Aircraft destroyed")
    },
});