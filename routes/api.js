var express = require('express');
var router = express.Router();
var FirebaseAccount = require('firebase-admin');
var Firebase = require('firebase');
var s3 = require('s3');
var awsSdk = require('s3/node_modules/aws-sdk');
var pyrofb = new Firebase("https://pyro.firebaseio.com");

var client = s3.createClient({
	s3Options:{
		accessKeyId: process.env.PYRO_SERVER_S3_KEY,
		secretAccessKey: process.env.PYRO_SERVER_S3_SECRET
	}
});
var fbInfo = {email: process.env.PYRO_INFO_EMAIL, password: process.env.PYRO_INFO_PASS};
awsSdk.config.update({accessKeyId:process.env.PYRO_SERVER_S3_KEY, secretAccesssKey:process.env.PYRO_SERVER_S3_SECRET})
router.post('/generate', function(req, res){
	console.log('generate request received:', req.body);
	if(req.body.hasOwnProperty('name') && req.body.hasOwnProperty('author')){
		var newAppName = req.body.name;
		pyrofb.child('instances').child(newAppName).once('value', function(appSnap){
			if(appSnap.val() == null){
				//App doesn't already exist in firebase
				var author = req.body.author;
				console.log('request has name param:', newAppName);
				// Log into Server Firebase account
				FirebaseAccount.getToken(fbInfo.email, fbInfo.password).then(function(token) {
				  var account = new FirebaseAccount(token);
				  // create new firebase with "pyro-"" ammended to front of the app name
				  var dbName = 'pyro-'+ newAppName;
				  account.createDatabase(dbName).then(function(instance) {
				    // var appfb = new Firebase(instance.toString());
				    console.log('instance created:', instance.toString());
				    // Save new instance to pyro firebase
				    var instanceObj = {name:newAppName, url:instance.toString(), author:author};
				    pyrofb.child('instances').child(newAppName).set(instanceObj, function(){
			    		var s3bucket = new awsSdk.S3();
							s3bucket.createBucket({Bucket: dbName},function(err1, data1) {
								if(err1){
									console.error('error creating bucket:', err1);
									respond(err1, res);
								} else {
									console.log('bucketCreated successfully:', data1);
									s3bucket.putBucketWebsite({
										Bucket: dbName, 
										WebsiteConfiguration:{
											IndexDocument:{
												Suffix:'index.html'
											}
										}
									}, function(err, data){
										if(err){
											console.error('Error creating bucket website setup');
											respond(err, res);
										} else {
											console.log('website config set');
											// put first object
											var upParams = {
											  localDir: "fs/seed",
											  s3Params: {
											    Bucket: dbName,
											    Prefix: "",
											    ACL:'public-read'
											  },
											};
											var uploader = client.uploadDir(upParams);
											uploader.on('error', function(err) {
										  	console.error("unable to sync:", err.stack);
										  	respond(err, res);
											});
											uploader.on('progress', function() {
											  console.log("progress", uploader.progressAmount, uploader.progressTotal);
											});
											uploader.on('end', function() {
											  console.log("done uploading");
											  var responseInfo = {status:200, url:dbName + '.s3-website-us-east-1.amazonaws.com', message:'Seed app upload successful for ' + newAppName};
												respond(responseInfo, res);
											});	
										}

									});
									
										// s3bucket.moveObject({CopySource:'pyro-cdn/seed', Key:''}, function(err, data) {
									 //    if (err) {
									 //      console.error("Error uploading data: ", err);
									 //      respond(err, res);
									 //    } 
									 //    else {
									 //      console.log("Successfully uploaded data to myBucket/myKey");
							   //    		// [TODO] Copy new app to new bucket
								  //   		// [TODO] Delete local app instance after upload to s3 is completed successfully
										// 		// Successful response
										// 		var responseInfo = {status:201, message:'Successful Generation. App available at:'};
										// 		respond(responseInfo, res);
										// 	}
									 //  }); //--putObject
									// });

								}
							}); //--createBucket
						}); 
				  }).catch(function(err) {
				    console.error('Oops, error creating instance:', err);
				    respond({status:500, message:JSON.stringify(err)}, res);
				  }); //-- createDatabase
				}); //-- getToken
			} else {
				respond({status:500, message:'App with this name already exists'}, res);
			}
		});
		
	} else {
		respond({status:500, message:'Incorrect request format'}, res);
	}
});


/* CREATE
params:
	author
	name
	Creates new firebase instance on pyro_server firebase account formatted as follows:
	 "pyro-exampleApp"

	Sends instance info to Firebase:
	instance:{name:'exampleApp', fburl:'pyro-exampleApp.firebaseio.com', author:'$uid of author'} 
 
*/

