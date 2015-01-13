module.exports = function(grunt) {
    // Project configuration.
    grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
      jsdoc: {
        dist:{
          src: ['routes/api.js'],
          options: {
            destination: 'dist/<%= pkg.version %>/docs',
            template : "node_modules/grunt-jsdoc/node_modules/ink-docstrap/template",
            configure : "node_modules/grunt-jsdoc/node_modules/ink-docstrap/template/jsdoc.conf.json"
          }
        },
        stage:{
          src: ['routes/api.js'],
          options: {
            destination: 'dist/staging/docs',
            template : "node_modules/grunt-jsdoc/node_modules/ink-docstrap/template",
            configure : "node_modules/grunt-jsdoc/node_modules/ink-docstrap/template/jsdoc.conf.json"
          }
        }
      },
      bump:{
        options:{
          files:['package.json'],
          updateConfigs:['pkg'],
          commit:true,
          commitMessage:'[RELEASE] Release v%VERSION%',
          commitFiles:['-a'],
          createTag:true,
          tagName:'v%VERSION%',
          push:true,
          pushTo:'origin',
          gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d',
          globalReplace: false
        }
      },
      copy:{
        stage:{
          files:[{expand: true, cwd:'routes/', src: ['api.js'], dest: 'dist/staging/', filter: 'isFile'}]
        },
        release:{
          files:[{expand: true, cwd:'routes/', src: ['api.js'], dest: 'dist/<%= pkg.version %>/', filter: 'isFile'}]
        }
      },
      shell:{
        deploy:{
          command:'git push heroku master'
        }
      }
    });

    // JSDoc
    grunt.loadNpmTasks('grunt-jsdoc');

    //Copy current version
    grunt.loadNpmTasks('grunt-contrib-copy');

     //Bump version commit and push
    grunt.loadNpmTasks('grunt-bump');

     //Shell commands (push to heroku)
    grunt.loadNpmTasks('grunt-shell');

    // Default task(s).
    grunt.registerTask('default', [ 'jsdoc']);
    /* Builds minified script and creates documentation
      @task
    */
    //copy to dist folder, create docs
    grunt.registerTask('stage', ['copy:stage']);

    //Bump version, Create docs, copy to dist folder, deploy to heroku
    grunt.registerTask('release', ['bump-only:prerelease', 'copy:release', 'bump-commit', 'shell:deploy']);

};
