var deviceTpl = $( '#deviceTpl' ).html(),
	deviceTplSwitch = $( '#deviceTplSwitch' ).html(),
	socket = false,
	_rooms = false,
	DEBUG = false,
	knowndevices = [];

Mustache.parse( deviceTpl );

$( document ).ready( function() {

	// Start her up!
	init();

	// Auth form
	$( '#Auth form' ).on('submit', function( event ) {
		
		event.preventDefault();

		if ( $( this ).find( '#PWD' ).val() == '1234' ) {
			$( this ).parent().fadeOut( function() {
				$('body').removeClass('Blurred');	
			});
		}

	});

	document.addEventListener( "visibilitychange", handleVisibilityChange, false );

	$( document ).on( 'click', '.Log .Entry .Device', function( e ) {
	    $( this ).parent().toggleClass( 'Active' );
	});

});


/**
 * handleVisibilityChange
 * @return void
 */
function handleVisibilityChange() {
	if ( document.hidden ) {
		//socket.send( 'Close' );
		//socket.close();
		socket.send( JSON.stringify( { message: "Hidden" } ) );
	}
	else {
		//document.location.href = document.location;
		//init();
		socket.send( JSON.stringify( { message: "Visible!" } ) );
	}
}


/**
 * updateRoomLight
 * @param  string room
 * @return bool
 */
function updateRoomLight( room ) {
	if ( getRoomLightStatus( room ) === 'Off' ) {
		$('.Planrit').removeClass( room );
		return false;
	}
	else {
		$('.Planrit').addClass( room );
		return true;
	}
}


/**
 * getDevicesByRoom
 * @param  string room
 * @return array
 */
function getDevicesByRoom( room ) {

	var devices = _rooms[room].devices;
	return devices;
}


/**
 * getRoomLightStatus
 * @param  string room
 * @return string
 */
function getRoomLightStatus( room ) {

	var devices = getDevicesByRoom( room );
	var status = 'Off';
	
	for ( var i in devices ) {

		if ( typeof( devices[i].status ) === 'object' ) {
			if ( devices[i].status.name == 'ON' ) {
				status = 'Light';
			}
			else if( devices[i].status.name == 'DIM' && devices[i].status.level !== 0 ) {
				status = 'Light';
			}
		}
		else if ( devices[i].status == 'DIM' && devices[i].dimlevel !== 0 ) {
			status = 'Light';
		}
	}

	return status;
}


/**
 * [getRoomLightValue description]
 * @param  string room
 * @return int
 */
function getRoomLightValue( room ) {

	var devices = getDevicesByRoom( room );
	var status = 0;
	
	for ( var i in devices ) {

		if ( typeof( devices[ i ].status ) === 'object' ) {
			if ( devices[ i ].status.name == 'ON' ) {
				status = 'Light';
			}
			else if( devices[ i ].status.name == 'DIM' && devices[ i ].status.level !== 0 ) {
				status = devices[ i ].status.level;
			}
		}
		else if ( devices[ i ].status == 'DIM' && devices[ i ].dimlevel !== 0 ) {
			status = devices[ i ].dimlevel;
		}
	}

	return dimLevelToPercentage( status );
}


/**
 * [updatePlanRit description]
 * @return void
 */
function updatePlanRit() {

	$('.Planrit').removeClass().addClass('Planrit');

	console.log( 'updatePlanRit' );

	for ( var r in _rooms ) {	

		if ( getRoomLightStatus( _rooms[r].name ) === 'Light' ) {
			
			if ( ! $( '.Planrit' ).is( '.' + _rooms[r].name ) ) {
				$( '.Planrit' ).addClass( _rooms[r].name );
				$( '.Planrit' ).addClass( _rooms[r].name + getRoomLightValue( _rooms[r].name ) );
			}
			else {
				$( '.Planrit' ).removeClass( _rooms[r].name );
			}

		}
	}

}

/**
 * [findDeviceRoom description]
 * @param  int deviceI
 * @return string
 */
