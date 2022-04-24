/**
 * Flight dynamics of fixed-wind aircraft.
 * 
 * Computes the geometry orientation from newest and previous position vectors.
 * Triggers on 'componentchanged' (position) event fired by aircraft entity.
 */
AFRAME.registerComponent('fixed-wing', {

    init: function () {

        var self = this; // Closure to access fresh `this.data` from event handler context.

        this.prevPosition = null;  // Vector3 instance of previous aircraft position
        this.orientation = new THREE.Vector3(0, 0, -1);  // Normalized orientation vector of last path segment (initiate pointing north)


        // Rotate geometry according to aircraft new and past position vectors
        this.el.addEventListener('componentchanged', function (evt) {
            if (evt.detail.name === 'position') {
                const newPosition = evt.target.getAttribute('position')

                // If first ever position, then just store it and return
                if (self.prevPosition === null) {
                    self.prevPosition = newPosition.clone();
                    return
                }

                self.orientation.copy(newPosition).sub(self.prevPosition).normalize();
                self.el.object3D.setRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), self.orientation));

                self.prevPosition = newPosition.clone();
            }
        });
    },
});
