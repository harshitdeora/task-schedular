# Task Scheduler - Automation Platform

A comprehensive workflow automation platform that allows you to build, manage, and execute complex task workflows (DAGs) with a visual interface. Create automated workflows with HTTP requests, email notifications, database operations, scripts, and more.

## 🚀 Features

### Core Functionality
- **Visual DAG Builder**: Drag-and-drop interface to create complex workflows
- **Multiple Task Types**: HTTP requests, emails, database queries, scripts, file operations, webhooks, delays, notifications, data transformations, and conditional logic
- **Real-time Execution Monitoring**: Live logs and execution tracking via WebSocket
- **Worker Management**: Distributed task execution with worker health monitoring
- **Execution History**: Track and analyze past workflow executions
- **Scheduled Executions**: Cron-based scheduling for automated workflows

### Advanced Features
- **🔐 Variables & Secrets Management**: Securely store and use API keys, tokens, and configuration values with encryption
- **🔀 Conditional Logic**: Add if/else branches to workflows with multiple comparison operators
- **🚀 API & Webhook Triggers**: Trigger workflows externally via secure tokens or custom webhook endpoints
- **📋 Workflow Templates**: Pre-built templates to jumpstart your automation
- **📊 Data Passing**: Automatic variable substitution and task output context
- **📤📥 Export/Import**: Share workflows as JSON files
- **📧 Scheduled Emails**: Schedule and manage email notifications
- **🔔 Notifications**: Send Slack/Discord notifications

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **MongoDB** with Mongoose
- **Redis** (Upstash) for task queue management
- **Socket.io** for real-time communication
- **Passport.js** for authentication
- **Nodemailer** for email functionality
- **Node-cron** for scheduling

### Frontend
- **React** with Vite
- **Material-UI** for UI components
- **React Flow** for visual DAG builder
- **Socket.io Client** for real-time updates
- **Recharts** for analytics

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **MongoDB** (local or cloud instance)
- **Redis** account (Upstash recommended) or local Redis instance

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd task-schedular
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

## ⚙️ Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ALLOW_ALL_ORIGINS=true

# Database
MONGO_URI=mongodb://localhost:27017/taskScheduler
# Or for MongoDB Atlas:
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/taskScheduler

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token

# Session & Security
SESSION_SECRET=your-super-secret-session-key-change-in-production
ENCRYPTION_KEY=your-32-character-encryption-key-for-secrets

# Worker Configuration (optional)
WORKER_SOCKET_PORT=7000
```

### Getting Redis Credentials (Upstash)
1. Sign up at [Upstash](https://upstash.com/)
2. Create a new Redis database
3. Copy the REST URL and REST Token to your `.env` file

## 🚀 Running the Application

### Development Mode

1. **Start the backend server**
   ```bash
   cd backend
   npm run dev
   ```
   The server will start on `http://localhost:5000`

2. **Start the frontend development server** (in a new terminal)
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`

3. **Start a worker** (optional, in a new terminal)
   ```bash
   cd backend
   npm run worker
   ```
   Workers execute tasks from the queue. You can run multiple workers for distributed processing.

### Production Mode

1. **Build the frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Start the backend**
   ```bash
   cd backend
   npm start
   ```

## 📁 Project Structure

```
task-schedular/
├── backend/
│   ├── config/          # Database configuration
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Authentication middleware
│   ├── models/           # MongoDB models
│   ├── routes/           # API routes
│   ├── scheduler/        # Cron scheduler
│   ├── services/         # Background services
│   ├── utils/            # Utility functions
│   ├── websocket/        # Socket.io server
│   ├── worker/           # Task execution workers
│   └── server.js         # Main server file
├── frontend/
│   ├── src/
│   │   ├── api/          # API client functions
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── utils/        # Utility functions
│   │   └── App.jsx       # Main app component
│   └── vite.config.mjs   # Vite configuration
└── README.md
```

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### DAGs (Workflows)
- `GET /api/dags` - List all DAGs
- `POST /api/dags` - Create a new DAG
- `GET /api/dags/:id` - Get DAG details
- `PUT /api/dags/:id` - Update DAG
- `DELETE /api/dags/:id` - Delete DAG
- `POST /api/dags/:id/execute` - Manually trigger DAG execution
- `GET /api/dags/:id/export` - Export DAG as JSON
- `POST /api/dags/import` - Import DAG from JSON

### Executions
- `GET /api/executions` - List all executions
- `GET /api/executions/:id` - Get execution details
- `GET /api/executions/:id/logs` - Get execution logs

### Workers
- `GET /api/workers` - List all workers
- `POST /api/workers` - Register a worker
- `DELETE /api/workers/:id` - Remove a worker

### Variables
- `GET /api/variables` - List all variables
- `POST /api/variables` - Create variable
- `PUT /api/variables/:id` - Update variable
- `DELETE /api/variables/:id` - Delete variable

### Triggers
- `GET /api/triggers` - List all triggers
- `POST /api/triggers` - Create trigger
- `POST /api/triggers/token/:token` - Trigger DAG by token (public)
- `POST /api/triggers/webhook/:path` - Trigger DAG by webhook (public)

### Templates
- `GET /api/templates` - List all templates
- `GET /api/templates/:id` - Get template details
- `POST /api/templates` - Create template
- `POST /api/templates/:id/use` - Create DAG from template
- `POST /api/templates/defaults` - Create default templates

## 💡 Usage Examples

### Creating a Variable

Store an API key securely:
```json
POST /api/variables
{
  "name": "api_key",
  "value": "your-secret-key",
  "isSecret": true,
  "description": "API key for external service"
}
```

### Using Variables in Tasks

Reference variables in task configurations using `{{variableName}}`:
```json
{
  "type": "http",
  "name": "Fetch Data",
  "config": {
    "url": "https://api.example.com/data",
    "method": "GET",
    "headers": {
      "Authorization": "Bearer {{api_key}}"
    }
  }
}
```

### Creating a Webhook Trigger

Allow external systems to trigger your workflow:
```bash
POST /api/triggers
{
  "dagId": "your_dag_id",
  "name": "GitHub Webhook",
  "type": "webhook",
  "webhookPath": "github-events"
}
```

Then trigger from external system:
```bash
curl -X POST http://your-server.com/api/triggers/webhook/github-events
```

### Conditional Workflow

Create a workflow with conditional logic:
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

## 🎯 Task Types

1. **HTTP Request** - Call REST APIs
2. **Send Email** - Send emails via SMTP
3. **Database** - Query MongoDB
4. **Script** - Execute Node.js, Python, or Bash scripts
5. **File** - Read, write, copy, delete files
6. **Webhook** - Send webhook requests
7. **Delay** - Wait for specified duration
8. **Notification** - Send Slack/Discord notifications
9. **Transform** - Transform data with JavaScript
10. **Condition** - Conditional logic with if/else branches

## 🔒 Security Features

- **Encryption**: AES-256-CBC encryption for secrets
- **User Isolation**: All data scoped to user ID
- **Token-Based Triggers**: Secure random tokens for API triggers
- **Session Management**: Passport.js session-based authentication
- **CORS Protection**: Configurable CORS policies

## 🧪 Development

### Running Tests
```bash
# Backend tests (if available)
cd backend
npm test

# Frontend tests (if available)
cd frontend
npm test
```

### Code Structure
- Backend follows MVC pattern
- Frontend uses React functional components with hooks
- Real-time updates via WebSocket
- Worker-based task execution for scalability

## 📝 Additional Documentation

For more detailed information about automation features, see [AUTOMATION_FEATURES.md](./AUTOMATION_FEATURES.md).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

 





 


