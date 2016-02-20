/**
 * This is the main server-file which serves both an express webserver and a websocket for communication.
 * It also listens for events from the tellstick, and sends commands to it.
 * I know it's a mess, but it's constantly undergoing changes, but a major overhaul and rewrite is due once most of the functionality is there.
 */

/**
 * Dependencies
 */
var mysql 		= require( 'mysql' ),
	clc 		= require( 'cli-color' ),
	telldus 	= require( 'telldus' ),
	exec 		= require( 'child_process' ).exec,
	engine		= require( 'engine.io' ),
	async 		= require( 'async' ),
	date_util 	= require( 'date-util' ),
	util 		= require( 'util' ),
	parser 		= require( 'tellstick-confparser' ),
	schedule 	= require( 'node-schedule' ),
	express 	= require( 'express' );

/**
 * Variables
 */
var	server 		= engine.listen( '1337' ),
	app 		= express(),
	eventCache 	= {},
	error 		= clc.red.bold,
	warn 		= clc.yellow,
	notice 		= clc.blue,
	ok 			= clc.green,
	_devices 	= false,
	_hasChanged = false,
	knowndevices = [],
	timers		= {},
	nightmode	= false,
	awaymode	= false,
	sensorEventListener = false,
	deviceEventListener = false,
	rawEventListener = false;

/**
 * Set jade as our view engine
 */
app.set( 'view engine', 'jade' );


/**
 * Set /public as our path to static assets
 */
app.use( express.static( __dirname + '/public' ) );


/**
 * Index
 */
app.get( '/', function ( req, res ) {
    res.render( 'index' );
});


/**
 * Return our tellstick.conf as JSON
 */
app.get( '/getConfig/', function( req, res ) {
	var config = parser.parseConfigFile( '/etc/tellstick.conf' );
	res.json( config );
});


/**
 * TODO: Save tellstick.conf from json data
 */
 app.get( '/saveConfig/', function( req, res ) {
 	res.json( { message: "TODO..." } );
 });


/**
 * SENSOR DATA
 * Return sensor data (temperature, humidity)
 * Example, get last 24 hour temperature data from sensor #11: /getSensorData/11/temperature/hour/24
 * Example, get last 14 days humidity data from sensors #11, #16 and #32: /getSensorData/11|16|32/humidity/week/14
 */
app.get( '/getSensorData/:deviceid/:type/:interval/:limit', function ( req, res ) {

	var deviceArr = req.params.deviceid.split( '|' );

	async.mapSeries( deviceArr, function( device, callback ) {
		getSensorData( device, req.params.type, req.params.interval, req.params.limit, callback );
	},
	function( err, results ) {
		res.json( results );
	});

});


/**
 * HOME EVENT
 * Will for example be used to turn on the hallway lights when returning home after dark
 */
app.get( '/home', function ( req, res ) {
	res.send( 'Home Event!' );
	server.broadcast( JSON.stringify( { type: 'HomeEvent' } ) );
});


/**
 * AWAY EVENT
 * Turn on all lights when there's nobody home
 */
app.get( '/away', function ( req, res ) {
	res.send( 'AWay Event!' );
	server.broadcast( JSON.stringify( { type: 'AwayEvent' } ) );
});


/**
 * Start the express server on port 3000
 */
var express_server = app.listen( 3000, function() {
	var host = express_server.address().address;
	var port = express_server.address().port;
	log(ok('Home Automation GUI listening at http://%s:%s'), host, port);
});
/**
 * </EXPRESS>
 */


/**
 * Connect to MySQL
 * TODO: Better pooling?
 */
var mysqlConn = mysql.createConnection({
	host: 'localhost',
	user: 'tellstick',
	password: 'tellstick',
	database: 'tellstick_log'
});
mysqlConn.connect();


/**
 * Get all known devices from the database
 */
getKnownDevices();
 

log( clc.reset );
log( ok("Connected to the Tellstick Duo?!") );
log( ok("Waiting for events ...") );


/**
 * Broadcast a message to all connected clients
 */
server.broadcast = function( mssg, id ) {
	for( var key in server.clients ) {
		if(typeof id !== 'undefined') {
			// Don't broadcast to sending client
			if( key == id ) {
				continue;
			}
		}
		server.clients[key].send( mssg );
	}
};


/**
 * Scheduled jobs
 * 
 */
