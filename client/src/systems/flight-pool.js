/**
 * flight-pool system
 * 
 * Manages all visible flights:
 * - Listens to latest aircraft position update events from dump1090-client system
 * - Performs initial population of the sky with a-aircraft entities
 * - Updates position of all aircraft when new data comes in from dump1090-client
 * - Adds new aircraft to pool; deletes dead aircraft from pool
 * - Updates the aircraft labels
 */

import { ColorByAlt } from '../libs/flightaware/styles'


AFRAME.registerSystem('flight-pool', {
    // dependencies: ['dump1090-client'], label

    schema: {
        deadGracePeriod: { default: 90 }  // sec, 'dead' state means the aircraft's 'seen_pos' is older than deadGracePeriod.
    },

    init: function () {
        this.scene = this.el;  // In a system el is a reference to the scene
        // Delete Aircraft element only after its dead state (seen_pos attribute) has this age
        this.deadGracePeriod = this.data.deadGracePeriod;  // sec

        // Register event listeners
        this.scene.addEventListener('dump1090-data-received', ev => this.updatePoolCallback(ev.detail))
    },

    /**
     * Creat a new a-aircraft entity from dump1090 json data and attach to scene.
     */
    _createAircraftElement: function (id, json) {
        const flight = json.flight ? json.flight.trim() : null;
        console.log("Creating new aircraft: %s (%s)", flight, id)

        let aircraftEl = document.createElement('a-aircraft');

        aircraftEl.setAttribute('geometry', { primitive: 'aircraft', model: 'arrow' });
        aircraftEl.setAttribute('id', id);
        aircraftEl.setAttribute('material', { color: ColorByAlt.unknown })
        aircraftEl.setAttribute('class', 'clickable');
        aircraftEl.setAttribute('cursor-listener', {});
        aircraftEl.setAttribute('fixed-wing', {});
        aircraftEl.addEventListener('data-updated', ev => this.updateLabelCallback(ev));
        this.scene.appendChild(aircraftEl)

        // Create a-flight-path entity, its flight-path component will listen to gps-position updates of aircraft component
        let flightPathEl = document.createElement('a-flight-path');
        flightPathEl.setAttribute('flight-path', { 'aircraft': `#${id}` });
        flightPathEl.setAttribute('id', `${id}_fp`);
        this.scene.appendChild(flightPathEl)
    },

    /**
     * Update state of all a-aircraft entities in flight pool or create new entities.
     * 
     * todo: Update ALL aircraft in the pool, even if not update came in from dump1090. Because each 
     * aircraft must keep its seen and seen_pos attributes up-to date such that its stale and dead states can change
     */
    updatePoolCallback: function (aircraftJson) {

        aircraftJson.aircraft.forEach((json) => {
            // We need a valid id to uniquely identify each aircraft for later updates
            const id = this._idFromHex(json.hex);
            if (id === null) return

            var aircraftEl = this.el.querySelector(`#${id}`); // Check if aircraft element already exists
            if (aircraftEl) {
                aircraftEl.components.aircraft.updateData(aircraftJson.now, json);
            } else {
                if (json.seen_pos < this.deadGracePeriod) {  // create new aircraft only if it is not dead
                    this._createAircraftElement(id, json)
                }
            }
        })

        this._purge();  // Delete dead aircraft
    },

    /**
     * Remove all dead aircraft from the pool.
     * 
     * 'Dead' means the aircraft's 'seen_pos' is older than deadGracePeriod.
     * 
     * Problem: Some of the _createAircraftElement() calls in the forEach loop of updatePoolCallback()
     * do not finish before purge() is called, such that a deletion is attempted on entities which do not fully exist yet 
     * (they have an id, but no aircraft component is attached yet), so you get an
     * "uncaught TypeError: aircraftEl.components.aircraft is undefined". That's why 
     * check for aircraftEl.components.aircraft !== undefined
     */
    _purge: function () {
        const aircraftEls = this.el.querySelectorAll('a-aircraft');

        aircraftEls.forEach((aircraftEl) => {
            if (aircraftEl.components.aircraft !== undefined) {
                if (aircraftEl.components.aircraft.seen_pos > this.deadGracePeriod) {
                    this._destroyAircraft(aircraftEl);
                }
            }
        })
    },

    /**
     * Create clean aircraft id string from the aircraft hex number.
     * 
     * The id must start with a letter, so prepend 'id' to the numerical hex: id_<hex>.
     * The MLAT flights start with a tilde, so remove it.
     * (Maybe ignore MLAT flights completely, as their position is never transmitted by dump1090?)
     */
    _idFromHex: function (hex) {
        if (hex === null) return null

        const hexCleaned = hex.startsWith("~") ? hex.substring(2) : hex
        return `id_${hexCleaned}`
    },

    /**
     * Add and update label component to a-aircraft entity.
     * 
     * Note: The label should be managed from outside of the aircraft component, as it
     * contains global information which the aircraft cannot be aware of
     * (e.g. distance to camera, which is managed by my-gps-projected-entity-place component).
     */
    updateLabelCallback: function (ev) {
        var aircraftEl = ev.target;
        var aircraft = aircraftEl.components.aircraft;
        aircraftEl.setAttribute('label', {
            flight: aircraft.flight,
            altitude: aircraft.getAltitude(),
            distance: aircraftEl.getAttribute('distance')
        })
    },

    /**
     * Remove the provided a-aircraft entity from scene.
     */
    _destroyAircraft: function (aircraftEl) {
        const id = aircraftEl.components.aircraft.id;

        const flightPath = this.scene.querySelector(`#${id}_fp`);
        if (flightPath !== null) {
            this.scene.removeChild(flightPath);
            flightPath.destroy();
        }

        console.log("Deleting aircraft:" + id)
        this.scene.removeChild(aircraftEl);  // remove from scene
        aircraftEl.destroy();  // Clean up memory related to the entity such as clearing all components and their data.

        console.log("Aircraft " + id + " destroyed")
    },
});