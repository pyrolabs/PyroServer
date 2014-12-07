angular.module('pyroApp.controllers', ['pyro.service'])
.controller('SidemenuCtrl', function($scope, $ionicSideMenuDelegate){
	$scope.toggleLeft = function() {
    $ionicSideMenuDelegate.toggleLeft();
  };
})