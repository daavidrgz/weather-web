/*jshint esversion:6*/

require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const https = require("https");
const http = require("http");
const async = require("async");
const { resourceUsage } = require('process');

const app = express();
app.use(express.static("public"));
app.use(express.static("error/404"));
app.use(bodyParser.urlencoded({extended: true}));

app.get("/", function(_req, res) {
	res.sendFile(__dirname + "/public/index.html");
});

function httpGet(url, callback) {
	http.get(url, function(serverRes) {
		const { statusCode } = serverRes;
		let err;
		if (statusCode !== 200)
			err = new Error('Request Failed.' +`Status Code: ${statusCode}`);
		serverRes.setEncoding('utf8');
		let rawData = '';
		serverRes.on('data', (chunk) => { rawData += chunk; });
		serverRes.on('end', () => { callback(err, rawData); });
	});
}

/* GET THE WEATHER BY CITY */
const appid = process.env.OPEN_WEATHER_KEY;
app.post("/api/weather/city", function(req, res) {
	const url = "https://api.openweathermap.org/data/2.5/weather?q=" + req.body.city + "&units=metric&appid=" + appid;
	https.get(url, function(serverRes) {
		serverRes.setEncoding('utf8');
		let rawData = '';
		serverRes.on('data', (chunk) => { rawData += chunk; });
		serverRes.on('end', () => {
			res.send(rawData);
		});
	}).on("error", (e) => {
		console.error("Error: " + e.message);
	});
});

/* GET THE WEATHER BY LAT LONG */
app.post("/api/weather/latlon", function(req, res) {
	const url = "https://api.openweathermap.org/data/2.5/weather?lat=" + req.body.lat + "&lon=" + req.body.lon + "&units=metric&appid=" + appid;
	https.get(url, function(serverRes) {
		serverRes.setEncoding('utf8');
		let rawData = '';
		serverRes.on('data', (chunk) => { rawData += chunk; });
		serverRes.on('end', () => {
			res.send(rawData);
		});
	}).on('error', (e) => {
		console.error(`Error: ${e.message}`);
	});
});

/* GET FUTURE WEATHER INFO */
app.post("/api/weather/prediction", function(req, res) {
	const url = "https://api.openweathermap.org/data/2.5/onecall?lat=" + req.body.lat + "&lon=" + req.body.lon + 
	"&exclude=current&units=metric&appid=" + appid;
	https.get(url, function(serverRes) {
		serverRes.setEncoding('utf8');
		let rawData = '';
		serverRes.on('data', (chunk) => { rawData += chunk; });
		serverRes.on('end', () => {
			res.send(rawData);
		});
	}).on('error', (e) => {
		console.error(`Error: ${e.message}`);
	});
});


/* GET COUNTRY INFO */
const countryKey = process.env.COUNTRY_KEY
app.post("/api/country", function(req, res) {
	httpGet(`http://api.countrylayer.com/v2/all?access_key=${countryKey}`, function(err, serverRes) {
		if ( err ) {
			console.error(`Error: ${err.message}`);
			res.statusCode(500).send()
			return
		}
		let allCountryInfo = JSON.parse(serverRes);
		let countryInfo = allCountryInfo.find(country => country.alpha2Code == req.body.iso2)
		if ( !countryInfo )
			res.statusCode(404).send({})
		res.send(JSON.stringify(countryInfo));
	});
});

/* GET GEO IP */
const geoApi = process.env.GEOLOC_KEY;
app.get("/api/geoip", function(req, res) {
	https.get("https://api.getgeoapi.com/api/v2/ip/" + req.headers["x-forwarded-for"] + "?api_key=" + geoApi + "&format=json", (serverRes) => {
		serverRes.setEncoding('utf8');
		let rawData = '';
		serverRes.on('data', (chunk) => { rawData += chunk; });
		serverRes.on('end', () => {
			res.send(rawData);
		});
	}).on('error', (e) => {
		console.error(`Error: ${e.message}`);
	});
});

/* GET COUNTRY CLIMATE DATA */
app.post("/api/worldbank/climate", function(req, res) {
	http.get("http://climatedataapi.worldbank.org/climateweb/rest/v2/country/cru/" + req.body.var + "/decade/" + req.body.iso3, function(serverRes) {
		serverRes.setEncoding('utf8');
		let rawData = '';
		serverRes.on('data', (chunk) => { rawData += chunk; });
		serverRes.on('end', () => {
			res.send(rawData);
		});
	}).on('error', (e) => {
		console.error(`Error: ${e.message}`);
	});
});

/* GET COUNTRY INDICATORS DATA */
var urlViolence = "http://api.worldbank.org/v2/country/iso3/indicator/PV.EST?format=json&mrv=10";
var urlDoingBusiness = "http://api.worldbank.org/v2/country/iso3/indicator/IC.BUS.EASE.DFRN.XQ.DB1719?format=json&mrv=10";
var urlGPD = "http://api.worldbank.org/v2/country/iso3/indicator/NY.GDP.PCAP.CD?format=json&mrv=10";
var urlElectricity = "http://api.worldbank.org/v2/country/iso3/indicator/1.1_ACCESS.ELECTRICITY.TOT?format=json&mrv=10";
var urls = [urlViolence, urlDoingBusiness, urlGPD, urlElectricity];

app.post("/api/worldbank/indicators", function(req, res) {
	var urlCountry = [];
	urls.forEach(elem => urlCountry.push(elem.replace("iso3", req.body.iso3)));

	async.map(urlCountry, httpGet, function(err, responses){
		if ( err )
			console.error(`Error: ${err.message}`);
		else
			res.send(responses);
	});
});


/* ERRORS */
app.get("/error", function(req, res) {
	res.sendFile(__dirname + "/error/404/error404.html");
});
app.get("*", function(req, res) {
	res.redirect("/error");
});

let port = process.env.PORT;
if ( port == null || port == ' ' )
	port = 3000;
app.listen(port, function() {
	console.log("Server listening on port 3000");
});
