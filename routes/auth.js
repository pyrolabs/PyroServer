var express = require('express');
var router = express.Router();
var FirebaseTokenGenerator = require("firebase-token-generator");

var qs = require('querystring');

router.post('/admin', function(req, res) {
	if(req.body.hasOwnProperty('secret')) {
		console.log('Admin Request Received:', req.body);
		var tokenGenerator = new FirebaseTokenGenerator(req.body.secret);
		var token = tokenGenerator.createToken({uid: "pyroAdmin"}, 
		{admin:true, debug:true});
		res.writeHead(200, {'Content-Type':'application/json'});
		res.write(token);
	  res.end();
	}
	else {
		res.writeHead(501, {'Content-Type':'application/json'});
		res.end('Incorrect request format');
	}
});
module.exports = router;
