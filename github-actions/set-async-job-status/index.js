const core = require('@actions/core');
const { Kafka } = require('kafkajs');
const fs = require('fs');
const nunjucks = require('nunjucks');
const EventEmitter = require('events');

// Constants
const EVENT_ID_KEY = 'job_id';
const EVENT_STATUS_KEY = 'job_status';
const STATUS_SUCCESS = 'SUCCESS';
const STATUS_FAILED = 'FAILED';

let kafka_broker, topic_name, job_id, listener_timeout;
let authentication, sasl_username, sasl_password;
let ssl_enabled, ca_path, client_cert, client_key;
let group_id, group_prefix;
let success_when, fail_when, jinja_conditional;

const events = new EventEmitter();

try {
    kafka_broker = core.getInput('kafka_broker', { required: true });
    topic_name = core.getInput('topic_name', { required: true });
    job_id = core.getInput('job_id');
    listener_timeout = parseInt(core.getInput('listener_timeout'), 10);
    authentication = core.getInput('authentication');
    ssl_enabled = core.getInput('ssl_enabled') === 'true';
    group_id = core.getInput('group_id');
    group_prefix = core.getInput('group_prefix');
    success_when = core.getInput('success_when');
    fail_when = core.getInput('fail_when');
    jinja_conditional = core.getInput('jinja_conditional');

    if (!(jinja_conditional || success_when || job_id)) {
        throw new Error('At least one of jinja_conditional, success_when, or job_id (depreciated) must be provided to determine the job status.');
    }

    if (authentication && authentication.toUpperCase() === 'SASL PLAIN') {
        sasl_username = core.getInput('sasl_username');
        sasl_password = core.getInput('sasl_password');
        if (!sasl_username || !sasl_password) {
            throw new Error('sasl_username and sasl_password are mandatory when authentication is set to SASL PLAIN.');
        }
    }

    if (ssl_enabled) {
        ca_path = core.getInput('ca_path');
        client_cert = core.getInput('client_cert');
        client_key = core.getInput('client_key');

        if (ca_path && !fs.existsSync(ca_path)) {
            throw new Error(`ca certificate file does not exist at path '${ca_path}'`);
        }

        if (client_cert && !fs.existsSync(client_cert)) {
            throw new Error(`client certificate file does not exist at path '${client_cert}'`);
        }

        if (client_key && !fs.existsSync(client_key)) {
            throw new Error(`client key file does not exist at path '${client_key}'`);
        }
    }
} catch (error) {
    core.setFailed(`[ERROR] Error while retrieving action inputs: ${error.message}`);
    process.exit(1);
}

const kafkaConfig = {
    brokers: [kafka_broker],
    ssl: ssl_enabled ? {
        rejectUnauthorized: false,
        ca: ca_path ? fs.readFileSync(ca_path, 'utf-8') : undefined,
        cert: client_cert ? fs.readFileSync(client_cert, 'utf-8') : undefined,
        key: client_key ? fs.readFileSync(client_key, 'utf-8') : undefined,
    } : false
};

if (authentication && authentication.toUpperCase() === 'SASL PLAIN') {
    kafkaConfig.sasl = {
        mechanism: 'plain',
        username: sasl_username,
        password: sasl_password,
    };
}

const workflowRunId = process.env.GITHUB_RUN_ID;
const currentJobName = process.env.GITHUB_JOB;
const group_suffix = `${workflowRunId}/${currentJobName}`;

const kafka = new Kafka(kafkaConfig);
const consumer = kafka.consumer({
    groupId: group_id || `${group_prefix}${group_suffix}`
});

