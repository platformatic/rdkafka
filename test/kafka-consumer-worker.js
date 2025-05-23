var WorkerThreads = require('worker_threads');
var Kafka = require('../');

if (WorkerThreads.isMainThread) {
  var worker = new WorkerThreads.Worker(__filename);

  var timeout = setTimeout(function() {
    process._rawDebug('terminating worker');
    worker.terminate();
  }, 10000);

  worker.on('message', function(report) {
    console.log('received message', report);
  });

  worker.on('exit', function(code) {
    clearTimeout(timeout);
    process.exit(code);
  });

  return;
}

const interval = setInterval(() => {
  process._rawDebug('waiting for parent');
}, 1000);

var stream = Kafka.KafkaConsumer.createReadStream({
 	'metadata.broker.list': 'localhost:9092',
  'client.id': 'kafka-mocha-consumer',
 	'group.id': 'kafka-mocha-grp',
  'allow.auto.create.topics': true,
  'enable.auto.commit': false,
  'rebalance_cb': true,
}, {}, {
  topics: ['topic']
});

stream.on('data', function(message) {
  process._rawDebug('received message', message);
  WorkerThreads.parentPort?.postMessage({ message });
  stream.consumer.commitMessage(message);
  stream.consumer.disconnect();
  stream.close(function () {
    setTimeout(() => {
      process._rawDebug('exiting');
      clearInterval(interval);
      process.exit(0);
    }, 1000);
  });
});
