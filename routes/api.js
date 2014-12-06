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
var util = require('util');
var path = require('path');

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
	if(req.body.hasOwnProperty('name') && req.body.hasOwnProperty('uid')){
		console.log('it is the correct shape');
		var newAppName = "pyro-" + req.body.name;

		pyrofb.child('instances').child(newAppName).once('value', function(appSnap){
				console.log('appSnap:', appSnap);
				if(!appSnap.val()){
					// [TODO] check that author is the author of the instance
					console.log('request has name param:', newAppName);
					// Log into Server Firebase account
					// generateFirebase
					createFirebaseInstance(req.body.uid, newAppName, res, function(){
						createS3Bucket(newAppName, res, function() {
					  	uploadToBucket(newAppName, "fs/seed", res, function(bucketUrl){
					  		saveFolderToFirebase(newAppName).then(function(jsonFolder){
					  			respond({status:200, appUrl:bucketUrl, url:bucketUrl}, res);
					  		}, function(error){
					  			respond(error,res);
					  		});
					  	});
				  	});
					});
				}
		}, function(err){
			console.error('error getting app reference:', err);
			respond({status:500,  error:err.error, code:err.code}, res);
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
/** New Fb Account 
 * @endpoint api/fb/account/get
 * @params {string} email Email of account to get
 * @params {string} password Password of account to get
 */
router.post('/fb/account/new', function(req, res){
	if(req.body.hasOwnProperty('email') && req.body.hasOwnProperty('password')) {
		createFirebaseAccount(req.body.email, req.body.password, res, function(account){
			var fbAccountData = {token: account.adminToken, email:req.body.email};
			pyrofb.child('fbData').child(req.body.email).set(fbAccountData, function(){
				respond({status:200, account: account, message:'fb account created successfully'}, res);
			});
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
		getFirebaseAccount(req.body.email, req.body.password, res, function(account){
				console.log('Account for:' + req.body.email + ' has been updated to:' + account.adminToken);
				respond({status:200, account: account, message:' Account loaded successfully'}, res);

		}); 
	} else {
		respond({status:500, message:'Incorrectly formatted request'}, res);
	}
});
router.post('/fb/config', function(req, res){
	console.log('api test post received:', req.body);
	getFirebaseAccountFromUid(req.body.uid).then(function(account){
		enableEmailAuth(account, "pyro-" + req.body.name, res, function(){
			console.log('emailAuth enabled successfully');
			respond({status:200, message:'emailAuth enabled successfully for ' + req.body.name})
		});
	}, function(){
		console.error('error getting firebase account from uid');
		respond({status:500, message:'error getting firebase account from uid'})
	});
});
router.post('/test', function(req, res){
	console.log('api test post received:', req.body);
	saveFolderToFirebase(req.body.name).then(function(jsonFolder){
		console.log('JSON folder:', jsonFolder);
		respond({status:200, message:'Save folder to firebase successful'}, res);
	}, function(error){
		respond(error,res);
	});
});

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
var mime = require('mime');
	function dirTree(filename) {
	  var stats = fs.lstatSync(filename),
	      info = {
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

	function enableEmailAuth(argAccount, argDbName, argRes, cb) {
		console.log('enableEmailAuth called');
		argAccount.getDatabase(argDbName).then(function(instance){
			console.log('instance:', instance.toString());
			instance.setAuthConfig({password:{"enabled":true}}).then(function(){
				console.log('Email&Password Authentication enabled succesfully for:', instance.toString());
				if(cb){
					cb();
				} else {
					respond({status:200, message:'Email&Password Authentication enabled succesfully for ' + argDbName}, argRes);
				}
			});
		}, function(error){
			console.error('error seeing auth config', error);
			respond({status:500, message:'Error enabling auth settings'}, argRes);
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
function generateFirebase(argUid, argFBName, argRes, cb) {
	var firebaseObj = {};
	// create new firebase with "pyro-"" ammended to front of the app name
  firebaseObj.dbName = 'pyro-'+ argFBName;
  console.log('creating instance with name:', firebaseObj.dbName);
	createFirebaseInstance(argUid, firebaseObj.dbName, argRes, function(instance){
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
		//generateFirebase
}
function createFirebaseAccount(argEmail, argPass, argRes, cb) {
	console.log('CreateFirebaseAccount called with:', argEmail, argPass);
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
				console.log('Firebase account created successfully:', body.error);
				if(cb){
					cb(bodyData);
				} else {
					respond({success:true, status:200, message:'Firebase account created successfully', account:bodyData}, argRes);
				}

			} else {
				var errObj = {status:500, message:'Error creating Firebase account', error:bodyData.error};
				if(error){
					errObj.error2 = error;
				}
				console.error('error with create account request:', errObj);
				respond(errObj, argRes);
			}
		});
	} else {
		console.error('Request does not contain correct credentials');
		respond({status:500, message:'Invalid new account credentials'}, argRes);
	}

}

function createFirebaseInstance(argUid, argFBName, argRes, callback) {
	console.log('createFirebaseInstance called:', argUid, argFBName);
	getFirebaseAccountFromUid(argUid).then(function(account){
			account.createDatabase(argFBName).then(function(instance) {
	    // var appfb = new Firebase(instance.toString());
	    console.log('instance created:', instance.toString());
	    // Enable email & password auth
	    callback(instance.toString());
	  }).catch(function(err) {
	    console.error('Error creating firebase instance:', err);
	    respond({status:500, message:JSON.stringify(err)}, argRes);
	  });
	}, function(err1){
		respond({status:500, message:JSON.stringify(err1)}, argRes);
	});

} //-- createDatabase

function getFirebaseAccountFromUid(argUid){
	var deferred = Q.defer();
		pyrofb.child('fbData').child(argUid).once('value', function(fbDataSnap){
			console.log(fbDataSnap.val());
			if(fbDataSnap.val() != null) {
				var account = new FirebaseAccount(fbDataSnap.val().token);
				deferred.resolve(account);
			} else {
				console.log('FbData does not exist for this user');
				deferred.reject({message:'FbData does not exist for this user'});
			}
		});
		return deferred.promise;
}
function getFirebaseAccount(argEmail, argPass, argRes, cb){
	console.log('getFirebaseAccount', argEmail, argPass);
	FirebaseAccount.getToken(argEmail, argPass).then(function(token) {
	  var account = new FirebaseAccount(token);
	  console.log('getFirebaseAccount successful:', account);
	  if(cb){
	  	cb(account);
	  } else {
	  	respond({status:200, account: account}, argRes);
	  }
	}, function(error){
		console.error('Error getting firebase token:', error.toString());
		respond({status:401, message:'Error getting firebase account', error: error.toString()}, argRes);
	}); //-- getToken
}



// function generateAdminToken(argSecret, argRes, cb){
// 	if(argSecret) {
// 		console.log('Generate Admin Token called:', argSecret);
// 		var tokenGenerator = new FirebaseTokenGenerator(req.body.secret);
// 		var authToken = tokenGenerator.createToken({uid: "pyroAdmin"}, 
// 		{admin:true, debug:true});
// 		if(cb){
// 			cb(authToken);
// 		} else {
// 			respond({status:200, token:authToken}, argRes);
// 		}
// 	}
// 	else {
// 		respond({status:500, message:'Incorrect request format'}, argRes);
// 	}
// }
function getAppFb(argAppName, argRes, cb){
	console.log('getAppFb called for:', argAppName);
	pyrofb.child('instances').child(argAppName).once('value', function(instanceSnap){
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
	    pyrofb.child('instances').child(argBucketName).update({fileStructure:data.Contents}, function(){
	    	cb(data.Contents);
	    });
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