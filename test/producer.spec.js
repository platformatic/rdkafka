/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var Producer = require('../lib/producer');
var t = require('assert');
var worker_threads = require('worker_threads');
var path = require('path');
// var Mock = require('./mock');

var client;
var defaultConfig = {
  'client.id': 'kafka-mocha',
  'metadata.broker.list': 'localhost:9092',
  'socket.timeout.ms': 250
};
var topicConfig = {};

var server;

module.exports = {
  'Producer client': {
    'beforeEach': function() {
      client = new Producer(defaultConfig, topicConfig);
    },
    'afterEach': function() {
      client = null;
    },
    'is an object': function() {
      t.equal(typeof(client), 'object');
    },
    'requires configuration': function() {
      t.throws(function() {
        return new Producer();
      });
    },
    'has necessary methods from superclass': function() {
      var methods = ['connect', 'disconnect', 'getMetadata'];
      methods.forEach(function(m) {
        t.equal(typeof(client[m]), 'function', 'Client is missing ' + m + ' method');
      });
    },
    'has "_disconnect" override': function() {
      t.equal(typeof(client._disconnect), 'function', 'Producer is missing base _disconnect method');
    },
    'does not modify config and clones it': function () {
      t.deepStrictEqual(defaultConfig, {
        'client.id': 'kafka-mocha',
        'metadata.broker.list': 'localhost:9092',
        'socket.timeout.ms': 250
      });
      t.deepStrictEqual(client.globalConfig, {
        'client.id': 'kafka-mocha',
        'metadata.broker.list': 'localhost:9092',
        'socket.timeout.ms': 250
      });
      t.notEqual(defaultConfig, client.globalConfig);
    },
    'does not modify topic config and clones it': function () {
      t.deepStrictEqual(topicConfig, {});
      t.deepStrictEqual(client.topicConfig, {});
      t.notEqual(topicConfig, client.topicConfig);
    },
    'disconnect method': {
      'calls flush before it runs': function(next) {
        var providedTimeout = 1;

        client.flush = function(timeout, cb) {
          t.equal(providedTimeout, timeout, 'Timeouts do not match');
          t.equal(typeof(cb), 'function');
          setImmediate(cb);
        };

        client._disconnect = function(cb) {
          setImmediate(cb);
        };

        client.disconnect(providedTimeout, next);
      },
      'provides a default timeout when none is provided': function(next) {
        client.flush = function(timeout, cb) {
          t.notEqual(timeout, undefined);
          t.notEqual(timeout, null);
          t.notEqual(timeout, 0);
          t.equal(typeof(cb), 'function');
          setImmediate(cb);
        };

        client._disconnect = function(cb) {
          setImmediate(cb);
        };

        client.disconnect(next);
      },
      'does not crash in a worker': function (cb) {
        this.timeout(10000);

        var producer = new worker_threads.Worker(
          path.join(__dirname, 'producer-worker.js')
        );

        producer.on('message', (report) => {
          process._rawDebug('got message');
          t.strictEqual(report.topic, 'topic');
        });

        producer.on('exit', function(code) {
          process._rawDebug('exiting');
          t.strictEqual(code, 0);
          cb();
        });
      }
    }
  },
};
