// https://github.com/flightaware/dump1090/blob/v7.1/public_html/planeObject.js
// ATTENTION: Altitude in feet, to match ColorByAlt!
const getAltitudeColor = function (altitude) {
    var h, s, l;

    // if (typeof altitude === 'undefined') {
    //     altitude = this.altitude;
    // }

    if (altitude === null) {
        h = ColorByAlt.unknown.h;
        s = ColorByAlt.unknown.s;
        l = ColorByAlt.unknown.l;
    } else if (altitude === "ground") {
        h = ColorByAlt.ground.h;
        s = ColorByAlt.ground.s;
        l = ColorByAlt.ground.l;
    } else {
        s = ColorByAlt.air.s;
        l = ColorByAlt.air.l;

        // find the pair of points the current altitude lies between,
        // and interpolate the hue between those points
        var hpoints = ColorByAlt.air.h;
        h = hpoints[0].val;
        for (var i = hpoints.length - 1; i >= 0; --i) {
            if (altitude > hpoints[i].alt) {
                if (i == hpoints.length - 1) {
                    h = hpoints[i].val;
                } else {
                    h = hpoints[i].val + (hpoints[i + 1].val - hpoints[i].val) * (altitude - hpoints[i].alt) / (hpoints[i + 1].alt - hpoints[i].alt)
                }
                break;
            }
        }
    }

    if (h < 0) {
        h = (h % 360) + 360;
    } else if (h >= 360) {
        h = h % 360;
    }

    if (s < 5) s = 5;
    else if (s > 95) s = 95;

    if (l < 5) l = 5;
    else if (l > 95) l = 95;

    return [h, s, l];
}


const getMarkerColor = function () {
    // Emergency squawks override everything else
    // if (this.squawk in SpecialSquawks)
    //     return SpecialSquawks[this.squawk].markerColor;

    // Dummy constants for now
    const seen_pos = 5;
    const selected = false;
    const SelectedAllPlanes = false;

    var h, s, l;

    var colorArr = getAltitudeColor();

    h = colorArr[0];
    s = colorArr[1];
    l = colorArr[2];

    // If we have not seen a recent position update, change color
    if (seen_pos > 15) {
        h += ColorByAlt.stale.h;
        s += ColorByAlt.stale.s;
        l += ColorByAlt.stale.l;
    }

    // If this marker is selected, change color
    if (selected && !SelectedAllPlanes) {
        h += ColorByAlt.selected.h;
        s += ColorByAlt.selected.s;
        l += ColorByAlt.selected.l;
    }

    // // If this marker is a mlat position, change color
    // if (this.position_from_mlat) {
    //     h += ColorByAlt.mlat.h;
    //     s += ColorByAlt.mlat.s;
    //     l += ColorByAlt.mlat.l;
    // }

    if (h < 0) {
        h = (h % 360) + 360;
    } else if (h >= 360) {
        h = h % 360;
    }

    if (s < 5) s = 5;
    else if (s > 95) s = 95;

    if (l < 5) l = 5;
    else if (l > 95) l = 95;

    return 'hsl(' + (h / 5).toFixed(0) * 5 + ',' + (s / 5).toFixed(0) * 5 + '%,' + (l / 5).toFixed(0) * 5 + '%)'
}


// return the styling of the lines based on altitude
const altitudeLines = function (altitude) {
    var colorArr = getAltitudeColor(altitude);
    return 'hsl(' + (colorArr[0] / 5).toFixed(0) * 5 + ',' + (colorArr[1] / 5).toFixed(0) * 5 + '%,' + (colorArr[2] / 5).toFixed(0) * 5 + '%)'
}


// https://github.com/flightaware/dump1090/blob/v7.1/public_html/config.js

// -- Output Settings -------------------------------------
// The DisplayUnits setting controls whether nautical (ft, NM, knots), 
// metric (m, km, km/h) or imperial (ft, mi, mph) units are used in the 
// plane table and in the detailed plane info. Valid values are
// "nautical", "metric", or "imperial".
const DisplayUnits = "metric";

// -- Marker settings -------------------------------------

// These settings control the coloring of aircraft by altitude.
// All color values are given as Hue (0-359) / Saturation (0-100) / Lightness (0-100)
const ColorByAlt = {
    // HSL for planes with unknown altitude:
    unknown: { h: 0, s: 0, l: 40 },

    // HSL for planes that are on the ground:
    ground: { h: 15, s: 80, l: 20 },

    air: {
        // These define altitude-to-hue mappings
        // at particular altitudes; the hue
        // for intermediate altitudes that lie
        // between the provided altitudes is linearly
        // interpolated.
        //
        // Mappings must be provided in increasing
        // order of altitude.
        //
        // Altitudes below the first entry use the
        // hue of the first entry; altitudes above
        // the last entry use the hue of the last
        // entry.
        h: [{ alt: 2000, val: 20 },    // orange
        { alt: 10000, val: 140 },   // light green
        { alt: 40000, val: 300 }], // magenta
        s: 85,
        l: 50,
    },

    // Changes added to the color of the currently selected plane
    selected: { h: 0, s: -10, l: +20 },

    // Changes added to the color of planes that have stale position info
    stale: { h: 0, s: -10, l: +30 },

    // Changes added to the color of planes that have positions from mlat
    mlat: { h: 0, s: -10, l: -10 }
};

const SpecialSquawks = {
    '7500': { cssClass: 'squawk7500', markerColor: 'rgb(255, 85, 85)', text: 'Aircraft Hijacking' },
    '7600': { cssClass: 'squawk7600', markerColor: 'rgb(0, 255, 255)', text: 'Radio Failure' },
    '7700': { cssClass: 'squawk7700', markerColor: 'rgb(255, 255, 0)', text: 'General Emergency' }
};


export { ColorByAlt, SpecialSquawks, altitudeLines };