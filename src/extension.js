const vscode = require('vscode');
const { CopilotAssetsProvider } = require('./assets/assetProvider');
const { openAgentEditor, createAgent } = require('./editors/agentEditor');

function activate(context) {
  const provider = new CopilotAssetsProvider(context);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('copilotAssets', provider),
    vscode.commands.registerCommand('aiFrontmatterStudio.openAgent', (uri) => openAgentEditor(context, uri, provider)),
    vscode.commands.registerCommand('aiFrontmatterStudio.createAgent', () => createAgent(context, provider)),
    vscode.workspace.onDidCreateFiles(() => provider.refresh()),
    vscode.workspace.onDidDeleteFiles(() => provider.refresh()),
    vscode.workspace.onDidRenameFiles(() => provider.refresh()),
    vscode.workspace.onDidSaveTextDocument(() => provider.refresh())
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