//var jobs = [];
//var job = schedule.scheduleJob('*/1 * * * *', function() {
//	log( 'Logging this every minute' );
//});


/**
 * Wait for websocket connection
 */
server.on( 'connection', function( socket ) {
	
	log( notice( 'New connection received' ) );
	getKnownDevices();

	server.broadcast( JSON.stringify( { type: 'Client connected' } ), socket.id );

	/**
	 * SOCKET MESSAGE
	 */
	socket.on( 'message', function( data ) {

		log( data );

		/**
		 * GET DEVICES
		 */
		if ( data == 'getDevices' ) {

			if ( true ) {

				telldus.getDevices(function( err, devices ) {
					
					if ( err ) {
						log( 'Error: ' + err );
					}
					else {
						_devices = devices;
						_hasChanged = false;
						var message = {
							"type": "devices",
							"data": devices 
						};
						socket.send( JSON.stringify( message ) );
						log( notice('Sent devices to client') );
					}

				});

				var message = {
					"type": "knownDevices",
					"data": knowndevices
				};

				socket.send( JSON.stringify( message ) );
				log( notice('Sent known devices to client') );
			}
			else {
				var message = {
					"type": "devices",
					"data": _devices 
				};
				socket.send( JSON.stringify( message ) );
			}
		}
		/**
		 * PING
		 */
		else if ( data == 'Ping' ) {
			log( 'Just trying to stay alive...' );
		}
		/**
		 * CLOSE
		 */
		else if ( data == 'Close' ) {
			socket.close();
		}
		/**
		 * EVERYTHING ELSE
		 */
		else {

			log( data );

			_hasChanged = true;

			data = JSON.parse( data );

			switch ( data.type ) {
				// AUTHENTICATION
				case 'AUTH':

					break;
				// TURN DEVICE ON
				case 'On':
					log( 'Turning device on' );
					telldus.turnOn( data.deviceID, function( err ) {
						// . . .
					});
					server.broadcast( JSON.stringify({type: 'deviceChanged', device: data.deviceID, status: 'on' }), socket.id );
					break;
				// TURN DEVICE OFF
				case 'Off':
					log( 'Turning device off' );
					telldus.turnOff( data.deviceID, function( err ) {
						// . . .
					});
					server.broadcast( JSON.stringify({type: 'deviceChanged', device: data.deviceID, status: 'off' }), socket.id );
					break;
				// DIM DEVICE
				case 'Dim':
					telldus.dim( data.deviceID, data.dimLevel, function( err ) {
						// . . .
					});
					server.broadcast( JSON.stringify({type: 'deviceChanged', device: data.deviceID, status: 'dimmed', dimLevel: data.dimLevel}), socket.id );
					break;
				// DEVICECHANGE START
				case 'DeviceChangeStart':
					server.broadcast( JSON.stringify({type: 'DeviceChangeStart'}), socket.id );
					break;
				// DEVICECHANGE END
				case 'DeviceChangeEnd':
					server.broadcast( JSON.stringify({type: 'DeviceChangeEnd'}), socket.id );
					break;
				case 'IgnoreEvent':
					ignoreEvent( data.data );
					break;
				case 'ConnectDevice':
					connectDevice( data.data );
					break;
				case 'SaveDevice':
					saveDevice( data.data );
					break;
			}

		}

	});

});

startRawDeviceEventListener();
startSensorEventListener();
startDeviceEventListener();


/**
 * Sensor events
 */