function findDeviceRoom( deviceId ) {

	var room = false;

	for ( var r in _rooms ) {
		for ( var i in _rooms[r].devices ) {
			if ( _rooms[r].devices[i].id === deviceId ) {
				room = _rooms[r].name;
				break;
			}
		}
		if ( room !== false ) {
			break;
		}
	}

	return room;

}


/**
 * [updateDeviceStatus description]
 * @param  int id
 * @param  string status
 * @param  int level
 * @return boolean
 */
function updateDeviceStatus( id, status, level ) {

	var devicePos = false;
	var room = findDeviceRoom( id );

	if ( typeof( room ) !== 'undefined' ) {

		for ( var i in _rooms[ room ].devices ) {
			if ( _rooms[ room ].devices[ i ].id == id ) {
				devicePos = i;
			}
		}

		if ( devicePos !== false ) {
			if ( typeof( level ) !== 'undefined' ) {
				_rooms[ room ].devices[ devicePos ].dimlevel = level;
				_rooms[ room ].devices[ devicePos ].status = 'DIM';
			}
			else {
				_rooms[ room ].devices[ devicePos ].status = status;
				_rooms[ room ].devices[ devicePos ].dimlevel = 0;
			}
		}
		else {
			return false;
		}
	}
	else {
		return false;
	}

}


/**
 * INIT
 */
