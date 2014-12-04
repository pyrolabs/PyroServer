var express = require('express');
var router = express.Router();
var FirebaseAccount = require('firebase-admin');
var Firebase = require('firebase');
var s3 = require('s3');
var awsSdk = require('s3/node_modules/aws-sdk');
var pyrofb = new Firebase("https://pyro.firebaseio.com");
var request = require('request');
var url = require('url');
var _ = require('underscore');
var replace = require('replace');
var fs = require('fs-extra');
var cookies = require('request-cookies');
var Q = require('q');
var client = s3.createClient({
	s3Options:{
		accessKeyId: process.env.PYRO_SERVER_S3_KEY,
		secretAccessKey: process.env.PYRO_SERVER_S3_SECRET
	}
});
var fbInfo = {email: process.env.PYRO_INFO_EMAIL, password: process.env.PYRO_INFO_PASS};
awsSdk.config.update({accessKeyId:process.env.PYRO_SERVER_S3_KEY, secretAccesssKey:process.env.PYRO_SERVER_S3_SECRET})
/* CREATE ACCOUNT
Request Details
	Request Type: GET
		URL: https://admin.firebase.com/joinbeta?email=shelby%40pyrolabs.io&password=thisispassword
	Success Response
		{
		"success": true
		}
*/
router.post('/createAccount', function(req, res){
	console.log('createAccount request received');
	if(req.body.hasOwnProperty('email') && req.body.hasOwnProperty('password')){
		var email = req.body.email;
		var pass = req.body.password;
		createFirebaseAccount(email, pass);
	} else {
		respond({status:500, message:'Incorrect request format'}, res);
	}
});

/* GENERATE
params:
	author
	name
*/


// argLocalDir = "fs/seed"


/* List
List objects from s3 given name
params:
	name
*/
//[TODO] THIS NEEDS TO BE SECURED
router.post('/list', function(req, res) {
	if(req.body.hasOwnProperty('name')){
		console.log('name exists');
		getListOfObjects(req.body.name, res, function(returnedList){
			console.log('getListOfObjects returned:', returnedList);
			respond({list:returnedList, status:200}, res);
		});
	} else {
		respond({status:500, message:'Url Parameter does not exist'}, res);
	}
});


router.post('/generate', function(req, res){
	console.log('generate request received:', req.body);
	if(req.body.hasOwnProperty('name') && req.body.hasOwnProperty('email') && req.body.hasOwnProperty('password')){
		console.log('it is the correct shape');
		var newAppName = "pyro-" + req.body.name;
		pyrofb.child('instances').child(newAppName).once('value', function(appSnap){
				if(!appSnap.val()){
					var author = req.body.author;
					// [TODO] check that author is the author of the instance
					console.log('request has name param:', newAppName);
					// Log into Server Firebase account
					// generateFirebase
					generateFirebase(req.body.email, req.body.password,  newAppName, res, function(fbObj){
						createS3Bucket(fbObj.dbName, res, function() {
					  	uploadToBucket(fbObj.dbName, "fs/seed", res, function(bucketUrl){
					  		respond({status:200, appUrl:bucketUrl, url:bucketUrl}, res);
					  	});
				  	});
					});
				}
		});
	} else {
		respond({status:500, message:'Incorrect request format'}, res);
	}
});
/** New Fb Account 
 * @endpoint api/fb/account/get
 * @params {string} email Email of account to get
 * @params {string} password Password of account to get
 */
router.post('/fb/account/new', function(req, res){
	if(req.body.hasOwnProperty('email') && req.body.hasOwnProperty('password')) {
		createFirebaseAccount(req.body.email, req.body.passwod, res) 
	} else {
		respond({status:500, message:'Incorrectly formatted request'});
	}
});
/** Get Fb Account 
 * @endpoint api/fb/account/get
 * @params {string} email Email of account to get
 * @params {string} password Password of account to get
 */
