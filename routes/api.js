var express = require('express');
var router = express.Router();
var FirebaseAccount = require('firebase-admin');
var Firebase = require('firebase');
var FirebaseTokenGenerator = require('firebase-token-generator');
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
var util = require('util');
var path = require('path');
var mime = require('mime');
var client = configureS3AndGetClient();
pyrofb.onAuth(function(authData) {
  if (authData) {
    console.log("Authenticated with uid:", authData.uid);
  } else {
    console.log("Not authenticaed with pyrofb.");
    serverLoginToPyro();
  }
});
var pyroAuth = function(){
	return pyrofb.getAuth();
}
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
		throw Error('Enter firebase secret');
	}
	return deferred.promise;
}
/** Set S3 credentials from environment variables if they are availble and return the s3 client object
 * @function configureS3AndGetClient
 */
function configureS3AndGetClient(){
	if(process.env.hasOwnProperty('PYRO_SERVER_S3_KEY')&&process.env.hasOwnProperty('PYRO_SERVER_S3_SECRET')){
		awsSdk.config.update({
			accessKeyId:process.env.PYRO_SERVER_S3_KEY, 
			secretAccesssKey:process.env.PYRO_SERVER_S3_SECRET
		});
		return s3.createClient({
			s3Options:{
				accessKeyId: process.env.PYRO_SERVER_S3_KEY,
				secretAccessKey: process.env.PYRO_SERVER_S3_SECRET
			}
		});
	} else {
		throw Error('Environment not setup properly. Check S3 keys');
	}
}
/** UNSECURE List objects from s3 given name
 * @endpoint /list
 * @params {string} Name name of bucket of which to list items
 */
// router.post('/list', function(req, res) {
// //[TODO] THIS NEEDS TO BE SECURED
// 	getListOfS3BucketContents(req.body.name).then(function(returnedList){
// 		console.log('getListOfS3BucketContents returned:', returnedList);
// 		respond({list:returnedList, status:200}, res);
// 	}, function(error){
// 		console.log('[/list] Response:');
// 		respond(resObj, res);
// 	});
// });
/** Create a new database on Firebase, create a new Bucket on S3, copy the seed to the bucket, set the bucket permissions
 * @endpoint /generate
 * @params {string} Name Name of list to retreive
 * @params {string} Uid Uid of user to generate for
 */
router.post('/generate', function(req, res){
	console.log('generate request received:', req.body);
	if(req.body.hasOwnProperty('name') && req.body.hasOwnProperty('uid')){
		console.log('[/generate] request is the correct shape');
		var newAppName = "pyro-" + req.body.uid;
		pyrofb.child('instances').child(newAppName).once('value', function(appSnap){
				console.log('[/generate appSnap:]:', appSnap);
				if(!appSnap.val()){
					// [TODO] check that author is the author of the instance
					console.log('request has name param:', newAppName);
					// Log into Server Firebase account
					// generateFirebase
					generatePyroApp(req.body.uid).then(function(pyroAppData){
						console.log('[/generate App generated successfully]:', pyroAppData);
						pyroAppData.status = 200;
						respond(pyroAppData, res);
					}, function(err){
						respond(err, res);
					});
				}
				else {
					respond({status:500, message:'App By that name already exists on pyro.'}, res);
				}
		}, function(err){
			console.error('error getting app reference:', err);
			respond({status:500,  error:err.error, code:err.code}, res);
		});
	} else {
		respond({status:500, message:'Incorrect request format'}, res);
	}
});
/** Create a new Bucket on S3, copy the seed to the bucket, set the bucket permissions
 * @endpoint /app/new
 * @params {string} Name Name of list to retreive
 * @params {string} Uid Uid of user to generate for
 */
