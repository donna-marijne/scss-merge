#!/usr/bin/env node

const { parse, stringify } = require('scss-parser');
const createQueryWrapper = require('query-ast');
const fs = require('fs');

const StyleMap = {};
const VariableMap = {};
const noSpace = q => q.node.type !== 'space';

(function run() {
    const left = createQueryWrapperFromFile(process.argv[2]);
    processRules(left('stylesheet').children('rule'), '');

    const right = createQueryWrapperFromFile(process.argv[3]);
    processRules(right('stylesheet').children('rule'), '');

    // console.log(JSON.stringify(StyleMap, null, 4));
    Object.keys(VariableMap).forEach(variable => {
        console.log(`$${variable}: ${VariableMap[variable]};`);
    });
})();

function createQueryWrapperFromFile(fileName) {
    const scss = fs.readFileSync(fileName, 'utf8');
    const ast = parse(scss);
    // console.log(JSON.stringify(ast, null, 4));
    return createQueryWrapper(ast);
}

function processRules(rulesQuery, parentSelector) {
    let ruleIterator = rulesQuery.first();
    while (ruleIterator.length() === 1) {
        processRule(ruleIterator, parentSelector);
        ruleIterator = ruleIterator.next();
    }
}

function processRule(ruleQuery, parentSelector) {
    let selectorIterator = ruleQuery.children('selector').first();
    while (selectorIterator.length() === 1) {

        const selector = getSelector(selectorIterator, parentSelector);

        const blockQuery = selectorIterator.next('block');
        processBlock(blockQuery, selector);

        selectorIterator = selectorIterator.nextAll('selector').first();
    }
}

function processBlock(blockQuery, parentSelector) {

    // Declarations
    let declarationIterator = blockQuery.children('declaration').first();
    while (declarationIterator.length() === 1) {
        processDeclaration(declarationIterator, parentSelector);
        declarationIterator = declarationIterator.nextAll('declaration').first();
    }

    // Child rules
    processRules(blockQuery.children('rule'), parentSelector);
}

function processDeclaration(declarationQuery, parentSelector) {
    const property = getProperty(declarationQuery);

    if (!StyleMap[parentSelector]) {
        StyleMap[parentSelector] = {};
    }

    if (StyleMap[parentSelector][property.name]) {
        if (property.variable) {
            VariableMap[property.variable] = StyleMap[parentSelector][property.name];
        }
    } else {
        StyleMap[parentSelector][property.name] = property.value;
    }
}

function getSelector(selectorQuery, parentSelector) {
    const placeholderQuery = selectorQuery.children(q => q.node.type === 'operator' && q.node.value === '&');
    if (placeholderQuery.length() > 0) {

        const prefix = stringify({
            type: 'selector',
            value: placeholderQuery.first().prevAll(noSpace).get()
        });

        const suffix = stringify({
            type: 'selector',
            value: placeholderQuery.first().nextAll(noSpace).get()
        });

        return `${prefix}${parentSelector}${suffix}`;
    }
    
    return parentSelector + stringify({
        type: 'selector',
        value: selectorQuery.children(noSpace).get()
    });
}

function getProperty(declarationQuery) {
    return {
        name: stringify(declarationQuery.children('property').first().get(0)).trim(),
        value: stringify(declarationQuery.children('value').first().get(0)).trim(),
        variable: declarationQuery.children('value').children('variable').first().value()
    };
}