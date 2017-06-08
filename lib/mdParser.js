const fs = require('fs');
const marked = require('marked');
const yaml = require('js-yaml');
const Prism = require('node-prismjs');
const MT = require('mark-twain');
const JsonML = require('./jsonml.js');
const Stringify = require('jsonml-stringify/stringify');
let stringify = require('jsonml-stringify/plugins/loose');

stringify = Stringify([stringify]);

marked.setOptions({
  highlight(code) {
    return Prism.highlight(code, Prism.languages.javascript);
  },
});

function splitInput(str) {
  if (str.slice(0, 3) !== '---') {
    return [{error: 'not ---'}];
  }
  if (!/---\n[\s\S]+\n---\n/.test(str) && !/---\r\n[\s\S]+\r\n---\r\n/.test(str)) {
    return [{error: 'not ---'}];
  }

  const metaMatcher = /\n(\.{3}|-{3})/g;
  const metaEnd = metaMatcher.exec(str);
  const [meta, other] = [str.slice(0, metaEnd.index), str.slice(metaMatcher.lastIndex)];

  const descMatcher = /\n````jsx/g;
  const descEnd = descMatcher.exec(other);
  const desc = other.slice(0, descEnd.index);
  const jsxCodeWithdot = other.slice(descMatcher.lastIndex);
  const jsxMd = other.slice(descEnd.index);
  const jsxEndMatcher = /\n````/g;
  const jsxEnd = jsxEndMatcher.exec(jsxCodeWithdot);
  const jsx = jsxCodeWithdot.slice(0, jsxEnd.index);
  return [meta, desc, jsxMd, jsx];
}

function parseDemoMd(content) {
  const inputs = splitInput(content);
  let result;
  if (inputs.length === 1) {
    result = inputs[0];
  } else {
    result = {
      meta: yaml.safeLoad(inputs[0]),
      descriptionMd: marked(inputs[1]),
      codeMd: marked(inputs[2]),
      jsx: inputs[3],
    };
  }
  return result;
}

function parseMd(filePath) {
  const fileContent = String(fs.readFileSync(filePath));
  return MT(fileContent);
}

function parseComponentMd(content) {
  let contentChildren = JsonML.getChildren(content);

  const dividerIndex = contentChildren.findIndex(node => JsonML.getTagName(node) === 'hr');

  contentChildren = contentChildren.map((node) => {
    if (JsonML.getTagName(node) === 'h2') {
      switch (JsonML.getChildren(node)[0]) {
        case '组件描述':
          JsonML.setAttribute(node, 'id', 'description');
          return node;
        case '使用场景':
          JsonML.setAttribute(node, 'id', 'scene');
          return node;
        default:
          return node;
      }
    }
    return node;
  });

  let result = null;
  if (dividerIndex >= 0) {
    result = {
      description: stringify(['section', contentChildren.slice(0, dividerIndex)]),
      content: [
        JsonML.getTagName(content),
        JsonML.getAttributes(content) || {},
      ].concat(contentChildren.slice(dividerIndex + 1)),
    };
  }
  return result;
}

module.exports = { parseDemoMd, parseMd, parseComponentMd };