// [TODO] Make this a get request?
router.post('/fb/account/get', function(req, res){
	if(req.body.hasOwnProperty('email') && req.body.hasOwnProperty('password')) {
		getFirebaseAccount(req.body.email, req.body.passwod, res); 
	} else {
		respond({status:500, message:'Incorrectly formatted request'});
	}
});
/** CREATE
params:
	name
	email
	password
*/
router.post('/pyro/generate', function(req, res){
	console.log('generate request received:', req.body);
	if(req.body.hasOwnProperty('name') && req.body.hasOwnProperty('email') && req.body.hasOwnProperty('password')){
		console.log('it is the correct shape');
		var newAppName = "pyro-"+req.body.name;
		pyrofb.child('instances').child(newAppName).once('value', function(appSnap){
				if(!appSnap.val()){
					var author = req.body.author;
					// [TODO] check that author is the author of the instance
					console.log('request has name param:', newAppName);
					createFirebaseInstance(req.body.email, req.body.password, newAppName, res, function(instance){
						createS3Bucket(newAppName, res, function() {
					  	uploadToBucket(fbObj.dbName, "fs/seed", res, function(bucketUrl){
					  		respond({status:200, appUrl:bucketUrl, url:bucketUrl, dbUrl:instance.toString()}, res);
					  	});
				  	});
					});
				}
		});
	} else {
		respond({status:500, message:'Incorrect request format'}, res);
	}
});
/* DELETE
params:
	author
	name
*/
router.post('/delete', function(req, res) {
	console.log('Delete request received:', req.body);
	// [TODO] Make this delete firebase
		if(req.body.hasOwnProperty('name') && req.body.hasOwnProperty('author')){
		var newAppName = req.body.name;
		var author = req.body.author;
		console.log('request has name param:', newAppName);
		FirebaseAccount.getToken(fbInfo.email, fbInfo.password).then(function(token) {
		  var account = new FirebaseAccount(token);
		  var dbName = 'pyro-'+ req.body.name;
		  account.deleteDatabase(dbName)
		  .then(function(instance) {
		    var pyrofb = new Firebase("https://pyro.firebaseio.com");
		    console.log('instance created:', instance.toString());
		    // Save new instance to pyro firebase
		    var instanceObj = {name:newAppName, url:instance.toString(), dbName:dbName, author:author};
		    
		  }).catch(function(err) {
		    console.error('Oops, error creating instance:', err);
		    respond({status:500, message:'Error Creating instance', error: err.toString()}, res);
		  });
		})
	} else {
		respond({status:500, message:'Incorrect request format'}, res);
	}
});
router.post('/test', function(req, res){
	console.log('api test post received:', req.body);
	enableEmailAuth(req.body.email, req.body.password, "pyro-" + req.body.name, res, function(){

	});


});




	function enableEmailAuth(argAccountEmail, argAccountPass, argAppName, argRes, cb){
		console.log('enableEmailAuth called');
		getFirebaseAccount(req.body.email, req.body.password, res, function(account){
			console.log('account returned:', account);
			account.getDatabase("pyro-" + req.body.name).then(function(instance){
				console.log('instance:', instance.toString());
				instance.setAuthConfig({password:{"enabled":true}}).then(function(){
					console.log('Email&Password Authentication enabled succesfully for:', instance.toString());
					if(cb){
						cb();
					} else {
						respond({status:200, message:'Email&Password Authentication enabled succesfully for ' + req.body.name}, argRes);
					}
				});
			}, function(error){
				console.error('error seeing auth config', error);
				respond({status:500, message:'Error enabling auth settings'}, argRes);
			});
		});
	}

