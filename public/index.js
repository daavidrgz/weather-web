/*jshint esversion:6*/

const countryEmoji = require('country-emoji');
const $ = require('jquery');
const countrySwitch = require('country-code-switch');
const capitalize = require('change-case');	
const countryFlagColors = require('country-flag-colors');
const chart = require('chart.js');

let clientCountry;
let mapZoom = false;

$(function() {
	$('.about-link').on('click', function() {
		$('#about-popup').addClass('show-about-popup');
	});
	$('.popup-close-button').on('click', function() {
		$('#about-popup').removeClass('show-about-popup');
	});
	$('#reload-button').on('click', reloadButton);
	$('.search-button').on('click', searchWeather);
	$('#search-city').on('keypress', function (e) {
		if (e.key === 'Enter')
			searchWeather();
	});
	$('#close-error-message').on('click', function() {
		$('.error-message-container').removeClass('slide-right');
		removeSaturationFilter();
	});

	handleScroll();
	getGeoLoc();
	initMap();

	setTimeout(function() {
		$('.title-tiles-container').removeClass('hide-left');
	}, 500);
});

/*********************** HANDLE SCROLL ******************/
function handleScroll() {
	$(document).on('scroll', function() {
		if ( $(document).scrollTop() > 50 )
			$('.title-map-mobile').removeClass('hide-left');
		// else
		// 	$('.title-map-mobile').addClass('hide-left');

		if ( $(document).scrollTop() > 1200 )
			$('.more-about-country').removeClass('hide-left');
		// else
		// 	$('.more-about-country').addClass('hide-left');
		
		if ( $(document).scrollTop() > 400 )
			$('.weather-prediction-title').removeClass('hide-right');
		// else
		// 	$('.weather-prediction-title').addClass('hide-right');
	});
}

function getWeather(url, req) {
	$.post(url, req, function(data) {
		// Removing the previous event listeners to avoid conflicts
		$(document).off('scroll', drawAllCharts);
		$(document).off('scroll', createHourlyTempChart);
		$(document).off('scroll', createPrecipitationCharts);

		const weatherData = JSON.parse(data);

		if ( weatherData.cod != 200 ) {
			$('.error-message-container').addClass('slide-right');
			$('#error-message').text(capitalize.sentenceCase(weatherData.message) + ' :(');
			addSaturationFilter();
			return;
		}
		
		$('.error-message-container').removeClass('slide-right'); // Every time the search button is clicked, the error message should be hidden
		removeSaturationFilter();

		changeMapView(weatherData.coord.lat, weatherData.coord.lon); // Changing the map viewport

		if ( weatherData.sys.country == undefined ) { // Undefined location
			$('.error-message-container').addClass('slide-right');
			$('#error-message').text("Couldn't get that weather :(");
			addSaturationFilter();
			return;
		}

		if ( clientCountry === undefined ) // Saving the country of the client
			clientCountry = countrySwitch.ISO2toISO3(weatherData.sys.country);

		getCountryInfo(weatherData.sys.country);
		startClock(weatherData.timezone);

		$('#current-temp, #max-temp, #min-temp, #feels-like, #city, #current-forecast, #forecast-description, #forecast-icon').addClass('hide');
		$('#current-wind, #current-humidity, #current-pressure, #current-clouds, #country').addClass('hide');
		setTimeout(function() {
			$('#current-temp').text(Math.round(weatherData.main.temp));
			$('#max-temp').text(Math.round(weatherData.main.temp_max) + '°C');
			$('#min-temp').text(Math.round(weatherData.main.temp_min) + '°C');
			$('#feels-like').text(weatherData.main.feels_like + '°C');
			$('#city').text(weatherData.name);

			let countryName = countrySwitch.ISO2toName(weatherData.sys.country);
			$('#country').text(countrySwitch.ISONametoISO3(countryName));
			$('#country-flag').text(countryEmoji.flag(weatherData.sys.country));
			$('#country-tooltip').text(capitalize.capitalCase(countryName));

			$('#current-forecast').text(weatherData.weather[0].main);
			$('#forecast-description').text(capitalize.sentenceCase(weatherData.weather[0].description));
			$('#forecast-icon').attr('src', 'assets/images/' + weatherData.weather[0].icon + '.svg');
			$('#current-wind').text(weatherData.wind.speed + ' m/s');
			$('#current-humidity').text(weatherData.main.humidity + '%');
			$('#current-pressure').text(weatherData.main.pressure + ' hPa');
			$('#current-clouds').text(weatherData.clouds.all + '%');


			$('#current-temp, #max-temp, #min-temp, #feels-like, #city, #current-forecast, #forecast-description, #forecast-icon').removeClass('hide');
			$('#current-wind, #current-humidity, #current-pressure, #current-clouds, #country').removeClass('hide');
		}, 300);

		// GET FUTURE FORECAST PREDICTION
		$.post('/api/weather/prediction', {lat: weatherData.coord.lat, lon: weatherData.coord.lon}, function(data) {
			let allWeatherData = JSON.parse(data);
			forecastPrediction(allWeatherData);
		});
	});
}

