AFRAME.registerComponent('label', {

    schema: {
        callsign: { default: '' },
        altitude: { type: 'number' },
        distance: { type: 'number' },
        visible: { default: true },
        showDetails: { default: false },
    },

    init: function () {
        let infoLabel = null;
        let callsign = this.data.callsign;
    },

    update: function () {
        var data = this.data;

        if (!this.infoLabel) {
            this.infoLabel = this._createLabel(data.callsign, data.altitude, data.distance);
            this.el.appendChild(this.infoLabel);
            this.el.addEventListener('click', this._clickListener.bind(this));
        }

        if (this.infoLabel.hasLoaded) {
            this.infoLabel.querySelector('.infoLabelCallsign').setAttribute('value', data.callsign);
            this.infoLabel.querySelector('.infoLabelAltitude').setAttribute('value', this._altitudeStr(data.altitude));
            this.infoLabel.querySelector('.infoLabelDistance').setAttribute('value', this._distanceStr(data.distance));

            // this.infoLabel.querySelector('.infoLabelAltitude').object3D.visible = data.showDetails;
            // this.infoLabel.querySelector('.infoLabelDistance').object3D.visible = data.showDetails;
            // this.infoLabel.object3D.visible = data.visible;
        }
    },

    _createLabel: function (callsign, altitude, distance) {

        let labelEl = document.createElement('a-entity');
        labelEl.setAttribute('scale', '120 120 120');
        labelEl.setAttribute('look-at', "[gps-projected-camera]");
        labelEl.setAttribute('position', '0 -20 0');

        let callsignEl = document.createElement('a-text');
        callsignEl.setAttribute('class', 'infoLabelCallsign clickable');
        callsignEl.setAttribute('value', callsign);
        callsignEl.setAttribute('position', '0 0.5 0');
        callsignEl.setAttribute('align', 'center');
        callsignEl.setAttribute('scale', '1.5 1.5 1.5');
        callsignEl.setAttribute('side', 'double');
        callsignEl.setAttribute('wrap-count', 9);  // Needed to scale clickable plane geometry
        callsignEl.setAttribute('width', 1);  // Needed to scale clickable plane geometry
        // Clickable surface
        callsignEl.setAttribute('geometry', 'primitive: plane; width: auto; height: auto;');
        callsignEl.setAttribute('material', { visible: false })

        let altitudeEl = document.createElement('a-text');
        altitudeEl.setAttribute('class', 'infoLabelAltitude');
        altitudeEl.setAttribute('value', this._altitudeStr(altitude));
        altitudeEl.setAttribute('position', '0 0 0');
        altitudeEl.setAttribute('align', 'center');
        altitudeEl.setAttribute('side', 'double');
        altitudeEl.setAttribute('visible', this.data.showDetails);

        let distanceEl = document.createElement('a-text');
        distanceEl.setAttribute('class', 'infoLabelDistance');
        distanceEl.setAttribute('value', this._distanceStr(distance));
        distanceEl.setAttribute('position', '0 -0.2 0');
        distanceEl.setAttribute('align', 'center');
        distanceEl.setAttribute('side', 'double');
        distanceEl.setAttribute('visible', this.data.showDetails);

        labelEl.appendChild(callsignEl);
        labelEl.appendChild(altitudeEl);
        labelEl.appendChild(distanceEl);

        labelEl.setAttribute('visible', this.data.visible);

        return labelEl;
    },

    _clickListener: function () {
        this.infoLabel.querySelector('.infoLabelAltitude').object3D.visible = true;
        this.infoLabel.querySelector('.infoLabelDistance').object3D.visible = true;
    },

    _altitudeStr: function (altitudeM) {
        var altitudeStr = 'ALT: --- km';
        if (altitudeM && altitudeM < 1000) {
            altitudeStr = `ALT: ${altitudeM.toFixed(0)}m`
        } else if (altitudeM && altitudeM > 1000) {
            altitudeStr = `ALT: ${(altitudeM / 1000).toFixed(1)}km`
        }
        return altitudeStr;
    },

    _distanceStr: function (distanceM) {
        var distanceStr = 'DST: ---.- km';
        if (distanceM) {
            distanceStr = `DST: ${(distanceM / 1000).toFixed(1)}km`
        }
        return distanceStr;
    },
})