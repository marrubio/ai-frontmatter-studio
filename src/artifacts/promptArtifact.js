const path = require('path');
const vscode = require('vscode');
const {
  BUILT_IN_TOOL_ALIASES,
  MODEL_OPTIONS,
  createEmptyPromptState,
  parsePromptDocument,
  serializePromptDocument,
  validatePromptState
} = require('../frontmatter');

const promptArtifact = {
  key: 'prompt',
  title: 'Prompt',
  description: 'Visual editor for *.prompt.md frontmatter.',
  rendererPath: path.join('media', 'artifacts', 'prompt', 'editor.js'),
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
    return parsePromptDocument(content, filePath);
  },
  serialize(state) {
    return serializePromptDocument(state);
  },
  validate(state) {
    return validatePromptState(state);
  },
  createState(filePath) {
    return createEmptyPromptState(filePath);
  },
  createContent(state) {
    return serializePromptDocument(state);
  }
};

module.exports = promptArtifact;