async function run() {
    try {
        await consumer.connect();
        await consumer.subscribe({
            topic: topic_name,
            fromBeginning: false
        });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                let value;
                try {
                    value = message.value.toString('utf8');
                } catch (error) {
                    core.error(`[ERROR] Error while converting message to string: ${error.message}`);
                }
                core.debug(`Topic: ${topic}, Partition: ${partition}, Offset: ${message.offset}, Message: ${value}`);
                try {
                    const jobStatus = processMessage(value);
                    await consumer.commitOffsets([{ topic, partition, offset: (Number(message.offset) + 1).toString() }]);
                    if ([STATUS_SUCCESS, STATUS_FAILED].includes(jobStatus)) {
                      core.setOutput("json", value);
                      if (jobStatus === STATUS_SUCCESS) {
						core.info(`\u001b[32m[INFO] Marked current running job status as ${jobStatus}.`);
                        events.emit('exit', 0);
                      } else {
						core.info(`\u001b[31m[INFO] Marked current running job status as ${jobStatus}.`);
                        events.emit('exit', 1);
                      }
                    }
                } catch (error) {
                    core.error(`[ERROR] Error while processing message: ${error.message}`);
                }
            },
        });
    } catch (error) {
        core.setFailed(`[ERROR] Error while running the consumer: ${error.message}`);
        process.exit(1);
    }

	await new Promise((resolve, reject) => {
    const wrapUpAndExit = async (exitCode) => {
      await consumer.stop();
      await consumer.disconnect();
	  process.exit(exitCode);
      resolve(null);
    }
    events.on('exit', wrapUpAndExit);
	});

}

function processMessage(message) {
    let event;
    try {
        event = JSON.parse(message);
    } catch (error) {
        core.error(`[ERROR] Error while parsing JSON message: ${error.message}`);
        return '';
    }

    let jobStatus;
    if (jinja_conditional) {
      jobStatus = renderNunjucksTemplate(event, jinja_conditional);
    } else if (success_when) {
      jobStatus = renderConditionalTemplate(event, success_when, STATUS_SUCCESS);
      if (fail_when && jobStatus !== STATUS_SUCCESS) {
        jobStatus = renderConditionalTemplate(event, fail_when, STATUS_FAILED);
      }
    } else if (job_id) {
      jobStatus = processJobEvent(event);
    }

    return jobStatus.trim().toUpperCase();
}

function renderNunjucksTemplate(event, templateStr) {
  try {
    const result = nunjucks.renderString(templateStr, { event });
    return result;
  } catch (e) {
    return '';
  }
}

function renderConditionalTemplate(event, conditionStr, jobStatus) {
  try {
    const templateStr = `{% if ${conditionStr} %}${jobStatus}{% else %}{% endif %}`;
    const result = nunjucks.renderString(templateStr, { event });
    return result;
  } catch (e) {
    return '';
  }
}

function processJobEvent(event) {
    if (event[EVENT_ID_KEY] === job_id) {
        if (event[EVENT_STATUS_KEY] === STATUS_SUCCESS) {
            return STATUS_SUCCESS;
        } else if (event[EVENT_STATUS_KEY] === STATUS_FAILED) {
            return STATUS_FAILED;
        }
    }
    return '';
}

run();

setTimeout(async () => {
    core.info(`\u001b[31m[INFO] Listener timed out after waiting ${listener_timeout} minutes for target message, marked current running job status as ${STATUS_FAILED}.`);

	// [EDGE SCENARIO] When new consumer with new consumer group times out without committing any offset
	// and is restarted again, it processes messages from latest offset because of 'fromBeginning: false'
	// Hence messages produced after timeout and before consumer restart are missed from being processed

	// [EDGE SCENARIO FIX] Fetch and commit latest offset for each partition in given topic for consumer
	try {
		const admin = kafka.admin();
		await admin.connect();
		const topicOffsets = await admin.fetchTopicOffsets(topic_name);
        core.debug(`Fetched topic offsets:\n${JSON.stringify(topicOffsets, null, 2)}`);
		await admin.disconnect();
		const offsetsToCommit = topicOffsets.map(({ partition, offset }) => ({
            topic: topic_name,
            partition,
            offset: offset
        }));
		await consumer.commitOffsets(offsetsToCommit);
		core.debug('Offsets committed successfully');
		events.emit('exit', 1);
	} catch(error) {
		core.error(`[ERROR] Error while fetching and committing offsets: ${error.message}`);
	}

}, listener_timeout * 60 * 1000);