function startSensorEventListener() {
	sensorEventListener = telldus.addSensorEventListener( function( deviceId, protocol, model, type, value, timestamp ) {

		var sensorObject = {
			deviceId: deviceId,
			protocol: protocol,
			model: model,
			type: type,
			value: value,
			timestamp: timestamp
		};

		if ( ! alreadyLogged( sensorObject ) ) {

			server.broadcast( JSON.stringify( { type: 'SensorEvent', object: sensorObject } ) );

			log( notice('New sensor event received: ', deviceId, protocol, model, type, value, timestamp) );

			var currentdate = new Date();
			var logdate = currentdate.getFullYear() + "-" + ( currentdate.getMonth() + 1 )  + "-"  + currentdate.getDate() + " " + currentdate.getHours() + ":" + currentdate.getMinutes() + ":" + currentdate.getSeconds();
			var logdateDay = currentdate.getFullYear() + "-" + ( currentdate.getMonth() + 1 )  + "-"  + currentdate.getDate() + " 00:00:00";

			sensorObject.logdate = logdate;

			mysqlConn.query(
				'INSERT INTO sensordata3 (deviceid, protocol, model, type, value, logdate) VALUES ("' + deviceId + '", "' + protocol + '", "' + model + '", "' + type + '", "' + value + '", "' + logdate + '")',
				function( err, rows ) {
					if( err ) {
						log( error(err) );
					}
					else {
						mysqlConn.query(
							'INSERT INTO sensordata_daily (deviceid, protocol, model, type, value_min, value_max, logdate) VALUES ("' + deviceId + '", "' + protocol + '", "' + model + '", "' + type + '", "' + value + '","' + value + '", "' + logdateDay + '") ON DUPLICATE KEY UPDATE value_min = LEAST(value_min, VALUES(value_min)), value_max = GREATEST(value_max, VALUES(value_max))',
							function( err, rows ) {
								if( err ) {
									log( error(err) );
								}
								else {
									log( notice('Created new daily aggregate data for sensor ' + deviceId) );
								}
							}
						);
					}
				}
			);
		}
		else {
			//log( notice('Skipped duplicate event for Device ' + deviceId + ' as it was recently logged') );
		}

	});
}



/**
 * Most devices seem to send the same event several times which causes a lot of duplicate entries.
 * By checking the timestamp we can skip duplicate events.
 * @param object sensorObjet
 */
 function alreadyLogged( sensorObject, seconds ) {

 	if ( typeof( sensorObject ) !== 'object' ) {
 		var key = sensorObject.replace( / /g, '-' );
 		sensorObject = { timestamp: ( parseInt( Date.now() ) / 1000 ) };
 	}
 	else {
 		var key = '' + sensorObject.deviceId + '-' + sensorObject.protocol + '-' + sensorObject.type;
 	}

	// 15 minutes by default
	if ( typeof( seconds ) == 'undefined' ) {
		seconds = 900;
	}

	if ( typeof( eventCache[ key ] ) !== 'undefined' ) {
		
		if ( eventCache[ key ] == sensorObject.timestamp ) {
			return true;
		}
		else {

			var now = Date.now();
		    var diff = now - ( eventCache[ key ] * 1000 );
		    
		    diff = parseInt( diff / 1000 );

			// Only log every 15 minutes
			if ( diff >= seconds ) {
				eventCache[ key ] = sensorObject.timestamp;
				return false;
			}
			else {
				return true;
			}
		}
	}
	else {
		eventCache[ key ] = sensorObject.timestamp;
		return false;
	}

}

/**
 * Device Events
 */
function startDeviceEventListener() {
	deviceEventListener = telldus.addDeviceEventListener( function( deviceId, status ) {

		/*if ( typeof( server ) !== 'undefined' && ! alreadyLogged ( { "deviceId": deviceId, "protocol": "sensor", "type": "motion" }, 30 ) ) {
			server.broadcast( JSON.stringify( { type: 'DeviceEvent', deviceId: deviceId, status: status } ) );
		}*/

		log( notice( 'Device ' + deviceId + ' is now ' + status.name ) );

		/*if( deviceId == 2 && status.name == 'ON' && !dimmed)  {
			dimmed = true;
			telldus.turnOn(11, function(err) {} );
			telldus.turnOn(12, function(err) {} );
			telldus.turnOn(14, function(err) {} );
		}
		else if( deviceId == 2 && status.name == 'OFF' && dimmed) {
			dimmed = false;
			telldus.turnOff(11, function(err) {} );
			telldus.turnOff(12, function(err) {} );
			telldus.turnOff(14, function(err) {} );
		}*/

	});
}

function getTimer( name ) {
	var found = false;
	for( var key in timers ) {
		if ( (key == name ) && timers[ key ] !== null ) {
			found = true;
			break;
		}
	}
	return found;
}

function removeTimer( name ) {
	if ( typeof( timers[ name ]) !== 'undefined' ) {
		delete timers[ name ];
	}
}


function stopRawDeviceEventListener() {
	telldus.stopEventListener(rawEventListener, function(err) {
		rawEventListener = false;
	});
}

function stopDeviceEventListener() {
	telldus.stopEventListener(deviceEventListener, function(err) {
		deviceEventListener = false;
	});
}

function stopSensorEventListener() {
	telldus.stopEventListener(sensorEventListener, function(err) {
		sensorEventListener = false;
	});
}


/**
 * Raw events
 */