router.post('/app/new', function(req, res){
	console.log('generate request received:', req.body);
	if(req.body.hasOwnProperty('name') && req.body.hasOwnProperty('uid')){
		console.log('[/generate] request is the correct shape');
		pyrofb.child('instances').child(newAppName).once('value', function(appSnap){
				console.log('[/generate appSnap:]:', appSnap);
				if(!appSnap.val()){
					// [TODO] check that author is the author of the instance
					console.log('request has name param:', newAppName);
					// Log into Server Firebase account
					// generateFirebase
					newApp(req.body.name).then(function(pyroAppData){
						console.log('[/generate App generated successfully]:', pyroAppData);
						pyroAppData.status = 200;
						respond(pyroAppData, res);
					}, function(err){
						respond(err, res);
					});
				}
				else {
					respond({status:500, message:'App By that name already exists on pyro.'}, res);
				}
		}, function(err){
			console.error('error getting app reference:', err);
			respond({status:500,  error:err.error, code:err.code}, res);
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
		createFirebaseAccount(req.body.email, req.body.password).then(function(account){
			var fbAccountData = {token: account.adminToken, email:req.body.email};
			respond({status:200, account: account, message:'fb account created successfully'}, res);
		}, function(errResponse){
			respond(errResponse, res);
		});
	} else {
		respond({status:500, message:'Incorrectly formatted request'}, res);
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
		getFirebaseAccount(req.body.email, req.body.password).then(function(account){
				console.log('Account for:' + req.body.email + ' has been updated to:' + account.adminToken);
				respond({status:200, account: account, message:' Account loaded successfully'}, res);
		}, function(err){
			respond(err, res);
		}); 
	} else {
		respond({status:500, message:'Incorrectly formatted request'}, res);
	}
});
/** Get Fb Instance
 * @endpoint api/fb/instance/get
 * @params {string} uid Uid of account to get
 * @params {string} instanceName Name of instance you would like to get
 */
router.post('/fb/instance/get', function(req, res){
	if(req.body.hasOwnProperty('name') && req.body.hasOwnProperty('uid')) {
		getFirebaseInstance(req.body.uid, req.body.name).then(function(returnedInstance){
			respond({status:200, instance: returnedInstance}, res);
		}, function(err){
			console.error('error getting firebase instance:', err);
			respond(err, res);
		});
	} else {
		respond({status:500, message:'Incorrectly formatted request'}, res);
	}
});
/** Configure email/password auth on Firebase account given uid 
 * @endpoint api/fb/config
 * @params {string} uid Uid of account to enable email auth on
 * @params {string} name Name of instance to enable email auth on
 */
router.post('/fb/config', function(req, res){
	console.log('api test post received:', req.body);
	getFirebaseAccountFromUid(req.body.uid).then(function(account){
		enableEmailAuth(account, "pyro-" + req.body.name, res, function(){
			console.log('emailAuth enabled successfully');
			respond({status:200, message:'emailAuth enabled successfully for ' + req.body.name}, res);
		});
	}, function(err){
		console.error('error getting firebase account from uid', err);
		respond(resObj, res);
	});
});
/** NOT WORKING  Delete the pyro application given name. This includes the S3 bucket, and should have the option to include the Firebase instance and Account seperatetly in the delete.
 * @endpoint api/delete
 * @params {string} email Email of account to get
 * @params {string} password Password of account to get
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
		  account.deleteDatabase(dbName).then(function(instance) {
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
/** TEST ENDPOINT Params are always changing so they are not listed
 * @endpoint api/test
 */
router.post('/test', function(req, res){
	console.log('api test post received:', req.body);
	saveFolderToFirebase(req.body.name).then(function(jsonFolder){
		console.log('JSON folder:', jsonFolder);
		respond({status:200, message:'Save folder to firebase successful'}, res);
	}, function(error){
		respond(error,res);
	});
});
// -------------------Helper Functions------------------
/** Respond with a status header if available
 * @function respond
 * @params {string} Response info
 * @params {string} res Response object to send responses with/to
 */
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
function newApp(newAppName){
	console.log('newApp:', argUid);
	// create new firebase with "pyro-"" ammended to front of the app name
	var deferred = Q.defer();
	var appObj = {name: newAppName};
	var bucketName = "pyro-" + req.body.name;
	createS3Bucket(newAppName).then(function() {
  	uploadToBucket(bucketName, "fs/seed", newAppName).then(function(bucketUrl){
  		appObj.appUrl = bucketUrl;
  		saveFolderToFirebase(newAppName).then(function(jsonFolder){
  			// appObj.structure = jsonFolder;
  			deferred.resolve(appObj);
  		}, function(error){
  				console.error('[newApp] saving folder structure to Firebase:', err);
  				deferred.reject(error);
  		});
  	}, function(err){
				console.error('[newApp] error uploading seed to S3:', err);
  			deferred.reject(error);
  	});
	}, function(err){
		console.error('[newApp] creating S3 bucket:', err);
		deferred.reject(error);
	});
	return deferred.promise;
}
		

/** Create a new Database, and copy a new app to a new S3 bucket under the same bucket name as the database
 * @function generatePyroApp
 * @params {string} Email Email of new Firebase account to create
 * @params {string} Password Name of new instance
 */
function generatePyroApp(argUid, argName) {
	console.log('generatePyroApp:', argUid);
	// create new firebase with "pyro-"" ammended to front of the app name
	var deferred = Q.defer();
	var firebaseObj = {};
  firebaseObj.dbName = 'pyro-'+ argName;
  console.log('creating instance with name:', firebaseObj.dbName);
	createFirebaseInstance(req.body.uid, newAppName).then(function(returnedFbUrl){
	  console.log('[generatePyroApp] create firebase successfully returned:', returnedFbUrl);
		firebaseObj.fbUrl = returnedFbUrl;
		createS3Bucket(newAppName).then(function() {
	  	uploadToBucket(newAppName, "fs/seed").then(function(bucketUrl){
	  		firebaseObj.appUrl = bucketUrl;
	  		saveFolderToFirebase(newAppName).then(function(jsonFolder){
	  			// firebaseObj.structure = jsonFolder;
	  			deferred.resolve(firebaseObj);
	  		}, function(error){
	  				console.error('[generatePyroApp] saving folder structure to Firebase:', err);
	  				deferred.reject(error);
	  		});
	  	}, function(err){
					console.error('[generatePyroApp] error uploading seed to S3:', err);
	  			deferred.reject(error);
	  	});
  	}, function(err){
  		console.error('[generatePyroApp] creating S3 bucket:', err);
			deferred.reject(error);
  	});
	}, function(err){
		console.error('[generatePyroApp] error creating firebase instance', err);
		deferred.reject(error);
	});
	return deferred.promise;
}
/** Create a new Firebase Account
 * @function createFirebaseAccount
 * @params {string} Email Email of new Firebase account to create
 * @params {string} Password Name of new instance
 */
function createFirebaseAccount(argEmail, argPass) {
	// [TODO] Add a counter to pyroApp of how many firebase accounts we have created
	console.log('createFirebaseAccount() called with:', argEmail, argPass);
	var deferred = Q.defer();
	// check for account
	if(argEmail && argPass){
		var urlObj = {
			protocol:'https:', 
			host:'admin.firebase.com', 
			pathname:'/joinbeta', 
			query: {
				email: argEmail,
				password: argPass
			},
			json: true
		};
		console.log('urlObj:', urlObj);
		var requestUrl = url.format(urlObj);
		request.get(requestUrl, function(error, response, body){
			var bodyData = JSON.parse(body);
			if(!error && !bodyData.hasOwnProperty('error')) {
				console.log('Firebase account created successfully:', bodyData);
				deferred.resolve(bodyData);
			} else {
				console.warn('[createFirebaseAccount] Error creating Firebase account:', bodyData.error);
				var errObj = {status:401, error:bodyData.error, message:'Error creating Firebase account:' + bodyData.error};
				if(error){
					console.error('[createFirebaseAccount] Error exists:', error);
					errObj.error2 = error;
				}
				console.error('[createFirebaseAccount] error with create account request:', errObj);
				deferred.reject(errObj);
			}
		});
	} else {
		console.error('[createFirebaseAccount] Request does not contain correct credentials');
		deferred.reject({status:500, message:'Invalid account credentials'});
	}
	return deferred.promise;
}
/** Create a new Firebase App
 * @function createFirebaseInstance
 * @params {string} Uid Uid of user to create firebase instance on (Auth info is looked up)
 * @params {string} Name Name of new instance
 */
function createFirebaseInstance(argUid, argName) {
	console.log('createFirebaseInstance called:', argUid, argName);
	var deferred = Q.defer();
	getFirebaseAccountFromUid(argUid).then(function(account){
		account.createDatabase(argName).then(function(instance) {
	    // var appfb = new Firebase(instance.toString());
	    console.log('instance created:', instance.toString());
	    // Enable email & password auth
	    deferred.resolve(instance.toString());
	  }).catch(function(err) {
	    console.error('Error creating firebase instance:', err);
	    deferred.reject({status:500, message:JSON.stringify(err)});
	  });
	}, function(err1){
	    deferred.reject({status:500, message:JSON.stringify(err1)});
	});
	return deferred.promise;
}
/** Create a new Firebase App
 * @function getFirebaseInstance
 * @params {string} Uid Uid of user to get firebase instance with (Auth info is looked up)
 * @params {string} Name Name of instance to get
 */
function getFirebaseInstance(argUid, argName) {
	console.log('createFirebaseInstance called:');
	var deferred = Q.defer();
	if(argUid && argName){
		console.log('Instance info:', argUid, argName);
		getFirebaseAccountFromUid(argUid).then(function(account){
			account.getDatabase(argName).then(function(instance) {
		    // var appfb = new Firebase(instance.toString());
		    console.log('instance created:', instance.toString());
		    // Enable email & password auth
		    deferred.resolve(instance.toString());
		  }).catch(function(err) {
		    console.error('Error getting firebase instance:', err);
		    deferred.reject({status:500, message:JSON.stringify(err)});
		  });
		}, function(err1){
		    deferred.reject({status:500, message:JSON.stringify(err1)});
		});
	} else {
		deferred.reject({status:500, message:'Incorrect request format'});
	}

	return deferred.promise;
}
/** Enable email authentication on Firebase given firebase account and name of instance to enable email auth on
 * @function enableEmailAuth
 * @params {string} account Email of account you would like to get
 * @params {string} dbName Name of database to enable email authentication on
 */
function enableEmailAuth(argAccount, argDbName) {
	console.log('enableEmailAuth called');
	var deferred = Q.defer();
	argAccount.getDatabase(argDbName).then(function(instance){
		console.log('instance:', instance.toString());
		instance.setAuthConfig({password:{"enabled":true}}).then(function(){
			console.log('Email&Password Authentication enabled succesfully for:', instance.toString());
			deferred.resolve({status:200, message:'Email&Password Authentication enabled succesfully for ' + argDbName});
		});
	}, function(error){
		console.error('error seeing auth config', error);
		deferred.reject({status:500, message:'Error enabling auth settings'});
	});
	return deferred.promise;
}
/** Get Firebase Account given email and password
 * @function getFirebaseAccountFromUid
 * @params {string} uid Uid of user to get Firebase Account of
 */
function getFirebaseAccountFromUid(argUid){
	console.log('getFirebaseAccountFromUid:', argUid);
	var deferred = Q.defer();
	pyrofb.child('fbData').child(argUid).once('value', function(fbDataSnap){
		if(fbDataSnap.val() != null) {
			console.log('[getFirebaseAccountFromUid] returned fbData:', fbDataSnap.val());
			var account = new FirebaseAccount(fbDataSnap.val().token);
			deferred.resolve(account);
		} else {
			console.log('[getFirebaseAccountFromUid] FbData does not exist for this user');
			deferred.reject({status:401, message:'Incorrect user credentials'});
		}
	}, function(err){
			console.error('[getFirebaseAccountFromUid] Could not lookup fbData:', err);
			if(err.code == 'PERMISSION_DENIED'){
				deferred.reject({status:401, message:'Incorrect user credentials from uid'});
			} else {
				deferred.reject({status:500, message:'Server Error'});
			}
	});
	return deferred.promise;
}
/** Get Firebase Account given email and password
 * @function getFirebaseAccount
 * @params {string} email Email of account you would like to get
 * @params {string} password Password of Firebase you would like to get
 */
function getFirebaseAccount(argEmail, argPass){
	console.log('getFirebaseAccount', argEmail, argPass);
	var deferred = Q.defer();
	FirebaseAccount.getToken(argEmail, argPass).then(function(token) {
	  var account = new FirebaseAccount(token);
	  console.log('getFirebaseAccount successful:', account);
	  deferred.resolve(account);
	}, function(error){
		console.error('Error getting firebase token:', error);
		var errObj = {status:401, message:'Error getting Firebase account', error: error.toString().replace("Error: ", "")};
		console.warn('error response:', errObj);
		deferred.reject(errObj);
	}); //-- getToken
	return deferred.promise;
}
/** Get App Firebase from App Name
 * @function getAppFb
 * @params {string} appName Name of app to get Firebase of
 */
function getAppFb(argAppName){
	console.log('getAppFb called for:', argAppName);
	var deferred = Q.defer();

	pyrofb.child('instances').child(argAppName).once('value', function(instanceSnap){
		if(instanceSnap.val() && instanceSnap.val().hasOwnProperty('dbUrl')){
			var appFbUrl = instanceSnap.val().dbUrl
			var fb = new Firebase(appFbUrl);
			deferred.resolve(fb);
		} else {
			deferred.reject({status:500, message: 'App by that name does not exist'});
		}
	});
	return deferred.promise;
}
/** Upload to a bucket
 * @function uploadToBucket
 * @params {string} bucketName Name of bucket to upload to
 */ 
function uploadToBucket(argBucketName, argLocalDir, argAppName){
	console.log('uploadToBucket called:', argBucketName);
	var dbUrl = "https://"+argBucketName+".firebaseio.com";
	if(argAppName) {
		dbUrl = "https://"+argAppName+".firebaseio.com"
	}
	var newAppDir = 'fs/'+ argBucketName;
	var deferred = Q.defer();
	fs.copy(argLocalDir, newAppDir , function(err){
		replace({regex:"ZZ", replacement:dbUrl, paths:[newAppDir+"/app.js"]});
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
			deferred.reject({status:500, error:err});
		});
		// uploader.on('progress', function() {
		//   console.log("progress", uploader.progressAmount, uploader.progressTotal);
		// });
		uploader.on('end', function() {
		  console.log("Upload succesful");
			// [TODO] Delete new app folders
		  var bucketUrl = argBucketName + '.s3-website-us-east-1.amazonaws.com';
		  var resObj = {status:200, url:bucketUrl, message:'Seed app upload successful to bucket named:' + argBucketName};
		  console.log('uploadToBucket responding:', resObj);
		  deferred.resolve(resObj);
		});	
	})
	return deferred.promise;
}
/** Create a new bucket
 * @function createS3Bucket
 * @params {string} bucketName Name of bucket to create
 */
