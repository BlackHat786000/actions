const core = require('@actions/core');
const { Kafka } = require('kafkajs');

let kafka_broker, topic_name, job_id, listener_timeout, authentication, sasl_username, sasl_password;

try {
  kafka_broker = core.getInput('kafka_broker');
  topic_name = core.getInput('topic_name');
  job_id = core.getInput('job_id');
  listener_timeout = parseInt(core.getInput('listener_timeout'), 10);
  authentication = core.getInput('authentication');

  const missingInputs = [];
  if (!kafka_broker) {
    missingInputs.push('kafka_broker');
  }
  if (!topic_name) {
    missingInputs.push('topic_name');
  }
  if (!job_id) {
    missingInputs.push('job_id');
  }

  if (missingInputs.length > 0) {
    throw new Error(`${missingInputs.join(', ')} are mandatory action-inputs and cannot be empty.`);
  }

  if (authentication && (authentication.toUpperCase() === 'SASL/PLAIN')) {
    sasl_username = core.getInput('sasl_username');
    sasl_password = core.getInput('sasl_password');
    if (!sasl_username || !sasl_password) {
      throw new Error('sasl_username and sasl_password are mandatory when authentication is set to SASL/PLAIN.');
    }
  }
} catch (error) {
  core.setFailed(`[ERROR] Error while retrieving action inputs: ${error.message}`);
  process.exit(1);
}

const kafkaConfig = {
  brokers: [kafka_broker],
};

if (authentication && authentication.toUpperCase() === 'SASL/PLAIN') {
  kafkaConfig.sasl = {
    mechanism: 'plain',
    username: sasl_username,
    password: sasl_password,
  };
  kafkaConfig.ssl = false;
}

const kafka = new Kafka(kafkaConfig);
const consumer = kafka.consumer({ groupId: `group-${uuidv4()}` });

async function run() {
  await consumer.connect();
  await consumer.subscribe({ topic: topic_name, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const value = message.value.toString('utf8');
      console.log('[DEBUG]', topic, partition, message.offset, value);
      processMessage(value);
    },
  });
}

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

run().catch(error => {
  core.setFailed(`[ERROR] Error while running the consumer: ${error}`);
  process.exit(1);
});

setTimeout(() => {
  console.log(`[INFO] Listener timed out while waiting for ${listener_timeout} minutes for target message, marked current running job status as FAILED.`);
  process.exit(1);
}, listener_timeout * 60 * 1000);
