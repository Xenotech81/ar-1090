/**
 * flight-track component
 * 
 * Stores flight track segments in lat/lon and world coordinates.
 * Uses line segments as geometry.
 * 
 */
AFRAME.registerSystem('flight-track', {
    dependencies: ['my-gps-projected-entity-place'],

    schema: {
    },

    init: function () {
        this.prev_position = null;
        this.prev_position_time = null;
        this.position = null;
        this.position_from_mlat = false
        this.sitedist = null;

        // Track history as a series of line segments
        this.elastic_feature = null;
        this.track_linesegs = [];
        this.history_size = 0;
    },

    remove: function () {
        this.clearLines();
        this.clearMarker();
    },

    /**
    * Appends data to the running track so we can get a visual tail on the plane
    */
    updateTrack: function (receiver_timestamp, last_timestamp) {
        if (!this.position)
            return false;
        if (this.prev_position && this.position[0] == this.prev_position[0] && this.position[1] == this.prev_position[1])
            return false;

        var projHere = ol.proj.fromLonLat(this.position);
        var projPrev;
        var prev_time;
        if (this.prev_position === null) {
            projPrev = projHere;
            prev_time = this.last_position_time;
        } else {
            projPrev = ol.proj.fromLonLat(this.prev_position);
            prev_time = this.prev_position_time;
        }

        this.prev_position = this.position;
        this.prev_position_time = this.last_position_time;

        if (this.track_linesegs.length == 0) {
            // Brand new track
            //console.log(this.icao + " new track");
            var newseg = {
                fixed: new ol.geom.LineString([projHere]),
                feature: null,
                update_time: this.last_position_time,
                estimated: false,
                ground: (this.altitude === "ground"),
                altitude: this.altitude
            };
            this.track_linesegs.push(newseg);
            this.history_size++;
            return;
        }

        var lastseg = this.track_linesegs[this.track_linesegs.length - 1];

        // Determine if track data are intermittent/stale
        // Time difference between two position updates should not be much
        // greater than the difference between data inputs
        // MLAT data are given some more leeway

        var time_difference = (this.last_position_time - prev_time) - (receiver_timestamp - last_timestamp);
        var stale_timeout = (this.position_from_mlat ? 30 : 5);
        var est_track = (time_difference > stale_timeout);

        // Also check if the position was already stale when it was exported by dump1090
        // Makes stale check more accurate for history points spaced 30 seconds apart
        est_track = est_track || ((receiver_timestamp - this.last_position_time) > stale_timeout);

        var ground_track = (this.altitude === "ground");

        if (est_track) {

            if (!lastseg.estimated) {
                // >5s gap in data, create a new estimated segment
                //console.log(this.icao + " switching to estimated");
                lastseg.fixed.appendCoordinate(projPrev);
                this.track_linesegs.push({
                    fixed: new ol.geom.LineString([projPrev]),
                    feature: null,
                    update_time: prev_time,
                    altitude: 0,
                    estimated: true
                });
                this.history_size += 2;
            } else {
                // Keep appending to the existing dashed line; keep every point
                lastseg.fixed.appendCoordinate(projPrev);
                lastseg.update_time = prev_time;
                this.history_size++;
            }

            return true;
        }

        if (lastseg.estimated) {
            // We are back to good data (we got two points close in time), switch back to
            // solid lines.
            lastseg.fixed.appendCoordinate(projPrev);
            lastseg = {
                fixed: new ol.geom.LineString([projPrev]),
                feature: null,
                update_time: prev_time,
                estimated: false,
                ground: (this.altitude === "ground"),
                altitude: this.altitude
            };
            this.track_linesegs.push(lastseg);
            this.history_size += 2;
            return true;
        }

        if ((lastseg.ground && this.altitude !== "ground") ||
            (!lastseg.ground && this.altitude === "ground") || this.altitude !== lastseg.altitude) {
            //console.log(this.icao + " ground state changed");
            // Create a new segment as the ground state changed.
            // assume the state changed halfway between the two points
            // FIXME needs reimplementing post-google

            lastseg.fixed.appendCoordinate(projPrev);
            this.track_linesegs.push({
                fixed: new ol.geom.LineString([projPrev]),
                feature: null,
                update_time: prev_time,
                estimated: false,
                altitude: this.altitude,
                ground: (this.altitude === "ground")
            });
            this.history_size += 2;
            return true;
        }

        // Add more data to the existing track.
        // We only retain some historical points, at 5+ second intervals,
        // plus the most recent point
        if (prev_time - lastseg.update_time >= 5) {
            // enough time has elapsed; retain the last point and add a new one
            //console.log(this.icao + " retain last point");
            lastseg.fixed.appendCoordinate(projPrev);
            lastseg.update_time = prev_time;
            this.history_size++;
        }

        return true;
    },

    /**
    * This is to remove the line from the screen if we deselect the plane
    */
    clearLines: function () {
        for (var i = this.track_linesegs.length - 1; i >= 0; --i) {
            var seg = this.track_linesegs[i];
            if (seg.feature !== null) {
                PlaneTrailFeatures.remove(seg.feature);
                seg.feature = null;
            }
        }

        if (this.elastic_feature !== null) {
            PlaneTrailFeatures.remove(this.elastic_feature);
            this.elastic_feature = null;
        }
    },

    /**
    * Return color of airplane geometry as HSL string.
    * 
    * Color criteria:
    * - Squawk code
    * - Altitude; calls getAltitudeColor()
    * - Last position update age (stale)
    * - Selection status by user
    * - Mlat position
    */
    getMarkerColor: function () {
        // Emergency squawks override everything else
        if (this.squawk in SpecialSquawks)
            return SpecialSquawks[this.squawk].markerColor;

        var h, s, l;

        var colorArr = this.getAltitudeColor();

        h = colorArr[0];
        s = colorArr[1];
        l = colorArr[2];

        // If we have not seen a recent position update, change color
        if (this.seen_pos > 15) {
            h += ColorByAlt.stale.h;
            s += ColorByAlt.stale.s;
            l += ColorByAlt.stale.l;
        }

        // If this marker is selected, change color
        if (this.selected && !SelectedAllPlanes) {
            h += ColorByAlt.selected.h;
            s += ColorByAlt.selected.s;
            l += ColorByAlt.selected.l;
        }

        // If this marker is a mlat position, change color
        if (this.position_from_mlat) {
            h += ColorByAlt.mlat.h;
            s += ColorByAlt.mlat.s;
            l += ColorByAlt.mlat.l;
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

        return 'hsl(' + (h / 5).toFixed(0) * 5 + ',' + (s / 5).toFixed(0) * 5 + '%,' + (l / 5).toFixed(0) * 5 + '%)'
    },

    /**
    * Return color as array of h,s,l values as function of altitude (in feet).
    * 
    * If altitude is:
    * - null: unknown color
    * - "ground": ground color
    * - else: air color
    * 
    * Uses styles.ColorByAlt object
    */
    getAltitudeColor: function (altitude) {
        var h, s, l;

        if (typeof altitude === 'undefined') {
            altitude = this.altitude;
        }

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
    },

    /**
    * Updates color, position and rotation of the airplane marker.
    */
    updateIcon: function () {
        var scaleFactor = Math.max(0.2, Math.min(1.2, 0.15 * Math.pow(1.25, ZoomLvl))).toFixed(1);

        var col = this.getMarkerColor();
        var opacity = 1.0;
        var outline = (this.position_from_mlat ? OutlineMlatColor : OutlineADSBColor);
        var add_stroke = (this.selected && !SelectedAllPlanes) ? ' stroke="black" stroke-width="1px"' : '';
        var baseMarker = getBaseMarker(this.category, this.icaotype, this.typeDescription, this.wtc);
        var rotation = this.track;
        if (rotation === null) {
            rotation = this.true_heading;
        }
        if (rotation === null) {
            rotation = this.mag_heading;
        }
        if (rotation === null) {
            rotation = 0;
        }
        //var transparentBorderWidth = (32 / baseMarker.scale / scaleFactor).toFixed(1);

        var svgKey = col + '!' + outline + '!' + baseMarker.svg + '!' + add_stroke + "!" + scaleFactor;
        var styleKey = opacity + '!' + rotation;

        if (this.markerStyle === null || this.markerIcon === null || this.markerSvgKey != svgKey) {
            //console.log(this.icao + " new icon and style " + this.markerSvgKey + " -> " + svgKey);

            var icon = new ol.style.Icon({
                anchor: [0.5, 0.5],
                anchorXUnits: 'fraction',
                anchorYUnits: 'fraction',
                scale: 1.2 * scaleFactor,
                imgSize: baseMarker.size,
                src: svgPathToURI(baseMarker.svg, outline, col, add_stroke),
                rotation: (baseMarker.noRotate ? 0 : rotation * Math.PI / 180.0),
                opacity: opacity,
                rotateWithView: (baseMarker.noRotate ? false : true)
            });

            this.markerIcon = icon;
            this.markerStyle = new ol.style.Style({
                image: this.markerIcon
            });
            this.markerStaticIcon = null;
            this.markerStaticStyle = new ol.style.Style({});

            this.markerStyleKey = styleKey;
            this.markerSvgKey = svgKey;

            if (this.marker !== null) {
                this.marker.setStyle(this.markerStyle);
                this.markerStatic.setStyle(this.markerStaticStyle);
            }
        }

        if (this.markerStyleKey != styleKey) {
            //console.log(this.icao + " new rotation");
            this.markerIcon.setRotation(rotation * Math.PI / 180.0);
            this.markerIcon.setOpacity(opacity);
            if (this.staticIcon) {
                this.staticIcon.setOpacity(opacity);
            }
            this.markerStyleKey = styleKey;
        }

        return true;
    },

    /**
     * Return the styling of the lines based on altitude
     */
    altitudeLines: function (altitude) {
        var colorArr = this.getAltitudeColor(altitude);
        return new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'hsl(' + (colorArr[0] / 5).toFixed(0) * 5 + ',' + (colorArr[1] / 5).toFixed(0) * 5 + '%,' + (colorArr[2] / 5).toFixed(0) * 5 + '%)',
                width: 2
            })
        })
    },

    /**
    * Update our planes tail line
    */
    updateLines: function () {
        if (!this.selected)
            return;

        if (this.track_linesegs.length == 0)
            return;

        var estimateStyle = new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#a08080',
                width: 1.5,
                lineDash: [3, 3]
            })
        });

        var airStyle = new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#000000',
                width: 2
            })
        });

        var groundStyle = new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: '#408040',
                width: 2
            })
        });

        // find the old elastic band so we can replace it in place
        // (which should be faster than remove-and-add when PlaneTrailFeatures is large)
        var oldElastic = -1;
        if (this.elastic_feature !== null) {
            oldElastic = PlaneTrailFeatures.getArray().indexOf(this.elastic_feature);
        }

        // create the new elastic band feature
        var lastseg = this.track_linesegs[this.track_linesegs.length - 1];
        var lastfixed = lastseg.fixed.getCoordinateAt(1.0);
        var geom = new ol.geom.LineString([lastfixed, ol.proj.fromLonLat(this.position)]);
        this.elastic_feature = new ol.Feature(geom);
        if (lastseg.estimated) {
            this.elastic_feature.setStyle(estimateStyle);
        } else {
            this.elastic_feature.setStyle(this.altitudeLines(lastseg.altitude));
        }

        if (oldElastic < 0) {
            PlaneTrailFeatures.push(this.elastic_feature);
        } else {
            PlaneTrailFeatures.setAt(oldElastic, this.elastic_feature);
        }

        // create any missing fixed line features
        for (var i = 0; i < this.track_linesegs.length; ++i) {
            var seg = this.track_linesegs[i];
            if (seg.feature === null) {
                seg.feature = new ol.Feature(seg.fixed);
                if (seg.estimated) {
                    seg.feature.setStyle(estimateStyle);
                } else {
                    seg.feature.setStyle(this.altitudeLines(seg.altitude));
                }

                PlaneTrailFeatures.push(seg.feature);
            }
        }
    }

});