// -------------------Helper Functions------------------
// Basic Respond
function respond(argResInfo, res){
	// {status:500, error:errObj}
	if(argResInfo && argResInfo.hasOwnProperty('status')){
		res.writeHead(argResInfo.status, {'Content-Type':'application/json'});
		res.write(JSON.stringify(argResInfo));
		res.end();
	} else {
		res.write(JSON.stringify(argResInfo));
		res.end();
	}
}
// function checkParams(argParamsArray, argObject) {
// 	var resultsArray = [];
// 	console.log('checkParams', arguments);
// 	for (param in argParamsArray) {
// 		if(!_.has(argObject, param)){
// 			resultsArray.push(false);
// 		}
// 	}
// 	if(_.has(resultsArray, false)){
// 		return false
// 	} else {
// 		return true;
// 	}
// }
function generateFirebase(argEmail, argPass, argFBName, argRes, cb) {
	var firebaseObj = {};
	createFirebaseAccount(argEmail, argPass, argRes, function(){
		//login to firebase
		getFirebaseAccount(argEmail, argPass, argRes, function(returnedAccount){
			  // create new firebase with "pyro-"" ammended to front of the app name
			  firebaseObj.dbName = 'pyro-'+ argFBName;
			  console.log('creating instance with name:', firebaseObj.dbName);
				createFirebaseInstance(returnedAccount, firebaseObj.dbName, argRes, function(instance){
					console.log('instance created:', instance);
					//enable email
					firebaseObj.dbUrl = instance.toString();
					if(cb){
						console.log('calling back firebaseObj:', firebaseObj);
						cb(firebaseObj);
					} else {
						respond({status:200, url:instance.toString(), message: 'New Account Created with firebase instance'}, argRes);
					}
				});
			});
		});
		//createFirebaseInstance
}
function createFirebaseAccount(argEmail, argPass, argRes, cb) {
	console.log('CreateFirebaseAccount called with:', argEmail, argPass);
	var urlObj = {
		protocol:'https:', 
		host:'admin.firebase.com', 
		pathname:'/joinbeta', 
		query: {
			email: argEmail,
			password: argPass
		}
	};
	console.log('urlObj:', urlObj);
	var requestUrl = url.format(urlObj);
	request.get(requestUrl, function(error, response, body){
		if(!error || !response.body.hasOwnProperty('error')) {
			console.log('Firebase account created successfully:', body);
			if(cb){
				cb(body);
			} else {
				respond({success:true, status:200, message:'Firebase account created successfully', account:body, fbRes:response}, argRes);
			}

		} else {
			console.error('error with create account request:', error);
			respond({status:500, message:'Error creating Firebase account', error: error}, argRes);
		}
	});
}
function createFirebaseInstance(argEmail, argPass, argFBName, argRes, callback) {
	console.log('createFirebaseInstance called:', argAccount, argFBName);
	getFirebaseAccount(argEmail, argPass, argRes, function(account){
		argAccount.createDatabase(argFBName).then(function(instance) {
	    // var appfb = new Firebase(instance.toString());
	    console.log('instance created:', instance.toString());
	    // Enable email & password auth
	    instance.setAuthConfig({password:{"enabled":true}}).then(function(){
	    	callback(instance);
	    }, function(error){
	    	console.error('Error setting up email auth');
	    	respond({status:500, message:JSON.stringify(error)}, argRes);
	    });
	  }).catch(function(err) {
	    console.error('Error creating firebase instance:', err);
	    respond({status:500, message:JSON.stringify(err)}, argRes);
	  });
	});
} //-- createDatabase


function getFirebaseAccount(argEmail, argPass, argRes, cb){
	console.log('getFirebaseAccount', argEmail, argPass);
	FirebaseAccount.getToken(argEmail, argPass).then(function(token) {
	  var account = new FirebaseAccount(token);
	  console.log('getFirebaseAccount successful:', account);
	  if(cb){
	  	cb(account);
	  } else {
	  	respond({status:200, account: account}, argRes)
	  }
	}, function(){
		console.error('Error getting firebase token:');
		response({error:'Error getting firebase token:'},argRes);
	}); //-- getToken
}





function generateAdminToken(argSecret, argRes, cb){
	if(argSecret) {
		console.log('Generate Admin Token called:', argSecret);
		var tokenGenerator = new FirebaseTokenGenerator(req.body.secret);
		var authToken = tokenGenerator.createToken({uid: "pyroAdmin"}, 
		{admin:true, debug:true});
		if(cb){
			cb(authToken);
		} else {
			respond({status:200, token:authToken}, argRes);
		}
	}
	else {
		respond({status:500, message:'Incorrect request format'}, argRes);
	}
}
function getAppFb(argAppName, argRes, cb){
	console.log('getAppFb called for:', argAppName);
	pyroFb.child('instances').child(argAppName).once('value', function(instanceSnap){
		if(instanceSnap.val() && instanceSnap.val().hasOwnProperty('dbUrl')){
			var appFbUrl = instanceSnap.val().dbUrl
			var fb = new Firebase(appFbUrl);
			if(cb){
				cb(fb);
			} else {
				respond({status:500, error:'Internal server error'}, argRes);
			}
		} else {
			respond({status:500, message: 'App by that name does not exist'}, argRes);
		}
	});
}