function createS3Bucket(argBucketName) {
	console.log('createS3Bucket called');
	var deferred = Q.defer();
	if(argBucketName) {
		var s3bucket = new awsSdk.S3();
		s3bucket.createBucket({Bucket: argBucketName},function(err1, data1) {
			if(err1){
				console.error('error creating bucket:', err1);
				deferred.reject({status:500, error:err1});
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
						deferred.reject({status:500, error:err});
					} else {
						console.log('website config set for ' + argBucketName, data1.location);
						deferred.resolve(data1.location);
					}
				});
			}
		});
	} else {
		deferred.reject({status:500, message:'Invalid Bucket Name'});
	}
	return deferred.promise;
}
/** Get list of object in a given bucket name
 * @function seperateS3Url
 * @params {string} url Url to seperate name from
 */
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

/** Get list of object in a given bucket name
 * @function getListOfS3BucketContents
 * @params {string} bucketName Name of bucket to get list of objects from
 */
function getListOfS3BucketContents(argBucketName) {
	// [TODO] Secure this
	console.log('getListOfS3BucketContents:', argBucketName);
	var deferred = Q.defer();
	if(argBucketName){
		var bucket = new awsSdk.S3({params: {Bucket: argBucketName}});
		bucket.listObjects(function (err, data) {
		  if (!err) {
		  	console.log('[getListOfObject] Loaded ' + data.Contents.length + ' items from S3:', data.Contents);
		    pyrofb.child('instances').child(argBucketName).update({fileStructure:data.Contents}, function(fbErr){
		    	if(!fbErr) {
		    		deferred.resolve(data.Contents);
		    	} else {
		    		console.error('[getListOfObject] Error writing list to firebase:', fbErr);
		    		deferred.reject({status:500, error:fbErr, message:'Server Error: Retreived list not saved.'});
		    	}
		    });
		  } else {
		    console.error('[getListOfObject] Could not load objects from S3 - ', err);
		    deferred.reject({status:500, error:err, message:'Could not load objects from S3'});
		  }
		});
	} else {
		deferred.reject({status:500, message:'Invalid Bucket name'});
	}
	return deferred.promise;
}
/** Converts a folder structure to JSON including file types given App name
 * @function saveFolderToFirebase
 * @params {string} AppName Name of App that you would like to get
 * @description Adds extension to access folder on local system. In our case that is "fs/pyro-"
 */
