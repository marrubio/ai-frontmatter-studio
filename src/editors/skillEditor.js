const path = require('path');
const vscode = require('vscode');
const skillArtifact = require('../artifacts/skillArtifact');
const { discoverFiles, CATEGORY_DEFINITIONS } = require('../assets/assetProvider');
const { openArtifactEditor } = require('./artifactEditor');

async function openSkillEditor(context, uri, provider) {
  if (!uri) {
    const definition = CATEGORY_DEFINITIONS.find((entry) => entry.key === 'skills');
    const resources = await discoverFiles(definition.patterns);
    if (!resources.length) {
      vscode.window.showInformationMessage('No skill files were found. Create one from the Copilot Assets view.');
      return;
    }

    const picked = await vscode.window.showQuickPick(
      resources.map((resource) => ({
        label: path.basename(path.dirname(resource.fsPath)),
        description: vscode.workspace.asRelativePath(resource, false),
        resource
      })),
      { placeHolder: 'Select a skill to open in the form editor' }
    );
    if (!picked) {
      return;
    }
    uri = picked.resource;
  }

  await openArtifactEditor(context, uri, provider, skillArtifact);
}

function toSlug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'new-skill';
}

async function createSkill(context, provider) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('Open a workspace folder before creating a skill.');
    return;
  }

  const suggestedName = await vscode.window.showInputBox({
    prompt: 'Skill directory name',
    value: 'new-skill',
    validateInput(value) {
      return value?.trim() ? null : 'Directory name is required.';
    }
  });
  if (!suggestedName) {
    return;
  }

  const directoryName = toSlug(suggestedName);
  const targetDir = vscode.Uri.joinPath(workspaceFolder.uri, '.github', 'skills', directoryName);
  const fileUri = vscode.Uri.joinPath(targetDir, 'SKILL.md');
  await vscode.workspace.fs.createDirectory(targetDir);

  try {
    await vscode.workspace.fs.stat(fileUri);
    const action = await vscode.window.showWarningMessage(`${directoryName}/SKILL.md already exists.`, 'Open existing', 'Overwrite');
    if (action === 'Open existing') {
      await openSkillEditor(context, fileUri, provider);
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

  const state = skillArtifact.createState(fileUri.fsPath);
  state.fields.name = { enabled: true, value: directoryName };
  state.fields.description.value = 'Describe what this skill does.';
  state.body = '# Instructions\n\nDescribe the skill workflow here.\n';
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(skillArtifact.createContent(state), 'utf8'));
  provider.refresh();
  await openSkillEditor(context, fileUri, provider);
}

module.exports = {
  openSkillEditor,
  createSkill
};
