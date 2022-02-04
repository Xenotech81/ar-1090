var dotenv = require('dotenv')
const fs = require('fs')
const https = require('https')
const express = require('express');
const axios = require('axios').default;
const path = require('path')

dotenv.config()

const app = express();
app.use(express.static('public'))

const DUMP10190_DATA_URL = process.env.DUMP10190_DATA_URL || "http://localhost/skyaware/data"
const PORT = process.env.PORT || 4444

var options = {
    key: fs.readFileSync('./ssl/key_unencrypted.pem'),
    cert: fs.readFileSync('./ssl/cert.pem'),
};

var server = https.createServer(options, app).listen(PORT, function () {
    console.log("Express server listening on port " + PORT);
});

// Routes
app.get('/', (_, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'index.html'))
})

// https://xpertphp.com/node-js-axios-http-get-request-example/
app.get('/aircraft', (_, res) => {
    axios.get(DUMP10190_DATA_URL + "/aircraft.json")
        .then((response) => { res.json(response.data); })
        .catch((err) => {
            console.error(err);
            res.status('500').end(`Failed retrieving aircraft.json from ${DUMP10190_DATA_URL}`);
        })
});

app.get('/receiver', (_, res) => {
    axios.get(DUMP10190_DATA_URL + "/receiver.json")
        .then((response) => { res.json(response.data); })
        .catch((err) => {
            console.error(err);
            res.status('500').end(`Failed retrieving receiver.json from ${DUMP10190_DATA_URL}`);
        })
});

// https://stackoverflow.com/questions/63205191/express-route-parameters-vs-http-query-parameters
app.get('/history/:n', (req, res) => {
    axios.get(DUMP10190_DATA_URL + `/history_${req.params.n}.json`)
        .then((response) => { res.json(response.data); })
        .catch((err) => {
            console.error(err);
            res.status('500').end(`Failed retrieving history_[n].json from ${DUMP10190_DATA_URL}`);
        })
});