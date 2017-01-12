'use strict';

const log = require('fh-bunyan').getLogger(__filename);

module.exports = function (err, req, res, next) {
  log.error(err, 'error passed to express error handler');

  res.status(500).json({
    msg: 'internal server error'
  });
};
