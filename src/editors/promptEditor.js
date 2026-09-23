const path = require('path');
const vscode = require('vscode');
const promptArtifact = require('../artifacts/promptArtifact');
const { discoverFiles, CATEGORY_DEFINITIONS } = require('../assets/assetProvider');
const { openArtifactEditor } = require('./artifactEditor');

async function openPromptEditor(context, uri, provider) {
  if (!uri) {
    const definition = CATEGORY_DEFINITIONS.find((entry) => entry.key === 'prompts');
    const resources = await discoverFiles(definition.patterns);
    if (!resources.length) {
      vscode.window.showInformationMessage('No prompt files were found. Create one from the Copilot Assets view.');
      return;
    }

    const picked = await vscode.window.showQuickPick(
      resources.map((resource) => ({
        label: path.basename(resource.fsPath),
        description: vscode.workspace.asRelativePath(resource, false),
        resource
      })),
      { placeHolder: 'Select a prompt to open in the form editor' }
    );
    if (!picked) {
      return;
    }
    uri = picked.resource;
  }

  await openArtifactEditor(context, uri, provider, promptArtifact);
}

function toSlug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'new-prompt';
}

async function createPrompt(context, provider) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Open a workspace folder before creating a prompt.');
    return;
  }

  const suggestedName = await vscode.window.showInputBox({
    prompt: 'Prompt file name',
    value: 'new-prompt',
    validateInput(value) {
      return value?.trim() ? null : 'File name is required.';
    }
  });
  if (!suggestedName) {
    return;
  }

  const fileName = suggestedName.endsWith('.prompt.md') ? suggestedName : `${toSlug(suggestedName)}.prompt.md`;
  const targetDir = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'prompts');
  await vscode.workspace.fs.createDirectory(targetDir);
  const fileUri = vscode.Uri.joinPath(targetDir, fileName);

  try {
    await vscode.workspace.fs.stat(fileUri);
    const action = await vscode.window.showWarningMessage(`${fileName} already exists.`, 'Open existing', 'Overwrite');
    if (action === 'Open existing') {
      await openPromptEditor(context, fileUri, provider);
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

  const state = promptArtifact.createState(fileUri.fsPath);
  state.fields.name = { enabled: true, value: path.basename(fileName, '.prompt.md') };
  state.fields.description = { enabled: true, value: 'Describe what this prompt does.' };
  state.body = '# Prompt\n\nDescribe the reusable prompt here.\n';
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(promptArtifact.createContent(state), 'utf8'));
  provider.refresh();
  await openPromptEditor(context, fileUri, provider);
}

module.exports = {
  openPromptEditor,
  createPrompt
};