function startRawDeviceEventListener() {

	rawEventListener = telldus.addRawDeviceEventListener( function( controllerId, data ) {

		//log( 'Raw device event: ' + data );
		var deviceObject = parseRawEvent( data );
		var knownDevice = isKnownDevice( deviceObject );

		// Skip temp/humidity sensors as these seem to be detected by the sensor listener above. TODO: Remove the sensor listener and only use the RawDeviceEventListener?
		if ( deviceObject.type == 'temperature' || deviceObject.type == 'temperaturehumidity' ) {
			//
		}
		else {
			if ( typeof( knownDevice) == 'object' ) {

				deviceObject.name = knownDevice.name;
				deviceObject.description = knownDevice.description;

				var related = getRelatedDevices( knownDevice );
				var loggedRelated = false;
				var logged = false;

				/*log( ok( 'Related Devices' ) );
				log( related );*/

				logged = alreadyLogged( deviceObject.name, 2 );

				if ( !logged ) {
					if ( typeof( related ) !== 'undefined' ) {
						for ( var i in related ) {
							loggedRelated = alreadyLogged( related[ i ].name, 10 );
							if ( loggedRelated == true ) {
								break;
							}
						}
					}
				}

				if ( !logged && !loggedRelated ) {
					server.broadcast( JSON.stringify( { type: 'KnownDevice', object: deviceObject } ) );

					if ( deviceObject.name.indexOf( 'Motion' ) > -1 && ( deviceObject.name.indexOf( 'Livingroom' ) > -1 || deviceObject.name.indexOf( 'Hallway' ) > -1 ) ) {

						//log( error('DETECTED MOTION IN THE HALLWAY!') );

						if ( nightmode ) {
							var timerKey = "MotionHallway";

							//log( getTimer( timerKey ) );

							if ( !getTimer( timerKey ) ) {
								telldus.turnOn( 12, function(err) {
								} );
								timers[ timerKey ] = setTimeout( function() {
										telldus.turnOff( 12, function() {
										} );
										removeTimer( timerKey );
								}, 60000 );
							}
							else {
								clearTimeout( timers[ timerKey ] );
								timers[ timerKey ] = setTimeout( function() {
									telldus.turnOff( 12, function() {
									} );
									removeTimer( timerKey );
								}, 60000 );
							}
						}
					
					} 
				}
				else {
					// Already triggered
					//log( notice('Motion already triggered...') );
				}
			}
			else {
				server.broadcast( JSON.stringify( { type: 'Unknown RawDeviceEvent', object: deviceObject } ) );	
			}
		}

	});
}


/*if (protocol == 'arctech' && method == 'bell') {
	exec('say Ring ring');
}*/

/**
 * Turns a rawEvent into a sensorObject
 */
function parseRawEvent( rawEvent ) {
	
	var eventArray = rawEvent.split(';');

	var sensorObject = {};
	var tmp = [];
	var key = false;
	var val = false;

	for( var i in eventArray ) {
		
		tmp = eventArray[i].split(':');
		key = tmp[0];
		val = tmp[1];

		if( key !== '' && val !== '' ) {
			sensorObject[key] = val;
		}
	}

	return sensorObject;

}


/**
 * Return sensor data for the specified device
 * @param  int   	deviceId 		The device ID
 * @param  int   	type     		The device Type (1 = Temperature, 2 = Humidity)
 * @param  string   interval 		The interval (day, hour, halfhour, fifteen, five, minute)
 * @param  int   	limit 			How many log entries to return
 * @param  {Function} callback
 */
