// Pyro Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
angular.module('pyroApp', ['ionic', 'pyroApp.controllers'])
.constant('FBURL', 'ZZ')
.run(function($ionicPlatform) {
  // Use Ionic to setup device defaults
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if(window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if(window.StatusBar) {
      // Set the statusbar to use the default style, tweak this to
      // remove the status bar on iOS or change it to use white instead of dark colors.
      StatusBar.styleDefault();
    }
  });
})
.config(function($stateProvider, $urlRouterProvider) {

  // Ionic uses AngularUI Router which uses the concept of states
  // Learn more here: https://github.com/angular-ui/ui-router
  // Set up the various states which the app can be in.
  // Each state's controller can be found in controllers.js
  $stateProvider
    .state('sidemenu', {
      abstract:true,
      templateUrl:'templates/sidemenu.html'
    })
    .state('home', {
      parent:'sidemenu',
      url: '/home',
      controller:'HomeCtrl',
      templateUrl: 'components/home/home-index.html',
    })
    .state('landing', {
      url: '/landing',
      controller:'LandingCtrl',
      templateUrl: 'components/landing/landing-index.html'
    })
    .state('login', {
      url: '/login',
      controller:'LoginCtrl',
      templateUrl: 'components/session/login/login-index.html'
    })
    .state('signup', {
      url: '/signup',
      controller:'SignupCtrl',
      templateUrl: 'components/session/signup/signup-index.html'
    })
    .state('account', {
      url: '/account',
      controller:'AccountCtrl',
      templateUrl: 'components/session/account/account-index.html'
    })
    ;
  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/landing');
});