var express = require('express');
var router = express.Router();
var FirebaseTokenGenerator = require("firebase-token-generator");

var qs = require('querystring');

/* GET users listing. */
router.post('/', function(req, res) {
	// var body = '';
	// req.on('data', function(data){
	// 	body += data;
	// 	if(body.length > 1e6) {
	// 		// FLOOD ATTACK OR FAULTY CLIENT, NUKE REQUEST
 //      request.connection.destroy();
	// 	}
	// })
	// req.on('end', function() {
	// 	console.log('data received:', qs.parse(req.body));
	// });
	if(req.body.hasOwnProperty('secret')) {
		console.log('Request Received:', req.body);
		var tokenGenerator = new FirebaseTokenGenerator(req.body.secret);
		var token = tokenGenerator.createToken({uid: "1",});
		res.writeHead(200, {'Content-Type':'application/json'});
		res.write(token);
	  res.end();
	}
	else {
		res.writeHead(501, {'Content-Type':'application/json'});
		res.end('Incorrect request format');
	}
});
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
