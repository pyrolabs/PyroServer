var express = require('express');
var router = express.Router();
var FirebaseAccount = require('firebase-admin');
var Firebase = require('firebase');
var fbInfo = {email: process.env.PYRO_INFO_EMAIL, password: process.env.PYRO_INFO_PASS};
/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});
router.post('/create', function(req, res){
	console.log('request received:', req.body);
	if(req.body.hasOwnProperty('name')){
		console.log('request has name param:', req.body.name);
		FirebaseAccount.getToken(fbInfo.email, fbInfo.password).then(function(token) {
		  var account = new FirebaseAccount(token);
		  var dbName = 'pyro-'+ req.body.name
		  account.createDatabase(dbName)
		  .then(function(instance) {
		    var fb = new Firebase(instance.toString());
		    console.log('instance created:', instance.toString());
		    // [TODO] Save new instance to pyro firebase
		    res.writeHead(201, {'Content-Type':'text/plain'});
				res.write(instance.toString());
			  res.end();
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

module.exports = router;