function enableEmailSimpleLogin(argEmail, argPass, argAppName, argRes, cb){
	console.log('enableEmailSimpleLogin called:', argAppName);
	// [TODO] Make this a query so that it will still work even if we change appIds
			// This is assuming that their firebase account was created with us
			getFirebaseAccount(argEmail, argPass, argRes, function(account){
				var appHost = "pyro-"+ argAppName + '.firebaseio.com';
				var appOrigin = "https://"+ appHost;
				console.log('appHost:', appHost);
				var urlObj = {
					protocol:'https:', 
					host:appHost, 
					pathname:'/.settings/authConfig.json',
					headers:{'Origin': appOrigin, 'Referer':appOrigin + '/'},
					query: {
						token: account.adminToken
					}
				};
				cookies.add({adminToken:account}, "https://"+ appHost);
				// console.log('cookies:', cookies.toJSON());
				console.log('urlObj:', urlObj);
				var requestUrl = url.format(urlObj);
				request.put(requestUrl, function(error, response, body){
					if(!error || !response.body.hasOwnProperty('error')) {
						console.log('create request returned:', body);
						if(cb){
							cb();
						} else {
							respond({success:true, status:200, message:'Firebase account created successfully', fbRes:response}, argRes);
						}
					} else {
						console.error('error with create account request:', error);
						respond({status:500, message:'Error creating Firebase account', error: error}, argRes);
					}
				});
			});




}
function uploadToBucket(argBucketName, argLocalDir, argRes, cb){
	console.log('uploadToBucket called:', argBucketName);
	var newAppDir = 'fs/'+ argBucketName;
	fs.copy(argLocalDir, newAppDir , function(err){
		replace({regex:"ZZ", replacement:"https://"+argBucketName+".firebaseio.com", paths:[newAppDir+"/app.js"]});
		var upParams = {
		  localDir: newAppDir,
		  s3Params: {
		    Bucket: argBucketName,
		    Prefix: "",
		    ACL:'public-read'
		  },
		};
		var uploader = client.uploadDir(upParams);
		uploader.on('error', function(err) {
	  	console.error("unable to sync:", err.stack);
	  	respond(err, argRes);
		});
		// uploader.on('progress', function() {
		//   console.log("progress", uploader.progressAmount, uploader.progressTotal);
		// });
		uploader.on('end', function() {
		  console.log("done uploading");
			// [TODO] Delete new app folders
		  var bucketUrl = argBucketName + '.s3-website-us-east-1.amazonaws.com';
		  if(cb){
		  	cb(bucketUrl);
		  } else {
				var responseInfo = {status:200, url:bucketUrl, message:'Seed app upload successful to bucket named:' + argBucketName};
				respond(responseInfo, argRes);
		  }
		});	
	})
	
}
function createS3Bucket(argBucketName, argRes, cb) {
	console.log('createS3Bucket called');
	var s3bucket = new awsSdk.S3();
	s3bucket.createBucket({Bucket: argBucketName},function(err1, data1) {
		if(err1){
			console.error('error creating bucket:', err1);
			respond(err1, argRes);
		} else {
			console.log('bucketCreated successfully:', data1);
			// Setup Bucket website
			s3bucket.putBucketWebsite({
				Bucket: argBucketName, 
				WebsiteConfiguration:{
					IndexDocument:{
						Suffix:'index.html'
					}
				}
			}, function(err, data){
				if(err){
					console.error('Error creating bucket website setup');
					respond(err, argRes);
				} else {
					console.log('website config set for ' + argBucketName, data1.location);
					cb(data1.location);
				}
			});
		}
	}); //--createBucket
}
function seperateS3Url(argUrl){
	console.log('seperateS3Url called with', argUrl);
	var re = /(.+)(?=\.s3)/g;
	var reRegion = /website.(us.+)(?=\.amazon)/g;
	var bucketArray = argUrl.match(re);
	var regionArray = argUrl.match(reRegion);
	awsSdk.config.region = regionArray[0];
	var endIdx = bucketArray.indexOf('amazonaws');
	console.warn("bucket: ", bucketArray,"region: ",regionArray);
	var bucketString = bucketArray[0]
	console.warn("bucket: ", bucketString);
	return bucketString;
}
function getListOfObjects(argBucketName, argRes, cb) {
	console.log('getListOfObjects:', arguments);
	var bucket = new awsSdk.S3({params: {Bucket: argBucketName}});
	bucket.listObjects(function (err, data) {
	  if (err) {
	    console.error('Could not load objects from S3 - ',err);
	    respond({status:500, error:err, message:'Could not load objects from S3'}, argRes);
	  } else {
	    console.log('Loaded ' + data.Contents.length + ' items from S3:', data.Contents);
	    cb(data.Contents);
	  }
	});
}
module.exports = router;
/* CREATE ---- DEPRECATED
params:
	author
	name
	Creates new firebase instance on pyro_server firebase account formatted as follows:
	 "pyro-exampleApp"

	Sends instance info to Firebase:
	instance:{name:'exampleApp', fburl:'pyro-exampleApp.firebaseio.com', author:'$uid of author'} 
 
*/

