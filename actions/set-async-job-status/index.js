const core = require('@actions/core');
const Kafka = require('no-kafka');

let kafka_broker, topic_name, job_id, listener_timeout;

try {
  kafka_broker = core.getInput('kafka_broker');
  topic_name = core.getInput('topic_name');
  job_id = core.getInput('job_id');
  listener_timeout = parseInt(core.getInput('listener_timeout'), 10);
  if (!kafka_broker) {
	  throw new Error('kafka_broker is a mandatory action-input and cannot be empty.');
  }
  if (!topic_name) {
	  throw new Error('topic_name is a mandatory action-input and cannot be empty.');
  }
  if (!job_id) {
	  throw new Error('job_id is a mandatory action-input and cannot be empty.');
  }
} catch (error) {
  core.setFailed(`[ERROR] Error while retreiving action-inputs: ${error.message}`);
  process.exit(1);
}

const consumer = new Kafka.SimpleConsumer({
    connectionString: `kafka://${kafka_broker}`
});

function processMessage(message) {
    try {
        const parsedMessage = JSON.parse(message);
        if (parsedMessage.job_id === job_id) {
            if (parsedMessage.job_status === "SUCCESS") {
                console.log("[INFO] Marked current running job status as SUCCESS.");
                process.exit(0);
            } else if (parsedMessage.job_status === "FAILED") {
                console.log("[INFO] Marked current running job status as FAILED.");
                process.exit(1);
            }
        }
    } catch (error) {
        core.setFailed(`[ERROR] Error while processing message: ${error.message}`);
		process.exit(1);
    }
}

const dataHandler = function (messageSet, topic, partition) {
    messageSet.forEach(function (m) {
        const value = m.message.value.toString('utf8');
		console.log('[DEBUG]', topic, partition, m.offset, m.message.value.toString('utf8'));
        processMessage(value);
    });
};

consumer.init().then(function () {
    return consumer.subscribe(topic_name, dataHandler);
}).catch(function (error) {
    core.setFailed(`[ERROR] Error while subscribing to topic: ${error.message}`);
	process.exit(1);
});

setTimeout(function () {
    console.log(`[INFO] Listener timed out while waiting for ${listener_timeout} minutes for target message, marked current running job status as FAILED.`);
    process.exit(1);
}, listener_timeout * 60 * 1000);
