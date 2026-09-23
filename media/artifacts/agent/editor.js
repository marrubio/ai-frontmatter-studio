const root = document.getElementById('artifactRoot');
const status = document.getElementById('status');
const state = initial.state;
const docs = {
  github: 'https://docs.github.com/en/copilot/reference/custom-agents-configuration',
  vscode: 'https://code.visualstudio.com/docs/agent-customization/custom-agents'
};
const help = {
  name: 'Optional display name.',
  'argument-hint': 'Prompt hint shown in chat input.',
  tools: 'Tool allowlist. Use * for all or [] for none.',
  agents: 'Subagent allowlist. Requires the agent tool when populated.',
  model: 'Single model or prioritized fallback list.',
  'user-invocable': 'Whether the agent appears in the picker.',
  'disable-model-invocation': 'Blocks model-based invocation.',
  infer: 'Deprecated legacy invocation flag.',
  target: 'vscode or github-copilot.',
  'mcp-servers': 'Agent-scoped MCP server configuration.',
  handoffs: 'Suggested agent transitions.',
  hooks: 'Agent-scoped hooks.',
  metadata: 'Arbitrary string annotations.'
};

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setStatus(text, error) {
  status.textContent = text;
  status.classList.toggle('error', Boolean(error));
}

function fieldCard(title, content, description) {
  return '<section class="form-section"><div class="section-heading"><h2>' + title + '</h2>' + (description ? '<div class="muted">' + description + '</div>' : '') + '</div>' + content + '</section>';
}

function renderMarkdown(markdown) {
  const lines = escapeHtml(markdown).split(/\r?\n/);
  const output = [];
  let paragraph = [];
  let list = [];
  let code = false;
  const inline = (text) => text.replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>');
  const flush = () => {
    if (paragraph.length) output.push('<p>' + inline(paragraph.join('<br>')) + '</p>');
    if (list.length) output.push('<ul>' + list.map((item) => '<li>' + inline(item) + '</li>').join('') + '</ul>');
    paragraph = [];
    list = [];
  };
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      flush();
      output.push(code ? '</code></pre>' : '<pre><code>');
      code = !code;
    } else if (code) {
      output.push(line + '\n');
    } else if (/^#{1,3}\s/.test(line)) {
      flush();
      const match = line.match(/^(#{1,3})\s(.+)$/);
      output.push('<h' + match[1].length + '>' + inline(match[2]) + '</h' + match[1].length + '>');
    } else if (/^\s*[-*]\s+/.test(line)) {
      paragraph = [];
      list.push(line.replace(/^\s*[-*]\s+/, ''));
    } else if (!line.trim()) {
      flush();
    } else {
      paragraph.push(line);
    }
  }
  flush();
  return output.join('') || '<span class="muted">Nothing to preview yet.</span>';
}

function updateTitle(name) {
  const fallbackTitle = document.body.dataset.fallbackTitle || document.title;
  const title = name.trim() || fallbackTitle;
  document.title = title;
  document.querySelector('h1').textContent = title;
}

function listCard(key, title, modes) {
  const field = state.fields[key];
  const mode = modes ? '<div class="field"><label>Mode</label><select data-mode="' + key + '">' + modes.map((item) => '<option value="' + item.value + '" ' + (field.mode === item.value ? 'selected' : '') + '>' + item.label + '</option>').join('') + '</select></div>' : '';
  const rows = !modes || field.mode === 'selected' ? (field.items || []).map((item, index) => '<div class="list-row">' + (key === 'model' ? modelSelect(item, index) : '<input data-list="' + key + '" data-index="' + index + '" value="' + escapeHtml(item) + '">') + '<button class="secondary" data-remove="' + key + '" data-index="' + index + '">Remove</button></div>').join('') + '<button class="secondary" data-add="' + key + '">Add</button>' : '';
  return fieldCard(title, mode + '<div class="field">' + rows + '</div>', help[key]);
}

function modelSelect(value, index) {
  const options = Array.isArray(initial.modelOptions) ? initial.modelOptions.slice() : [];
  if (value && !options.includes(value)) {
    options.unshift(value);
  }
  return '<select data-list="model" data-index="' + index + '" aria-label="Model">' + options.map((option) => '<option value="' + escapeHtml(option) + '" ' + (option === value ? 'selected' : '') + '>' + escapeHtml(option) + '</option>').join('') + '</select>';
}