// router.post('/create', function(req, res){
// 	console.log('request received:', req.body);
// 	if(req.body.hasOwnProperty('name') && req.body.hasOwnProperty('author')){
// 		var newAppName = req.body.name;
// 		var author = req.body.author;
// 		console.log('request has name param:', newAppName);
// 		// Log into Server Firebase account
// 		FirebaseAccount.getToken(fbInfo.email, fbInfo.password).then(function(token) {
// 		  var account = new FirebaseAccount(token);
// 		  // create new firebase with "pyro-"" ammended to front of the app name
// 		  var dbName = 'pyro-'+ req.body.name;
// 		  account.createDatabase(dbName).then(function(instance) {
// 		    // var appfb = new Firebase(instance.toString());
// 		    var pyrofb = new Firebase("https://pyro.firebaseio.com");
// 		    console.log('instance created:', instance.toString());
// 		    // Save new instance to pyro firebase
// 		    var instanceObj = {name:newAppName, url:instance.toString(), author:author};
// 		    pyrofb.child('instances').child(newAppName).set(instanceObj, function(){
// 		    	res.writeHead(201, {'Content-Type':'text/plain'});
// 					res.write(newAppName);
// 				  res.end();
// 		    });
		    
// 		  }).catch(function(err) {
// 		    console.error('Oops, error creating instance:', err);
// 		    res.writeHead(500, {'Content-Type':'text/plain'});
// 				res.write(err.toString());
// 				res.end();
// 		  });
// 		})
// 	} else {
// 		respond({status:500, message:'Incorrect request format'}, res);
// 	}
// });

// -------------  Useful Code ----------------
// Bucket copy
// var knoxCopy = require('knox-copy');
// 		knoxClient = knoxCopy.createClient({key:process.env.PYRO_SERVER_S3_KEY, secret:process.env.PYRO_SERVER_S3_SECRET, bucket:dbName})
		// knoxClient.copyBucket({fromBucket:'pyro-cdn', fromPrefix:'/seed', toPrefix:'/' }, function(err, count){
		// 	if(err){
		// 		console.error(err);
		// 		respond(err, res)
		// 	} else {
		// 		console.log('successfully copied '+ count + ' files');
		// 		respond({status:200, message:'Successfully created app.', url:newAppName + '.s3-website-us-east-1.amazonaws.com'}, res);
		// 	}
		// });
// Single file copy
// 	var copyTask = client.copyObject({Bucket:'pyro-labs', CopySource:'pyro-cdn/seed/index.html', Key:'index.html'});
// 	copyTask.on('end', function(data){
// 		console.log('Copy successful:', data);
// 		res.writeHead(201, {'Content-Type':'application/json'});
// 		res.write(JSON.stringify(data));
// 	  res.end();
// 	});
// 	copyTask.on('error', function(err){
// 		console.error('Error copying:', err);
// 		res.writeHead(500, {'Content-Type':'application/json'});
// 		res.write(JSON.stringify(err));
// 		res.end();
// 	});