function init() {
	
	socket = eio( 'ws://www.fkinnovation.se:1337' );
	
	socket.on( 'open', function() {

		// Now that we've got a socket open we can send stuff to the server
		$( document ).on( 'click', '.Log .Entry a.Ignore', function( e ) {
		    var data = $( this ).parents('.Entry').data();
		    var object = {};

		    for( var prop in data ) {
		    	object[prop] = data[prop];
		    }

		    var message = {
		    	type: 'IgnoreEvent',
		    	data: object
		    };

		    console.log( message );

		    socket.send( JSON.stringify( message ) );
		});

		$( document ).on( 'change', '.Log .Entry select', function( e ) {
		    
		    var yes = confirm( 'Are you sure that you want to connect the unknown device to the selected device?' );

		    if( yes ) {
		    	
		    	var parent_device = $(this).children(":selected").attr("id");
		    	var parent_device_name = $(this).val();

		    	var data = $( this ).parents('.Entry').data();
		    	var object = {};

		    	for( var prop in data ) {
		    		object[prop] = data[prop];
		    	}

		    	object.parent_device = parent_device;
		    	object.name = parent_device_name + ' - Child';

		    	var message = {
		    		type: 'ConnectDevice',
		    		data: object
		    	};

		    	socket.send( JSON.stringify( message ) );
		    }

		});

		$( document ).on( 'click', '.Log .Entry .Save', function( e ) {

			var name = prompt('Name the device:');

			if( name !== null ) {

				var data = $( this ).parents('.Entry').data();
				var object = {};

				for( var prop in data ) {
					object[prop] = data[prop];
				}

				object.name = name;

				console.log(object);

				var message = {
					type: 'SaveDevice',
					data: object
				};

				socket.send( JSON.stringify( message ) );
			}
			else {

			}

		});



		//console.log( 'Opened socket' );

		// Ask for devices
		socket.send( 'getDevices' );
		
		socket.on( 'message', function( data ) { 

			console.log( 'Got message: ', JSON.parse( data ) );
			
			data = JSON.parse( data );

			/** 
			 * DEVICES 
			 */
			if( data.type == 'devices' ) {

				$( '#Tellstick' ).empty();

				window.devices = data.data;

				var rooms = {};

				// Gruppera per rum
				for ( var i_data in data.data ) {

					var device = data.data[i_data];
					var deviceProps = device.name.split( '|' );

					if ( typeof( deviceProps[1] ) !== 'undefined' ) {

						device.name = deviceProps[2];
						device.room = deviceProps[1];
						device.type = deviceProps[0];

						if ( typeof( rooms[deviceProps[1]] ) !== 'undefined' && typeof( rooms[deviceProps[1]].devices ) !== 'undefined' ) {
							rooms[deviceProps[1]].devices.push( device );
						}
						else {
							rooms[deviceProps[1]] = {
								"devices": [
									device
								],
								"name": deviceProps[1]
							};
						}
					}
					else {
						continue;
					}
		

				}

				_rooms = rooms;


				for ( var r in rooms ) {
					
					var devices = '';

					var room = {
						"name": rooms[r].name
					};

					var roomHTML = $('<div class="Room"><h2>' + room.name + '<i class="fa fa-chevron-down"></i></h2></div>');
					var roomLight = false;

					for ( var i in rooms[ r ].devices ) {
						
						var device = rooms[ r ].devices[ i ];
						var html = "";
						var tmpDevice = {
							"name": device.name,
							"id": device.id
						};

						if ( tmpDevice.name.indexOf('Motion') > -1 ) {
							continue;
						}

						var dimmable = $.inArray('DIM', device.methods );

						if ( dimmable > -1 ) {
							tmpDevice.type = 'dimmer';
							tmpDevice.dimlevel = device.status.level;
							tmpDevice.status = device.status.name;
						}
						else {
							tmpDevice.type = 'switch';
							tmpDevice.status = device.status.name;
						}

						if ( tmpDevice.status == 'ON' ) {
							tmpDevice.classes = 'On';
						}
						else if ( tmpDevice.status == 'DIM' ) {
							tmpDevice.classes = 'Dim' + tmpDevice.dimlevel;
						}
						else {
							tmpDevice.classes = 'Off';
						}

						if ( tmpDevice.classes != 'Off' ) {
							roomLight = true;
						}

						if ( tmpDevice.type == 'switch' ) {
							html = Mustache.render( deviceTplSwitch, tmpDevice );
						}
						else {
							html = Mustache.render( deviceTpl, tmpDevice );
						}
						
						devices += html;
					}					

					$( roomHTML ).append( '<div class="Devices">' + devices + '</div>' );

					$('#Tellstick').append( roomHTML );

				}

				updatePlanRit();

				$('.Confirm button.Yes').on('click', function() {

					var devices = $('#Tellstick .Device');
					var i = 0;
					
					for( i = 0; i < $(devices).length; i++ ) {
						var deviceID = $(devices[i]).data('device');
						updateDevice( deviceID, "0" );
					}

				});

				
				$( '.Room' ).each( function() {

					var roomRubrik = $( this ).find( 'h2' );

					if ( typeof( roomRubrik ) !== 'undefined' && $( roomRubrik ).length > 0 ) {
						
						if ( $( roomRubrik ).text() == 'Livingroom' ) {
							$.getJSON( '/getSensorData/11/temperature/hour/1', function( data ) {
								if ( typeof( data[0][0] ) !== 'undefined' ) {
									$( roomRubrik ).append( '<span class="Temp">' + data[0][0][1] + ' °C</span>' );
								}
							});
						}
						else if ( $( roomRubrik ).text() == 'Office' ) {
							$.getJSON( 'getSensorData/12/temperature/hour/1', function( data ) {
								if ( typeof( data[0][0] ) !== 'undefined' ) {
									$( roomRubrik ).append( '<span class="Temp">' + data[0][0][1] + ' °C</span>' );
								}
							});
						}
						else if ( $( roomRubrik ).text() == 'Kitchen' ) {
							$.getJSON( 'getSensorData/135/temperature/hour/1', function( data ) {
								if ( typeof( data[0][0] ) !== 'undefined' ) {
									$( roomRubrik ).append( '<span class="Temp">' + data[0][0][1] + ' °C</span>' );
								}
							});
						}
						else if ( $( roomRubrik ).text() == 'Bathroom' ) {
							$.getJSON( 'getSensorData/121/temperature/hour/1', function( data ) {
								if ( typeof( data[0][0] ) !== 'undefined' ) {
									$( roomRubrik ).append( '<span class="Temp">' + data[0][0][1] + ' °C</span>' );
								}
							});
						}
					}

				});

				createPlanritTemps();

				$( '.Room h2' ).on( 'click', function() {
					$( this ).parent().toggleClass( 'Active' );
				});

				setupSwitches( '.Device .Controls.Switch' );
				setupSliders( '.Device .Controls .Slider' );

			}
			else if ( data.type == 'knownDevices' ) {
				console.log( 'Known devices: ', data.data );
				knowndevices = data.data;
			}
			else if ( data.type == 'deviceChanged' ) {
				

				//$('.Button.Devices .Overlay').velocity('callout.fadepulse');
				
				if ( data.status == 'dimmed' ) {

					Log( '<div class="Entry">Device <span class="Device">#' + data.device + '</span> dimmed to <span class="Status Dimmed">' + dimLevelToPercentage( data.dimLevel ) + '%</span></div>' );

					if ( dimLevelToPercentage( data.dimLevel ) === 0 ) {
						updateDeviceStatus( data.device, 'OFF' );
					}
					else if ( dimLevelToPercentage( data.dimLevel ) == 100 ) {
						updateDeviceStatus( data.device, 'ON' );
					}
					else {
						updateDeviceStatus( data.device, 'DIM', data.dimLevel );
					}
					
					$('[data-device="' + data.device + '"] .Slider').val( dimLevelToPercentage(data.dimLevel) );

				}
				else if ( data.status == 'off' ) {
					updateDeviceStatus( data.device, 'OFF' );
					Log( '<div class="Entry">Device <span class="Device">#' + data.device + '</span> turned <span class="Status Off">Off</span></div>' );
					$( '[data-device="' + data.device + '"] .Slider' ).val( 0 );
				}
				else if ( data.status == 'on' ) {
					updateDeviceStatus( data.device, 'ON' );
					Log( '<div class="Entry">Device <span class="Device">#' + data.device + '</span> turned <span class="Status On">On</span></div>' );
					$( '[data-device="' + data.device + '"] .Slider' ).val( 100 );
				}

				updatePlanRit();

			}
			else if ( data.type == 'DeviceChangeStart' ) {
				$( '#TellstickOverlay' ).fadeIn();
			}
			else if ( data.type == 'DeviceChangeEnd' ) {
				$( '#TellstickOverlay' ).fadeOut();
			}
			/*else if ( data.type == 'SensorEvent' ) {
				if ( data.object.protocol === "temperaturehumidity" && data.object.type === 1 ) {
					Log( '<div class="Entry">Thermometer <span class="Device">#' + data.object.deviceId + '</span> sent <span class="Status Temp">' + data.object.value + ' °C</span></div>' );
				}
			}*/
			/*else if ( data.type == 'DeviceEvent' ) {
				
				// Motion sensor - Office
				if ( data.deviceId == 2 && data.status.name == 'ON' ) {
					
					Log( '<div class="Entry">Motion sensor <span class="Device">Office</span> was <span class="Status">triggered</span></div>' );

					$( '#Office.RitRoom' ).addClass( 'Warn' );
					setTimeout( function() {
						$( '#Office.RitRoom' ).removeClass( 'Warn' );
					}, 2000);
					
				}
			}*/
			else if ( data.type == "KnownDevice" ) {
				var html = '<div class="Entry"><span class="Device">' + data.object.name + '</span> ';

				if( typeof(data.object.id) !== 'undefined' ) {
					html += '<span class="Id">#' + data.object.id + '</span> ';
				}

				if( data.object.model == "temperaturehumidity" ) {
					html += '<span class="Temperature">' + data.object.temp + '°C</span> ';
					html += '<span class="Humidity">' + data.object.humidity + '%</span> ';
				}

				html += '</div>';
				Log( html );
			}
			else if ( data.type == "Updated knowndevices" ) {

				var data_attrs = "";

				for( var key in data.data ) {
					if( key !== 'name' && key !== 'method' && key !== 'parent_device' ) {
						data_attrs += '[data-' + key + '="' + data.data[ key ] + '"]';
					}
				}

				$( data_attrs ).each( function() {
					$( this ).removeClass( 'Unknown' );
					$( this ).find('div').remove();
					$( this ).find('span.Device').text( data.data.name );
				});

			}
			else if ( data.type == "Unknown RawDeviceEvent" ) {

				var htmldata = '';

				if( typeof( data.object.id ) !== 'undefined' ) {
					htmldata += ' data-id="' + data.object.id + '"';
				}

				if( typeof( data.object.protocol ) !== 'undefined' ) {
					htmldata += ' data-protocol="' + data.object.protocol + '"';
				}

				if( typeof( data.object.class ) !== 'undefined' ) {
					htmldata += ' data-class="' + data.object.class + '"';
				}
				
				if( typeof( data.object.model ) !== 'undefined' ) {
					htmldata += ' data-model="' + data.object.model + '"';
				}

				if( typeof( data.object.method ) !== 'undefined' ) {
					htmldata += ' data-method="' + data.object.method + '"';

				}

				if( typeof( data.object.unit ) !== 'undefined' ) {
					htmldata += ' data-unit="' + data.object.unit + '"';
				}

				if( typeof( data.object.house ) !== 'undefined' ) {
					htmldata += ' data-house="' + data.object.house + '"';
				}

				if( typeof( data.object.code ) !== 'undefined' ) {
					htmldata += ' data-code="' + data.object.code + '"';
				}

				var html = '<div class="Entry Unknown"' + htmldata + '><span class="Device">Unknown Device</span><div>';
				
				/*

				*/

				if( typeof( data.object.id ) !== 'undefined' ) {
					html += '<span class="Id">Id: ' + data.object.id + '</span> ';
				}

				if( typeof( data.object.protocol ) !== 'undefined' ) {
					html += '<span class="Protocol">Protocol: ' + data.object.protocol + '</span> ';
				}

				if( typeof( data.object.class ) !== 'undefined' ) {
					html += '<span class="Class">Class: ' + data.object.class + '</span> ';
				}
				
				if( typeof( data.object.model ) !== 'undefined' ) {
					html += '<span class="Model">Model: ' + data.object.model + '</span> ';
				}

				if( typeof( data.object.method ) !== 'undefined' ) {
					html += '<span class="Method">Method: ' + data.object.method + '</span> ';

				}

				if( typeof( data.object.unit ) !== 'undefined' ) {
					html += '<span class="Unit">Unit: ' + data.object.unit + '</span> ';
				}

				if( typeof( data.object.house ) !== 'undefined' ) {
					html += '<span class="House">House: ' + data.object.house + '</span> ';
				}

				if( typeof( data.object.code ) !== 'undefined' ) {
					html += '<span class="Code">Code: ' + data.object.code + '</span> ';
				}

				html += '<div class="EntryToolbar">';
				//html += '<a href="#" class="Ignore">Ignore device</a>';

				html += printKnownDeviceSelect();
				html += '<a href="#" class="Save">Save</a>';

				html += '</div></div></div>';
				Log( html );
			}

		});

		socket.on('close', function() { 
			//console.log( 'close' );
		});
	});
}


