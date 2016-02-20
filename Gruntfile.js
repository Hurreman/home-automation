module.exports = function(grunt) {
  require('jit-grunt')(grunt);

  grunt.initConfig({
    less: {
      development: {
        options: {
          compress: true,
          yuicompress: true,
          optimization: 2
        },
        files: {
          "public/assets/css/main.css": "public/assets/css/main.less" // destination file and source file
        }
      }
    },
    concat: {
      options: {
        separator: ';',
      },
      dist: {
        src: [
          'public/assets/js/wNumb.min.js',
          'public/assets/noUiSlider.7.0.10/jquery.nouislider.all.min.js',
          'public/assets/js/moment-with-locales.js',
          'public/assets/js/mustache.min.js',
          'public/assets/js/hammer.min.js',
          'public/assets/js/jquery.hammer.js',
          'public/assets/js/devices.js',
          'public/assets/js/geo.js',
          'public/assets/js/engine.io.js',
          'public/assets/js/highcharts.js',
          'public/assets/js/graphs.js'
        ],
        dest: 'public/assets/js/minified.js',
      },
    },
    watch: {
      styles: {
        files: ['public/assets/css/**/*.less'], // which files to watch
        tasks: ['less'],
        options: {
          nospawn: true
        }
      },
      scripts: {
        files: ['public/assets/js/**/*.js'],
        tasks: ['concat']
      }
    }
  });

  grunt.registerTask('default', ['less', 'concat', 'watch']);
};