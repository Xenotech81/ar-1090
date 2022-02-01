// <a-entity geometry="primitive: aircraft"></a-entity>
AFRAME.registerGeometry('aircraft', {
    schema: { model: { default: 'arrow', oneOf: ['arrow'] }, scale: { default: 1 } },

    init: function (data) {
        // Model orientation vector in model space (will be used for rotation later)
        var MODEL_ORIENTATION = null;

        if (data.model === 'arrow') {
            this.geometry = this._getArrowGeometry();
        }
        else { console.log("Unknown geometry selected. Currently available: arrow"); return; }
        // Apply user scaling
        this.geometry.scale(data.scale, data.scale, data.scale)

    },


    /**
     * Creates the dummy arrow-geometry.
     * From; https://codepen.io/usefulthink/pen/YNrvpY?editors=0010
     * @return {THREE.Geometry}
     */
    _getArrowGeometry: function () {
        const shape = new THREE.Shape([
            [-1, -1], [-0.03, 1], [-0.01, 1.017], [0.0, 1.0185],
            [0.01, 1.017], [0.03, 1], [1, -1], [0, -0.5]
        ].map(p => new THREE.Vector2(...p)));

        const arrowGeometry = new THREE.ExtrudeGeometry(shape, {
            amount: 1,
            bevelEnabled: true,
            bevelSize: 0.1,
            bevelThickness: 0.1,
            bevelSegments: 2
        });

        // Scale up roughly to size of a A320: length: 31m, wingspan: 34m, height: 12m)
        arrowGeometry.scale(34 / 2, 31, 6)

        // orient the geometry into x/z-plane, roughly centered
        const matrix = new THREE.Matrix4()
            .makeRotationX(-Math.PI / 2)  // Point north by default
            .setPosition(new THREE.Vector3(0, 0, 0));

        arrowGeometry.applyMatrix(matrix);
        this.MODEL_ORIENTATION = new THREE.Vector3(0, 0, -1);

        return arrowGeometry
    },
});


// https://aframe.io/docs/1.2.0/components/material.html#creating-a-material-from-a-component
AFRAME.registerComponent('aircraft-material', {
    schema: {
        // Add properties.
    },

    init: function () {
        this.material = this.el.getOrCreateObject3D('mesh').material = new THREE.ShaderMaterial({
            // ...
        });
    },

    update: function () {
        // Update `this.material`.
    }
});