/****************************************************************************
 The MIT License (MIT)

 Copyright (c) 2013 Apigee Corporation

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
'use strict';

var _ = require('underscore');

function QuotaExpress(quota, options) {
  if (!(this instanceof QuotaExpress)) {
    return new QuotaExpress(quota, options);
  }

  this.quota = quota;
  this.options = options || {};
}
module.exports = QuotaExpress;

// applies quota and returns (403) error on exceeded
// options contains:
// identifier (optional) may be a string or a function that takes the request and generates a string id
//   if not specified, id will default to the request originalUrl
// weight (optional) may be a number or a function that takes the request and generates a number
QuotaExpress.prototype.apply = function(options) {
  var self = this;
  return function(req, resp, next) {
    var opts = calcOptions(req, options);
    applyQuota(self, opts, resp, next);
  };
};

// applies quota on a per-caller address basis and returns (403) error on exceeded
// options contains:
// id (required, may be null) may be a string or a function that takes the request and generates a string id
//   if not specified, id will be set to the request originalUrl
// weight (optional) may be a number or a function that takes the request and generates a number
//   if weight is specified, id is required (may be null)
QuotaExpress.prototype.applyPerAddress = function(options) {
  var self = this;
  return function(req, resp, next) {
    var opts = calcOptions(req, options);
    var remoteAddress = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.connection.remoteAddress;
    opts.identifier = opts.identifier + '/' + remoteAddress;
    if (debugEnabled) { debug('Quota check: ' + opts.identifier); }
    applyQuota(self, opts, resp, next);
  };
};

function calcOptions(req, opts) {
  var options = _.extend({}, opts); // clone
  if (_.isFunction(options.identifier)) { options.identifier = options.identifier(req); }
  if (_.isFunction(options.weight)) { options.weight = options.weight(req); }
  if (!options.identifier) { options.identifier = req.originalUrl; }
  return options;
}

function applyQuota(self, options, resp, next) {
  if (debugEnabled) { debug('Quota check: ' + options.identifier); }
  self.quota.apply(
    options,
    function(err, reply) {
      if (err) { return next(err); }
      if (!reply.isAllowed) {
        if (debugEnabled) { debug('Quota exceeded: ' + options.identifier); }
        resp.statusCode = 403;
        return resp.end(JSON.stringify({ error: 'exceeded quota' }));
      }
      next();
    }
  );
}

var debug;
var debugEnabled;
if (process.env.NODE_DEBUG && /quota/.test(process.env.NODE_DEBUG)) {
  debug = function(x) {
    console.log('Quota: ' + x);
  };
  debugEnabled = true;
} else {
  debug = function() { };
}