function addSaturationFilter() {
	$('body').find('*').addClass('desaturated');

	$('.error-message-container').removeClass('desaturated');
	$('#error-message').removeClass('desaturated');
	$('#error-icon').removeClass('desaturated');
	$('#close-error-message').removeClass('desaturated');
}
function removeSaturationFilter() {
	$('body').find('*').removeClass('desaturated');
}

/* ******************** RELOAD WEATHER ****************** */
function reloadButton() {
	getWeather('/api/weather/latlon', {lat: mymap.getCenter().lat, lon: mymap.getCenter().lon});
	$('.error-message-container').removeClass('slide-right');
	removeSaturationFilter();

	$('#reload-button').addClass('reload-rotate-360');
	setTimeout(function() {
		$('#reload-button').css('transition', 'all 0s');
		$('#reload-button').removeClass('reload-rotate-360');
		setTimeout(function() {
			$('#reload-button').css('transition', 'all 1s');
		}, 100);
		
	}, 1000);
}

/* ******************** SEARCH WEATHER ****************** */
function searchWeather() {
	searchIconRotate();
	mapZoom = true;
	getWeather('/api/weather/city', {city: $('#search-city').val()});
}
function searchIconRotate() {
	$('#search-icon').addClass('rotate-90');
	setTimeout(function() {
		$('#search-icon').removeClass('rotate-90');
	}, 300);
}

/* *************** GEOLOCALIZATION ************* */
function getGeoLoc() {
	$.ajax({url: '/api/geoip'}).done(function(data) {
		let geoData = JSON.parse(data);
		if ( geoData.status == 'failed' )
			getWeather('/api/weather/city', {city: 'Madrid,es'});
		else
			getWeather('/api/weather/city', {city: geoData.city.name + ',' + geoData.country.code});
	});
}

/* *************  MAP  ************* */
const bounds = L.latLngBounds(L.latLng(-90, -180), L.latLng(90, 180));
let mymap = L.map('mapid', {
	maxBounds: bounds,
	minZoom: 2,
	maxBoundsViscosity: 1.0
});
let marker = L.marker([0, 0]).addTo(mymap);
function initMap() {
	mymap.setView([0, 0], 12);
	L.tileLayer('https://api.maptiler.com/maps/voyager/256/{z}/{x}/{y}@2x.png?key=DbSxwPmW5xiL5oZ3WKuN').addTo(mymap);

	mymap.on('drag', function() {
		mymap.panInsideBounds(bounds);
	});
	mymap.on('click', function(e) {
		marker.setLatLng(e.latlng);
		getWeather('/api/weather/latlon', {lat:e.latlng.lat, lon: e.latlng.lng});
		changeMapView(e.latlng.lat, e.latlng.lng);
	});	
}

function changeMapView(lat, lon) {
	if ( mapZoom ) {
		mymap.setView([lat, lon], 13);
		mapZoom = !mapZoom;
	} else
		mymap.setView([lat, lon]);

	marker.setLatLng([lat, lon]);
}

/******************** COUNTRY INFO *******************/
function getCountryInfo(countryIso2) {
	getCountryColors(countryIso2);

	$.post('/api/country', {iso2: countryIso2}).done(function(data) {
		let countryInfo = JSON.parse(data);

		$('#country-name').text(capitalize.capitalCase(countrySwitch.ISO2toName(countryIso2)));
		$('#native-country-name').text(countryInfo.nativeName);

		$('#region-text').text(countryInfo.region);
		$('#country-subregion').text(countryInfo.subregion);
		$('#capital-text').text(countryInfo.capital);
		$('#country-population').text(countryInfo.population.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, '.'));
		$('#country-area').text(countryInfo.area.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, '.') + ' km²');
		$('#country-gini').text(countryInfo.gini + '%');
		$('#country-calling-codes').text('+' + countryInfo.callingCodes.toString());
		$('#country-borders').text(getBorderList(countryInfo.borders));

		setCurrencies(countryInfo.currencies);
		setLanguages(countryInfo.languages);
		getCountryIdicators(countrySwitch.ISO2toISO3(countryIso2));
	});
}

