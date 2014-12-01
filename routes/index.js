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
  res.render('index', { title: 'Pyro Server' });
});
/* UPDATE
params:
	author
	name
*/
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

router.post('/test', function(req, res){
	console.log('test post received:');
});
// Helper Functions
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
module.exports = router;
