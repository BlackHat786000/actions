## Set Async GitHub Workflow Job Status

### Description

The set-async-job-status GitHub Action allows you to update GitHub Actions workflow job status as success or failure based on Kafka event messages. It listens to a specified Kafka topic for messages containing job status information and updates the corresponding GitHub Actions job accordingly.

### Pre-requisites

Create a workflow *.yml file in your repositories .github/workflows directory.

### Example Usage

```yaml
uses: BlackHat786000/set-async-job-status@v1.0
with:
  kafka_broker: '12.34.56.78:9092'
  topic_name: 'myJsonTopic'
  job_id: '123456'
  listener_timeout: 5
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
  - **Required:** Yes

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
  - **Required:** Only if ssl_enabled is set to true

- **`client_cert`**:
  - **Description:** PEM formatted certificate chain file to be used for SSL client authentication
  - **Required:** No

- **`client_key`**:
  - **Description:** PEM formatted file that contains your private key to be used for SSL client authentication
  - **Required:** No

### Kafka Message Format

The messages sent to the Kafka topic should be in JSON format and contain at least the following two key-value pairs:

- **`job_id`**: Represents the unique identifier of the job within the GitHub Actions workflow.
- **`job_status`**: Indicates the status of the job, which could be either `SUCCESS` or `FAILED`.

Example message:
```json
{
  "job_id": "123456",
  "job_status": "SUCCESS"
}
```

### Role of Action Input `job_id`

When using the GitHub Action, you need to provide a specific `job_id` as an input. This `job_id` serves as a reference point for the Action to match against the `job_id` present in the incoming Kafka messages. Based on this match, the Action determines the status (`job_status`) of the associated job.

For instance, if you provide `job_id: '123'` as an input to the Action, it will look for messages in the Kafka topic where the `job_id` matches '123'. If it finds a matching message, it will use the `job_status` value from that message to update the status of the corresponding job in the GitHub Actions workflow.

### Support

For support or any questions about this Action, please [open an issue](https://github.com/BlackHat786000/set-async-job-status/issues) in the GitHub repository.

### License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/BlackHat786000/set-async-job-status/blob/main/LICENSE) file for details.
