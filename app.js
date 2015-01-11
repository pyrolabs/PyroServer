require('newrelic');
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var pkg = require('./package.json');
var cors = require('cors');
var routes = require('./routes/index');
var users = require('./routes/users');
var auth = require('./routes/auth');
var api = require('./routes/api');
var _ = require('underscore');
var Q = require('q');
var fs = require('fs-extra');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// API HEADERS
var whitelist = ['https://pyro.firebaseapp.com', 'http://localhost:9000', 'https://pyro-platform.firebaseapp.com', 'https://pyrolabs.io'];
var corsOptions = {origin: function(origin, callback){
    var originIsWhitelisted = whitelist.indexOf(origin) !== -1;
    callback(null, originIsWhitelisted);
  }};
app.use(cors());
app.options('*', cors());
app.use('/', routes);
// app.use('/dev', api);

var versionDirectories = fs.readdirSync('./dist/');
var versionNames = _.filter(versionDirectories, function(path){
  return fs.lstatSync("./dist/"+ path).isDirectory();
});
console.log('Enabled versions:', versionNames);
createEndpointsFromArray(versionNames, "./dist/");
//Create endpoint for each version
function createEndpointsFromArray(endpointsArray, folderPath){
  _.each(endpointsArray, function(element,index, list){
    app.use('/'+ element, require(folderPath + element + '/api.js'));
  });
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});
var Firebase = require('firebase');
var FirebaseTokenGenerator = require('firebase-token-generator');
var pyrofb = new Firebase("https://pyro.firebaseio.com");
pyrofb.onAuth(function(authData) {
  if (authData) {
    console.log("Authenticated with uid:", authData.uid);
  } else {
    console.log("Not authenticaed with pyrofb.");
    serverLoginToPyro();
  }
});
function serverLoginToPyro(){
  console.log('Server login to pyro called');
  var deferred = Q.defer();
  if(process.env.hasOwnProperty('PYRO_SERVER_FB_SECRET')){
    generateAdminToken(process.env.PYRO_SERVER_FB_SECRET).then(function(adminToken){
      pyrofb.authWithCustomToken(adminToken, function(error, authData){
        if(!error){
          var savedAuthData = authData;
          deferred.resolve(authData);
        } else {
          console.error('Error loggin into Pyro Firebase');
          deferred.reject(error);
        }
      });
    });
  } else {
    throw Error('Missing Firebase Secret. Check Environment variable');
  }
  return deferred.promise;
}
// Admin Token from Firebase's exposed library
function generateAdminToken(argSecret){
 var deferred = Q.defer();
  if(argSecret) {
    console.log('Generate Admin Token called:', argSecret);
    var tokenGenerator = new FirebaseTokenGenerator(argSecret);
    var authToken = tokenGenerator.createToken({uid: "pyroServer"},
    {admin:true, debug:true});
   deferred.resolve(authToken);
  }
  else {
    deferred.reject({status:500, message:'Incorrect request format'});
  }
return deferred.promise;
}
module.exports = app;
