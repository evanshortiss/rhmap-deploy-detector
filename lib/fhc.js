'use strict';

const Promise = require('bluebird');
const fhc = Promise.promisifyAll(require('fh-fhc'));
const env = require('env-var');
const log = require('fh-bunyan').getLogger(__filename);
const R = require('ramda');


/**
 * Required environment variables for this service to run:
 * 	FHC_USER - The user you'd like to pass to "fhc login"
 * 	FHC_PASS - The password for the user you'd like to pass to "fhc login"
 * 	FHC_DOMAIN - The domain to pass to "fhc target"
 */
const USER = env('FHC_USER').required().asString();
const PASS = env('FHC_PASS').required().asString();
const DOMAIN = env('FHC_DOMAIN').required().asString();

// We need this to make valid requests to the studio so we store it to avoid
// the need to keep logging in
let loginInfo = null;

function executeCommand (cmd) {
  return fhc.applyCommandFunctionAsync(cmd)
    .tap((res) => {
      const cmdStr = cmd.join(' ');
      log.trace(`response from fhc command ${cmdStr}`, res);
    });
}


/**
 * Simple getter for login info
 * @return {Object|null}
 */
function getLoginInfo () {
  return loginInfo;
}


/**
 * Initialises the fh-fhc module for use and then performs a login. It will
 * ensure login information is persisted for future usage
 * @return {Promise}
 */
function init () {
  return fhc.loadAsync()
    .then(() => executeCommand(['target', DOMAIN]))
    .then(() => executeCommand(['login', USER, PASS]))
    .then((info) => {
      loginInfo = info;
    });
}


/**
 * Retrieves the GUIDs for all node applications on a domain
 * @return {Promise<Array>}
 */
function getNodeApplicationsForDomain () {
  return Promise.all([
    getNodeApplicationsFromServices(),
    getNodeApplicationsFromProjects()
  ])
    .then((results) => {
      return results[0].concat(results[1]);
    });
}


/**
 * Retrieves the GUIDs for all node applications that live in the Projects
 * section of the Studio.
 * @return {Promise<Array>}
 */
function getNodeApplicationsFromProjects () {
  var getAppsWithUpdatedTitles = R.map((project) => {
    R.forEach((app) => {
      app.title  = `${project.title} => ${app.title}`;
    }, project.apps);

    return project.apps;
  });


  return executeCommand(['projects', 'list'])
    .then(getAppsWithUpdatedTitles)
    // Joins all apps into a single array since currently it looks like
    // [
    //    [APP_1, APP_2] <= Project 1
    //    [APP_3] <= Project 2
    // ]
    .then((projectApps) => R.concat.apply(R, projectApps))
    .then((apps) => R.filter((a) => a.type === 'cloud_nodejs')(apps));
}


/**
 * Retrieves the GUIDs for all node applications in Services
 * @return {Promise<Array>}
 */
function getNodeApplicationsFromServices () {
  var getApps = R.map((project) => {
    R.forEach((app) => {
      // services have just one app named "Cloud App", so use the service name
      app.title  = project.title;
    }, project.apps);

    return project.apps;
  });

  return executeCommand(['services', 'list'])
    .then(getApps)
    .then((serviceApps) => {
      return R.concat.apply(R, serviceApps);
    });
}


/**
 * Returns an Array containing environments.
 * Will return a cached copy after the first successful call.
 * @return {Promise<Array>}
 */
var getEnvironments = (function getEnvironments () {
  var envs = null;

  return function () {
    if (envs) {
      return Promise.resolve(envs);
    }

    return executeCommand(['admin', 'environments', 'list'])
      .then(R.pluck('id'))
      .tap((_envs) => {
        envs = _envs;
      });
  };
})();

module.exports = {
  init: init,
  getLoginInfo: getLoginInfo,
  executeCommand: executeCommand,
  getEnvironments: getEnvironments,
  getNodeApplicationsForDomain: getNodeApplicationsForDomain
};
