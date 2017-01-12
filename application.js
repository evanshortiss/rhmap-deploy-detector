'use strict';

const Promise = require('bluebird');
const VError = require('verror');
const log = require('fh-bunyan').getLogger(__filename);
const fhc = require('lib/fhc');

require('https').globalAgent.maxSockets = 1000;
require('http').globalAgent.maxSockets = 1000;

// If a rejection is not caught then we need to be made aware of it
Promise.onPossiblyUnhandledRejection(function (e) {
  log.error(e, 'uncaught error in promise chain');
  throw e;
});

fhc.init()
  .then(function () {
    log.info('Application startup initialised');

    const mbaasApi = require('fh-mbaas-api');
    const mbaasExpress = mbaasApi.mbaasExpress();
    const port = process.env.FH_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8001;
    const host = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';
    const app = require('express')();

    // Note: the order which we add middleware to Express here is important!
    app.use('/sys', mbaasExpress.sys([]));
    app.use('/mbaas', mbaasExpress.mbaas);

    // Note: important that this is added just before your own Routes
    app.use(mbaasExpress.fhmiddleware());

    // fhlint-begin: custom-routes
    app.use('/applications/deploys', require('lib/routes/deploys'));
    // fhlint-end

    // Add the FeedHenry error handler (for restarting and events)
    mbaasExpress.errorHandler();

    // 404 handler
    app.use(function notFoundHandler (req, res){
      res.status(404).json({
        message: '404 not found'
      });
    });

    // Add a express error handler of our own (this won't cause restart)
    app.use(require('lib/express-error-handler'));

    app.listen(port, host, function onListening () {
      log.info('App started at: ' + new Date() + ' on port: ' + port);
    });
  })
  .catch((e) => {
    throw new VError(e, 'app startup failed');
  });