function getSensorData( deviceId, type, interval, limit, callback ) {
	
	var query = "";
	var past = false;
	var now = new Date().format('yyyy-mm-dd HH:MM:ss');

	switch ( interval ) {
		case 'day':
			query = "SELECT deviceid, AVG(value_max) AS value, value_min, value_max, DATE_FORMAT(logdate, '%Y-%m-%dT%H:%i') as logdate FROM sensordata_daily";
			break;
		case 'hour':
			query = "SELECT id, deviceid, value, DATE_FORMAT(logdate, '%Y-%m-%dT%H:%i') as logdate FROM sensordata3";
			break;
		case 'halfhour':
			query = "SELECT id, deviceid, value, DATE_FORMAT(logdate, '%Y-%m-%dT%H:%i') as logdate FROM sensordata3";
			break;
		case 'fifteen':
			query = "SELECT id, deviceid, value, DATE_FORMAT(logdate, '%Y-%m-%dT%H:%i') as logdate FROM sensordata3";
			break;
		case 'five':
			query = "SELECT id, deviceid, value, DATE_FORMAT(logdate, '%Y-%m-%dT%H:%i') as logdate FROM sensordata3";
			break;
		case 'minute':
			query = "SELECT id, deviceid, value, DATE_FORMAT(logdate, '%Y-%m-%dT%H:%i') as logdate FROM sensordata3";
			break;
	}

	if ( type === 'temperature' || type == 1 ) {
		query += ' WHERE TYPE = 1';
	}
	else if ( type === 'humidity' || type == 2 ) {
		query += ' WHERE TYPE = 2';
	}

	query += ' AND logdate < "' + now + '"';
	query += ' AND deviceid = ' + deviceId;

	switch ( interval ) {
		case 'day':
			past = new Date().strtotime('-' + limit + ' days').format('yyyy-mm-dd HH:MM:ss');
			query += ' AND logdate >= "' + past + '"';
			query += ' GROUP BY logdate';
			break;
		case 'hour':
			past = new Date().strtotime('-' + limit + ' hours').format('yyyy-mm-dd HH:MM:ss');
			query += ' AND logdate >= "' + past + '"';
			query += ' GROUP BY round(UNIX_TIMESTAMP(logdate) / (60*5*12))';
			break;
		case 'halfhour':
			past = new Date().strtotime('-' + (limit/2) + ' hours').format('yyyy-mm-dd HH:MM:ss'); ;
			query += ' AND logdate >= "' + past + '"';
			query += ' GROUP BY round(UNIX_TIMESTAMP(logdate) / (60*5*6))';
			break;
		case 'fifteen':
			past = new Date().strtotime('-' + (limit/4) + ' hours').format('yyyy-mm-dd HH:MM:ss');
			query += ' AND logdate >= "' + past + '"';
			query += ' GROUP BY round(UNIX_TIMESTAMP(logdate) / (60*5*3))';
			break;
		case 'five':
			past = new Date().strtotime('-' + (limit*5) + ' minutes').format('yyyy-mm-dd HH:MM:ss');
			query += ' AND logdate >= "' + past + '"';
			query += ' GROUP BY round(UNIX_TIMESTAMP(logdate) / (60*5))';
			break;
		case 'minute':
			past = new Date().strtotime('-' + limit + ' minutes').format('yyyy-mm-dd HH:MM:ss');
			query += ' AND logdate >= "' + past + '"';
			query += ' GROUP BY round(UNIX_TIMESTAMP(logdate) / (60))';
			break;
	}

	query += ' ORDER BY logdate DESC';
	query += ' LIMIT ' + limit;

	mysqlConn.query(
		query,
		function( err, rows ) {
			if( err ) {
				log( err );
			}
			else {

				var values = [];
				var labels = [];
				var raw = [];

				for( var i in rows ) {
					if( interval === 'day' ) {
						values.push( parseInt( rows[ i ].value_min ), parseInt( rows[ i ].value_max ) );	
					}
					else {
						values.push( parseInt( rows[ i ].value ) );
					}
					labels.push( rows[ i ].logdate );

					if( interval === 'day' ) {
						raw.push( [rows[ i ].logdate, parseInt( rows[ i ].value_min ), parseInt( rows[ i ].value_max ) ] );	
					}
					else {
						raw.push( [rows[ i ].logdate, parseInt( rows[ i ].value ) ] );
					}
				}

				values = values.reverse();
				labels = labels.reverse();
				raw = raw.reverse();
				
				callback(null, raw);

			}
		}
	);
}

/**
 * SQL to manually aggregate daily sensor data
 *
INSERT INTO sensordata_daily (deviceid, protocol, model, type, logdate, value_min, value_max )
SELECT deviceid, protocol, model, type, logdate, 
	max(value) AS max, 
	min(value) AS min 
FROM sensordata3 
WHERE 
	type = 2
	AND logdate > '2015-12-00 00:00:00'
	AND logdate < '2015-12-26 00:00:00'
	AND deviceid != 0 AND deviceid != 1 AND deviceid != 2 AND deviceid != 4 AND deviceid != 5
	 AND deviceid != 9
AND value != 0.0
AND value < 100
AND value > -100
GROUP BY deviceid, round(UNIX_TIMESTAMP(logdate) / (60*5*12*24));
*/

