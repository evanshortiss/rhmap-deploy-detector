'use strict';

const deploys = require('lib/deploys');

const route = module.exports = require('express').Router();

route.get('/status', (req, res, next) => {
  return deploys.getUpdatesForApps()
    .then((ret) => res.json(ret))
    .catch(next);
});
