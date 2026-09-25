function estimateTokens(content) {
  return Math.ceil(Buffer.byteLength(content, 'utf8') / 4);
}

function estimateTokenBreakdown(content, body) {
  const markdown = body || '';
  const frontmatter = content.slice(0, content.length - markdown.length);
  const frontmatterTokens = estimateTokens(frontmatter);
  const markdownTokens = estimateTokens(markdown);
  return { frontmatter: frontmatterTokens, markdown: markdownTokens, total: frontmatterTokens + markdownTokens };
}

function estimateArtifactTokens(artifact, state) {
  try {
    return estimateTokenBreakdown(artifact.serialize(state), state.body);
  } catch (_) {
    const fields = Object.entries(state.fields || {})
      .filter(([, field]) => field.enabled)
      .map(([key, field]) => `${key}: ${field.yamlText ?? field.value ?? JSON.stringify(field.items ?? [])}`);
    return estimateTokenBreakdown(`---\n${fields.join('\n')}\n${state.extraPropertiesYaml || ''}\n---\n${state.body || ''}`, state.body);
  }
}

module.exports = { estimateTokens, estimateTokenBreakdown, estimateArtifactTokens };