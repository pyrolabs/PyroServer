angular.module('pyro.service', [])
.factory('pyroService', [ 'FBURL','pyroMaker',  function(FBURL, pyroMaker) {
	return pyroMaker(FBURL);
}])
.factory('pyroMaker', ['$q', function($q){
	return function (argPyroUrl){
		var auth = null;
		var account = null;
		var pyro = new Pyro({url:argPyroUrl});
			pyro.signup = function(argSignupData) {
				var deferred = $q.defer();
				pyro.userSignup(argSignupData, function(userAccount) {
		      console.log('signup + login successful:', userAccount);
		      deferred.resolve(userAccount);
		    }, function(err) {
		      console.warn('pyroSignup returned:', err);
		      deferred.reject(err);
		    });
		    return deferred.promise;
			};
			pyro.loginPromise =  function(argLoginData) {
				var deferredLogin = $q.defer();
				pyro.login(argLoginData, function(returnedAccount){
					deferredLogin.resolve(returnedAccount);
				}, function(err){
					deferredLogin.reject(err);
				});
				return deferredLogin.promise;
			};
			pyro.getUser = function() {
				var deferred = $q.defer();
				if(account != null) {
					deferred.resolve(account);
				}
				else {
					pyro.getUser(function(returnedAccount){
						account = returnedAcount;
						deferred.resolve(returnedAccount);
					});
				}
				return deferred.promise;
			};
			pyro.passwordLogin =  function(argLoginData) {
				console.log('passwordLogin = ', arguments);
				var deferredLogin = $q.defer();
				pyro.login(argLoginData, function(returnedAccount){
					deferredLogin.resolve(returnedAccount);
				}, function(err){
					deferredLogin.reject(err);
				});
				return deferredLogin.promise;
			};
			pyro.logout =  function() {
				var deferred = $q.defer();
				auth = null;
				account = null;
				pyro.logout(function(){
					deferred.resolve();
				});
				return deferred.promise;
			};
			pyro.getAuth =  function(){
				return pyro.getAuth();
			};
			pyro.getUser =  function(){
				var deferred = $q.defer();
				pyro.getUser(function(userAccount){
					deferred.resolve(userAccount);
				});
				return deferred.promise;
			};
			pyro.getListByAuthor =  function(argListName) {
				var deferredLoad = $q.defer();
				pyro.getListByAuthor(argListName, function(returnedList){
					deferredLoad.resolve(returnedList);
				});
				return deferredLoad.promise;
			};
			pyro.createObject = function(argListName, argObject) {
				var deferredCreate = $q.defer();
				// [TODO] Do this correctly with the library
				if(argListName == 'instances'){
					pyro.createInstance(argObject, function(newObject){
						deferredCreate.resolve(newObject);
					});
				} else {
					pyro.createObject(argListName, argObject, function(newObject){
						deferredCreate.resolve(newObject);
					});
				}
				return deferredCreate.promise;
			};
			pyro.loadObject = function(argListName, argObjectId){
				var deferredLoad = $q.defer();
				pyro.loadObject(argListName, argObjectId, function(loadedObject){
					deferredLoad.resolve(loadedObject);
				});
				return deferredLoad.promise;
			};
			pyro.deleteObject = function(argListName, argObjectId){
				pyro.deleteObject(argListName, argObjectId);
				console.log(argObjectId + ' was removed from the ' + argListName + ' list');
			};
			pyro.getObjectCount = function(argListName) {
				var deferred = $q.defer();
				pyro.getObjectCount(argListName,function(count){
					deferred.resolve(count);
				});
				return deferred.promise;
			};
			return pyro;
		}
	}
])