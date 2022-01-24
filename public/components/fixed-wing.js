// Flight dynamics of fixed-wind aircraft
AFRAME.registerComponent('fixed-wing', {
    //dependencies: ['flight-path'],

    schema: {
        onGround: { default: false },
    },

    _gpsTrack: null,

    init: function () {
        // Closure to access fresh `this.data` from event handler context.
        var self = this;
        var data = this.data;
        var el = this.el;  // Reference to the component's entity.

        this._gpsTrack = el.components['flight-path']

        // Set up initial state and variables
        if (data.onGround) { el.addState('onGround') } else { el.addState('airborne') }

        // State change listenders and handlers
        el.addEventListener('stateadded', function (evt) {
            if (evt.detail === 'onGround') {
                entity.removeState('airborne');
                console.log('Aircraft landed!');
            } else if (evt.detail === 'airborne') {
                entity.removeState('onGround');
                console.log('Aircraft took off!');
            }
        });

    },
});
