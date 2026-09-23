const root = document.getElementById('artifactRoot');
const status = document.getElementById('status');
const state = initial.state;
const docs = {
  github: 'https://docs.github.com/en/copilot/concepts/agents/about-agent-skills'
};

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setStatus(text, error) {
  status.textContent = text;
  status.classList.toggle('error', Boolean(error));
}

function renderMarkdown(markdown) {
  const lines = escapeHtml(markdown).split(/\r?\n/);
  return lines.map((line) => {
    if (/^#{1,3}\s/.test(line)) {
      const match = line.match(/^(#{1,3})\s(.+)$/);
      return '<h' + match[1].length + '>' + match[2] + '</h' + match[1].length + '>';
    }
    if (/^\s*[-*]\s+/.test(line)) {
      return '<li>' + line.replace(/^\s*[-*]\s+/, '') + '</li>';
    }
    return line ? '<p>' + line + '</p>' : '';
  }).join('') || '<span class="muted">Nothing to preview yet.</span>';
}

function updateTitle(name) {
  const fallbackTitle = document.body.dataset.fallbackTitle || document.title;
  const title = name.trim() || fallbackTitle;
  document.title = title;
  document.querySelector('h1').textContent = title;
}

function render() {
  const f = state.fields;
  root.innerHTML = '<div class="grid">'
    + '<section class="form-section"><div class="section-heading"><h2>description <span class="badge">required</span></h2><div class="muted">Short description of what the skill does.</div></div><textarea id="description">' + escapeHtml(f.description.value) + '</textarea></section>'
    + '<section class="form-section"><div class="section-heading"><h2>name</h2><div class="muted">Optional skill identifier. If omitted, the directory name is used.</div></div><input id="name" value="' + escapeHtml(f.name.value) + '"></section>'
    + '<section class="form-section"><div class="section-heading"><h2>extra properties</h2><div class="muted">Unknown keys are preserved.</div></div><textarea data-yaml="extra">' + escapeHtml(state.extraPropertiesYaml) + '</textarea></section>'
    + '<section class="form-section full-width"><div class="body-grid"><div><label for="body">Instructions (Markdown)</label><textarea id="body">' + escapeHtml(state.body) + '</textarea></div><div><label>Rendered preview</label><div id="bodyPreview" class="markdown-preview"></div></div></div></section>'
    + '</div><section class="related-links"><h2>Related links</h2><div class="link-list"><button class="secondary" data-doc="github">GitHub docs</button></div></section>';
  bind();
  document.getElementById('bodyPreview').innerHTML = renderMarkdown(state.body || '');
}

function bind() {
  document.getElementById('description').oninput = (event) => { state.fields.description.enabled = true; state.fields.description.value = event.target.value; setStatus('Modified'); };
  document.getElementById('name').oninput = (event) => { state.fields.name.enabled = true; state.fields.name.value = event.target.value; updateTitle(event.target.value); setStatus('Modified'); };
  document.querySelector('[data-yaml="extra"]').oninput = (event) => { state.extraPropertiesYaml = event.target.value; setStatus('Modified'); };
  document.getElementById('body').oninput = (event) => { state.body = event.target.value; document.getElementById('bodyPreview').innerHTML = renderMarkdown(state.body); setStatus('Modified'); };
  document.querySelectorAll('[data-doc]').forEach((button) => button.addEventListener('click', (event) => vscode.postMessage({ type: 'openDoc', url: docs[event.target.dataset.doc] })));
}

document.getElementById('saveButton').addEventListener('click', () => { state.body = document.getElementById('body').value; vscode.postMessage({ type: 'save', state }); setStatus('Saving...'); });
render();
