const root = document.getElementById('artifactRoot');
const status = document.getElementById('status');
const state = initial.state;
const docs = {
  vscode: 'https://code.visualstudio.com/docs/agent-customization/prompt-files'
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
  const flush = () => {
    if (paragraph.length) output.push('<p>' + paragraph.join('<br>') + '</p>');
    if (list.length) output.push('<ul>' + list.map((item) => '<li>' + item + '</li>').join('') + '</ul>');
    paragraph = [];
    list = [];
  };
  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) {
      flush();
      const match = line.match(/^(#{1,3})\s(.+)$/);
      output.push('<h' + match[1].length + '>' + match[2] + '</h' + match[1].length + '>');
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

function listCard(key, title, description, options) {
  const items = state.fields[key].items || [];
  const rows = items.map((item, index) => {
    if (options) {
      if (key === 'model') {
        const values = options.slice();
        if (item && !values.includes(item)) values.unshift(item);
        return '<div class="list-row"><select data-list="' + key + '" data-index="' + index + '">' + values.map((value) => '<option value="' + escapeHtml(value) + '" ' + (value === item ? 'selected' : '') + '>' + escapeHtml(value) + '</option>').join('') + '</select><button class="secondary" data-remove="' + key + '" data-index="' + index + '">Remove</button></div>';
      }
      return '<div class="list-row"><select data-list="' + key + '" data-index="' + index + '"><option value="">Select tool</option>' + options.map((value) => '<option value="' + escapeHtml(value) + '" ' + (value === item ? 'selected' : '') + '>' + escapeHtml(value) + '</option>').join('') + '</select><input data-list="' + key + '" data-index="' + index + '" value="' + escapeHtml(item) + '" aria-label="Custom tool name"><button class="secondary" data-remove="' + key + '" data-index="' + index + '">Remove</button></div>';
    }
    return '<div class="list-row"><input data-list="' + key + '" data-index="' + index + '" value="' + escapeHtml(item) + '"><button class="secondary" data-remove="' + key + '" data-index="' + index + '">Remove</button></div>';
  }).join('');
  return fieldCard(title, '<div class="field">' + rows + '<button class="secondary" data-add="' + key + '">Add</button></div>', description);
}

function render() {
  const f = state.fields;
  const cards = [
    fieldCard('description', '<input id="description" value="' + escapeHtml(f.description.value) + '">', 'Short description of the prompt.'),
    fieldCard('name', '<input id="name" value="' + escapeHtml(f.name.value) + '">', 'Name used after typing / in chat. If omitted, the file name is used.'),
    fieldCard('argument-hint', '<input id="argument-hint" value="' + escapeHtml(f['argument-hint'].value) + '">', 'Hint shown in the chat input field.'),
    fieldCard('agent', '<input id="agent" value="' + escapeHtml(f.agent.value) + '" placeholder="ask, agent, plan, or custom agent">', 'Agent used to run the prompt. By default, the current agent is used.'),
    listCard('model', 'model', 'Language model used when running the prompt.', Array.isArray(initial.modelOptions) ? initial.modelOptions : []),
    listCard('tools', 'tools', 'Tools available to this prompt. Tool sets and MCP tools are also supported.', Array.isArray(initial.toolAliases) ? initial.toolAliases : []),
    fieldCard('extra properties', '<textarea data-yaml="extra">' + escapeHtml(state.extraPropertiesYaml) + '</textarea>', 'Unknown keys are preserved.'),
    '<section class="form-section full-width"><div class="body-grid"><div><label for="body">Prompt body (Markdown)</label><textarea id="body">' + escapeHtml(state.body) + '</textarea></div><div><label>Rendered preview</label><div id="bodyPreview" class="markdown-preview"></div></div></div></section>'
  ];
  root.innerHTML = '<div class="grid">' + cards.join('') + '</div><section class="related-links"><h2>Related links</h2><div class="link-list"><button class="secondary" data-doc="vscode">VS Code docs</button></div></section>';
  bind();
  document.getElementById('bodyPreview').innerHTML = renderMarkdown(state.body || '');
}

function bind() {
  for (const key of ['description', 'name', 'argument-hint', 'agent']) {
    document.getElementById(key).oninput = (event) => { state.fields[key].enabled = true; state.fields[key].value = event.target.value; if (key === 'name') updateTitle(event.target.value); setStatus('Modified'); };
  }
  document.querySelector('[data-yaml="extra"]').oninput = (event) => { state.extraPropertiesYaml = event.target.value; setStatus('Modified'); };
  document.querySelectorAll('[data-list]').forEach((input) => input.addEventListener('input', (event) => { state.fields[event.target.dataset.list].enabled = true; state.fields[event.target.dataset.list].items[Number(event.target.dataset.index)] = event.target.value; setStatus('Modified'); }));
  document.querySelectorAll('[data-add]').forEach((button) => button.addEventListener('click', () => { state.fields[button.dataset.add].enabled = true; state.fields[button.dataset.add].items.push(''); render(); setStatus('Modified'); }));
  document.querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => { state.fields[button.dataset.remove].items.splice(Number(button.dataset.index), 1); render(); setStatus('Modified'); }));
  document.querySelectorAll('[data-doc]').forEach((button) => button.addEventListener('click', (event) => vscode.postMessage({ type: 'openDoc', url: docs[event.target.dataset.doc] })));
  document.getElementById('body').oninput = (event) => { state.body = event.target.value; document.getElementById('bodyPreview').innerHTML = renderMarkdown(state.body); setStatus('Modified'); };
}

document.getElementById('saveButton').addEventListener('click', () => { state.body = document.getElementById('body').value; vscode.postMessage({ type: 'save', state }); setStatus('Saving...'); });
render();
