const path = require('path');
const vscode = require('vscode');
const {
  BUILT_IN_TOOL_ALIASES,
  MODEL_OPTIONS,
  createEmptyState,
  parseAgentDocument,
  serializeAgentDocument,
  getAgentDiagnostics
} = require('../frontmatter');

const agentArtifact = {
  key: 'agent',
  title: 'Agent',
  description: 'Visual editor for *.agent.md frontmatter.',
  rendererPath: path.join('media', 'artifacts', 'agent', 'editor.js'),
  initialData: {
    toolAliases: BUILT_IN_TOOL_ALIASES,
    modelOptions: MODEL_OPTIONS
  },
  getInitialData() {
    const configuredModels = vscode.workspace
      .getConfiguration('aiFrontmatterStudio')
      .get('modelOptions', MODEL_OPTIONS);
    const modelOptions = Array.isArray(configuredModels)
      ? configuredModels.filter((model) => typeof model === 'string' && model.trim()).map((model) => model.trim())
      : MODEL_OPTIONS;

    return {
      toolAliases: BUILT_IN_TOOL_ALIASES,
      modelOptions: modelOptions.length ? modelOptions : MODEL_OPTIONS
    };
  },
  parse(content, filePath) {
    return parseAgentDocument(content, filePath);
  },
  serialize(state) {
    return serializeAgentDocument(state);
  },
  validate(state) {
    return getAgentDiagnostics(state).errors;
  },
  getDiagnostics(state) {
    return getAgentDiagnostics(state);
  },
  createState(filePath) {
    return createEmptyState(filePath);
  },
  createContent(state) {
    return serializeAgentDocument(state);
  }
};

module.exports = agentArtifact;
