const path = require('path');
const {
  BUILT_IN_TOOL_ALIASES,
  MODEL_OPTIONS,
  createEmptyState,
  parseAgentDocument,
  serializeAgentDocument,
  validateState
} = require('../frontmatter');

const agentArtifact = {
  key: 'agent',
  title: 'Agent Frontmatter Editor',
  description: 'Visual editor for *.agent.md frontmatter.',
  rendererPath: path.join('media', 'artifacts', 'agent', 'editor.js'),
  initialData: {
    toolAliases: BUILT_IN_TOOL_ALIASES,
    modelOptions: MODEL_OPTIONS
  },
  parse(content, filePath) {
    return parseAgentDocument(content, filePath);
  },
  serialize(state) {
    return serializeAgentDocument(state);
  },
  validate(state) {
    return validateState(state);
  },
  createState(filePath) {
    return createEmptyState(filePath);
  },
  createContent(state) {
    return serializeAgentDocument(state);
  }
};

module.exports = agentArtifact;
