$( function() {
    FastClick.attach( document.body );
});

$( document ).ready( function() {

    //getLocation( showPosition );

    $( '#Menu .Button' ).on( 'click', function() {

        var _screen = $( '#' + $(this).data('screen') );
        var visibleScreen = $( '.Screen.Visible' );

        if ( ! $( _screen ).is( '.Visible' ) ) {
            $( '#Menu .Button.Active' ).removeClass( 'Active' );
            $( this ).addClass( 'Active' );
            showScreen( _screen );
            hideScreen( visibleScreen );
        }
        else {
            /*$( '#Menu .Button.Active' ).removeClass( 'Active' );
            hideScreen( _screen );*/
        }

    });


    // Visa första skärmen
    var _screen = $( '.Screen:eq(0)' );
    $( '#Menu .Button[data-screen="' + $( _screen ).attr( 'id' ) + '"]' ).addClass( 'Active' );
    showScreen( _screen );

    /*$( '.Screen h3' ).on( 'click', function() {
        var _screen = $( this ).parent();
        hideScreen( _screen );
    });*/

    $( '.Screen h3 .MenuIcon' ).on( 'click', function() {
        var _screen = $( this ).parents('.Screen');
        toggleMenu( _screen );
    });

    $('.ScreenMenu .Close').on('click', function() {
        var _screen = $( this ).parents('.Screen');
        toggleMenu( _screen ); 
    });


    function toggleMenu( _screen ) {
        $( _screen ).find( '.ScreenMenu' ).toggleClass('Visible');
    }

    /**
     * Show edit screen
     */
    $( '.ScreenMenu .EditDevices' ).on( 'click', function() {
        var editScreen = $( '<div id="EditDevices"/>' );
        var parentScreen = $( this ).parents( '.Screen' );

        $.ajax({
            url: '/getConfig',
            success: function( data ) {
                for( var i in data.devices ) {
                    var html = '<div class="ConfigDevice" data-id="' + data.devices[i].id + '"><dl>';
                    for( var key in data.devices[ i ] ) {
                        var value = data.devices[ i ][ key ];
                        if( key == 'parameters' ) {
                            html += '<strong>Parameters</strong>';
                            for( var pKey in value ) {
                                html += '<dt>' + pKey + '</dt><dd>' + value[ pKey ] + '</dd>';
                            }
                        }
                        else {
                            html += '<dt>' + key + '</dt><dd>' + value + '</dd>';
                        }
                    }
                    html += '</dl></div>';
                    $( editScreen ).append( html );
                }
                $( parentScreen ).append( editScreen );
            }
        })

        
    });


    $( '.Button.Off' ).on( 'click', function() {
        $( '.Confirm' ).velocity(
            {
                opacity: 1
            },
            {
                duration: 200,
                display: 'block',
                complete: function() {
                    $( '.Confirm .Inner' ).velocity("transition.expandIn", 
                        { 
                            duration: 200,
                            display: 'block' 
                        }
                    );
                }
            }
        );
    });

    $( '.Confirm button' ).on( 'click', function() {
        $( '.Confirm .Inner' ).velocity( "transition.shrinkOut",
            {
                duration: 200,
                complete: function() {
                    $( '.Confirm' ).velocity( 
                        {
                            opacity: 0
                        },
                        {
                            duration: 200,
                            display: 'none'
                        }
                    );
                }
            }
        );
    });

    function showScreen( _screen ) {
        $( _screen ).addClass( 'Visible' );
        $( _screen ).velocity(
            {   
                left: [0, [500,35]]
            },
            {
                duration: 300,
                delay: 0
            }
        );
    }

    function hideScreen( _screen ) {
        $( _screen ).removeClass( 'Visible' );
        $( _screen ).velocity(
            {   
                left: '-100%'
            },
            {
                duration: 200
            },
            "easeIn"
        );
    }

    /**
     * Material design style buttons
     */
    $.Velocity.RegisterUI( "callout.touched", {
        defaultDuration: 500,
        calls: [
            [{
                opacity: 1
            },
            0.1],
            [{
                opacity: 0,
                left: '50%',
                top: '50%',
                scaleX: 10,
                scaleY: 10
            },
            0.8],
            [{
                scaleX: 1,
                scaleY: 1
            },
            0.1]
        ]
    });

    $.Velocity.RegisterUI( "callout.fadepulse", {
        defaultDuration: 700,
        calls: [
            [{
                backgroundColorAlpha: 0.2
            },
            0.3],
            [{
                backgroundColorAlpha: 0,
            },
            0.3]
        ]
    });

    $(document).ready(function(e) {
        
        $( '.Button' ).click( function( e ) {
            var posX = $( this ).offset().left,
                posY = $( this ).offset().top;
            $( '> .Inner', this ).css({
                top: ( e.pageY - posY ),
                left: ( e.pageX - posX )
            });
            $( '> .Inner', this ).velocity( "callout.touched" );
            $( '> .Overlay', this ).velocity( "callout.fadepulse" );
        });

    });

});