const fs = require('fs');
const { transform } = require('babel-core');
const { parse } = require('acorn-jsx');
const traverse = require('ast-traverse');

module.exports = (modPath) => {
  const commentArr = [];
  const apiMap = {};
  const apiList = [];
  let propTypeArr;
  let defaultPropArr;

  const jsxFile = String(fs.readFileSync(modPath));

  const pureContent = transform(jsxFile, {
    plugins: [
      'transform-flow-strip-types',
      'transform-react-jsx',
      'transform-class-properties',
      'transform-object-rest-spread',
      'transform-es2015-arrow-functions',
    ],
  });

  const astData = parse(pureContent.code, {
    plugins: {
      jsx: true,
    },
    sourceType: 'module',
    onComment: (block, text) => {
      if (!block && text.search(/@INTRO/) !== -1) {
        commentArr.push(text.replace(/\s+/g, '').slice(6));
      }
    },
  });

  traverse(astData, {
    pre: (node, parent, prop) => {
      if (node.type === 'MemberExpression' && prop === 'left' && node.property.name === 'propTypes') {
        propTypeArr = parent.right.properties;
      }
      if (node.type === 'MemberExpression' && prop === 'left' && node.property.name === 'defaultProps') {
        defaultPropArr = parent.right;
      }
    },
  });

  if (!propTypeArr || !propTypeArr.length) {
    return null;
  }

  // 根据proptypes找出属性名，取值范围，属性类型
  for (let k = 0, l = propTypeArr.length; k < l; k++) {
    const prop = propTypeArr[k];
    const ptype = prop.value.type;
    const cname = prop.key.name;
    let cvalues = [];
    let ctype = null;

    if (ptype === 'MemberExpression') {
      ctype = prop.value.property.name;
      if (ctype === 'bool') {
        cvalues = [true, false];
      }
    } else if (ptype === 'CallExpression') {
      const arr = prop.value.arguments[0].elements;
      arr.forEach((vOb) => {
        cvalues.push(vOb.value);
      });
      ctype = typeof cvalues[0];
    }
    apiMap[cname] = {
      prop: cname,
      type: ctype,
      desc: commentArr[k],
      values: cvalues,
    };
  }
  // 根据defaultProps找出属性默认值
  traverse(defaultPropArr, {
    pre: (node) => {
      if (node.type === 'Property') {
        if (!apiMap[node.key.name]) {
          return;
        }
        if (node.value.type === 'ObjectExpression') {
          apiMap[node.key.name].default = node.value.properties.reduce((properties, property) => {
            properties[property.key.name] = property.value.value;
            return properties;
          }, {});
        }
        if (node.value.type === 'Literal') {
          apiMap[node.key.name].default = node.value.value;
        }
        if (node.value.type === 'UnaryExpression') {
          apiMap[node.key.name].default = parseFloat(`${node.value.operator}${node.value.argument.value}`);
        }
      }
    },
  });

  const nameList = Object.keys(apiMap);
  nameList.forEach((name) => {
    apiList.push(apiMap[name]);
  });

  return apiList;
};