function printKnownDeviceSelect()  {
	
	var html = '<select class="KnownDeviceSelect"><option id="default">Associate with known device</option>'

	for( var i in knowndevices ) {
		
		html += '<option id="' + knowndevices[i].deviceid + '">';
		
		if ( isDefined( knowndevices[i].name ) ) {
			html += knowndevices[i].name;
		}
		
		html += '</option>';
	}

	html += '</select>';

	return html;
}

function isDefined( data ) {
	if( typeof( data ) !== 'undefined' ) {
		return true;
	}
	else {
		return false;
	}
}

/**
 * [dimLevelToPercentage description]
 * @param  int dimLevel
 * @return int
 */
function dimLevelToPercentage( dimLevel ) {
	switch ( dimLevel ) {
		case 0:
			return 0;
		case 20:
			return 10;
		case 55:
			return 20;
		case 70:
			return 30;
		case 105:
			return 40;
		case 125:
			return 50;
		case 155:
			return 60;
		case 170:
			return 70;
		case 205:
			return 80;
		case 220:
			return 90;
		case 255:
			return 100;
	}
}


/**
 * [updateDevice description]
 * @param  {[type]} device   [description]
 * @param  {[type]} dimLevel [description]
 * @return {[type]}          [description]
 */
function updateDevice( deviceID, dimLevel ) {

	console.log( 'Setting ' + deviceID + ' to ' + dimLevel );
	
	var device = $('[data-device="' + deviceID + '"]');

	var message = { 
		"deviceID": deviceID
	};

	if ( dimLevel == 'off' ) {
		message.type = 'Off';
		updateDeviceStatus( deviceID, 'OFF' );
		Log( '<div class="Entry"><span class="Device">Device #' + deviceID + '</span><span class="Status Off">turned <em>Off</em></span></div>' );
	}
	else if ( dimLevel == 'on' ) {
		message.type = 'On';
		updateDeviceStatus( deviceID, 'ON' );
		Log( '<div class="Entry"><span class="Device">Device #' + deviceID + '</span><span class="Status On">turned <em>On</em></span></div>' );
	}
	else {
		message.type = 'Dim';
		Log( '<div class="Entry"><span class="Device">Device #' + deviceID + '</span><span class="Status Dimmed"> dimmed to <em>' + dimLevel + '%</em></span></div>' );
		switch ( dimLevel ) {
			case '0':
				message.type = 'Off';
				message.dimLevel = 0;
				break;
			case '10':
				message.dimLevel = 20;
				break;
			case '20':
				message.dimLevel = 55;
				break;
			case '30':
				message.dimLevel = 70;
				break;
			case '40':
				message.dimLevel = 105;
				break;
			case '50':
				message.dimLevel = 125;
				break;
			case '60':
				message.dimLevel = 155;
				break;
			case '70':
				message.dimLevel = 170;
				break;
			case '80':
				message.dimLevel = 205;
				break;
			case '90':
				message.dimLevel = 220;
				break;
			case '100':
				message.dimLevel = 255;
				break;
		}
		updateDeviceStatus( deviceID, 'DIM', message.dimLevel );
	}
	
	// Stäng temporärt av skickning
	if ( DEBUG === false ) {
		socket.send( JSON.stringify( message ) );
	}
	
	//console.log( message );

	var room = findDeviceRoom( deviceID );

	updatePlanRit();

	return false;
}


