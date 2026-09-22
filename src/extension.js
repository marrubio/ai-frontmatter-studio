const path = require('path');
const vscode = require('vscode');
const {
  BUILT_IN_TOOL_ALIASES,
  MODEL_OPTIONS,
  createEmptyState,
  parseAgentDocument,
  serializeAgentDocument,
  validateState
} = require('./frontmatter');

const CATEGORY_DEFINITIONS = [
  {
    key: 'agents',
    label: 'Agents',
    icon: 'hubot',
    patterns: [
      '.github/agents/**/*.agent.md',
      '.agents/**/*.agent.md',
      '.claude/agents/**/*.md'
    ],
    editable: true
  },
  {
    key: 'skills',
    label: 'Skills',
    icon: 'library',
    patterns: ['.github/skills/**/SKILL.md', '.claude/skills/**/SKILL.md'],
    editable: false
  },
  {
    key: 'instructions',
    label: 'Instructions',
    icon: 'book',
    patterns: ['.github/instructions/**/*.instructions.md'],
    editable: false
  },
  {
    key: 'prompts',
    label: 'Prompts',
    icon: 'comment-discussion',
    patterns: ['.github/prompts/**/*.prompt.md'],
    editable: false
  },
  {
    key: 'mcp',
    label: 'MCP Servers',
    icon: 'plug',
    patterns: ['.vscode/mcp.json'],
    editable: false
  },
  {
    key: 'plugins',
    label: 'Plugins',
    icon: 'extensions',
    patterns: ['**/plugin.json'],
    editable: false
  }
];

class AssetNode extends vscode.TreeItem {
  constructor(options) {
    super(options.label, options.collapsibleState ?? vscode.TreeItemCollapsibleState.None);
    this.nodeType = options.nodeType;
    this.categoryKey = options.categoryKey;
    this.resourceUri = options.resourceUri;
    this.contextValue = options.contextValue;
    this.iconPath = options.iconPath;
    this.description = options.description;
    this.command = options.command;
    this.tooltip = options.tooltip;
  }
}

class CopilotAssetsProvider {
  constructor(context) {
    this.context = context;
    this._onDidChangeTreeData = new vscode.EventEmitter();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element) {
    return element;
  }

  async getChildren(element) {
    if (!vscode.workspace.workspaceFolders?.length) {
      if (element) {
        return [];
      }

      return [new AssetNode({
        label: 'Open a workspace folder to discover Copilot assets',
        nodeType: 'empty',
        contextValue: 'empty',
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        iconPath: new vscode.ThemeIcon('info')
      })];
    }

    if (!element) {
      return Promise.all(CATEGORY_DEFINITIONS.map(async (category) => {
        const items = await discoverFiles(category.patterns);
        return new AssetNode({
          label: category.label,
          description: `${items.length}`,
          nodeType: 'category',
          categoryKey: category.key,
          contextValue: 'category',
          collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
          iconPath: new vscode.ThemeIcon(category.icon),
          tooltip: `${category.label}: ${items.length} files found`
        });
      }));
    }

    if (element.nodeType !== 'category') {
      return [];
    }

    const category = CATEGORY_DEFINITIONS.find((entry) => entry.key === element.categoryKey);
    if (!category) {
      return [];
    }

    const resources = await discoverFiles(category.patterns);
    if (!resources.length) {
      return [new AssetNode({
        label: 'No files found',
        nodeType: 'empty',
        categoryKey: category.key,
        contextValue: 'empty',
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        iconPath: new vscode.ThemeIcon('circle-slash')
      })];
    }

    return resources.map((resource) => {
      const relativePath = vscode.workspace.asRelativePath(resource, false);
      return new AssetNode({
        label: path.basename(resource.fsPath),
        description: path.dirname(relativePath) === '.' ? '' : path.dirname(relativePath),
        nodeType: 'file',
        categoryKey: category.key,
        contextValue: category.editable ? 'agentFile' : 'file',
        resourceUri: resource,
        collapsibleState: vscode.TreeItemCollapsibleState.None,
        iconPath: new vscode.ThemeIcon(category.editable ? 'file-code' : 'file'),
        tooltip: relativePath,
        command: category.editable
          ? { command: 'aiFrontmatterStudio.openAgent', title: 'Open Agent Form', arguments: [resource] }
          : { command: 'vscode.open', title: 'Open File', arguments: [resource] }
      });
    });
  }
}

