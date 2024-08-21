## Set Async GitHub Workflow Job Status

### Description

The set-async-job-status GitHub Action allows you to update GitHub Actions workflow job status as success or failure based on Kafka event messages. It listens to a specified Kafka topic for messages containing job status information and updates the corresponding GitHub Actions job accordingly.

### Pre-requisites

Create a workflow *.yml file in your repositories .github/workflows directory.

### Example Usage

```yaml
uses: BlackHat786000/set-async-job-status@v5.1
with:
  kafka_broker: '12.34.56.78:9092'
  topic_name: 'myJsonTopic'
  listener_timeout: 5
  authentication: 'SASL PLAIN'
  sasl_username: ${{ secrets.username }}
  sasl_password: ${{ secrets.password }}
  ssl_enabled: true
  ca_path: '/my/custom/ca.crt'
  client_cert: '/my/custom/client-cert.pem'
  client_key: '/my/custom/client-key.pem'
  success_when: event.some_id == 'foo' and event.any_status == 'completed'
```

### Inputs

- **`kafka_broker`**:
  - **Description:** The bootstrap server URL with port (e.g., `12.34.56.78:9092`).
  - **Required:** Yes

- **`topic_name`**:
  - **Description:** The name of the Kafka topic that the listener subscribes to.
  - **Required:** Yes

- **`job_id`**:
  - **Description:** The job ID used to determine the job status from the message value.
  - **Required:** At least one of jinja_conditional, success_when, or job_id must be provided to determine the job status

- **`listener_timeout`**:
  - **Description:** Time in minutes for which the listener will be actively waiting for the target message.
  - **Required:** No
  - **Default:** 10

- **`authentication`**:
  - **Description:** Specifies the security protocol used to communicate with the Kafka broker.
  - **Required:** No
  - **Default:** None

- **`sasl_username`**:
  - **Description:** Username for SASL authentication.
  - **Required:** Only if authentication is set to `SASL PLAIN`

- **`sasl_password`**:
  - **Description:** Password corresponding to the SASL username.
  - **Required:** Only if authentication is set to `SASL PLAIN`

- **`ssl_enabled`**:
  - **Description:** Enable SSL connection to Kafka broker.
  - **Required:** No
  - **Default:** false

- **`ca_path`**:
  - **Description:** PEM formatted file that contains a CA certificate to be used for validation
  - **Required:** No

- **`client_cert`**:
  - **Description:** PEM formatted certificate chain file to be used for SSL client authentication
  - **Required:** No

- **`client_key`**:
  - **Description:** PEM formatted file that contains your private key to be used for SSL client authentication
  - **Required:** No

- **`group_id`**:
  - **Description:** Kafka consumer group ID
  - **Required:** No

- **`group_prefix`**:
  - **Description:** Prefix to be used to generate consumer group ID like <group_prefix><workflow_run_id>/<job_name>
  - **Required:** No
  - **Default:** 'group-'

- **`success_when`**:
  - **Description:** Conditional expression that evaluates to `true` against the kafka message payload to mark job status as SUCCESS
  - **Required:** At least one of jinja_conditional, success_when, or job_id must be provided to determine the job status

- **`fail_when`**:
  - **Description:** Conditional expression against the kafka message payload to mark job status as FAILED. This option only has an effect if `success_when` is provided
  - **Required:** No

- **`jinja_conditional`**:
  - **Description:** Jinja template that must return `SUCCESS` string or `FAILED` string against the kafka message payload to mark job status as SUCCESS/FAILED
  - **Required:** At least one of jinja_conditional, success_when, or job_id must be provided to determine the job status

### Outputs

- **`json`**:
  - **Description:** JSON event message that marked job status as SUCCESS/FAILED

### `jinja_conditional`, `success_when`, `fail_when`

**Kafka JSON event message is injected into `event` object. We can use `event` to specify conditions in our workflow to determine job status using below action-inputs:**

`success_when` and `fail_when` are used to evaluate specific conditions in the Kafka message to determine if the job should be marked as successful or failed.
These inputs provide flexibility for scenarios where the job status is dependent on particular conditions within the message.

If both success_when and fail_when are provided, the Action first checks the success_when condition to potentially mark the job as SUCCESS.
If the success_when condition is not met and fail_when is provided, it then checks the fail_when condition to potentially mark the job as FAILED.

```
success_when: event.some_id == 'foo' and event.any_status == 'completed'
fail_when: event.another_id >= 123456 and event.example_status == false // Optional
```

`jinja_conditional` offers a more advanced and flexible way to determine job status using Jinja2 templating.
You can create complex logic and conditions to set the job status based on the content of the Kafka message.

Conditional jinja template will be rendered with the Kafka message payload and must return SUCCESS or FAILED to mark the job status as SUCCESS or FAILED.

```
jinja_conditional: |
            {% if event.random_id < 11223344 and event.status == 'success' %}
            SUCCESS // return `SUCCESS` to mark job as success
            {% elif event.my_id == 'joe' and event.task_status == 'failure' %}
            FAILED // return `FAILED` to mark job as failure
            {% endif %}
```

### Role of Action Input `job_id` (Optional) (Not Recommended)

When using the GitHub Action, you can optionally provide a specific `job_id` as an input. This `job_id` serves as a reference point for the Action to match against the `job_id` present in the incoming Kafka messages. Based on this match, the Action determines the job status (SUCCESS/FAILED) of the associated job.

For instance, if you provide `job_id: '123'` as an input to the Action, it will look for messages in the Kafka topic where the `job_id` matches '123'. If it finds a matching message, it will use the `job_status` value (`SUCCESS` or `FAILED`) from that message to update the status of the corresponding job in the GitHub Actions workflow.

### Support

For support or any questions about this Action, please [open an issue](https://github.com/BlackHat786000/set-async-job-status/issues) in the GitHub repository.

### License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/BlackHat786000/set-async-job-status/blob/main/LICENSE) file for details.
