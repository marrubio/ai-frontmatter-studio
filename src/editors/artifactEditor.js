const fs = require('fs/promises');
const path = require('path');
const vscode = require('vscode');
const { estimateTokenBreakdown, estimateArtifactTokens } = require('../tokenEstimate');

async function readResource(context, resourcePath) {
  return fs.readFile(path.join(context.extensionPath, resourcePath), 'utf8');
}

function getNonce() {
  return Math.random().toString(36).slice(2);
}

function serializeState(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getDisplayTitle(artifact, state) {
  const name = state?.fields?.name?.value?.trim();
  if (name) {
    return name;
  }

  const fileName = state?.path ? path.basename(state.path) : '';
  return fileName || artifact.title;
}

async function getArtifactEditorHtml(context, webview, artifact, state, fileContent) {
  const [template, styles, renderer, tokenCounter] = await Promise.all([
    readResource(context, path.join('media', 'webview', 'index.html')),
    readResource(context, path.join('media', 'webview', 'common.css')),
    readResource(context, artifact.rendererPath),
    readResource(context, path.join('media', 'webview', 'tokenCounter.js'))
  ]);
  const nonce = getNonce();
  const title = escapeHtml(getDisplayTitle(artifact, state));
  const artifactData = typeof artifact.getInitialData === 'function' ? await artifact.getInitialData() : artifact.initialData;
  const initial = serializeState({ state, tokenEstimate: fileContent === undefined ? estimateArtifactTokens(artifact, state) : estimateTokenBreakdown(fileContent, state.body), diagnostics: artifact.getDiagnostics?.(state), ...artifactData });
  const script = `const initial = JSON.parse(document.getElementById('initial-state').textContent);\n${renderer}\n${tokenCounter}`;

  return template
    .replaceAll('{{TITLE}}', title)
    .replaceAll('{{DESCRIPTION}}', artifact.description)
    .replaceAll('{{STYLE}}', styles)
    .replaceAll('{{STATE}}', initial)
    .replaceAll('{{NONCE}}', nonce)
    .replaceAll('{{SCRIPT}}', script);
}

async function openArtifactEditor(context, uri, provider, artifact) {
  let fileContent;
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    fileContent = document.getText();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read artifact file';
    vscode.window.showErrorMessage(`Could not open ${path.basename(uri.fsPath)}: ${message}`);
    return;
  }

  const state = artifact.parse(fileContent, uri.fsPath);
  const displayTitle = getDisplayTitle(artifact, state);
  const panel = vscode.window.createWebviewPanel(
    `aiFrontmatterStudio.${artifact.key}Editor`,
    `${displayTitle}: ${path.basename(uri.fsPath)}`,
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  try {
    panel.webview.html = await getArtifactEditorHtml(context, panel.webview, artifact, state, fileContent);
  } catch (error) {
    vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to render artifact editor');
    panel.dispose();
    return;
  }

  panel.webview.onDidReceiveMessage(async (message) => {
    if (message?.type === 'estimateTokens') {
      panel.webview.postMessage({ type: 'tokenEstimate', revision: message.revision, count: estimateArtifactTokens(artifact, message.state) });
      return;
    }

    if (message?.type === 'diagnose' && artifact.getDiagnostics) {
      panel.webview.postMessage({ type: 'diagnostics', revision: message.revision, diagnostics: artifact.getDiagnostics(message.state) });
      return;
    }

    if (message?.type === 'openSource' && artifact.getDiagnostics) {
      await vscode.window.showTextDocument(uri);
      return;
    }

    if (message?.type === 'openDoc') {
      if (message.url) {
        await vscode.env.openExternal(vscode.Uri.parse(message.url));
      }
      return;
    }

    if (message?.type !== 'save') {
      return;
    }

    try {
      const errors = artifact.validate(message.state);
      if (errors.length) {
        panel.webview.postMessage({ type: 'saveResult', error: errors.join(' ') });
        vscode.window.showErrorMessage(errors.join(' '));
        return;
      }

      await vscode.workspace.fs.writeFile(uri, Buffer.from(artifact.serialize(message.state), 'utf8'));
      provider.refresh();
      panel.webview.postMessage({ type: 'saveResult' });
      vscode.window.showInformationMessage(`Saved ${path.basename(uri.fsPath)}`);
    } catch (error) {
      panel.webview.postMessage({ type: 'saveResult', error: error instanceof Error ? error.message : 'Failed to save artifact' });
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to save artifact');
    }
  });
}

module.exports = {
  getArtifactEditorHtml,
  openArtifactEditor
};