/**
 * [getDevicesByRoom description]
 * @param  string room
 * @return array
 */
function getDevicesByRoom( room ) {

	var devices = window.devices;
	var roomDevices = [];

	for ( var i in devices ) {
		
		if ( typeof( devices[ i ].room ) !== "undefined" ) {

			if ( devices[ i ].room === room ) {
				roomDevices.push( devices[ i ] );
			}

		}

	}

	return roomDevices;

}



$( document ).ready( function() {

	$( '.Rum' ).on( 'click', function( e ) {
	                                
	    $( '.RoomPop' ).remove();

	    var popOverlay = $( '<div class="PopOverlay"></div>' );

	    var room = $( this ).prop( 'id' );

	    var parentDiv = $( '.Planrit' );
	    var posX = $( 'body' ).offset().left,
	        posY = $( 'body' ).offset().top,
	        clickY = ( e.pageY - posY ),
	        clickX = ( e.pageX - posX );

        var docWidth = $( document ).width();
        var docHeight = $( document ).height();

	    var pop = $( '<div class="RoomPop"></div>' );

	    var left = (clickX - 100);
	    var top = (clickY - 35);

	    if ( ( left + 240 ) > docWidth ) {
	    	left = docWidth - 240;
	    }

	    if ( ( left < 0 ) ) {
	    	left = 0;
	    }

	    pop.css({
	        top: top + 'px',
	        left: left + 'px'
	    });

	    var devices = getDevicesByRoom( room );
	    var html = '';

	    for ( var i in devices ) {

	    	if ( devices[ i ].type == 'LEDSpot' ) {
	    		if ( typeof( devices[ i ].status ) === 'object' ) {
	    			devices[ i ].status = devices[ i ].status.name;
	    		}
	    		html = Mustache.render( deviceTplSwitch, devices[ i ] );
	    	}
	    	else if ( devices[ i ].type == 'DimmerLampa' ) {
	    		
	    		if ( typeof( devices[ i ].status ) === 'object' ) {
	    			devices[ i ].dimlevel = devices[ i ].status.level;
	    		}
	    		else {
	    			devices[ i ].dimlevel = devices[ i ].dimlevel;
	    		}
	    		devices[ i ].status = 'DIM';

	    		console.log( 'Adding device', devices[ i ] );

	    		html = Mustache.render( deviceTpl, devices[ i ] );
	    	}
	    	else {
	    		console.log( 'Skipping other device', devices[ i ] );
	    		continue;
	    	}

	    	$( pop ).append( html );
	    }

	    $( 'body' ).append( popOverlay );

	    $( popOverlay ).click( function() {
	    	$( this ).remove();
	    	$( pop ).remove();
	    });

	    $( 'body' ).append( pop );

	    setupSliders( $( pop ).find( '.Controls .Slider' ) );
	    setupSwitches( $( pop ).find('.Controls.Switch' ) );
	});

});


