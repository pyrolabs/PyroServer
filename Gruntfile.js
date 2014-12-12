module.exports = function(grunt) {
    // Project configuration.
    grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
      jsdoc: {
        dist:{
          src: ['routes/api.js'], 
          options: {
            destination: 'dist/docs',
            template : "node_modules/grunt-jsdoc/node_modules/ink-docstrap/template",
            configure : "node_modules/grunt-jsdoc/node_modules/ink-docstrap/template/jsdoc.conf.json"
          }
        }
      }
    });

    //Uglify
    grunt.loadNpmTasks('grunt-contrib-uglify');
    
    // JSDoc
    grunt.loadNpmTasks('grunt-jsdoc');

    // Default task(s).
    grunt.registerTask('default', [ 'jsdoc']);
    /* Builds minified script and creates documentation
      @task
    */
    grunt.registerTask('build', ['uglify', 'jsdoc']);
    
    grunt.registerTask('publish', ['jsdoc', 'uglify']);

};