function getCountryColors(countryIso2) {
	let countryName = capitalize.capitalCase(countrySwitch.ISO2toName(countryIso2));

	// Spacial cases
	if ( countryName === 'United States Of America')
		countryName = 'United States';
	else if ( countryName === 'United Kingdom Of Great Britain And Northern Ireland')
		countryName = 'United Kingdom';
	else if ( countryName === 'Brunei Darussalam' )
		countryName = 'Brunei';
	else if ( countryName === 'Congo')
		countryName = 'Republic of the Congo';
	else if ( countryName === 'Iran Islamic Republic Of' )
		countryName = 'Iran';
	else if ( countryName === 'Russian Federation' )
		countryName = 'Russia';
	else if ( countryName === 'Viet Nam' )
		countryName = 'Vietnam';
	else if ( countryName === 'Venezuela Boliletian Republic Of' )
		countryName = 'Venezuela';
	else if ( countryName === 'Macedonia The Former Yugoslav Republic Of' )
		countryName = 'Macedonia';
	else if ( countryName === 'Antigua And Barbuda' )
		countryName = 'Antigua and Barbuda';
	else if ( countryName === 'Syrian Arab Republic')
		countryName = 'Syria';

	let countryList = countryFlagColors.find(f => f.name === countryName);
	let countryColors = ['#1c1427', '#1c1427'];
	if  ( countryList != undefined )
		countryColors = countryList.colors;
	else {
		if ( countryName === 'Macao' )
			countryColors = ['#0F7562', '#FFFFFF', '#FFDE23'];
	}

	for ( let i = 0; i<3; i++ ) { // Normalizing the flag colors
		if ( countryColors[i] == undefined) {
			countryColors[i] = countryColors[i-1];
			countryColors[i-1] = countryColors[i-2];
		}
		if ( countryColors[i].length === 4 ) {
			for ( let j=1; j<4; j++ )
				countryColors[i] += countryColors[i][j];
		}
	}

	$(document).on('scroll', {colors: countryColors}, changeCountryColors);
}

function changeCountryColors(e) {
	const colors = e.data.colors;
	if ( $(document).scrollTop() > 1200 ) {

		$(document).off('scroll', changeCountryColors);

		$('#country-word-1').css('color', colors[0] + 'cc');
		setTimeout(function() {
			$('#country-word-2').css('color', colors[1] + 'cc');
			setTimeout(function() {
				$('#country-word-3').css('color', colors[2] + 'cc');
			},500);
		}, 500);
	}
}

function setCurrencies(currencies) {
	$('body').find('.currencies').remove();

	currencies.forEach(function(elem) {
		let name = elem.name;
		let symbol = elem.symbol;
		if ( name === 'Armenian dram' )
			symbol = '֏';
		else if ( name === 'Turkish lira' )
			symbol = '₺';
		else if ( name === 'Azerbaijani manat' )
			symbol = '₼';
		else if ( name === 'Kazakhstani tenge' )
			symbol = '₸';
		else if ( name === "Uzbekistani so'm" )
			symbol = 'сум';
		else if ( name == 'Sri Lankan rupee' )
			symbol = 'ரூ';
		else if ( name == 'Bosnia and Herzegovina convertible mark' )
			symbol = 'КМ';
		
		$('<div class="currencies"><span class="currency-symbol">' + 
		symbol + '</span><span class="currency-name">(' + name + ')</span></div>').
		appendTo('.currencies-container');
	});
}

function setLanguages(languages) {
	$('body').find('.languages').remove();

	for ( let i=0; i<languages.length && i<4; i++ ) {
		if ( i == 3 ) {
			$('<div class="languages"><span class="language-name">...</span></div>').appendTo('.languages-container');
		} else {
			$('<div class="languages"><span class="language-name">' + 
			languages[i].name + '</span><span class="language-native">(' + languages[i].nativeName + ')</span></div>').
			appendTo('.languages-container');
		}
	}					
}