function getRelatedDevices( device ) {

	var devices = [];

	// Is this a child? Find all siblings and its parent
	if ( typeof( device.parent_device ) !== 'undefined' ) {
		// Get parent & siblings
		devices = knowndevices.filter( function( obj ) {
			if ( ( ( typeof( obj.parent_device ) !== 'undefined' && obj.parent_device == device.parent_device ) && obj.deviceid !== device.deviceid ) || obj.deviceid == device.parent_device ) {
				return true;
			}
			else {
				return false;
			}
		});
	}
	else {
		// Get children
		devices = knowndevices.filter( function( obj ) {
			if ( typeof( obj.parent_device ) !== 'undefined' && obj.parent_device == device.deviceid ) {
				return true;
			}
			else {
				return false;
			}
		});
	}

	return devices;

}



function getKnownDevices() {

	var columns = [ 'name', 'description', 'model', 'protocol', 'house', 'unit', 'code', 'deviceid' ];

	mysqlConn.query(
		"SELECT id as deviceid, parent_device, deviceid AS id, name, description, model, protocol, house, unit, code FROM knowndevices",
		function( err, rows ) {
			if( err ) {
				log( err );
			}
			else {

				knowndevices = [];
				var tmpdevices =  [];

				for( var i in rows ) {

					var row = rows[i];
					var tmpObj = {};

					tmpObj.deviceid = row.deviceid;

					if( typeof( row.parent_device ) !== 'undefined' && row.parent_device !== null ) {
						tmpObj.parent_device = row.parent_device;
					}					

					if( typeof( row.name ) !== 'undefined' && row.name !== null ) {
						tmpObj.name = row.name;
					}

					if( typeof( row.description ) !== 'undefined' && row.description !== null ) {
						tmpObj.description = row.description;
					}

					if( typeof( row.model ) !== 'undefined' && row.model !== null ) {
						tmpObj.model = row.model;
					}

					if( typeof( row.protocol ) !== 'undefied' && row.protocol !== null ) {
						tmpObj.protocol = row.protocol;
					}

					if( typeof( row.house ) !== 'undefined' && row.house !== null ) {
						tmpObj.house = row.house;
					}

					if( typeof( row.unit ) !== 'undefined' && row.unit !== null ) {
						tmpObj.unit = row.unit;
					}

					if( typeof( row.code ) !== 'undefined' && row.code !== null ) {
						tmpObj.code = row.code;
					}

					if( typeof( row.id ) !== 'undefined' && row.id !== null ) {
						tmpObj.id = row.id;
					}

					tmpdevices.push( tmpObj );
				}

				knowndevices = tmpdevices;

			}
		}
	);
}

function isKnownDevice( device ) {

	var columns = [ 'model', 'protocol', 'house', 'unit', 'code', 'deviceid' ];

	for( var i in knowndevices ) {
		
		var knownDevice = knowndevices[ i ];
		var found = true;
		var property = '';
		
		for( var n in columns ) {

			property = columns[ n ];

			if ( device.hasOwnProperty( property ) ) {

				if( typeof( knownDevice[ property ] ) == 'undefined' || device[ property ].toString() !== knownDevice[ property ].toString() ) {
					found = false;
				}
			}
		}
		if( found ) {
			return knownDevice;
		}
	}

	return false;

}


function ignoreEvent( data ) {

	var query = "INSERT INTO ignoreddevices (";
	var values = "(";

	if( typeof( data.model ) !== 'undefined' && data.model !== null ) {
		query += "model, "
		values += '"' + data.model + '", ';
	}

	if( typeof( data.protocol ) !== 'undefined' && data.protocol !== null ) {
		query += "protocol, ";
		values += '"' + data.protocol + '", ';
	}

	if( typeof( data.house ) !== 'undefined' && data.house !== null ) {
		query += "house, ";
		values += '"' + data.house + '", ';
	}

	if( typeof( data.unit ) !== 'undefined' && data.unit !== null ) {
		query += "unit, ";
		values += '"' + data.unit + '", ';
	}

	if( typeof( data.code ) !== 'undefined' && data.code !== null ) {
		query += "code, ";
		values += '"' + data.code + '", ';
	}

	if( typeof( data.id ) !== 'undefined' && data.id !== null ) {
		query += "deviceid, ";
		values += '"' + data.id + '", ';
	}

	values += ')';

	// Remove trailing comma
	values = values.replace( ', )', ')' );

	query += ') VALUES ' + values;
	
	// Remove trailing comma
	query = query.replace(', )', ')');

	mysqlConn.query(
		query,
		function( err, rows ) {
			if( err ) {
				log( err );
			}
			else {
				log( 'Added event/device to ignore table' );
			}
		}
	);

}