/**
 * [setupSliders description]
 * @param  {[type]} parent [description]
 * @return {[type]}        [description]
 */
function setupSliders( parent ) {
	
	$( parent ).each( function() {

		var startLevel = 0;
		var device = $( this ).parent().parent();

		if ( $( device ).data( 'status' ) == 'DIM' ) {

			switch ( $( device ).data( 'dimlevel' ) ) {
				case 0:
					startLevel = 0;
					break;
				case 20:
					startLevel = 10;
					break;
				case 55:
					startLevel = 20;
					break;
				case 70:
					startLevel = 30;
					break;
				case 105:
					startLevel = 40;
					break;
				case 125:
					startLevel = 50;
					break;
				case 155:
					startLevel = 60;
					break;
				case 170:
					startLevel = 70;
					break;
				case 205:
					startLevel = 80;
					break;
				case 220:
					startLevel = 90;
					break;
				case 255:
					startLevel = 100;
					break;
			}
		}
		else if ( $( device ).data( 'status' ) == 'ON' ) {
			startLevel = 100;
		}
		else if ( $( device ).data( 'status' ) == 'OFF' ) {
			startLevel = 0;
		}

		if ( $( device ).data( 'type' ) == 'dimmer' || $( device ).data( 'type' ) == 'DimmerLampa' ) {

			var slider = this;

			noUiSlider.create( slider, {
				start: startLevel,
				step: 10,
				range: {
					min: 0,
					max: 100
				},
				format: wNumb({
					decimals: 0
				}),
				connect: 'lower'
			});

			slider.noUiSlider.on('change', function( values, handle, enencoded, tap, positions ) {
				updateDevice( $( device ).data( 'device' ), values[0] );
			});

			$( this ).find( '.noUi-handle' ).on( 'touchstart', function() {
				$( '.Device' ).not( $( this ).parents( '.Device' ) ).addClass( 'Inactive' );
				socket.send( JSON.stringify( { type: 'DeviceChangeStart' } ) );
			});

			$( this ).find( '.noUi-handle' ).on( 'touchend', function() {
				$('.Device').removeClass( 'Inactive' );
				socket.send( JSON.stringify({ type: 'DeviceChangeEnd' }) );
			});
		}

	});
}