function getBorderList(borders) {
	let borderStr = '';
	for ( let i=0; i<4 && i<borders.length; i++ ) {
		if ( i == 3 ) 
			borderStr += '...';
		else { 
			if ( i == borders.length-1 ) 
				borderStr += borders[i];
			else 
				borderStr += borders[i] + ', ';
		}
	}
	return borderStr;
}

/***************** COUNTRY INDICATORS *********************/
let indicatorCharts = [];

function getCountryIdicators(countryIso3) {
	let iso3; // Determine the country to compare with 
	if ( countryIso3 == clientCountry )
		iso3 = (countryIso3 == 'USA') ? countryIso3+';DEU' : countryIso3+';USA';
	else 
		iso3 = countryIso3+';'+clientCountry;

	$('.indicators-title').text('Country Indicators (Compared with '+ capitalize.capitalCase(countrySwitch.ISO3toName(iso3.slice(4))) + ')');

	$.when($.post('/api/worldbank/climate', {var: 'tas', iso3: countryIso3}), $.post('/api/worldbank/climate', {var: 'pr', iso3: countryIso3}),
	$.post('/api/worldbank/indicators', {iso3: iso3})).done(function(data, data2, data3) {

		//Country indicators data parse
		let indicators = [];
		data3[0].forEach((arr) => indicators.push(JSON.parse(arr)));

		indicators.forEach(function(arr, i) {
			// One array of data for each country (the API returns the country's data in alphabetical order)
			let obj = {country1: iso3.slice(0,3), country2: iso3.slice(4), value1: [], value2: [], date: [], id: arr[1][0].indicator.value};
			arr[1].forEach(function(item) { 
				if ( item.countryiso3code == countryIso3 || item.country.id == countryIso3 ) {
					obj.date.push(item.date);
					obj.value1.push(item.value); 
				} else
					obj.value2.push(item.value);
			});

			indicators[i] = obj;
		});

		//Decade temp chart data parse
		let decadeTemp = JSON.parse(data[0]);
		decadeTemp = decadeTemp.map((item) => item.data);
		let decadePr = JSON.parse(data2[0]);
		decadePr = decadePr.map((item) => item.data);

		indicatorCharts.forEach((chart) => chart.destroy()); //Destroying the previous charts
		indicatorCharts = [];

		$(document).on('scroll', {indicators: indicators, decadeTemp: decadeTemp, decadePr: decadePr}, drawAllCharts);
		
	});
}
function drawAllCharts(e) {
	if ( $(document).scrollTop() > 2200 ) {

		$(document).off('scroll', drawAllCharts);

		let fontSize = 14; // Managing the responsive size of the chart
		let borderWidth = 3;
		if ( $(window).width() <= 550 ) {
			fontSize = 10;
			borderWidth = 2;
		}
		
		drawIndicatorsCharts({
			indicator: e.data.indicators[0], label: 'Political Stability and Absence of Violence',
			id: 'violence-indicator', max: 2.5, min: -2.5, chartType: 'line', color: '#d44000', delay: 1000, 
			size: {fontSize: fontSize, borderWidth: borderWidth}
		});
		drawIndicatorsCharts({
			indicator: e.data.indicators[1], label: 'Ease of doing business',
			id: 'business-indicator', max: 100, min: NaN, chartType: 'line', color: '#267c5e', delay: 1200, 
			size: {fontSize: fontSize, borderWidth: borderWidth}
		});
		drawIndicatorsCharts({
			indicator: e.data.indicators[2], label: e.data.indicators[2].id,
			id: 'gdp-indicator', max: NaN, min: NaN, chartType: 'bar', color: '#7b113a', delay: 1500, 
			size: {fontSize: fontSize, borderWidth: borderWidth}
		});
		drawIndicatorsCharts({
			indicator: e.data.indicators[3], label: e.data.indicators[3].id,
			id: 'electricity-indicator', max: 100, min: NaN, chartType: 'line', color: '#536162', delay: 2000, 
			size: {fontSize: fontSize, borderWidth: borderWidth}
		});
		createTempChart(e.data.decadeTemp, e.data.decadePr, {fontSize: fontSize, borderWidth: borderWidth});

		$('body').find('.indicators-charts').removeClass('hide');
	}
}

