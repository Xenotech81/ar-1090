const aircraftUrl = "/aircraft"
var receiverUrl = "/receiver"
const historyUrl = "/history"



// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
// https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
export async function fetchAllHistory(positionKnownOnly) {
    // Fetch all histry files from dump1090 (usually 120) and regroup by unique id.
    let aircraftHistory = [];
    let allHistories_ = [];

    // Query the max number of history entries on server
    const response = await fetch(receiverUrl);
    if (!response.ok) {
        throw new Error(`HTTP error querying the receiver! Status: ${response.status}`);
    }
    const receiver = await response.json();

    const maxHistory = receiver.history;
    const historiesRange = [...Array(maxHistory).keys()];

    try {
        const allHistoriesPromises = historiesRange.map(async n => {
            return await fetch(`${historyUrl}/${n}`).then(res => res.json());
        });
        allHistories_ = await Promise.all(allHistoriesPromises);
    } catch (err) {
        throw new Error("There has been a problem fetching the aircraft history:" + err.message);
    };

    allHistories_.sort((a, b) => a.now - b.now)

    aircraftHistory = allHistories_.flatMap(hist => {
        return hist.aircraft.map(ac =>
            parseAircraftJson(hist.now, ac)
        );
    });

    return groupBy(aircraftHistory.filter(ac => ac.positionKnown == positionKnownOnly), 'id');
}


export async function fetchTrackCoordinates() {
    // Return (lat, lon, altitudeM) coordinates of historical flight tracks by fetching the history files from dump1090. 

    const idGroups = await fetchAllHistory(true);

    let trackCoordinates = {};

    for (const id in idGroups) {
        trackCoordinates = {
            ...trackCoordinates,
            [id]:
                idGroups[id].map((ac) => { return [ac.lat, ac.lon, ac.altitudeM] })
        }
    };
    return trackCoordinates;
}


// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce
function groupBy(objectArray, property) {
    return objectArray.reduce(function (acc, obj) {
        let key = obj[property]
        if (!acc[key]) {
            acc[key] = []
        }
        acc[key].push(obj)
        return acc
    }, {})
}


export function parseAircraftJson(now, json) {
    // Create a clean id string, as it will be used as DOM element id
    const id_ = json.hex.startsWith("~") ? json.hex.substring(2) : json.hex
    const id = `id_${id_}`

    const positionTimestamp = now;
    const hex = json.hex
    const callsign = json.flight ? json.flight.trim() : null;
    const lon = json.lon;
    const lat = json.lat;
    const altitudeFt = typeof json.alt_geom === 'number' ? json.alt_geom : json.baro
    const altitudeM = typeof altitudeFt === 'number' ? 0.3048 * altitudeFt : null;
    const onGround = altitudeM === 0 ? true : false;

    // True, if positional data is complete (for plotting)
    const positionKnown = lon && lat && (typeof altitudeM === "number") ? true : false;

    return { 'id': id, 'positionKnown': positionKnown, 'positionTimestamp': positionTimestamp, 'hex': hex, 'callsign': callsign, 'lon': lon, 'lat': lat, 'altitudeFt': altitudeFt, 'altitudeM': altitudeM, 'onGround': onGround }
}