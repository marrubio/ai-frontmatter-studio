const path = require('path');
const {
  createEmptySkillState,
  parseSkillDocument,
  serializeSkillDocument,
  validateSkillState
} = require('../frontmatter');

const skillArtifact = {
  key: 'skill',
  title: 'Skill',
  description: 'Visual editor for SKILL.md frontmatter.',
  rendererPath: path.join('media', 'artifacts', 'skill', 'editor.js'),
  parse(content, filePath) {
    return parseSkillDocument(content, filePath);
  },
  serialize(state) {
    return serializeSkillDocument(state);
  },
  validate(state) {
    return validateSkillState(state);
  },
  createState(filePath) {
    return createEmptySkillState(filePath);
  },
  createContent(state) {
    return serializeSkillDocument(state);
  }
};

module.exports = skillArtifact;
