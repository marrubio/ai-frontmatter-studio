const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseAgentDocument,
  getAgentDiagnostics,
  parseSkillDocument,
  serializeSkillDocument,
  buildSkillFrontmatterObject,
  parsePromptDocument,
  serializePromptDocument,
  buildPromptFrontmatterObject,
  serializeAgentDocument,
  buildFrontmatterObject,
  validateState
} = require('../src/frontmatter');

test('parseSkillDocument loads documented fields and preserves unknown properties', () => {
  const state = parseSkillDocument(`---
name: pdf-processing
description: Extract text from PDF files
license: MIT
---
# Instructions
`, '/workspace/.github/skills/pdf-processing/SKILL.md');

  assert.equal(state.fields.name.value, 'pdf-processing');
  assert.equal(state.fields.description.value, 'Extract text from PDF files');
  assert.match(state.extraPropertiesYaml, /license/);
  assert.match(state.body, /Instructions/);
});

test('serializeSkillDocument omits optional name and preserves extra properties', () => {
  const state = parseSkillDocument('---\ndescription: Original\n---\nBody');
  state.fields.name = { enabled: true, value: '' };
  state.fields.description.value = 'Updated skill';
  state.extraPropertiesYaml = 'license: MIT';
  state.body = '# Workflow';

  const serialized = serializeSkillDocument(state);
  const frontmatter = buildSkillFrontmatterObject(parseSkillDocument(serialized));

  assert.equal(frontmatter.description, 'Updated skill');
  assert.equal('name' in frontmatter, false);
  assert.equal(frontmatter.license, 'MIT');
  assert.match(serialized, /# Workflow/);
});

test('parsePromptDocument loads all documented prompt fields', () => {
  const state = parsePromptDocument(`---
description: Review a change
name: review-change
argument-hint: Add the files to review
agent: plan
model:
  - GPT-5 (copilot)
  - Claude Sonnet 4.5 (copilot)
tools:
  - read
  - search
custom-flag: true
---
# Review
`, '/workspace/.github/prompts/review-change.prompt.md');

  assert.equal(state.fields.description.value, 'Review a change');
  assert.equal(state.fields.name.value, 'review-change');
  assert.equal(state.fields['argument-hint'].value, 'Add the files to review');
  assert.equal(state.fields.agent.value, 'plan');
  assert.deepEqual(state.fields.model.items, ['GPT-5 (copilot)', 'Claude Sonnet 4.5 (copilot)']);
  assert.deepEqual(state.fields.tools.items, ['read', 'search']);
  assert.match(state.extraPropertiesYaml, /custom-flag/);
});

test('serializePromptDocument preserves optional prompt metadata and body', () => {
  const state = parsePromptDocument('---\ndescription: Review\n---\nBody');
  state.fields.name = { enabled: true, value: 'review' };
  state.fields['argument-hint'] = { enabled: true, value: 'Describe the change' };
  state.fields.agent = { enabled: true, value: 'agent' };
  state.fields.model = { enabled: true, items: ['GPT-5 (copilot)'] };
  state.fields.tools = { enabled: true, items: ['read', 'search'] };
  state.extraPropertiesYaml = 'custom-flag: true';
  state.body = '# Instructions';

  const serialized = serializePromptDocument(state);
  const frontmatter = buildPromptFrontmatterObject(parsePromptDocument(serialized));

  assert.equal(frontmatter.name, 'review');
  assert.equal(frontmatter['argument-hint'], 'Describe the change');
  assert.equal(frontmatter.agent, 'agent');
  assert.equal(frontmatter.model, 'GPT-5 (copilot)');
  assert.deepEqual(frontmatter.tools, ['read', 'search']);
  assert.equal(frontmatter['custom-flag'], true);
  assert.match(serialized, /# Instructions/);
});

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

test('parseAgentDocument loads frontmatter with Windows line endings', () => {
  const input = '---\r\n'
    + 'description: "Use when running a local agentic workflow."\r\n'
    + 'name: "local-feature-orchestrator"\r\n'
    + 'tools: [read, search, edit, agent, todo]\r\n'
    + 'reasoning-effort: high\r\n'
    + 'agents: [feature-planner, feature-implementer, feature-validator]\r\n'
    + 'model: GPT-5.6 Luna (copilot)\r\n'
    + '---\r\n'
    + '# Workflow\r\n\r\nCoordinate the feature.\r\n';

  const state = parseAgentDocument(input, '/workspace/local-feature-orchestrator.agent.md');

  assert.equal(state.hasFrontmatter, true);
  assert.equal(state.fields.name.value, 'local-feature-orchestrator');
  assert.equal(state.fields.description.value, 'Use when running a local agentic workflow.');
  assert.deepEqual(state.fields.tools.items, ['read', 'search', 'edit', 'agent', 'todo']);
  assert.deepEqual(state.fields.agents.items, ['feature-planner', 'feature-implementer', 'feature-validator']);
  assert.deepEqual(state.fields.model.items, ['GPT-5.6 Luna (copilot)']);
  assert.match(state.extraPropertiesYaml, /reasoning-effort/);
  assert.equal(state.body, '# Workflow\r\n\r\nCoordinate the feature.\r\n');
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

test('validateState rejects invalid boolean scalar values from YAML', () => {
  const state = parseAgentDocument(`---
description: Test
user-invocable: 'false'
handoffs:
  - label: Next
    agent: impl
    prompt: Go
    send: 'false'
---
`);

  const message = validateState(state).join(' ');
  assert.match(message, /user-invocable must be a boolean/);
  assert.match(message, /handoffs\.send must be a boolean/);
});

test('validateState rejects invalid YAML-backed top-level shapes', () => {
  const state = parseAgentDocument('---\ndescription: Test\n---\n');
  state.fields['mcp-servers'] = { enabled: true, yamlText: 'server' };
  state.fields.hooks = { enabled: true, yamlText: 'true' };
  state.extraPropertiesYaml = '- invalid';

  const message = validateState(state).join(' ');
  assert.match(message, /mcp-servers must be a YAML array/);
  assert.match(message, /hooks must be a YAML object/);
  assert.match(message, /Extra properties must be a YAML object/);
});

test('serializeAgentDocument preserves explicit false booleans and empty arrays', () => {
  const state = parseAgentDocument('---\ndescription: Test\n---\n');
  state.fields['mcp-servers'] = { enabled: true, yamlText: '[]' };
  state.fields.handoffs = {
    enabled: true,
    items: [{ label: 'Next', agent: 'impl', prompt: 'Go', send: false, model: '' }]
  };

  const serialized = serializeAgentDocument(state);
  const reparsed = parseAgentDocument(serialized);
  const frontmatter = buildFrontmatterObject(reparsed);

  assert.deepEqual(frontmatter['mcp-servers'], []);
  assert.equal(frontmatter.handoffs[0].send, false);
});

test('serializeAgentDocument preserves multiple prioritized models', () => {
  const state = parseAgentDocument('---\ndescription: Test\n---\n');
  state.fields.model = {
    enabled: true,
    items: ['GPT-5 (copilot)', 'Claude Sonnet 4.5 (copilot)']
  };

  const serialized = serializeAgentDocument(state);
  const frontmatter = buildFrontmatterObject(parseAgentDocument(serialized));

  assert.deepEqual(frontmatter.model, ['GPT-5 (copilot)', 'Claude Sonnet 4.5 (copilot)']);
});

test('serializeAgentDocument omits empty selected tools and agents', () => {
  const state = parseAgentDocument('---\ndescription: Test\n---\n');
  state.fields.tools = { enabled: true, mode: 'selected', items: [] };
  state.fields.agents = { enabled: true, mode: 'selected', items: [] };
  state.fields.model = { enabled: true, items: [] };

  const frontmatter = buildFrontmatterObject(state);

  assert.equal('tools' in frontmatter, false);
  assert.equal('agents' in frontmatter, false);
  assert.equal('model' in frontmatter, false);
});

test('serializeAgentDocument omits blank handoff fields', () => {
  const state = parseAgentDocument('---\ndescription: Test\n---\n');
  state.fields.handoffs = {
    enabled: true,
    items: [{ label: '', agent: 'impl', prompt: '', send: false, model: '' }]
  };

  const frontmatter = buildFrontmatterObject(state);

  assert.deepEqual(frontmatter.handoffs, [{ agent: 'impl', send: false }]);
});

test('serializeAgentDocument omits empty optional object and array properties', () => {
  const state = parseAgentDocument('---\ndescription: Test\n---\n');
  state.fields['mcp-servers'] = { enabled: true, yamlText: '' };
  state.fields.hooks = { enabled: true, yamlText: '' };
  state.fields.metadata = { enabled: true, items: [] };

  const frontmatter = buildFrontmatterObject(state);

  assert.equal('mcp-servers' in frontmatter, false);
  assert.equal('hooks' in frontmatter, false);
  assert.equal('metadata' in frontmatter, false);
});

test('agent diagnostics report invalid source YAML without treating it as a clean form', () => {
  const state = parseAgentDocument('---\ndescription: [broken\n---\nInstructions');
  const diagnostics = getAgentDiagnostics(state);

  assert.match(diagnostics.errors.join(' '), /Invalid frontmatter YAML/);
  assert.equal(diagnostics.warnings.length, 0);
});

test('agent diagnostics distinguish validation errors from unknown-property advice', () => {
  const state = parseAgentDocument('---\ndescription: Test\nfuture-option: true\n---\nInstructions');
  state.fields.description.value = '';
  state.fields.hooks = { enabled: true, yamlText: '[]' };

  const diagnostics = getAgentDiagnostics(state);

  assert.match(diagnostics.errors.join(' '), /Description is required/);
  assert.match(diagnostics.errors.join(' '), /hooks must be a YAML object/);
  assert.match(diagnostics.warnings.join(' '), /future-option/);
});

test('agent diagnostics warn about GitHub cloud body limit only when cloud can be targeted', () => {
  const state = parseAgentDocument('---\ndescription: Test\n---\n');
  state.body = 'a'.repeat(30001);

  assert.match(getAgentDiagnostics(state).warnings.join(' '), /30,000-character limit/);
  state.fields.target = { enabled: true, value: 'vscode' };
  assert.equal(getAgentDiagnostics(state).warnings.length, 0);
  state.fields.target.value = 'github-copilot';
  assert.match(getAgentDiagnostics(state).warnings.join(' '), /30,000-character limit/);
});

test('agent diagnostics explain when frontmatter will be created', () => {
  const state = parseAgentDocument('Just instructions');

  assert.match(getAgentDiagnostics(state).warnings.join(' '), /No YAML frontmatter found/);
});