/*********************** DECADE TEMP CHART ********************/
function createTempChart(decadeTemp, decadePr, size) {
	let delayed = false;
	let ctx = document.getElementById('decade-temp-chart').getContext('2d');
	decadeTempChart = new Chart(ctx, {
		type: 'line',
		data: {
			labels: ['1900-1910', '1910-1920', '1920-1930', '1930-1940', '1940-1950', '1950-1960', '1960-1970',
					'1970-1980', '1980-1990', '1990-2000', '2000-2010', '2010-2020'],
			datasets: [{
				yAxisID: 'y-axis-1',
				label: 'Temperature',
				data: decadeTemp,

				borderColor: '#cc3232',
				borderWidth: size.borderWidth,
				backgroundColor: '#cc323255',

				pointHitRadius: 2,
				pointBorderWidth: 1,
				pointHoverRadius: 5,
				pointRadius: 3,
				pointStyle: 'circle',

				tension: 0.4
			}, {
				yAxisID: 'y-axis-2',
				label: 'Precipitation',
				data: decadePr,

				borderColor: '#2a6970',
				backgroundColor: '#2a697055',
				borderWidth: size.borderWidth,

				pointHitRadius: 2,
				pointBorderWidth: 1,
				pointHoverRadius: 5,
				pointRadius: 3,
				pointStyle: 'circle',

				tension: 0.4
			}]
		},
		options: {
			maintainAspectRatio: false,
			responsive: true,

			plugins: {
				title: {
					display: true,
					text: 'Decade precipitation and temperature average',
					color: '#1c1427',
					font: {
						size: size.fontSize + 3,
						family: 'San Francisco',
					},
					padding: {
						bottom: 20
					}
				},
				legend: {
					labels: {
						font: {
							size: size.fontSize,
							family: 'San Francisco',
							weight: '400'
						}
					}
				},
			},
			transitions: {
				show: { animations: { y: { from: 0 } } },
				hide: { animations: { y: { to: 10 } } },
			},
			animation: {
				onComplete: () => {
					delayed = true;
				},
				delay: (context) => {
					let delay = 0;
					if (context.type === 'data' && context.mode === 'default' && !delayed) {
						delay = context.dataIndex * 200 + context.datasetIndex * 200 + 2500;
					}
					return delay;
				},
			},
			scales: {
				'y-axis-1': {
					display: true,
					position: 'left',
					grid: {
						lineWidth: 1,
						borderColor: 'rgba(0, 0, 0, 0.26)'
					},
					ticks: {
						color: '#1c1427',
						font: {
							family: 'San Francisco',
							size: size.fontSize,
							weight: '500'
						}
					},
					title: {
						display: true,
						text: 'Temperature [°C]',
						color: '#1c1427',
						font: {
							size: size.fontSize + 1,
							family: 'San Francisco',
							weight: '500'
						}
					}
				},
				'y-axis-2': {
					display: true,
					position: 'right',
					grid: {
						drawOnChartArea: false,
					},
					ticks: {
						color: '#1c1427',
						font: {
							size: size.fontSize,
							family: 'San Francisco',
							weight: '500'
						}	
					},
					title: {
						display: true,
						text: 'Precipitations [mm]',
						color: '#1c1427',
						font: {
							size: size.fontSize,
							family: 'San Francisco',
							weight: '500'
						}
					}
				},					
				x: {
					grid: {
						lineWidth: 1,
						display: true,
						color: 'rgba(0, 0, 0, 0.26)'
					},
					ticks: {
						color: '#1c1427',
						font: {
							size: size.fontSize,
							family: 'San Francisco',
							weight: '500'
						}
					}
				}
			},
		}
	});

	indicatorCharts.push(decadeTempChart);
}

