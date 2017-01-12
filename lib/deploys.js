'use strict';

var R = require('ramda');
const Promise = require('bluebird');
const fhc = require('lib/fhc');
const mongoUtils = require('mongo-dot-notation');
const studioReq = require('lib/studio-request');
const mongo = require('rhmap-mongodb');
const get = require('lodash.get');
const log = require('fh-bunyan').getLogger(__filename);

// Handy little getter for a mongo collection
const getCollection = mongo.collection.bind(mongo, 'cloud-apps');


/**
 * Makes a request to the studio and associates the latest deploy record with
 * the passed in app object. Not very functional, but ¯\_(ツ)_/¯
 * @param  {Object} app   The cloud app record in question
 * @param  {String} env   The environment to get deploys for
 * @return {Promise<Object>}
 */
function attachLatestDeployToApp (app, env) {
  return studioReq(
    `api/v2/mbaas/tke/${env}/apps/${app.guid}/deploy_history`
  )
    .then((res) => {
      if (res.statusCode === 200) {
        app.latestDeploy = app.latestDeploy || {};
        app.latestDeploy[env] = res.body[0]; // should not assume 0 is ok..
      } else {
        throw new Error(
          `received status ${res.statusCode} when getting deploy ` +
          `history for app ${app.guid} (${app.title})`
        );
      }
    })
    .thenReturn(app);
}


/**
 * Fetches the node app record from our local mongodb with and attaches the last
 * known deploy we recorded to the passed in app object.
 *
 * Again, not very functional, but ¯\_(ツ)_/¯
 *
 * @param  {Object} app   The cloud app record in question
 * @param  {String} env   The environment to get deploys for
 * @return {Promise<Object>}
 */
function attachPreviousDeployToApp (app) {
  return getCollection()
    .then((coll) => coll.findOne({guid: app.guid}))
    .then((existingAppEntry) => {
      if (existingAppEntry) {
        app.previousDeploy = existingAppEntry.latestDeploy;
      }
    })
    .thenReturn(app);
}


/**
 * Updates an node application record in mongodb with the latest version and
 * its lateste deploy record.
 * @param  {Object} app
 * @return {Promise}
 */
function updateAppInMongo (app) {
  return getCollection()
    .then((coll) => {
      return coll.update(
        {
          app: app.guid
        },
        mongoUtils.flatten(app), // does $set for all items - nice!
        {
          upsert: true
        }
      );
    });
}


/**
 * Returns a function that will filter applications so that only those that have
 * had their deployment status changed since our last check will be returned
 * @param  {String}   env
 * @return {Function}
 */
function getAppsWithUpdatedDeployState (env) {

  function hasBothDeployRecords (app) {
    return (
      get(
        app,
        `latestDeploy[${env}]`
      ) &&
      get(
        app,
        `previousDeploy[${env}]`
      )
    );
  }

  return R.filter((app) => {
    if (app.latestDeploy && !app.previousDeploy) {
      // First ever time checking this application, consider it a change
      return true;
    } else if (hasBothDeployRecords(app)) {
      return (
        // Completely new deploy...or at least from our perspective
        app.latestDeploy[env].logId !== app.previousDeploy[env].logId ||

        // Previous deploy has changed state
        app.latestDeploy[env].status !== app.previousDeploy[env].status
      );
    } else {
      return false;
    }
  });
}

/**
 * A messy stab at getting all node apps on the domain for a given environment
 * and then discovering if they have changed their deploy state.
 * @param  {String} env The environment we're interested in
 * @return {Promise}
 */
function getUpdatedAppsForEnvironment (env) {
  return fhc.getNodeApplicationsForDomain()
    .then((apps) => {
      return Promise.map(apps, (app) => {
        return attachLatestDeployToApp(app, env);
      }, {concurrency: 10});
    })
    .then((apps) => Promise.map(apps, attachPreviousDeployToApp, {concurrency: 10}))
    .then((apps) => getAppsWithUpdatedDeployState(env)(apps))
    .then((apps) => Promise.map(apps, updateAppInMongo).thenReturn(apps))
    .then((apps) => {
      return Promise.map(apps, (app) => {
        log.trace('building update for app', app);
        var deploy = app.latestDeploy;
        return `Deploy status for ${app.title} (${app.guid}) changed to ` +
              `"${deploy[env].status}" at ${deploy[env].modified}`;
      });
    });
}

exports.getUpdatesForApps = function () {
  return fhc.getEnvironments()
    .then((environments) => {
      const props = {};

      // Kick off getting updates for each environment
      environments.forEach((e) => {
        props[e] = getUpdatedAppsForEnvironment(e);
      });

      // Resolve updates into a single object by keys
      return Promise.props(props);
    });
};
