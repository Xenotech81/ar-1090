// Routes on the proxy server
const AIRCRAFT_ROUTE = "/aircraft";
const RECEIVER_ROUTE = "/receiver";
const HISTORY_ROUTE = "/history";


/**
 * dump1090-client system
 * 
 * Client responsible for retrieving dump1090 aircraft data from the server.
 * For now, implemented to periodically poll at pollInterval (s).
 * 
 * Knows following routes on the server:
 * - AIRCRAFT_ROUTE = /aircraft
 * - RECEIVER_ROUTE = /receiver
 * - HISTORY_ROUTE = /history
 * 
 * Custom event dispatches:
 * - dump1090-client-connected:  On successful connection to dump1090 receiver.
 * - dump1090-data-received: On each poll with received JSON attached as detail.
 * - stale-receiver: If receiver timestamp ('now' attribute)  did not change in the last 5sec.
 */
AFRAME.registerSystem('dump1090-client', {
    schema: {
        pollInterval: { default: 1 },  // Poll interval in seconds
    },

    init: function () {
        let _poller = null;  // setInteval() instace which fetches data from the server
        this.receiver = null;  // Receiver info: version, refresh [ms], history [s], lat, lon
        this.StaleReceiverCount = 0;
        this.LastReceiverTimestamp = 0;

        fetch(RECEIVER_ROUTE)
            .then((res) => res.json())
            .then(receiver => { this.receiver = receiver; return receiver })
            .then(receiver => {
                console.log("Connected to dump1090 instance: lat: %s, lon: %s, refresh rate: %ss, version: %s",
                    receiver.lat,
                    receiver.lon,
                    receiver.refresh / 1000,
                    receiver.version);
                this.el.dispatchEvent(new CustomEvent('dump1090-client-connected'));  // Inform that initialisation finished
            })
    },

    update: function (oldData) {
        if (this._poller && oldData.pollInterval !== this.data.pollInterval) {
            clearInterval(this._poller)
        }

        this._poller = setInterval(() => fetch(AIRCRAFT_ROUTE)
            .then((res) => res.json())
            .then(aircraftJson => {
                this.el.dispatchEvent(new CustomEvent('dump1090-data-received', { detail: aircraftJson }));
                this._checkStaleReceiver(aircraftJson.now);
            })
            .catch(err => console.error("Failed fetching aircraft.json: " + err)),
            this.data.pollInterval * 1000);
    },

    /**
     * Fetches 120sec history from server on initial connection.
     * 
     * NOTE: Currently not in use.
     */
    retreive_history: async function () {
        return fetch(HISTORY_ROUTE)
            .then((res) => res.json())
            .then(history => { return history })
    },

    /**
     * Checks if last timestamp from receiver has incremented in the last 5sec.
     * Dispatches stale-receiver custom event if stale.
     *      * 
     * Copy from https://github.com/flightaware/dump1090/blob/v7.1/public_html/script.js
     */
    _checkStaleReceiver: function (now) {
        if (this.LastReceiverTimestamp === now) {
            this.StaleReceiverCount++;
            if (this.StaleReceiverCount > 5) {
                this.el.dispatchEvent(new CustomEvent('stale-receiver'));
                console.log("The data from dump1090 hasn't been updated in a while. Maybe dump1090 is no longer running?");
            }
        } else {
            this.StaleReceiverCount = 0;
            this.LastReceiverTimestamp = now;
        }
    },

});