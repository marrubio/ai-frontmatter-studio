const tokenEstimate = document.getElementById('tokenEstimate');
let tokenRevision = 0;
let tokenTimer;

function showTokenEstimate(count) {
  tokenEstimate.textContent = `~${count.total.toLocaleString()} tokens (frontmatter: ~${count.frontmatter.toLocaleString()}, Markdown: ~${count.markdown.toLocaleString()})`;
}

showTokenEstimate(initial.tokenEstimate);
root.addEventListener('input', scheduleTokenEstimate);
root.addEventListener('change', scheduleTokenEstimate);
root.addEventListener('click', (event) => {
  if (event.target.closest('[data-add], [data-remove], [data-add-pair], [data-remove-pair], [data-add-handoff], [data-remove-handoff]')) {
    scheduleTokenEstimate();
  }
});

function scheduleTokenEstimate() {
  clearTimeout(tokenTimer);
  const revision = ++tokenRevision;
  tokenTimer = setTimeout(() => vscode.postMessage({ type: 'estimateTokens', revision, state }), 250);
}

window.addEventListener('message', (event) => {
  if (event.data?.type === 'tokenEstimate' && event.data.revision === tokenRevision) {
    showTokenEstimate(event.data.count);
  }
});