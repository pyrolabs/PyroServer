var express = require('express');
var router = express.Router();
var FirebaseAccount = require('firebase-admin');
var Firebase = require('firebase');
var s3 = require('s3');
var client = s3.createClient({
	s3Options:{
		accessKeyId: process.env.PYRO_SERVER_S3_KEY,
		secretAccessKey: process.env.PYRO_SERVER_S3_SECRET
	}
});
var fbInfo = {email: process.env.PYRO_INFO_EMAIL, password: process.env.PYRO_INFO_PASS};
/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});
router.post('/create', function(req, res){
	console.log('request received:', req.body);
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
		    	// client.copyObject().on('end', function(){

		    	// });
		    	res.writeHead(201, {'Content-Type':'text/plain'});
					res.write(newAppName);
				  res.end();
		    })
		    
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
	var copyTask = client.copyObject({Bucket:'pyro-labs', CopySource:'pyro-cdn/seed/index.html', Key:'index.html'});
	copyTask.on('end', function(data){
		console.log('Copy successful:', data);
		res.writeHead(201, {'Content-Type':'application/json'});
		res.write(JSON.stringify(data));
	  res.end();
	});
	copyTask.on('error', function(err){
		console.error('Error copying:', err);
		res.writeHead(500, {'Content-Type':'application/json'});
		res.write(JSON.stringify(err));
		res.end();
	});
});

module.exports = router;
