var hemma = { latitude: 57.715599, longitude: 12.05433 };

function getLocation( callback ) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition( callback );
    }
}

function showPosition( position ) {
    //console.log( "Latitude: " + position.coords.latitude, "Longitude: " + position.coords.longitude );
    //console.log( 'Distance from home: ' + distance_from( position, hemma ) );
    $('.Distance').html('<p>Currently ' + distance_from( position, hemma ) + ' km from home</p>');
}

function rad( x ) { 
  return x * Math.PI / 180;
}

// Distance in kilometers between two points using the Haversine algo.
function haversine( p1, p2 ) {
  
  var R = 6371;
  var dLat = this.rad( p2.latitude - p1.latitude );
  var dLong = this.rad( p2.longitude - p1.longitude );

  var a = Math.sin( dLat/2 ) * Math.sin( dLat/2 ) + Math.cos( rad( p1.latitude ) ) * Math.cos( rad( p2.latitude ) ) * Math.sin( dLong/2 ) * Math.sin( dLong/2 );
  var c = 2 * Math.atan2( Math.sqrt( a ), Math.sqrt( 1-a ) );
  var d = R * c;

  return Math.round( d );

}

// Distance between me and the passed position.
function distance_from( position, current_location ) {
  return haversine( position.coords, current_location );
}