// Routes on the proxy server
const AIRCRAFT_ROUTE = "/aircraft";
const RECEIVER_ROUTE = "/receiver";
const HISTORY_ROUTE = "/history";


/**
 * dump1090-client system
 * 
 * Client responsible for retrieving dump1090 aircraft data from the server.
 * For now, implemented to periodically poll at pollInterval (s).
 * Will dispatch each time a custom event 'dump1090-data-received' with JSON attached as detail.
 * Knows following routes on the server:
 * - AIRCRAFT_ROUTE = /aircraft
 * - RECEIVER_ROUTE = /receiver
 * - HISTORY_ROUTE = /history
 */
AFRAME.registerSystem('dump1090-client', {
    schema: {
        pollInterval: { default: 1 },  // Poll interval in seconds
    },

    init: function () {
        let _poller = null;
        this.receiver = null;  // Receiver info: version, refresh [ms], history [s], lat, lon

        fetch(RECEIVER_ROUTE)
            .then((res) => res.json())
            .then(receiver => this.receiver = receiver)

        this.el.dispatchEvent(new CustomEvent('dump1090-client-connected'));  // Inform that initialisation finished
    },

    update: function (oldData) {
        if (this._poller && oldData.pollInterval !== this.data.pollInterval) {
            clearInterval(this._poller)
        }

        this._poller = setInterval(() => fetch(AIRCRAFT_ROUTE)
            .then((res) => res.json())
            .then(aircraft => this.el.dispatchEvent(new CustomEvent('dump1090-data-received', { detail: { aircraftJson: aircraft } }))),
            this.data.pollInterval * 1000);
    },

    retreive_history: async function () {
        return fetch(HISTORY_ROUTE)
            .then((res) => res.json())
            .then(history => { return history })
    }
});