function pairsCard(key, title) {
  const rows = (state.fields[key].items || []).map((item, index) => '<div class="list-row"><input placeholder="Key" data-pair="key" data-kind="' + key + '" data-index="' + index + '" value="' + escapeHtml(item.key) + '"><input placeholder="Value" data-pair="value" data-kind="' + key + '" data-index="' + index + '" value="' + escapeHtml(item.value) + '"><button class="secondary" data-remove-pair="' + key + '" data-index="' + index + '">Remove</button></div>').join('');
  return fieldCard(title, '<div class="field">' + rows + '<button class="secondary" data-add-pair="' + key + '">Add</button></div>', help[key]);
}

function handoffsCard() {
  const rows = (state.fields.handoffs.items || []).map((item, index) => '<div class="handoff-row"><input placeholder="Label" data-handoff="label" data-index="' + index + '" value="' + escapeHtml(item.label) + '"><input placeholder="Agent" data-handoff="agent" data-index="' + index + '" value="' + escapeHtml(item.agent) + '"><input placeholder="Prompt" data-handoff="prompt" data-index="' + index + '" value="' + escapeHtml(item.prompt) + '"><input placeholder="Model" data-handoff="model" data-index="' + index + '" value="' + escapeHtml(item.model) + '"><label><input type="checkbox" data-handoff="send" data-index="' + index + '" ' + (item.send ? 'checked' : '') + '> Send</label><button class="secondary" data-remove-handoff="' + index + '">Remove</button></div>').join('');
  return fieldCard('handoffs', '<div class="field">' + rows + '<button class="secondary" data-add-handoff>Add</button></div>', help.handoffs);
}

function render() {
  const f = state.fields;
  const cards = [fieldCard('description <span class="badge">required</span>', '<textarea id="description">' + escapeHtml(f.description.value) + '</textarea>', 'Required summary of what the agent does.')];
  cards.push(fieldCard('name', '<input id="name" value="' + escapeHtml(f.name.value) + '">', help.name));
  cards.push(fieldCard('argument-hint', '<input id="argument-hint" value="' + escapeHtml(f['argument-hint'].value) + '">', help['argument-hint']));
  cards.push(listCard('tools', 'tools', [{ value: 'selected', label: 'Selected tools' }, { value: 'all', label: 'All tools (*)' }, { value: 'none', label: 'No tools ([])' }]));
  cards.push(listCard('agents', 'agents', [{ value: 'selected', label: 'Selected agents' }, { value: 'all', label: 'All agents (*)' }, { value: 'none', label: 'No agents ([])' }]));
  cards.push(listCard('model', 'model'));
  for (const key of ['user-invocable', 'disable-model-invocation', 'infer']) cards.push(fieldCard(key, '<label class="property-toggle"><input type="checkbox" data-boolean="' + key + '" ' + (f[key].value ? 'checked' : '') + '> Enabled</label>', help[key]));
  cards.push(fieldCard('target', '<select id="target"><option value="vscode">vscode</option><option value="github-copilot">github-copilot</option></select>', help.target));
  cards.push(fieldCard('mcp-servers', '<textarea data-yaml="mcp-servers">' + escapeHtml(f['mcp-servers'].yamlText) + '</textarea>', help['mcp-servers']));
  cards.push(handoffsCard());
  cards.push(fieldCard('hooks', '<textarea data-yaml="hooks">' + escapeHtml(f.hooks.yamlText) + '</textarea>', help.hooks));
  cards.push(pairsCard('metadata', 'metadata'));
  cards.push(fieldCard('extra properties', '<textarea data-yaml="extra">' + escapeHtml(state.extraPropertiesYaml) + '</textarea>', 'Unknown keys are preserved.'));
  cards.push('<section class="form-section full-width"><div class="body-grid"><div><label for="body">Prompt body (Markdown)</label><textarea id="body">' + escapeHtml(state.body) + '</textarea></div><div><label>Rendered preview</label><div id="bodyPreview" class="markdown-preview"></div></div></div></section>');
  root.innerHTML = '<div class="grid">' + cards.join('') + '</div><section class="related-links"><h2>Related links</h2><div class="link-list"><button class="secondary" data-doc="github">GitHub docs</button><button class="secondary" data-doc="vscode">VS Code docs</button></div></section>';
  bind();
  document.getElementById('bodyPreview').innerHTML = renderMarkdown(state.body || '');
}