router.post('/create', function(req, res){
	console.log('request received:', req.body);
	if(req.body.hasOwnProperty('name') && req.body.hasOwnProperty('author')){
		var newAppName = req.body.name;
		var author = req.body.author;
		console.log('request has name param:', newAppName);
		// Log into Server Firebase account
		FirebaseAccount.getToken(fbInfo.email, fbInfo.password).then(function(token) {
		  var account = new FirebaseAccount(token);
		  // create new firebase with "pyro-"" ammended to front of the app name
		  var dbName = 'pyro-'+ req.body.name;
		  account.createDatabase(dbName).then(function(instance) {
		    // var appfb = new Firebase(instance.toString());
		    var pyrofb = new Firebase("https://pyro.firebaseio.com");
		    console.log('instance created:', instance.toString());
		    // Save new instance to pyro firebase
		    var instanceObj = {name:newAppName, url:instance.toString(), author:author};
		    pyrofb.child('instances').child(newAppName).set(instanceObj, function(){
		    	res.writeHead(201, {'Content-Type':'text/plain'});
					res.write(newAppName);
				  res.end();
		    });
		    
		  }).catch(function(err) {
		    console.error('Oops, error creating instance:', err);
		    res.writeHead(500, {'Content-Type':'text/plain'});
				res.write(err.toString());
				res.end();
		  });
		})
	} else {
		respond({status:500, message:'Incorrect request format'}, res);
	}
});
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
router.post('/updateCdn', function(req, res){
	var downParams = {
		localDir:"fs/seed",
		s3Params:{
			Bucket:'pyro-cdn',
			Prefix:'seed'
		}
	};
	var downloader = client.downloadDir(downParams);
	downloader.on('end', function(){
		console.log('seed downloaded to server');
		var responseInfo = {status:200, message:'Seed downloaded to server'};
		respond(responseInfo, res)
	});
	downloader.on('error', function(err){
		console.error('unable to download:', err);
		var responseInfo = {status:500, message:'Error downloading seed'};
		respond(responseInfo, res);
	});
});
router.post('/delete', function(req, res){
	console.log('Delete request received:', req.body);
	// [TODO] Make this delete firebase
		if(req.body.hasOwnProperty('name') && req.body.hasOwnProperty('author')){
		var newAppName = req.body.name;
		var author = req.body.author;
		console.log('request has name param:', newAppName);
		FirebaseAccount.getToken(fbInfo.email, fbInfo.password).then(function(token) {
		  var account = new FirebaseAccount(token);
		  var dbName = 'pyro-'+ req.body.name;
		  account.createDatabase(dbName)
		  .then(function(instance) {
		    var appfb = new Firebase(instance.toString());
		    var pyrofb = new Firebase("https://pyro.firebaseio.com");
		    console.log('instance created:', instance.toString());
		    // Save new instance to pyro firebase
		    var instanceObj = {name:newAppName, url:instance.toString(), dbName:dbName, author:author};
		    pyrofb.child('instances').child(newAppName).set(instanceObj, function(){
		    	res.writeHead(201, {'Content-Type':'text/plain'});
					res.write(newAppName);
				  res.end();
		    });
		    
		  }).catch(function(err) {
		    console.error('Oops, error creating instance:', err);
		    res.writeHead(500, {'Content-Type':'text/plain'});
				res.write(err.toString());
				res.end();
		  });
		})
	} else {
		res.writeHead(500, {'Content-Type':'application/json'});
		res.write('Incorrect request format');
		res.end();
	}
});
router.post('/test', function(req, res){
	console.log('post received:');
	// Create Bucket
		var s3bucket = new awsSdk.S3();
		s3bucket.createBucket({Bucket: 'pyro-testBucket'},function(err1, data1) {
			if(err1){
				console.error('error creating bucket:', err1);
				respond(err1, res);
			} else {
				console.log('bucketCreated successfully');
			  var data = {Key: 'testKey', Body: 'Hello!', Bucket:'pyro-testBucket'};
			  s3bucket.putObject(data, function(err, data) {
			    if (err) {
			      console.error("Error uploading data: ", err);
			      respond(err, res);
			    } 
			    else {
			      console.log("Successfully uploaded data to myBucket/myKey");
	      		// [TODO] Copy new app to new bucket
		    		// [TODO] Delete local app instance after upload to s3 is completed successfully
						// Successful response
						var responseInfo = {status:201, message:'Successful Generation. App available at:'};
						respond(responseInfo, res);
					}
			  }); //--putObject
			}
		}); //--createBucket
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
});

module.exports = router;
