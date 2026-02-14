const fs = require('fs');
const path = require('path');

const rbsPath = path.join(__dirname, '../public/rbs/ruby-stdlib.rbs');
const indexPath = path.join(__dirname, '../public/data/rurima_index.json');

function parseRbs(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  const relationships = {}; // child -> parent
  const includes = {}; // child -> [modules]

  let currentContext = null;

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    // クラス定義: class Name < Parent
    const classMatch = line.match(/^class\s+([\w:]+)(?:\s*<\s*([\w:]+))?/);
    if (classMatch) {
      const className = classMatch[1];
      const parentName = classMatch[2] || 'Object';
      relationships[className] = parentName;
      currentContext = className;
      continue;
    }

    // モジュール定義: module Name
    const moduleMatch = line.match(/^module\s+([\w:]+)/);
    if (moduleMatch) {
      currentContext = moduleMatch[1];
      continue;
    }

    // インクルード: include Module
    const includeMatch = line.match(/^include\s+([\w:]+)/);
    if (includeMatch && currentContext) {
      if (!includes[currentContext]) includes[currentContext] = [];
      includes[currentContext].push(includeMatch[1]);
      continue;
    }
    
    // 定義の終了
    if (line === 'end') {
        currentContext = null;
    }
  }

  return { relationships, includes };
}

function buildAncestorChain(className, relationships, includes) {
  const chain = [className];
  const visited = new Set();
  visited.add(className);

  let current = className;

  while (current) {
    // インクルードされたモジュールを追加
    if (includes[current]) {
      for (const mod of includes[current]) {
        if (!visited.has(mod)) {
          chain.push(mod);
          visited.add(mod);
        }
      }
    }

    // 親クラスへ
    const parent = relationships[current];
    if (parent && !visited.has(parent)) {
      chain.push(parent);
      visited.add(parent);
      current = parent;
    } else {
      // 親がいなくて、ObjectでなければObjectを追加
      if (current !== 'BasicObject' && current !== 'Object' && !visited.has('Object')) {
          chain.push('Object');
          visited.add('Object');
          current = 'Object';
      } else if (current === 'Object' && !visited.has('Kernel')) {
          chain.push('Kernel');
          visited.add('Kernel');
          current = 'Object'; // 擬似的にKernelを追加したあとBasicObjectへ
      } else if (current === 'Object' && visited.has('Kernel') && !visited.has('BasicObject')) {
          chain.push('BasicObject');
          visited.add('BasicObject');
          current = null;
      } else {
          current = null;
      }
    }
  }

  return chain;
}

const { relationships, includes } = parseRbs(rbsPath);
const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

// インデックスに含まれる全クラスを抽出
const allClasses = new Set();
for (const [methodName, candidates] of Object.entries(index)) {
  for (const candidate of candidates) {
    const classMatch = candidate.match(/^([^#\.]+)/);
    if (classMatch) {
      allClasses.add(classMatch[1]);
    }
  }
}

const inheritanceMap = {};
for (const className of allClasses) {
  inheritanceMap[className] = buildAncestorChain(className, relationships, includes);
}

console.log(JSON.stringify(inheritanceMap, null, 2));
