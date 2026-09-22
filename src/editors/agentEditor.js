const path = require('path');
const vscode = require('vscode');
const agentArtifact = require('../artifacts/agentArtifact');
const { discoverFiles, CATEGORY_DEFINITIONS } = require('../assets/assetProvider');
const { openArtifactEditor } = require('./artifactEditor');

async function openAgentEditor(context, uri, provider) {
  if (!uri) {
    const definition = CATEGORY_DEFINITIONS.find((entry) => entry.key === 'agents');
    const resources = await discoverFiles(definition.patterns);
    if (!resources.length) {
      vscode.window.showInformationMessage('No agent files were found. Create one from the Copilot Assets view.');
      return;
    }

    const picked = await vscode.window.showQuickPick(
      resources.map((resource) => ({
        label: path.basename(resource.fsPath),
        description: vscode.workspace.asRelativePath(resource, false),
        resource
      })),
      { placeHolder: 'Select an agent to open in the form editor' }
    );
    if (!picked) {
      return;
    }
    uri = picked.resource;
  }

  await openArtifactEditor(context, uri, provider, agentArtifact);
}

function toSlug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'new-agent';
}

async function createAgent(context, provider) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Open a workspace folder before creating an agent.');
    return;
  }

  const suggestedName = await vscode.window.showInputBox({
    prompt: 'Agent file name',
    value: 'new-agent',
    validateInput(value) {
      return value?.trim() ? null : 'File name is required.';
    }
  });
  if (!suggestedName) {
    return;
  }

  const fileName = suggestedName.endsWith('.agent.md') ? suggestedName : `${toSlug(suggestedName)}.agent.md`;
  const targetDir = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'agents');
  await vscode.workspace.fs.createDirectory(targetDir);
  const fileUri = vscode.Uri.joinPath(targetDir, fileName);

  try {
    await vscode.workspace.fs.stat(fileUri);
    const action = await vscode.window.showWarningMessage(`${fileName} already exists.`, 'Open existing', 'Overwrite');
    if (action === 'Open existing') {
      await openAgentEditor(context, fileUri, provider);
      return;
    }
    if (action !== 'Overwrite') {
      return;
    }
  } catch (error) {
    if (!(error && typeof error === 'object' && error.code === 'FileNotFound')) {
      throw error;
    }
  }

  const state = agentArtifact.createState(fileUri.fsPath);
  state.fields.description.value = 'Describe what this agent does.';
  state.body = '# Role\n\nDescribe the agent behavior here.\n';
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(agentArtifact.createContent(state), 'utf8'));
  provider.refresh();
  await openAgentEditor(context, fileUri, provider);
}

module.exports = {
  openAgentEditor,
  createAgent
};