/****************** INDICATORS CHARTS **************************/
function drawIndicatorsCharts(obj) {
	let ctx = document.getElementById(obj.id).getContext('2d');
	let delayed = false;
	let indicatorChart = new Chart(ctx, {
		type: obj.chartType,
		data: {
			labels: obj.indicator.date.reverse(),
			datasets: [{
				label: obj.indicator.country1,
				data: obj.indicator.value1.reverse(),
				borderColor: obj.color,
				backgroundColor: obj.color+'55',
				borderWidth: obj.size.borderWidth,

				pointHitRadius: 2,
				pointBorderWidth: 1,
				pointHoverRadius: 5,
				pointRadius: 3,
				pointStyle: 'circle',

				tension: 0.4
			}, {
				label: obj.indicator.country2,
				data: obj.indicator.value2.reverse(),
				borderColor: '#28527a',
				backgroundColor: '#28527a55',
				borderWidth: obj.size.borderWidth,

				pointHitRadius: 2,
				pointBorderWidth: 1,
				pointHoverRadius: 5,
				pointRadius: 3,
				pointStyle: 'circle',

				tension: 0.4
			}],
		},
		options: {
			maintainAspectRatio: false,
			responsive: true,

			plugins: {
				title: {
					display: true,
					text: obj.label,
					color: '#1c1427',
					font: {
						size: obj.size.fontSize + 3,
						family: 'San Francisco',
					},
					padding: {
						bottom: 20
					}
				},
				legend: {
					labels: {
						font: {
							size: obj.size.fontSize,
							family: 'San Francisco',
							weight: '400'
						}
					}
				}
			},
			animation: {
				onComplete: () => {
					delayed = true;
				},
				delay: (context) => {
					let delay = 0;
					if (!delayed) {
						delay = context.dataIndex * 200 + obj.delay;
					}
					return delay;
				},
			},
			transitions: {
				show: { animations: { y: { from: 0 } } },
				hide: { animations: { y: { to: 10 } } },
			},
			scales: {
				y: {
					// suggestedMax: obj.max,
					// suggestedMin: obj.min,
					type: 'linear',
					display: true,
					position: 'left',
					grid: {
						lineWidth: 1,
						borderColor: 'rgba(0, 0, 0, 0.26)'
					},
					ticks: {
						color: '#1c1427',
						font: {	
							size: obj.size.fontSize,
							family: 'San Francisco',
							weight: '500'
						}
					},
					title: {
						display: false,
						font: {
							color: '#1c1427',
							style: 'bold',
							family: 'San Francisco',
						}
					}
				},			
				x: {
					grid: {
						lineWidth: 1,
						display: true,
						color: 'rgba(0, 0, 0, 0.26)'
					},
					ticks: {
						color: '#1c1427',
						font: {
							family: 'San Francisco',
							size: obj.size.fontSize,
							weight: '500'
						}
					}
				}
			}
		}
	});

	indicatorCharts.push(indicatorChart);
}

/********************** CLOCK *********************/ 
let interval;
function startClock(timezone) {
	clearTimeout(interval);

	if ( timezone !== undefined ) {
		interval = setInterval(function() {
			let d = new Date();
			let utc = d.getTime() + (d.getTimezoneOffset() * 60000);
			let nd = new Date(utc + timezone * 1000);
			$('#current-country-hour').text(nd.toTimeString().slice(0, 5));
			$('#current-country-seconds').text(nd.toTimeString().slice(5, 8));
		}, 1000);

	} else
		$('#current-country-hour').text('00:00');
}