function connectDevice( data ) {

	var query = "INSERT INTO knowndevices (";
	var values = "(";

	if( typeof( data.parent_device ) !== 'undefined' && data.parent_device !== null ) {
		query += "parent_device, "
		values += '"' + data.parent_device + '", ';
	}

	if( typeof( data.name ) !== 'undefined' && data.name !== null ) {
		query += "name, "
		values += '"' + data.name + '", ';
	}

	if( typeof( data.model ) !== 'undefined' && data.model !== null ) {
		query += "model, "
		values += '"' + data.model + '", ';
	}

	if( typeof( data.protocol ) !== 'undefined' && data.protocol !== null ) {
		query += "protocol, ";
		values += '"' + data.protocol + '", ';
	}

	if( typeof( data.house ) !== 'undefined' && data.house !== null ) {
		query += "house, ";
		values += '"' + data.house + '", ';
	}

	if( typeof( data.unit ) !== 'undefined' && data.unit !== null ) {
		query += "unit, ";
		values += '"' + data.unit + '", ';
	}

	if( typeof( data.code ) !== 'undefined' && data.code !== null ) {
		query += "code, ";
		values += '"' + data.code + '", ';
	}

	if( typeof( data.id ) !== 'undefined' && data.id !== null ) {
		query += "deviceid, ";
		values += '"' + data.id + '", ';
	}

	values += ')';

	// Remove trailing comma
	values = values.replace( ', )', ')' );

	query += ') VALUES ' + values;
	
	// Remove trailing comma
	query = query.replace(', )', ')');

	mysqlConn.query(
		query,
		function( err, rows ) {
			if( err ) {
				log( err );
			}
			else {
				log( 'Connected device to parent device' );
				//knowndevices.push( data );
				getKnownDevices();
				server.broadcast( JSON.stringify( { type: 'Updated knowndevices', data: data } ) );
			}
		}
	);

}



function saveDevice( data ) {

	var query = "INSERT INTO knowndevices (";
	var values = "(";

	if( typeof( data.name ) !== 'undefined' && data.name !== null ) {
		query += "name, "
		values += '"' + data.name + '", ';
	}

	if( typeof( data.model ) !== 'undefined' && data.model !== null ) {
		query += "model, "
		values += '"' + data.model + '", ';
	}

	if( typeof( data.protocol ) !== 'undefined' && data.protocol !== null ) {
		query += "protocol, ";
		values += '"' + data.protocol + '", ';
	}

	if( typeof( data.house ) !== 'undefined' && data.house !== null ) {
		query += "house, ";
		values += '"' + data.house + '", ';
	}

	if( typeof( data.unit ) !== 'undefined' && data.unit !== null ) {
		query += "unit, ";
		values += '"' + data.unit + '", ';
	}

	if( typeof( data.code ) !== 'undefined' && data.code !== null ) {
		query += "code, ";
		values += '"' + data.code + '", ';
	}

	if( typeof( data.id ) !== 'undefined' && data.id !== null ) {
		query += "deviceid, ";
		values += '"' + data.id + '", ';
	}

	values += ')';

	// Remove trailing comma
	values = values.replace( ', )', ')' );

	query += ') VALUES ' + values;
	
	// Remove trailing comma
	query = query.replace(', )', ')');

	mysqlConn.query(
		query,
		function( err, rows ) {
			if( err ) {
				log( err );
			}
			else {
				log( 'Saved device ' + data.name );
				//knowndevices.push( data );
				getKnownDevices();
				server.broadcast( JSON.stringify( { type: 'Updated knowndevices', data: data } ) );
			}
		}
	);

}


function log( message ) {

	if( typeof( message ) == 'undefined' ) {
		return false;
	}

	var curdate = new Date();
	var lgdate = curdate.getFullYear() + "-" + ( curdate.getMonth() + 1 )  + "-"  + curdate.getDate() + " " + curdate.getHours() + ":" + curdate.getMinutes() + ":" + curdate.getSeconds();

	console.log( lgdate + "\t::\t" + message );

}