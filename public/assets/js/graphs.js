var graphs = [];


/**
 * ShowGraphs
 * @return {[type]} [description]
 */
function showGraphs() {
	
	$( '.Chart' ).each( function() {
		
		var id = $( this ).attr( 'id' ),
			type = $( this ).data( 'type' ), 
			deviceid = $( this ).data( 'deviceid' ),
			interval = $( this ).data( 'interval' ),
			limit = $( this ).data( 'limit' ),
			label = $( this ).data( 'label' ),
			unit = $( this ).data( 'unit' );

		Highcharts.setOptions({
			global: {
				useUTC: false
			}
		});

		//console.log( '/getSensorData/'+deviceid+'/'+type+'/'+interval+'/' + limit );

		$.getJSON( '/getSensorData/'+deviceid+'/'+type+'/'+interval+'/' + limit, function( data ) {

				//console.log( data );

				var x = [];
				var y = [];
				var chartType = 'spline';

				for( var n in data ) {
					for( var i in data[ n ] ) {
						var tmpData = data[ n ][ i ][ 0 ];
						var tmpMom = new Date( tmpData );
						data[ n ][ i ][ 0 ] = tmpMom.valueOf();
					}
				}

				var pb = [];

				/*if( type == 'humidity' ) {
					pb.push({
		                from: 60,
		                to: 70,
		                color: 'rgba(68, 170, 213, 0.1)',
		                label: {
		                    text: 'Moist!',
		                    style: {
		                        color: '#606060'
		                    }
		                }
		            });
				}
				else {
					pb.push({
		                from: 0,
		                to: 18,
		                color: 'rgba(68, 170, 213, 0.1)',
		                label: {
		                    text: 'Cold...',
		                    style: {
		                        color: '#606060'
		                    }
		                }
		            });
				}*/

				if ( interval === 'day' ) {
					chartType = 'areasplinerange';
				}

				var hc = $( '#' + id ).highcharts({
					chart: {
						type: chartType
					},
					title: {
						style: {
			                fontSize: "12px"
			            },
			            text: label
					},
					yAxis: {
						title: {
							text: ''
						},
						labels: {
							formatter: function () {
			                    return this.value + unit;
			                }
						}
					},
					xAxis: {
						type: 'datetime'
					},
					plotOptions: {
			            spline: {
			                marker: {
			                    radius: 0,
			                    lineWidth: 0
			                },
			                lineWidth: 2
			            },
			            areaspline: {
			            	marker: {
			            		radius: 0,
			            		lineWidth: 0
			            	},
			            	lineWidth: 0
			            }
			        },
					series: prepareSeries( data )
				});

			}
		);

		
	});
}

function prepareSeries( data ) {

	var tmpSeries = new Array();
	
	if ( data[0].length > 0 ) {
		tmpSeries.push( { name: 'Livingroom', data: data[0] } );
	}

	if ( data[1].length > 0 ) {
		tmpSeries.push( { name: 'Bedroom', data: data[1] } );
	}

	if ( data[2].length > 0 ) {
		tmpSeries.push( { name: 'Greenhouse', data: data[2] } );
	}

	if ( data[3].length > 0 ) {
		tmpSeries.push( { name: 'Kitchen', data: data[3] } );
	}

	if ( data[4].length > 0 ) {
		tmpSeries.push( { name: 'Bathroom', data: data[4] } );
	}

	return tmpSeries;
}

function convertDateToUTC( date ) { 
	return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()); 
}


function setGraphStyles() {
	/**
	 * Dark theme for Highcharts JS
	 * @author Torstein Honsi
	 */
	Highcharts.theme = {
	   colors: ["#2b908f", "#90ee7e", "#f45b5b", "#7798BF", "#aaeeee", "#ff0066", "#eeaaee",
	      "#55BF3B", "#DF5353", "#7798BF", "#aaeeee"],
	   chart: {
	      backgroundColor: null,
	      style: {
	         fontFamily: "Roboto, sans-serif"
	      },
	      plotBorderColor: '#606063'
	   },
	   title: {
	      style: {
	         color: '#E0E0E3',
	         textTransform: 'uppercase',
	         fontSize: '20px'
	      }
	   },
	   subtitle: {
	      style: {
	         color: '#E0E0E3',
	         textTransform: 'uppercase',
	      }
	   },
	   xAxis: {
	      gridLineColor: '#404043',
	      labels: {
	         style: {
	            color: '#AAA',
	            letterSpacing: '0.1em',
	            fontWeight: '200'
	         }
	      },
	      lineColor: '#404043',
	      minorGridLineColor: '#404043',
	      tickColor: '#404043',
	      title: {
	         style: {
	            color: '#A0A0A3'

	         }
	      }
	   },
	   yAxis: {
	      gridLineColor: '#404043',
	      labels: {
	         style: {
	            color: '#AAA',
	            letterSpacing: '0.1em',
	            fontWeight: '200'
	         }
	      },
	      lineColor: '#404043',
	      minorGridLineColor: '#404043',
	      tickColor: '#404043',
	      tickWidth: 1,
	      title: {
	         style: {
	            color: '#A0A0A3'
	         }
	      }
	   },
	   tooltip: {
	      backgroundColor: 'rgba(0, 0, 0, 0.85)',
	      style: {
	         color: '#F0F0F0'
	      }
	   },
	   plotOptions: {
	      series: {
	         dataLabels: {
	            color: '#B0B0B3'
	         },
	         marker: {
	            lineColor: '#333'
	         }
	      },
	      boxplot: {
	         fillColor: '#505053'
	      },
	      candlestick: {
	         lineColor: 'white'
	      },
	      errorbar: {
	         color: 'white'
	      }
	   },
	   legend: {
	   	  //enabled: false,
	      itemStyle: {
	         color: '#CCCCCC',
	         fontWeight: 200,
	         fontSize: '12px',
	         letterSpacing: '0.1em',
	      },
	      useHTML: true,
	      itemWidth: 110,
	      itemMarginBottom: 5,
	      align: 'center',
	      //layout: 'vertical',
	      itemHoverStyle: {
	         color: '#FFF'
	      },
	      itemHiddenStyle: {
	         color: '#606063'
	      }
	   },
	   credits: {
	      style: {
	         color: 'rgba(0,0,0,0)'
	      }
	   },
	   labels: {
	      style: {
	         color: '#707073'
	      }
	   },
	   // special colors for some of the
	   legendBackgroundColor: 'rgba(0, 0, 0, 0.5)',
	   background2: '#505053',
	   dataLabelsColor: '#B0B0B3',
	   textColor: '#C0C0C0',
	   contrastTextColor: '#F0F0F3',
	   maskColor: 'rgba(255,255,255,0.3)'
	};

	// Apply the theme
	Highcharts.setOptions(Highcharts.theme);
}

setGraphStyles();
showGraphs();