/**************** FORECAST PREDICTION ****************/
function forecastPrediction(allWeatherData) {
	$('body').find('.hourly-forecast').remove();
	$('body').find('.hourly-dashed-vr').remove();
	
	let tempArr = [];
	for ( let i=1; i<=allWeatherData.hourly.length/2; i=i+2 ) { //First 12 hours
		let hElem = allWeatherData.hourly[i];
		let descr = hElem.weather[0].description.split(' ');
		tempArr.push(hElem.temp); // Creating an array of temps to draw the chart

		$('<div class="hourly-forecast"><span class="hourly-forecast-hour">' + 
		new Date(hElem.dt*1000 + (allWeatherData.timezone_offset-3600*2)*1000).toTimeString().slice(0,2) +
		'h</span><span class="hourly-forecast-description">' + capitalize.capitalCase(descr[0]) +
		'</span><span class="hourly-forecast-description">' + descr[1] +
		'</span><div><span class="hourly-forecast-temp">' + Math.round(hElem.temp) + '</span><span>°C</span></div>' + 
		'<span class="hourly-forecast-details-titles">Feels like: </span><span class="hourly-forecast-details-data">' +
		Math.round(hElem.feels_like) + '°C</span><div><span class="hourly-forecast-details-titles">Rain prob: </span>' +
		'<span class="hourly-forecast-details-data">' + parseInt(hElem.pop*100) + 
		'%</div></span><span class="hourly-forecast-details-titles">Clouds: </span><span class="hourly-forecast-details-data">' + 
		hElem.clouds + '%</span></div><div class="hourly-dashed-vr"></div>').appendTo('.hourly-forecast-container');
	}
	$('.hourly-forecast-container .hourly-dashed-vr').last().remove(); // Removing the last vr
	initHourlyTempChart(tempArr);

	$('body').find('.daily-forecast').remove();
	let precipitationArr = [];
	for ( let j=1; j<allWeatherData.daily.length; j++ ) {
		let dElem = allWeatherData.daily[j];
		precipitationArr.push(dElem.pop*100);

		$('<div class="daily-forecast"><span class="daily-forecast-day">' + 
		new Date(dElem.dt*1000 + (allWeatherData.timezone_offset-3600*2)*1000).toDateString().slice(0,10) + '</span>' +
		'<img src="assets/images/' + dElem.weather[0].icon + '.svg" alt="Forecast Icon" class="daily-forecast-icon">' +
		'<span class="daily-forecast-description">' + capitalize.capitalCase(dElem.weather[0].main) + '</span>' +
		'<span class="daily-forecast-temp">' + dElem.temp.day + '°C</span><div class="daily-prob-container">' +
		'<img class="water-drop" src="assets/images/water-drop.svg" alt="Water Drop Icon">' +
		'<span class="daily-forecast-pop">' + parseInt(dElem.pop*100) + '%</span></div>' +
		'<canvas class="precipitation-chart" id="precipitation-chart-' + j + '">Your browser does not support the canvas element.</canvas></div>')
		.appendTo('.daily-forecast-container');
	}
	$('.daily-forecast-day').first().text('Tomorrow');
	initPrecipitationCharts(precipitationArr);
}

let hourlyTempChart = null;
function initHourlyTempChart(tempArr) {
	if ( hourlyTempChart !== null )
		hourlyTempChart.destroy();

	$(document).on('scroll', {arr: tempArr}, createHourlyTempChart);
}
function createHourlyTempChart(e) {
	if ( $(document).scrollTop() > 750 ) {

		$(document).off('scroll', createHourlyTempChart);

		let ctx = document.getElementById('hourly-temp-chart').getContext('2d');
		hourlyTempChart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
				datasets: [{
					label: 'Hourly forecast',
					data: e.data.arr,
					borderColor: '#cc323291',

					fill: {
						target: 'origin',
						above: '#cc323231',
						below: '#2769881f'
					},
					pointRadius: 0,
					tension: 0.5,
				}]
			},
			options: {
				maintainAspectRatio: false,
				responsive: true,
				animation: { duration: 2000 },
				plugins: {
					tooltip: { enabled: false },
					legend: { display: false }
				},				
				scales: {
					y: { display: false, beginAtZero: true },
					x: { display: false }
				},
			}
		});
	}
}

let precipitationCharts = [];
function initPrecipitationCharts(precipitationArr) {
	precipitationCharts.forEach((elem) => elem.destroy());
	precipitationCharts = [];

	$(document).on('scroll', {arr: precipitationArr}, createPrecipitationCharts);
}
function createPrecipitationCharts(e) {
	if ( $(document).scrollTop() > 900 ) {

		$(document).off('scroll', createPrecipitationCharts);

		for ( let i=0; i<e.data.arr.length; i++ ) {
			let prob = e.data.arr[i];

			let ctx = document.getElementById('precipitation-chart-' + (i+1)).getContext('2d');
			let precipitationChart = new Chart(ctx, {
				type: 'line',
				data: {
					labels: [1, 2, 3, 4, 5, 6],
					datasets: [{
						id: 'y',
						label: 'Precipitation probability',
						data: [prob+2, prob, prob+2, prob, prob+2, prob],
						borderColor: '#2a6970c2',
						fill: {
							target: 'origin',
							above: '#2769881f',
						},
						pointRadius: 0,
					}]
				},
				options: {
					maintainAspectRatio: false,
					responsive: true,

					animation: {
						delay: 200*i,
						duration: 2000
					},
					plugins: {
						tooltip: {enabled: false},
						legend: {display: false}
					},
					animations: {
						tension: {
							duration: 1000,
							easing: 'linear',
							from: 0.7,
							to: 0.4,
							loop: true
						  }
					},
					
					scales: {
						y: {
							display: false,
							beginAtZero: true,
							max: 110,
						},
						x: {
							display: false,
						}
					},
				}
			});

			precipitationCharts.push(precipitationChart);
		}
	}
}
