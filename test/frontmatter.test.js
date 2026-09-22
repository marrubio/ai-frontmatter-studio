const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseAgentDocument,
  serializeAgentDocument,
  buildFrontmatterObject,
  validateState
} = require('../src/frontmatter');

test('parseAgentDocument loads official and extended properties', () => {
  const input = `---
name: Planner
description: Generates plans
argument-hint: Describe the feature
tools:
  - search
  - agent
agents:
  - implementation
model:
  - GPT-5 (copilot)
  - Claude Sonnet 4.5 (copilot)
user-invocable: false
disable-model-invocation: true
infer: false
target: vscode
mcp-servers:
  - id: browser
    command: node
metadata:
  owner: team-ai
handoffs:
  - label: Implement
    agent: implementation
    prompt: Build the plan
    send: true
hooks:
  pre:
    - command: npm test
future-flag: yes
---
# Body
`;

  const state = parseAgentDocument(input, '/tmp/planner.agent.md');

  assert.equal(state.fields.name.value, 'Planner');
  assert.equal(state.fields.description.value, 'Generates plans');
  assert.deepEqual(state.fields.tools.items, ['search', 'agent']);
  assert.deepEqual(state.fields.agents.items, ['implementation']);
  assert.deepEqual(state.fields.model.items, ['GPT-5 (copilot)', 'Claude Sonnet 4.5 (copilot)']);
  assert.equal(state.fields['user-invocable'].value, false);
  assert.equal(state.fields['disable-model-invocation'].value, true);
  assert.equal(state.fields.infer.value, false);
  assert.equal(state.fields.target.value, 'vscode');
  assert.match(state.fields['mcp-servers'].yamlText, /browser/);
  assert.equal(state.fields.metadata.items[0].key, 'owner');
  assert.equal(state.fields.handoffs.items[0].send, true);
  assert.match(state.fields.hooks.yamlText, /npm test/);
  assert.match(state.extraPropertiesYaml, /future-flag/);
});

test('buildFrontmatterObject enforces agent tool when agents are selected', () => {
  const state = parseAgentDocument('---\ndescription: Test\n---\n');
  state.fields.tools = { enabled: true, mode: 'selected', items: ['search'] };
  state.fields.agents = { enabled: true, mode: 'selected', items: ['implementation'] };

  assert.match(validateState(state).join(' '), /agent tool/);
});

test('serializeAgentDocument preserves structured values and omits disabled fields', () => {
  const state = parseAgentDocument('---\ndescription: Original\n---\nPrompt');
  state.fields.description.value = 'Updated';
  state.fields.name = { enabled: true, value: 'Reviewer' };
  state.fields.tools = { enabled: true, mode: 'all', items: [] };
  state.fields.model = { enabled: true, items: ['GPT-5 (copilot)'] };
  state.fields.metadata = { enabled: true, items: [{ key: 'team', value: 'platform' }] };
  state.extraPropertiesYaml = 'future-property: enabled';
  state.body = '## Instructions\n\nReview carefully.';

  const serialized = serializeAgentDocument(state);
  const reparsed = parseAgentDocument(serialized);
  const frontmatter = buildFrontmatterObject(reparsed);

  assert.equal(frontmatter.description, 'Updated');
  assert.equal(frontmatter.name, 'Reviewer');
  assert.deepEqual(frontmatter.tools, ['*']);
  assert.equal(frontmatter.model, 'GPT-5 (copilot)');
  assert.equal(frontmatter.metadata.team, 'platform');
  assert.equal(frontmatter['future-property'], 'enabled');
  assert.match(serialized, /## Instructions/);
});
