/*
 * node-rdkafka - Node.js wrapper for RdKafka C/C++ library
 *
 * Copyright (c) 2016 Blizzard Entertainment
 *
 * This software may be modified and distributed under the terms
 * of the MIT license.  See the LICENSE.txt file for details.
 */

var KafkaConsumer = require('../lib/kafka-consumer');
var KafkaProducer = require('../lib/producer');
var t = require('assert');
var path = require('path');
var worker_threads = require('worker_threads');

var client;
var defaultConfig = {
  'client.id': 'kafka-mocha',
  'group.id': 'kafka-mocha-grp',
  'metadata.broker.list': 'localhost:9092'
};
var topicConfig = {};

module.exports = {
  'KafkaConsumer client': {
    'beforeEach': function() {
      client = new KafkaConsumer(defaultConfig, topicConfig);
    },
    'afterEach': function(cb) {
      if (client) {
        client.disconnect(cb);
        client = null;
      } else {
        cb()
      }
    },
    'does not modify config and clones it': function () {
      t.deepStrictEqual(defaultConfig, {
        'client.id': 'kafka-mocha',
        'group.id': 'kafka-mocha-grp',
        'metadata.broker.list': 'localhost:9092'
      });
      t.deepStrictEqual(client.globalConfig, {
        'client.id': 'kafka-mocha',
        'group.id': 'kafka-mocha-grp',
        'metadata.broker.list': 'localhost:9092'
      });
      t.notEqual(defaultConfig, client.globalConfig);
    },
    'does not modify topic config and clones it': function () {
      t.deepStrictEqual(topicConfig, {});
      t.deepStrictEqual(client.topicConfig, {});
      t.notEqual(topicConfig, client.topicConfig);
    },
    'does not crash in a worker': function (cb) {
      this.timeout(30000);
      var consumer = new worker_threads.Worker(
        path.join(__dirname, 'kafka-consumer-worker.js')
      );

      consumer.on('message', function(msg) {
        process._rawDebug('got message');
        t.strictEqual(Buffer.from(msg.message.value).toString(), 'my message');
      });

      let stream

      consumer.on('exit', function(code) {
        process._rawDebug('exiting');
        stream.end();
        t.strictEqual(code, 0);
        cb();
      });

      stream = KafkaProducer.createWriteStream({
        'metadata.broker.list': 'localhost:9092',
        'client.id': 'kafka-mocha-producer',
        'dr_cb': true
      }, {}, {
        topic: 'topic'
      });

      stream.write(Buffer.from('my message'));
    }
  },
};
