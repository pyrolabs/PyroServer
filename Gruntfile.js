module.exports = function(grunt) {
    // Project configuration.
    require('load-grunt-tasks')(grunt);
    grunt.initConfig({
      pkg: grunt.file.readJSON('package.json'),
      conf:grunt.file.readJSON('config.json'),
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
        serve:{
          command:'node ./bin/www'
        },
        deploy:{
          command:'git push heroku master'
        }
      }
    });

    // Default task(s).
    grunt.registerTask('default', [ 'jsdoc', 'shell:serve']);
    /* Builds minified script and creates documentation
      @task
    */
    //copy to dist folder, create docs
    grunt.registerTask('stage', ['copy:stage']);
    grunt.registerTask('patch', ['copy:release', 'shell:deploy'])
    //Bump version, Create docs, copy to dist folder, deploy to heroku
    grunt.registerTask('release', ['bump-only:prerelease', 'copy:release', 'bump-commit', 'shell:deploy']);

};