function saveFolderToFirebase(argAppName){
	var deferredSave = Q.defer();
	var appFolder = "fs/pyro-"+ argAppName;
	var jsonTree = util.inspect(dirTree(appFolder), {depth:12}, null);

	// console.log('jsonTree:', jsonTree);
	console.log('filetree', eval('('+jsonTree + ')'));
	pyrofb.child('appFiles').child(argAppName).set(eval('('+jsonTree+ ')'), function(error){
		if(!error){
			deferredSave.resolve(eval('('+jsonTree+ ')'));
		} else {
			deferredSave.reject({status:500, message:'Error writing file tree to firebase', error:error});
		}
	});
	return deferredSave.promise;
}
/** Create a directory tree in JSON format given a path
 * @function dirTree
 * @params {string} Path Folder or File path that contains structure to JSONify
 */
function dirTree(filename) {
  var stats = fs.lstatSync(filename)
  var info = {
    path: filename,
    name: path.basename(filename)
  };
  if (stats.isDirectory()) {
    info.type = "folder";
    info.children = fs.readdirSync(filename).map(function(child) {
        return dirTree(path.join(filename, child));
    });
  } else {
    // Assuming it's a file. In real life it could be a symlink or
    // something else!

    info.type = "file";
    info.filetype = mime.lookup(info.path).split("/")[1];
    // convert file to string and remove line breaks
  	// info.contents = fs.readFileSync(info.path, 'utf8').replace(/(\r\n|\n|\r)/gm,"");
  }
  return info;
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
// Check params function that may or may not work
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