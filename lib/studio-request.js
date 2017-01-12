'use strict';

const fhc = require('lib/fhc');
const env = require('env-var');
const url = require('url');
const Promise = require('bluebird');

const domain = env('FHC_DOMAIN').required().asString();
const protocol = url.parse(domain).protocol;

// Export a configured request instance with required cookies, json parsing,
// and timeout for requests
module.exports = Promise.promisify(
  require('request').defaults({
    method: 'GET',
    headers: {
      'Cookie': `feedhenry=${fhc.getLoginInfo().login}; csrf=${fhc.getLoginInfo().csrf}`
    },
    timeout: 25000,
    json: true,

    // Simple way to allow env var to be https://blah.com or just blah.com
    baseUrl: protocol ? domain : `https://${domain}`
  })
);
