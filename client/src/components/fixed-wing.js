// Flight dynamics of fixed-wind aircraft
AFRAME.registerComponent('fixed-wing', {

    schema: {
        onGround: { default: false },
    },

    init: function () {
        // Closure to access fresh `this.data` from event handler context.
        var self = this;
        var data = this.data;
        var el = this.el;  // Reference to the component's entity.

        this.prevPosition = null;  // Vector3 to previous aircraft position
        this.orientation = new THREE.Vector3(0, 0, -1);  // Normalized orientation vector of last path segment (initiate pointing north)

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


        // Rotate geometry according to aircraft new and past position vectors
        el.addEventListener('componentchanged', function (evt) {
            if (evt.detail.name === 'position') {
                const newPosition = evt.target.getAttribute('position')

                // If first ever position, then just store it and return
                if (self.prevPosition === null) {
                    self.prevPosition = newPosition.clone();
                    return
                }

                self.orientation.copy(newPosition).sub(self.prevPosition).normalize();
                el.object3D.setRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), self.orientation));
            }
        });
    },
});
