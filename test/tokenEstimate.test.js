const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseAgentDocument,
  parsePromptDocument,
  parseSkillDocument,
  serializeAgentDocument,
  serializePromptDocument,
  serializeSkillDocument
} = require('../src/frontmatter');
const { estimateTokens, estimateTokenBreakdown, estimateArtifactTokens } = require('../src/tokenEstimate');

test('estimates tokens from YAML and Markdown for each artifact', () => {
  for (const [parse, serialize] of [
    [parseAgentDocument, serializeAgentDocument],
    [parsePromptDocument, serializePromptDocument],
    [parseSkillDocument, serializeSkillDocument]
  ]) {
    const state = parse('---\ndescription: Example\n---\nBody');
    const artifact = { serialize };
    const before = estimateArtifactTokens(artifact, state);

    const serialized = serialize(state);
    assert.deepEqual(before, estimateTokenBreakdown(serialized, state.body));
    assert.equal(before.total, before.frontmatter + before.markdown);
    assert.equal(before.markdown, estimateTokens('Body'));
    state.body += ' More instructions for the artifact.'.repeat(20);
    const after = estimateArtifactTokens(artifact, state);
    assert.equal(after.frontmatter, before.frontmatter);
    assert.ok(after.markdown > before.markdown);
    state.fields.description.value += ' More frontmatter description.'.repeat(20);
    const updated = estimateArtifactTokens(artifact, state);
    assert.ok(updated.frontmatter > after.frontmatter);
    assert.equal(updated.markdown, after.markdown);
  }
});

test('returns an approximate count even for invalid YAML drafts', () => {
  const state = parseAgentDocument('---\ndescription: Example\n---\nBody');
  state.fields.hooks = { enabled: true, yamlText: '[invalid' };
  const estimate = estimateArtifactTokens({ serialize: serializeAgentDocument }, state);

  assert.ok(estimate.frontmatter > 0);
  assert.equal(estimate.markdown, estimateTokens('Body'));
  assert.equal(estimate.total, estimate.frontmatter + estimate.markdown);
});

test('breaks down original malformed or missing frontmatter without losing body text', () => {
  const malformed = '---\ndescription: [broken\n---\nMarkdown';
  const state = parseAgentDocument(malformed);
  assert.equal(estimateTokenBreakdown(malformed, state.body).markdown, estimateTokens('Markdown'));

  const bodyOnly = 'Just Markdown';
  const noFrontmatter = parseAgentDocument(bodyOnly);
  assert.deepEqual(estimateTokenBreakdown(bodyOnly, noFrontmatter.body), {
    frontmatter: 0,
    markdown: estimateTokens(bodyOnly),
    total: estimateTokens(bodyOnly)
  });
});

test('estimates UTF-8 text and empty content deterministically', () => {
  assert.equal(estimateTokens(''), 0);
  assert.equal(estimateTokens('12345'), 2);
  assert.ok(estimateTokens('é'.repeat(10)) > estimateTokens('a'.repeat(10)));
});