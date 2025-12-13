import Template from "../models/Template.js";
import DAG from "../models/Dag.js";
import { sendResponse } from "../utils/response.js";

export const getTemplates = async (req, res) => {
  try {
    const { category, tag, publicOnly } = req.query;
    const query = {};

    if (publicOnly === "true" || !req.user) {
      query.isPublic = true;
    }

    if (category) {
      query.category = category;
    }

    if (tag) {
      query.tags = tag;
    }

    const templates = await Template.find(query).sort({ usageCount: -1, createdAt: -1 });
    return sendResponse(res, 200, { templates });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

export const getTemplate = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    
    if (!template) {
      return sendResponse(res, 404, { error: "Template not found" });
    }

    // Only allow access to public templates or user's own templates
    if (!template.isPublic && (!req.user || template.createdBy?.toString() !== req.user._id.toString())) {
      return sendResponse(res, 403, { error: "Access denied" });
    }

    return sendResponse(res, 200, { template });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

export const createTemplate = async (req, res) => {
  try {
    if (!req.user) {
      return sendResponse(res, 401, { error: "Authentication required" });
    }

    const { name, description, category, tags, graph, defaultSchedule, variables, isPublic } = req.body;

    if (!name || !description || !graph) {
      return sendResponse(res, 400, { error: "Name, description, and graph are required" });
    }

    const template = await Template.create({
      name,
      description,
      category: category || "general",
      tags: tags || [],
      graph,
      defaultSchedule: defaultSchedule || { enabled: false, type: "manual" },
      variables: variables || [],
      isPublic: isPublic || false,
      createdBy: req.user._id
    });

    return sendResponse(res, 201, { template });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

export const useTemplate = async (req, res) => {
  try {
    if (!req.user) {
      return sendResponse(res, 401, { error: "Authentication required" });
    }

    const { templateId, name, variables } = req.body;

    const template = await Template.findById(templateId);
    if (!template) {
      return sendResponse(res, 404, { error: "Template not found" });
    }

    // Only allow access to public templates or user's own templates
    if (!template.isPublic && template.createdBy?.toString() !== req.user._id.toString()) {
      return sendResponse(res, 403, { error: "Access denied" });
    }

    // Create DAG from template
    const dagData = {
      name: name || `${template.name} (Copy)`,
      description: template.description,
      userId: req.user._id,
      graph: template.graph,
      schedule: template.defaultSchedule,
      isActive: false
    };

    // Substitute template variables if provided
    if (variables && typeof variables === "object") {
      // Replace variables in graph nodes config
      const processGraph = (graph) => {
        const processedGraph = JSON.parse(JSON.stringify(graph));
        
        processedGraph.nodes = processedGraph.nodes.map(node => {
          if (node.config) {
            const configStr = JSON.stringify(node.config);
            let processedConfig = configStr;
            
            Object.keys(variables).forEach(varName => {
              const regex = new RegExp(`\\{\\{${varName}\\}\\}`, "g");
              processedConfig = processedConfig.replace(regex, variables[varName]);
            });
            
            node.config = JSON.parse(processedConfig);
          }
          return node;
        });
        
        return processedGraph;
      };

      dagData.graph = processGraph(template.graph);
    }

    const dag = await DAG.create(dagData);

    // Increment template usage count
    await Template.findByIdAndUpdate(templateId, { $inc: { usageCount: 1 } });

    return sendResponse(res, 201, { dag, message: "DAG created from template successfully" });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};

export const createDefaultTemplates = async (req, res) => {
  try {
    // Only allow admins or first-time setup
    const existingTemplates = await Template.countDocuments({ isPublic: true });
    if (existingTemplates > 0 && !req.user) {
      return sendResponse(res, 403, { error: "Templates already exist" });
    }

    const defaultTemplates = [
      {
        name: "Daily Email Report",
        description: "Fetch data from API and send daily email report",
        category: "email",
        tags: ["email", "api", "daily"],
        graph: {
          nodes: [
            { id: "1", type: "http", name: "Fetch Data", config: { url: "{{apiUrl}}", method: "GET" }, position: { x: 100, y: 100 } },
            { id: "2", type: "transform", name: "Format Data", config: { transformFunction: "input => ({ report: input })" }, position: { x: 300, y: 100 } },
            { id: "3", type: "email", name: "Send Email", config: { to: "{{emailTo}}", subject: "Daily Report", body: "{{reportBody}}" }, position: { x: 500, y: 100 } }
          ],
          edges: [
            { id: "e1", source: "1", target: "2", type: "success" },
            { id: "e2", source: "2", target: "3", type: "success" }
          ]
        },
        defaultSchedule: { enabled: true, type: "cron", cronExpression: "0 9 * * *" },
        variables: [
          { name: "apiUrl", description: "API endpoint URL", required: true },
          { name: "emailTo", description: "Recipient email address", required: true },
          { name: "reportBody", description: "Email body template", required: false, defaultValue: "Daily report attached" }
        ],
        isPublic: true
      },
      {
        name: "Webhook to Database",
        description: "Receive webhook and save to database",
        category: "integration",
        tags: ["webhook", "database"],
        graph: {
          nodes: [
            { id: "1", type: "webhook", name: "Receive Webhook", config: { url: "{{webhookUrl}}" }, position: { x: 100, y: 100 } },
            { id: "2", type: "database", name: "Save to DB", config: { databaseType: "mongodb", operation: "insert", collection: "{{collectionName}}", data: "{{webhookData}}" }, position: { x: 300, y: 100 } }
          ],
          edges: [
            { id: "e1", source: "1", target: "2", type: "success" }
          ]
        },
        defaultSchedule: { enabled: false, type: "manual" },
        variables: [
          { name: "webhookUrl", description: "Webhook endpoint URL", required: true },
          { name: "collectionName", description: "MongoDB collection name", required: true }
        ],
        isPublic: true
      }
    ];

    const created = await Template.insertMany(defaultTemplates);
    return sendResponse(res, 201, { templates: created, message: "Default templates created" });
  } catch (error) {
    return sendResponse(res, 500, { error: error.message });
  }
};


