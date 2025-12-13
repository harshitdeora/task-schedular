# Task Scheduler - Automation Platform Features

## Overview
This Task Scheduler has been enhanced into a comprehensive automation platform with advanced features for building, managing, and executing complex workflows.

## 🆕 New Features Added

### 1. **Variables & Secrets Management** 🔐
- **Secure Storage**: Store API keys, tokens, and configuration values encrypted
- **Variable Substitution**: Use `{{variableName}}` syntax in task configurations
- **Execution Context**: Access previous task outputs via `{{task_<nodeId>_output}}`
- **User-Scoped**: Each user has their own isolated variables

**API Endpoints:**
- `GET /api/variables` - List all variables
- `POST /api/variables` - Create variable
- `PUT /api/variables/:id` - Update variable
- `DELETE /api/variables/:id` - Delete variable

**Usage Example:**
```json
{
  "name": "api_key",
  "value": "your-secret-key",
  "isSecret": true,
  "description": "API key for external service"
}
```

In task config:
```json
{
  "url": "https://api.example.com/data",
  "headers": {
    "Authorization": "Bearer {{api_key}}"
  }
}
```

### 2. **Conditional Logic** 🔀
- **If/Else Branches**: Add conditional nodes to workflows
- **Multiple Operators**: equals, not equals, greater than, less than, contains, exists, regex
- **Dynamic Routing**: Tasks can branch based on condition results

**Task Type:** `condition`

**Configuration:**
```json
{
  "condition": {
    "field": "status",
    "value": "success"
  },
  "operator": "equals",
  "inputData": {
    "status": "success"
  }
}
```

### 3. **API & Webhook Triggers** 🚀
- **External Triggers**: Allow external systems to trigger DAGs via API
- **Token-Based**: Secure token-based authentication
- **Webhook Endpoints**: Custom webhook paths for integrations
- **Method Support**: GET, POST, PUT, DELETE, PATCH

**API Endpoints:**
- `POST /api/triggers` - Create trigger
- `GET /api/triggers` - List triggers
- `POST /api/triggers/token/:token` - Trigger DAG by token (public)
- `POST /api/triggers/webhook/:path` - Trigger DAG by webhook (public)

**Usage:**
```bash
# Trigger DAG via token
curl -X POST http://localhost:5000/api/triggers/token/YOUR_TOKEN

# Trigger DAG via webhook
curl -X POST http://localhost:5000/api/triggers/webhook/my-webhook-path
```

### 4. **Workflow Templates** 📋
- **Pre-built Workflows**: Start from ready-made templates
- **Categories**: Email, Integration, Data Processing, etc.
- **Variable Substitution**: Templates use variables that users configure
- **Public/Private**: Share templates or keep them private

**API Endpoints:**
- `GET /api/templates` - List templates
- `GET /api/templates/:id` - Get template details
- `POST /api/templates` - Create template
- `POST /api/templates/:id/use` - Create DAG from template
- `POST /api/templates/defaults` - Create default templates

**Default Templates Included:**
1. **Daily Email Report** - Fetch API data and send email
2. **Webhook to Database** - Receive webhook and save to DB

### 5. **Enhanced Data Passing** 📊
- **Variable Substitution**: Automatic replacement of `{{variable}}` in configs
- **Task Output Context**: Access previous task outputs
- **Execution Context**: Built-in variables like `{{execution.executionId}}`
- **Nested Objects**: Supports complex nested configurations

**Available Context Variables:**
- `{{execution.executionId}}` - Current execution ID
- `{{execution.dagId}}` - Current DAG ID
- `{{execution.timestamp}}` - Execution timestamp
- `{{task_<nodeId>_output}}` - Output from specific task
- `{{task_<index>_output}}` - Output from task by index

### 6. **Export/Import Workflows** 📤📥
- **Export DAGs**: Download workflows as JSON
- **Import DAGs**: Import workflows from JSON files
- **Share Workflows**: Easily share automation workflows
- **Version Control**: Track workflow versions

**API Endpoints:**
- `GET /api/dags/:id/export` - Export DAG as JSON
- `POST /api/dags/import` - Import DAG from JSON

## 🎯 Task Types Available

1. **HTTP Request** 🌐 - Call REST APIs
2. **Send Email** 📧 - Send emails via SMTP
3. **Database** 🗄️ - Query MongoDB
4. **Script** 📜 - Execute Node.js, Python, or Bash scripts
5. **File** 📁 - Read, write, copy, delete files
6. **Webhook** 🔗 - Send webhook requests
7. **Delay** ⏱️ - Wait for specified duration
8. **Notification** 🔔 - Send Slack/Discord notifications
9. **Transform** 🔄 - Transform data with JavaScript
10. **Condition** 🔀 - Conditional logic (NEW)

## 🔧 Technical Implementation

### Backend Architecture
- **Models**: Variable, DagTrigger, Template
- **Controllers**: Variable, Trigger, Template controllers
- **Utils**: Variable substitution utility
- **Middleware**: Authentication middleware for protected routes

### Security Features
- **Encryption**: AES-256-CBC encryption for secrets
- **User Isolation**: All data scoped to user ID
- **Token-Based Triggers**: Secure random tokens for API triggers
- **Session Management**: Passport.js session-based auth

### Worker Enhancements
- **Variable Substitution**: Automatic before task execution
- **Context Passing**: Previous task outputs available
- **Conditional Execution**: Support for conditional task types

## 📝 Usage Examples

### Example 1: API Call with Variables
```json
{
  "type": "http",
  "name": "Fetch User Data",
  "config": {
    "url": "https://api.example.com/users/{{userId}}",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer {{api_token}}"
    }
  }
}
```

### Example 2: Conditional Workflow
```json
{
  "nodes": [
    {
      "id": "1",
      "type": "http",
      "name": "Check Status"
    },
    {
      "id": "2",
      "type": "condition",
      "name": "If Success",
      "config": {
        "condition": {
          "field": "status",
          "value": 200
        },
        "operator": "equals"
      }
    },
    {
      "id": "3",
      "type": "email",
      "name": "Send Success Email"
    }
  ],
  "edges": [
    { "source": "1", "target": "2" },
    { "source": "2", "target": "3" }
  ]
}
```

### Example 3: Webhook Trigger
```bash
# Create trigger
POST /api/triggers
{
  "dagId": "dag_id_here",
  "name": "GitHub Webhook",
  "type": "webhook",
  "webhookPath": "github-events"
}

# External system triggers workflow
curl -X POST http://your-server.com/api/triggers/webhook/github-events
```

## 🚀 Getting Started

1. **Set Variables**: Store your API keys and secrets
2. **Create Workflow**: Build DAG using visual builder
3. **Add Variables**: Use `{{variableName}}` in task configs
4. **Set Triggers**: Create API/webhook triggers for external access
5. **Use Templates**: Start from pre-built templates
6. **Export/Import**: Share workflows with your team

## 📚 Next Steps

- Add more notification channels (Teams, Telegram, etc.)
- Implement workflow versioning
- Add workflow analytics and metrics
- Create more pre-built templates
- Add team collaboration features
- Implement workflow scheduling UI improvements


