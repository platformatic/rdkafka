var WorkerThreads = require('worker_threads');
var Kafka = require('../');

if (WorkerThreads.isMainThread) {
  var worker = new WorkerThreads.Worker(__filename);

  worker.on('message', function(report) {
    console.log('delivery report', report);
  });

  worker.on('exit', function(code, ...args) {
    process._rawDebug('exiting', code);
    process.exit(code);
  });

  return;
}

process.on('unhandledRejection', (reason, promise) => {
  process._rawDebug('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  process._rawDebug('Uncaught Exception:', err);
  process.exit(1);
});

const interval = setInterval(() => {
  process._rawDebug('waiting for parent');
}, 1000);

const stream = Kafka.Producer.createWriteStream({
  'metadata.broker.list': 'localhost:9092',
  'client.id': 'kafka-mocha-producer',
  'dr_cb': true
}, {}, {
  topic: 'topic'
});

stream.producer.on('delivery-report', function(err, report) {
  process._rawDebug('delivery-report', report);
  WorkerThreads.parentPort?.postMessage(report);
  stream.producer.disconnect();
  stream.close(function() {
    clearInterval(interval);
    process.exit(0);
  });
});

stream.write(Buffer.from('my message'));

process._rawDebug('stream created');