async function discoverFiles(patterns) {
  const results = [];
  const seen = new Set();

  for (const pattern of patterns) {
    const matches = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
    for (const match of matches) {
      if (!seen.has(match.fsPath)) {
        seen.add(match.fsPath);
        results.push(match);
      }
    }
  }

  return results.sort((left, right) => left.fsPath.localeCompare(right.fsPath));
}

function getNonce() {
  return Math.random().toString(36).slice(2);
}

function toSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'new-agent';
}

async function openAgentEditor(context, uri, provider) {
  if (!uri) {
    const resources = await discoverFiles(CATEGORY_DEFINITIONS.find((entry) => entry.key === 'agents').patterns);
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

  const fileContent = await vscode.workspace.fs.readFile(uri).then((buffer) => Buffer.from(buffer).toString('utf8')).catch(() => '');
  const state = fileContent ? parseAgentDocument(fileContent, uri.fsPath) : createEmptyState(uri.fsPath);
  const panel = vscode.window.createWebviewPanel(
    'aiFrontmatterStudio.agentEditor',
    `Agent: ${path.basename(uri.fsPath)}`,
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getAgentEditorHtml(panel.webview, context, state);

  panel.webview.onDidReceiveMessage(async (message) => {
    if (message?.type === 'openDoc') {
      const target = message.target === 'github'
        ? 'https://docs.github.com/en/copilot/reference/custom-agents-configuration'
        : 'https://code.visualstudio.com/docs/agent-customization/custom-agents';
      await vscode.env.openExternal(vscode.Uri.parse(target));
      return;
    }

    if (message?.type !== 'save') {
      return;
    }

    try {
      const errors = validateState(message.state);
      if (errors.length) {
        vscode.window.showErrorMessage(errors.join(' '));
        return;
      }

      const serialized = serializeAgentDocument(message.state);
      await vscode.workspace.fs.writeFile(uri, Buffer.from(serialized, 'utf8'));
      provider.refresh();
      vscode.window.showInformationMessage(`Saved ${path.basename(uri.fsPath)}`);
    } catch (error) {
      vscode.window.showErrorMessage(error instanceof Error ? error.message : 'Failed to save agent');
    }
  });
}

function getAgentEditorHtml(webview, context, state) {
  const nonce = getNonce();
  const safeState = JSON.stringify({
    state,
    toolAliases: BUILT_IN_TOOL_ALIASES,
    modelOptions: MODEL_OPTIONS,
    docs: {
      github: 'https://docs.github.com/en/copilot/reference/custom-agents-configuration',
      vscode: 'https://code.visualstudio.com/docs/agent-customization/custom-agents'
    }
  }).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${webview.cspSource}; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Frontmatter Studio</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: var(--vscode-font-family); padding: 16px; max-width: 1100px; margin: 0 auto; }
    h1, h2 { margin: 0 0 12px; }
    .actions { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 16px; }
    .card { border: 1px solid var(--vscode-panel-border); border-radius: 8px; padding: 12px; background: color-mix(in srgb, var(--vscode-editor-background) 96%, var(--vscode-focusBorder)); }
    .field { margin-bottom: 10px; }
    label { display: block; font-weight: 600; margin-bottom: 4px; }
    input[type="text"], textarea, select { width: 100%; box-sizing: border-box; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, var(--vscode-panel-border)); border-radius: 4px; padding: 8px; }
    textarea { min-height: 110px; resize: vertical; }
    .inline { display: flex; gap: 8px; align-items: center; }
    .inline > * { flex: 1; }
    .badge { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .muted { opacity: .85; font-size: 12px; }
    .list-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-bottom: 8px; }
    .handoff { border: 1px dashed var(--vscode-panel-border); border-radius: 6px; padding: 8px; margin-bottom: 8px; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; padding: 7px 12px; cursor: pointer; }
    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    .property-toggle { display: inline-flex; gap: 6px; align-items: center; margin: 0 10px 8px 0; }
    .status { margin-left: auto; }
    .error { color: var(--vscode-errorForeground); }
    .footer-links { margin-top: 8px; display: flex; gap: 12px; }
  </style>
</head>
<body>
  <div class="actions">
    <div>
      <h1>Agent Frontmatter Editor</h1>
      <div class="muted">MVP visual editor for <code>*.agent.md</code> frontmatter.</div>
    </div>
    <div class="status badge" id="status">Ready</div>
    <button id="saveButton">Save</button>
  </div>

  <div class="card" style="margin-bottom: 16px;">
    <h2>Optional properties</h2>
    <div id="propertyToggles"></div>
    <div class="footer-links muted">
      <button class="secondary" type="button" data-open-doc="github">GitHub Copilot docs</button>
      <button class="secondary" type="button" data-open-doc="vscode">VS Code docs</button>
    </div>
  </div>

  <div class="grid" id="formRoot"></div>

  <div class="card" style="margin-top: 16px;">
    <label for="body">Prompt body (Markdown)</label>
    <textarea id="body" placeholder="Describe the agent behavior, boundaries, and workflow."></textarea>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const initial = ${safeState};
    const state = initial.state;
    const propertyDocs = {
      name: 'Optional display name.',
      'argument-hint': 'VS Code-only prompt hint shown in chat input.',
      tools: 'Tool allowlist. Use * for all or [] for none.',
      agents: 'Subagents allowlist. Requires the agent tool when populated.',
      model: 'Single model or prioritized fallback list.',
      'user-invocable': 'Whether the agent appears in the picker.',
      'disable-model-invocation': 'Blocks subagent/model-based invocation.',
      infer: 'Deprecated legacy invocation flag.',
      target: 'vscode or github-copilot.',
      'mcp-servers': 'Agent-scoped MCP server configuration (GitHub Copilot target).',
      handoffs: 'Suggested agent transitions after a response.',
      hooks: 'Preview VS Code local agent-scoped hooks.',
      metadata: 'Arbitrary string annotations supported by GitHub Copilot.',
      description: 'Required summary of what the agent does.'
    };
    const propertyLabels = {
      name: 'Name',
      'argument-hint': 'Argument hint',
      tools: 'Tools',
      agents: 'Subagents',
      model: 'Model',
      'user-invocable': 'User invocable',
      'disable-model-invocation': 'Disable model invocation',
      infer: 'Infer (deprecated)',
      target: 'Target',
      'mcp-servers': 'MCP servers',
      handoffs: 'Handoffs',
      hooks: 'Hooks',
      metadata: 'Metadata'
    };

    const optionalKeys = ['name', 'argument-hint', 'tools', 'agents', 'model', 'user-invocable', 'disable-model-invocation', 'infer', 'target', 'mcp-servers', 'handoffs', 'hooks', 'metadata'];

    const formRoot = document.getElementById('formRoot');
    const propertyToggles = document.getElementById('propertyToggles');
    const body = document.getElementById('body');
    const status = document.getElementById('status');

    body.value = state.body || '';

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function setStatus(text, isError = false) {
      status.textContent = text;
      status.classList.toggle('error', isError);
    }

    function updateField(key, patch) {
      state.fields[key] = { ...state.fields[key], ...patch };
      render();
    }

    function renderPropertyToggles() {
      propertyToggles.innerHTML = optionalKeys.map((key) => 
        '<div class="field">'
          + '<label class="property-toggle" for="toggle-' + key + '"><input id="toggle-' + key + '" aria-describedby="toggle-help-' + key + '" type="checkbox" data-toggle="' + key + '" ' + (state.fields[key].enabled ? 'checked' : '') + '> ' + propertyLabels[key] + '</label>'
          + '<div class="muted" id="toggle-help-' + key + '">' + propertyDocs[key] + '</div>'
        + '</div>'
      ).join('');

      propertyToggles.querySelectorAll('[data-toggle]').forEach((checkbox) => {
        checkbox.addEventListener('change', (event) => {
          const key = event.target.getAttribute('data-toggle');
          updateField(key, { enabled: event.target.checked });
        });
      });
    }

    function renderListCard(key, title, items, placeholder, addLabel, modeOptions) {
      const modeHtml = modeOptions ? '<div class="field"><label>Mode</label><select data-mode="' + key + '">' + modeOptions.map((option) => '<option value="' + option.value + '" ' + (state.fields[key].mode === option.value ? 'selected' : '') + '>' + option.label + '</option>').join('') + '</select></div>' : '';
      const listAttribute = key === 'model' ? ' list="modelOptions"' : key === 'tools' ? ' list="toolOptions"' : '';
      const listHtml = (!modeOptions || state.fields[key].mode === 'selected')
        ? '<div class="field">' + items.map((item, index) => '<div class="list-row"><input type="text"' + listAttribute + ' data-list-item="' + key + '" data-index="' + index + '" value="' + escapeHtml(item) + '" placeholder="' + placeholder + '" /><button class="secondary" data-remove-list-item="' + key + '" data-index="' + index + '">Remove</button></div>').join('') + '<button class="secondary" data-add-list-item="' + key + '">' + addLabel + '</button></div>'
        : '';
      return '<div class="card"><h2>' + title + '</h2><div class="muted">' + propertyDocs[key] + '</div>' + modeHtml + listHtml + '</div>';
    }

    function renderHandoffs() {
      const items = state.fields.handoffs.items || [];
      return '<div class="card"><h2>handoffs</h2><div class="muted">' + propertyDocs.handoffs + '</div>' + items.map((item, index) => '<div class="handoff">'
        + '<div class="field"><label for="handoff-label-' + index + '">Label</label><input id="handoff-label-' + index + '" type="text" data-handoff="label" data-index="' + index + '" value="' + escapeHtml(item.label) + '" /></div>'
        + '<div class="field"><label for="handoff-agent-' + index + '">Agent</label><input id="handoff-agent-' + index + '" type="text" data-handoff="agent" data-index="' + index + '" value="' + escapeHtml(item.agent) + '" /></div>'
        + '<div class="field"><label for="handoff-prompt-' + index + '">Prompt</label><textarea id="handoff-prompt-' + index + '" data-handoff="prompt" data-index="' + index + '">' + escapeHtml(item.prompt) + '</textarea></div>'
        + '<div class="inline"><div class="field"><label for="handoff-model-' + index + '">Model</label><input id="handoff-model-' + index + '" type="text" list="modelOptions" data-handoff="model" data-index="' + index + '" value="' + escapeHtml(item.model) + '" /></div>'
        + '<label class="property-toggle" for="handoff-send-' + index + '"><input id="handoff-send-' + index + '" type="checkbox" data-handoff="send" data-index="' + index + '" ' + (item.send ? 'checked' : '') + '> Auto send</label></div>'
        + '<button class="secondary" data-remove-handoff="' + index + '">Remove handoff</button>'
        + '</div>').join('')
        + '<button class="secondary" id="addHandoff">Add handoff</button></div>';
    }

    function renderKeyValueCard(key, title, items) {
      return '<div class="card"><h2>' + title + '</h2><div class="muted">' + propertyDocs[key] + '</div>'
        + items.map((item, index) => '<div class="inline" style="margin-bottom:8px;"><input type="text" data-kv-key="' + key + '" data-index="' + index + '" value="' + escapeHtml(item.key) + '" placeholder="key" />'
        + '<input type="text" data-kv-value="' + key + '" data-index="' + index + '" value="' + escapeHtml(item.value) + '" placeholder="value" />'
        + '<button class="secondary" data-remove-kv="' + key + '" data-index="' + index + '">Remove</button></div>').join('')
        + '<button class="secondary" data-add-kv="' + key + '">Add entry</button></div>';
    }

    function renderTextAreaCard(key, title, value, placeholder) {
      return '<div class="card"><h2>' + title + '</h2><div class="muted">' + propertyDocs[key] + '</div><div class="field"><textarea data-yaml="' + key + '" placeholder="' + placeholder + '">' + escapeHtml(value) + '</textarea></div></div>';
    }

    function render() {
      renderPropertyToggles();
      const cards = [];
      cards.push('<div class="card"><h2>description <span class="badge">required</span></h2><div class="muted" id="description-help">' + propertyDocs.description + '</div><div class="field"><textarea id="description" aria-describedby="description-help">' + escapeHtml(state.fields.description.value) + '</textarea></div></div>');

      if (state.fields.name.enabled) {
        cards.push('<div class="card"><h2>name</h2><div class="muted">' + propertyDocs.name + '</div><div class="field"><input type="text" id="name" value="' + escapeHtml(state.fields.name.value) + '" /></div></div>');
      }
      if (state.fields['argument-hint'].enabled) {
        cards.push('<div class="card"><h2>argument-hint</h2><div class="muted">' + propertyDocs['argument-hint'] + '</div><div class="field"><input type="text" id="argument-hint" value="' + escapeHtml(state.fields['argument-hint'].value) + '" /></div></div>');
      }
      if (state.fields.tools.enabled) {
        cards.push(renderListCard('tools', 'tools', state.fields.tools.items || [], 'read, search, server/tool or server/*', 'Add tool', [
          { value: 'selected', label: 'Selected tools' },
          { value: 'all', label: 'All tools (*)' },
          { value: 'none', label: 'No tools ([])' }
        ]));
      }
      if (state.fields.agents.enabled) {
        cards.push(renderListCard('agents', 'agents', state.fields.agents.items || [], 'implementation, reviewer, *', 'Add subagent', [
          { value: 'selected', label: 'Selected agents' },
          { value: 'all', label: 'All agents (*)' },
          { value: 'none', label: 'No agents ([])' }
        ]));
      }
      if (state.fields.model.enabled) {
        cards.push(renderListCard('model', 'model', state.fields.model.items || [], 'Select or type a model', 'Add model', null));
      }
      if (state.fields['user-invocable'].enabled) {
        cards.push('<div class="card"><h2>user-invocable</h2><div class="muted">' + propertyDocs['user-invocable'] + '</div><label class="property-toggle"><input type="checkbox" id="user-invocable" ' + (state.fields['user-invocable'].value ? 'checked' : '') + '> Enabled</label></div>');
      }
      if (state.fields['disable-model-invocation'].enabled) {
        cards.push('<div class="card"><h2>disable-model-invocation</h2><div class="muted">' + propertyDocs['disable-model-invocation'] + '</div><label class="property-toggle"><input type="checkbox" id="disable-model-invocation" ' + (state.fields['disable-model-invocation'].value ? 'checked' : '') + '> Enabled</label></div>');
      }
      if (state.fields.infer.enabled) {
        cards.push('<div class="card"><h2>infer <span class="badge">deprecated</span></h2><div class="muted">' + propertyDocs.infer + '</div><label class="property-toggle"><input type="checkbox" id="infer" ' + (state.fields.infer.value ? 'checked' : '') + '> true</label></div>');
      }
      if (state.fields.target.enabled) {
        cards.push('<div class="card"><h2>target</h2><div class="muted">' + propertyDocs.target + '</div><div class="field"><select id="target"><option value="vscode" ' + (state.fields.target.value === 'vscode' ? 'selected' : '') + '>vscode</option><option value="github-copilot" ' + (state.fields.target.value === 'github-copilot' ? 'selected' : '') + '>github-copilot</option></select></div></div>');
      }
      if (state.fields['mcp-servers'].enabled) {
        cards.push(renderTextAreaCard('mcp-servers', 'mcp-servers', state.fields['mcp-servers'].yamlText || '', '- id: browser\n  command: node\n  args:\n    - server.js'));
      }
      if (state.fields.handoffs.enabled) {
        cards.push(renderHandoffs());
      }
      if (state.fields.hooks.enabled) {
        cards.push(renderTextAreaCard('hooks', 'hooks', state.fields.hooks.yamlText || '', 'pre:\n  - command: npm test'));
      }
      if (state.fields.metadata.enabled) {
        cards.push(renderKeyValueCard('metadata', 'metadata', state.fields.metadata.items || []));
      }
      cards.push(renderTextAreaCard('extra', 'extra properties', state.extraPropertiesYaml || '', 'future-property: value'));
      formRoot.innerHTML = cards.join('')
        + '<datalist id="modelOptions">' + initial.modelOptions.map((option) => '<option value="' + escapeHtml(option) + '"></option>').join('') + '</datalist>'
        + '<datalist id="toolOptions">' + initial.toolAliases.map((option) => '<option value="' + escapeHtml(option) + '"></option>').join('') + '</datalist>';
      bindEvents();
      if (state.validationError) {
        setStatus(state.validationError, true);
      }
    }

    function bindEvents() {
      const description = document.getElementById('description');
      description?.addEventListener('input', (event) => { state.fields.description.value = event.target.value; setStatus('Modified'); });
      document.getElementById('name')?.addEventListener('input', (event) => { state.fields.name.value = event.target.value; setStatus('Modified'); });
      document.getElementById('argument-hint')?.addEventListener('input', (event) => { state.fields['argument-hint'].value = event.target.value; setStatus('Modified'); });
      document.getElementById('target')?.addEventListener('change', (event) => { state.fields.target.value = event.target.value; setStatus('Modified'); });
      document.getElementById('user-invocable')?.addEventListener('change', (event) => { state.fields['user-invocable'].value = event.target.checked; setStatus('Modified'); });
      document.getElementById('disable-model-invocation')?.addEventListener('change', (event) => { state.fields['disable-model-invocation'].value = event.target.checked; setStatus('Modified'); });
      document.getElementById('infer')?.addEventListener('change', (event) => { state.fields.infer.value = event.target.checked; setStatus('Modified'); });
      body.oninput = (event) => { state.body = event.target.value; setStatus('Modified'); };

      document.querySelectorAll('[data-mode]').forEach((select) => {
        select.addEventListener('change', (event) => {
          const key = event.target.getAttribute('data-mode');
          state.fields[key].mode = event.target.value;
          render();
          setStatus('Modified');
        });
      });

      document.querySelectorAll('[data-list-item]').forEach((input) => {
        input.addEventListener('input', (event) => {
          const key = event.target.getAttribute('data-list-item');
          const index = Number(event.target.getAttribute('data-index'));
          state.fields[key].items[index] = event.target.value;
          setStatus('Modified');
        });
      });

      document.querySelectorAll('[data-add-list-item]').forEach((button) => {
        button.addEventListener('click', (event) => {
          const key = event.target.getAttribute('data-add-list-item');
          state.fields[key].items.push('');
          render();
          setStatus('Modified');
        });
      });

      document.querySelectorAll('[data-remove-list-item]').forEach((button) => {
        button.addEventListener('click', (event) => {
          const key = event.target.getAttribute('data-remove-list-item');
          const index = Number(event.target.getAttribute('data-index'));
          state.fields[key].items.splice(index, 1);
          render();
          setStatus('Modified');
        });
      });

      document.querySelectorAll('[data-open-doc]').forEach((button) => {
        button.addEventListener('click', (event) => {
          vscode.postMessage({ type: 'openDoc', target: event.target.getAttribute('data-open-doc') });
        });
      });

      document.querySelectorAll('[data-handoff]').forEach((input) => {
        const field = input.getAttribute('data-handoff');
        input.addEventListener(field === 'send' ? 'change' : 'input', (event) => {
          const index = Number(event.target.getAttribute('data-index'));
          state.fields.handoffs.items[index][field] = field === 'send' ? event.target.checked : event.target.value;
          setStatus('Modified');
        });
      });

      document.getElementById('addHandoff')?.addEventListener('click', () => {
        state.fields.handoffs.items.push({ label: '', agent: '', prompt: '', send: false, model: '' });
        render();
        setStatus('Modified');
      });

      document.querySelectorAll('[data-remove-handoff]').forEach((button) => {
        button.addEventListener('click', (event) => {
          const index = Number(event.target.getAttribute('data-remove-handoff'));
          state.fields.handoffs.items.splice(index, 1);
          render();
          setStatus('Modified');
        });
      });

      document.querySelectorAll('[data-yaml]').forEach((textarea) => {
        textarea.addEventListener('input', (event) => {
          const key = event.target.getAttribute('data-yaml');
          if (key === 'extra') {
            state.extraPropertiesYaml = event.target.value;
          } else {
            state.fields[key].yamlText = event.target.value;
          }
          setStatus('Modified');
        });
      });

      document.querySelectorAll('[data-kv-key]').forEach((input) => {
        input.addEventListener('input', (event) => {
          const key = event.target.getAttribute('data-kv-key');
          const index = Number(event.target.getAttribute('data-index'));
          state.fields[key].items[index].key = event.target.value;
          setStatus('Modified');
        });
      });
      document.querySelectorAll('[data-kv-value]').forEach((input) => {
        input.addEventListener('input', (event) => {
          const key = event.target.getAttribute('data-kv-value');
          const index = Number(event.target.getAttribute('data-index'));
          state.fields[key].items[index].value = event.target.value;
          setStatus('Modified');
        });
      });
      document.querySelectorAll('[data-add-kv]').forEach((button) => {
        button.addEventListener('click', (event) => {
          const key = event.target.getAttribute('data-add-kv');
          state.fields[key].items.push({ key: '', value: '' });
          render();
          setStatus('Modified');
        });
      });
      document.querySelectorAll('[data-remove-kv]').forEach((button) => {
        button.addEventListener('click', (event) => {
          const key = event.target.getAttribute('data-remove-kv');
          const index = Number(event.target.getAttribute('data-index'));
          state.fields[key].items.splice(index, 1);
          render();
          setStatus('Modified');
        });
      });
    }

    document.getElementById('saveButton').addEventListener('click', () => {
      state.body = body.value;
      vscode.postMessage({ type: 'save', state });
      setStatus('Saving...');
    });

    render();
  </script>
</body>
</html>`;
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
    const action = await vscode.window.showWarningMessage(
      `${fileName} already exists.`,
      'Open existing',
      'Overwrite'
    );

    if (action === 'Open existing') {
      await openAgentEditor(context, fileUri, provider);
      return;
    }

    if (action !== 'Overwrite') {
      return;
    }
  } catch (error) {
    const notFound = error && typeof error === 'object' && error.code === 'FileNotFound';
    if (!notFound) {
      throw error;
    }
  }

  const initialState = createEmptyState(fileUri.fsPath);
  initialState.fields.description.value = 'Describe what this agent does.';
  initialState.body = '# Role\n\nDescribe the agent behavior here.\n';
  const content = serializeAgentDocument(initialState);
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
  provider.refresh();
  await openAgentEditor(context, fileUri, provider);
}

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
