// Component to change to a sequential color on click.
AFRAME.registerComponent('cursor-listener', {
    init: function () {
        this.el.addEventListener('click', function (evt) {
            this.setAttribute('material', 'color', 'red');
        });
    }
});