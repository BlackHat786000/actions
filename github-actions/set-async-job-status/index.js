const core = require('@actions/core');
const { Kafka } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

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
  kafkaConfig.ssl = true;
  kafkaConfig.ssl = {
    rejectUnauthorized: false,
    ca: [
      `-----BEGIN CERTIFICATE-----
      MIID5TCCAs2gAwIBAgIUdj0KhB6OfYslmL0agKHNiDJgkQ0wDQYJKoZIhvcNAQEL
      BQAwgYExCzAJBgNVBAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQK
      DBhJbnRlcm5ldCBXaWRnaXRzIFB0eSBMdGQxOjA4BgNVBAMMMWVjMi0zLTExMC0z
      Ny0xNzAuYXAtc291dGgtMS5jb21wdXRlLmFtYXpvbmF3cy5jb20wHhcNMjQwNzEz
      MDUzMDU4WhcNMjUwNzEzMDUzMDU4WjCBgTELMAkGA1UEBhMCQVUxEzARBgNVBAgM
      ClNvbWUtU3RhdGUxITAfBgNVBAoMGEludGVybmV0IFdpZGdpdHMgUHR5IEx0ZDE6
      MDgGA1UEAwwxZWMyLTMtMTEwLTM3LTE3MC5hcC1zb3V0aC0xLmNvbXB1dGUuYW1h
      em9uYXdzLmNvbTCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKutJp2b
      FpxmYKARaqHcuUXKXPvqzYMLLIHebb3K+w7CdlW0qPi86UIQgEEZRGA4GWnQ7Mxl
      iHEFutwn8SWZ0iqb6wirzjIDK7duIkMs3BSgxtSIPdyZdc4Tz+LWBqTIQhh5a3rM
      EsCsOQb7bgrPZgrUFZWujRwJVAxYXMUaB1IionqjNNoZ10gKjssOotsR45z30MPU
      zYUYodZLrWhD0pRbtltC0AnwupheakbfWyQlgJI/+keQFIn9vg7SaBcxCjVXiy2s
      Pc/Xp5y9+NjCCtL4jciAkF7zYUAzYbVPs6Y27Ql9cs+J8PJgoOjIYGHerWW69fGx
      Oyz0EZtkKGDzu/kCAwEAAaNTMFEwHQYDVR0OBBYEFMpCussWeUpESOM16OwMcBwg
      wtiGMB8GA1UdIwQYMBaAFMpCussWeUpESOM16OwMcBwgwtiGMA8GA1UdEwEB/wQF
      MAMBAf8wDQYJKoZIhvcNAQELBQADggEBAKqccJqWyQytALjL4XnjS0c0GK1AeVP5
      3P+67Jz++8ygvBWVF/7X/mN5wEgYYzJeZGV8dzreZ4XUc0hmgX08JefQmI4h9YW1
      dD3AgNt2PDlRA4Vu9XidZcIqZm8Fm9YO2He2w7dgl7nl9A+GWHa/kIDqQTKytNLl
      A5QwCcZ07NDoWU14w9CHdn/kLViV0nQngk1YZ5go7LZ2UAuqfx2Duy3i5Gk1BNqe
      rMYp6RFWXKnkj3Lm5mJspBiJ1IHjOtWsz7DJ9Emz3nIso9QkZjvFVCKxYWqc7o3j
      fi2QkmZtZk9yEB+xjXoSFAcd95DpugcWSdFNGnhHG+daEdbFgMlmee4=
      -----END CERTIFICATE----`
    ]
  };
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
      try {
        const parsedMessage = JSON.parse(value);
        if (parsedMessage.job_id === job_id) {
          if (parsedMessage.job_status === "SUCCESS") {
            console.log("[INFO] Marked current running job status as SUCCESS.");
            await consumer.disconnect();
            console.log('Consumer has been disconnected.');
            process.exit(0);
      } else if (parsedMessage.job_status === "FAILED") {
        console.log("[INFO] Marked current running job status as FAILED.");
        await consumer.disconnect();
        console.log('Consumer has been disconnected.');
        process.exit(1);
      }
    }
  } catch (error) {
    core.setFailed(`[ERROR] Error while processing message: ${error.message}`);
    process.exit(1);
  }
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
  core.setFailed(`[ERROR] Error while running the consumer: ${error.message}`);
  process.exit(1);
});

setTimeout(() => {
  console.log(`[INFO] Listener timed out while waiting for ${listener_timeout} minutes for target message, marked current running job status as FAILED.`);
  process.exit(1);
}, listener_timeout * 60 * 1000);