/**
 *
 */
function createPlanritTemps() {
	$( '.Rum' ).each( function() {
		
		var position = $( this ).position();
		var width = this.getBoundingClientRect().width;
		var height = this.getBoundingClientRect().height;
		var id = $(this).attr('id');
		
		var centerH = position.top + ( height / 2 );
		var centerW = position.left + ( width / 2 );

		var lbl = $('<div class="TempLabel"></div>');

		$( lbl ).css({
			display: 'none',
			position: 'absolute',
			top: centerH - 15,
			left: centerW - 60,
			width: '120px',
			height: '30px',
			lineHeight: '30px',
		});
			
		if ( id == 'Office' ) {
			$.getJSON( '/getSensorData/12/temperature/hour/1', function( data ) {
				if ( typeof( data[0][0] ) !== 'undefined' ) {
					$( lbl ).append( '<span class="Temp">' + data[0][0][1] + ' °C</span>' );
					$(lbl).css({display: 'block'});
				}
			});
			$.getJSON( '/getSensorData/12/humidity/hour/1', function( data ) {
				if ( typeof( data[0][0] ) !== 'undefined' ) {
					$( lbl ).append( '<span class="Humidity">' + data[0][0][1] + ' %</span>' );
					$(lbl).css({display: 'block'});
				}
			});
		}
		else if ( id == 'Livingroom' ) {
			$.getJSON( '/getSensorData/11/temperature/hour/1', function( data ) {
				if ( typeof( data[0][0] ) !== 'undefined' ) {
					$( lbl ).append( '<span class="Temp">' + data[0][0][1] + ' °C</span>' );
					$(lbl).css({display: 'block'});
				}
			});
			$.getJSON( '/getSensorData/11/humidity/hour/1', function( data ) {
				if ( typeof( data[0][0] ) !== 'undefined' ) {
					$( lbl ).append( '<span class="Humidity">' + data[0][0][1] + ' %</span>' );
					$(lbl).css({display: 'block'});
				}
			});
		}
		else if ( id == 'Kitchen' ) {
			$.getJSON( 'getSensorData/135/temperature/hour/1', function( data ) {
				if ( typeof( data[0][0] ) !== 'undefined' ) {
					$( lbl ).append( '<span class="Temp">' + data[0][0][1] + ' °C</span>' );
					$(lbl).css({display: 'block'});
				}
			});
			$.getJSON( '/getSensorData/135/humidity/hour/1', function( data ) {
				if ( typeof( data[0][0] ) !== 'undefined' ) {
					$( lbl ).append( '<span class="Humidity">' + data[0][0][1] + ' %</span>' );
					$(lbl).css({display: 'block'});
				}
			});
		}
		else if ( id == 'Bathroom' ) {
			$.getJSON( 'getSensorData/121/temperature/hour/1', function( data ) {
				if ( typeof( data[0][0] ) !== 'undefined' ) {
					$( lbl ).append( '<span class="Temp">' + data[0][0][1] + ' °C</span>' );
					$(lbl).css({display: 'block'});
				}
			});
			$.getJSON( '/getSensorData/121/humidity/hour/1', function( data ) {
				if ( typeof( data[0][0] ) !== 'undefined' ) {
					$( lbl ).append( '<span class="Humidity">' + data[0][0][1] + ' %</span>' );
					$(lbl).css({display: 'block'});
				}
			});
		}

		$( '.Planrit' ).append( lbl );

	});
}


/**
 * [setupSwitches description]
 * @param  {[type]} parent [description]
 * @return {[type]}        [description]
 */
function setupSwitches( parent ) {

	$( parent ).each( function() {
		
		var that = $( this );
		var device = $( this ).parent();

		if ( $( device ).data( 'status' ) == 'OFF' ) {
			$( device ).addClass( 'Off' );
		}
		else if ( $( device ).data( 'status' ) == 'ON' ) {
			$( device ).addClass( 'On' );	
		}

		$( device ).find( '.Off' ).on( 'click', function() {
			$( device ).removeClass( 'On' ).addClass( 'Off' );
			updateDevice( $( device ).data( 'device' ), 'off' );
		});

		$( device ).find( '.On' ).on( 'click', function() {
			$(device).removeClass( 'Off' ).addClass( 'On' );
			updateDevice( $( device ).data( 'device' ), 'on' );
		});

	});
}

function Log( message ) {
	$('.Log').append( message );
}