function bind() {
  document.getElementById('description').oninput = (event) => { state.fields.description.value = event.target.value; setStatus('Modified'); };
  document.getElementById('name').oninput = (event) => { state.fields.name.enabled = true; state.fields.name.value = event.target.value; updateTitle(event.target.value); setStatus('Modified'); };
  document.getElementById('argument-hint').oninput = (event) => { state.fields['argument-hint'].enabled = true; state.fields['argument-hint'].value = event.target.value; setStatus('Modified'); };
  document.getElementById('target').onchange = (event) => { state.fields.target.enabled = true; state.fields.target.value = event.target.value; setStatus('Modified'); };
  document.getElementById('target').value = state.fields.target.value;
  document.querySelectorAll('[data-boolean]').forEach((input) => input.addEventListener('change', (event) => { state.fields[event.target.dataset.boolean].enabled = true; state.fields[event.target.dataset.boolean].value = event.target.checked; setStatus('Modified'); }));
  document.querySelectorAll('[data-mode]').forEach((input) => input.addEventListener('change', (event) => { state.fields[event.target.dataset.mode].enabled = true; state.fields[event.target.dataset.mode].mode = event.target.value; render(); setStatus('Modified'); }));
  document.querySelectorAll('[data-list]').forEach((input) => input.addEventListener('input', (event) => { state.fields[event.target.dataset.list].enabled = true; state.fields[event.target.dataset.list].items[Number(event.target.dataset.index)] = event.target.value; setStatus('Modified'); }));
  document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => { state.fields[button.dataset.add].enabled = true; state.fields[button.dataset.add].items.push(''); render(); setStatus('Modified'); }));
  document.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => { state.fields[button.dataset.remove].items.splice(Number(button.dataset.index), 1); render(); setStatus('Modified'); }));
  document.querySelectorAll('[data-yaml]').forEach((input) => input.addEventListener('input', (event) => { if (event.target.dataset.yaml === 'extra') state.extraPropertiesYaml = event.target.value; else { state.fields[event.target.dataset.yaml].enabled = true; state.fields[event.target.dataset.yaml].yamlText = event.target.value; } setStatus('Modified'); }));
  document.querySelectorAll('[data-pair]').forEach((input) => input.addEventListener('input', (event) => { const item = state.fields[event.target.dataset.kind].items[Number(event.target.dataset.index)]; state.fields[event.target.dataset.kind].enabled = true; item[event.target.dataset.pair] = event.target.value; setStatus('Modified'); }));
  document.querySelectorAll('[data-add-pair]').forEach((button) => button.addEventListener('click', () => { state.fields[button.dataset.addPair].enabled = true; state.fields[button.dataset.addPair].items.push({ key: '', value: '' }); render(); setStatus('Modified'); }));
  document.querySelectorAll('[data-remove-pair]').forEach((button) => button.addEventListener('click', () => { state.fields[button.dataset.removePair].items.splice(Number(button.dataset.index), 1); render(); setStatus('Modified'); }));
  document.querySelectorAll('[data-handoff]').forEach((input) => input.addEventListener('input', (event) => { const item = state.fields.handoffs.items[Number(event.target.dataset.index)]; state.fields.handoffs.enabled = true; item[event.target.dataset.handoff] = event.target.type === 'checkbox' ? event.target.checked : event.target.value; setStatus('Modified'); }));
  document.querySelectorAll('[data-add-handoff]').forEach((button) => button.addEventListener('click', () => { state.fields.handoffs.enabled = true; state.fields.handoffs.items.push({ label: '', agent: '', prompt: '', model: '', send: false }); render(); setStatus('Modified'); }));
  document.querySelectorAll('[data-remove-handoff]').forEach((button) => button.addEventListener('click', (event) => { state.fields.handoffs.items.splice(Number(event.target.dataset.removeHandoff), 1); render(); setStatus('Modified'); }));
  document.querySelectorAll('[data-doc]').forEach((button) => button.addEventListener('click', (event) => vscode.postMessage({ type: 'openDoc', url: docs[event.target.dataset.doc] })));
  document.getElementById('body').oninput = (event) => { state.body = event.target.value; document.getElementById('bodyPreview').innerHTML = renderMarkdown(state.body); setStatus('Modified'); };
}

document.getElementById('saveButton').addEventListener('click', () => { state.body = document.getElementById('body').value; vscode.postMessage({ type: 'save', state }); setStatus('Saving...'); });
render();
