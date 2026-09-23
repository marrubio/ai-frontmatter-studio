const path = require('path');
const vscode = require('vscode');
const YAML = require('yaml');
const { openAgentEditor } = require('./agentEditor');
const { openSkillEditor } = require('./skillEditor');
const { openPromptEditor } = require('./promptEditor');

function getFrontmatterArtifact(uri) {
  const filePath = uri?.fsPath || '';
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  const fileName = path.basename(filePath).toLowerCase();
  const pathSegments = normalizedPath.split('/');

  if (pathSegments.includes('agents') || pathSegments.includes('.agents')) {
    return 'agent';
  }
  if (pathSegments.includes('skills')) {
    return 'skill';
  }
  if (pathSegments.includes('prompts')) {
    return 'prompt';
  }
  if (fileName.endsWith('.agent.md')) {
    return 'agent';
  }
  if (fileName.endsWith('.prompt.md')) {
    return 'prompt';
  }
  if (fileName === 'skill.md') {
    return 'skill';
  }
  return undefined;
}

function isCopilotMarkdown(uri) {
  const normalizedPath = (uri?.fsPath || '').replace(/\\/g, '/').toLowerCase();
  return normalizedPath.includes('/.copilot/') && normalizedPath.endsWith('.md');
}

async function inferCopilotArtifact(uri) {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const match = document.getText().match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    const frontmatter = match ? YAML.parse(match[1]) || {} : {};

    if (frontmatter.agent !== undefined || frontmatter['argument-hint'] !== undefined) {
      return 'prompt';
    }
    if (frontmatter.tools !== undefined || frontmatter.agents !== undefined || frontmatter.model !== undefined
      || frontmatter['user-invocable'] !== undefined || frontmatter['disable-model-invocation'] !== undefined
      || frontmatter.handoffs !== undefined || frontmatter.hooks !== undefined) {
      return 'agent';
    }
  } catch (error) {
    return undefined;
  }

  return 'skill';
}

async function openFrontmatterEditor(context, uri, provider) {
  uri = uri || vscode.window.activeTextEditor?.document.uri;
  const artifact = getFrontmatterArtifact(uri) || (isCopilotMarkdown(uri) ? await inferCopilotArtifact(uri) : undefined);
  if (artifact === 'agent') {
    await openAgentEditor(context, uri, provider);
  } else if (artifact === 'skill') {
    await openSkillEditor(context, uri, provider);
  } else if (artifact === 'prompt') {
    await openPromptEditor(context, uri, provider);
  } else {
    vscode.window.showInformationMessage('Select an agent, prompt, or skill Markdown file to open its frontmatter view.');
  }
}

module.exports = {
  getFrontmatterArtifact,
  inferCopilotArtifact,
  openFrontmatterEditor
};
