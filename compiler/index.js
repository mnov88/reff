/**
 * Ref2Link compiler
 * 
 * The compiler script will parse all rules XML files and generate a JSON file with the serialized data (called Ref2Link CONSTANTS).
 * 
 * Usage: 
 *     /> yarn run compile --language=ES --output=data/rules.ES.json
 */
import fs from 'fs';
import path from 'path';
import yargsPkg from 'yargs';
import xpath from 'xpath';
import { DOMParser as dom } from '@xmldom/xmldom';
import { replaceList, replaceAll, escapeRegExp, getNodesChildOrAttribute, getNodeData, normalizePattern, getNonCapturingPattern, Base64 } from './lib/utils.js';
import { fileURLToPath } from 'url';
import LZString from '../src/lib/utils/lzstring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const argv = yargsPkg.argv;

const BASE_PATH = path.resolve(__dirname, "../");
const OUTPUT_PATH = argv.output || "data/rules.json";
const VERSION = argv.v || "";
const BUILD_INFO = argv.build;
const VALID_EXTENSIONS = ["xml"];
const ROOT_DIR = path.resolve(BASE_PATH, "rules/");
const LANGUAGE = argv.language ? argv.language.toUpperCase() : null;
const CSS_PATH = path.resolve(BASE_PATH, "css/ref2link.css");

const REF2LINK_SPECIAL_ESCAPEES = "(?::";
const REF2LINK_SPECIAL_ESCAPED = "%colon-group%";
const REF2LINK_SPECIAL_ACTUAL = "(?::";

const REF2LINK_ESCAPEES = "::,||,$$";
const REF2LINK_ESCAPED = "%3A,%7C,%24";
const REF2LINK_ACTUAL = ":,|,$";

const JS_OPERATORS = " === , != , == , >= , > , <= , < , || , && , !";
const CF_OPERATORS = " eq , neq , eq , gte , gt , lte , lt , OR , AND , NOT ";


const RULE_KEYMAP = { "casesensitive": "c", "converter": "cv", "forced": "f", "allowTitle": "at", "customTitle": "ct", "allowAttribute": "aa", "guard-pattern": "gp", "skip-pattern": "sp", "strict-pattern": "stp", "trim-pattern": "tp", "item-pattern": "ip", "itemForced": "g", "itemType": "y", "name": "n", "base": "bs", "order": "o", "pattern": "p", "ruleLibelle": "r", "baseLibelle": "bl", "type": "t", "baseType": "bt", "subtype": "st", "views": "v", "footnotes": "fo", "prefix": "lp", "skip": "lk", "shared": "ls", "slots": "sl", "ld": "ld", "coreIdentifiers": "cli", "identifiers": "li", "vars": "lv", "commonRules": "cr", "common": "cm" };

const VIEW_KEYMAP = { "condition": "x", "ldCondition": "ldx", "groupTarget": "gt", "environments": "e", "libelle": "l", "order": "d", "target": "a", "baseTarget": "ba", "template": "m", "_default": "_" };

const REF2LINK_CSS = fs.readFileSync(CSS_PATH, { encoding: 'utf8' });

let namedPatterns = {};
let purePatterns = {};

function loadRecursiveRules(dir, extensions) {
    let contents = [];
    fs.readdirSync(dir).forEach(filename => {
        if (fs.lstatSync(path.resolve(dir, filename)).isDirectory()) {
            contents = contents.concat(loadRecursiveRules(path.resolve(dir, filename), extensions));
        }
        else {
            if (extensions.indexOf(filename.split('.').pop()) === -1) {
                return;
            }

            try {
                contents = contents.concat(parseRulesFile(path.resolve(dir, filename)));
            }
            catch (e) {
                console.error(e);
            }
        }
    });

    return contents;
}

function parseRules(dir, extensions) {
    let rules = loadRecursiveRules(dir, extensions);

    // filter language-specific rules
    if (LANGUAGE) {
        rules = rules.filter(rule => {
            let languages = (rule.lang || "").split(" ").filter(lang => !!lang);
            if (languages.length > 0 && languages.indexOf(LANGUAGE) === -1) {

                if (LANGUAGE === "ENDEFR" && ["EN", "DE", "FR"].indexOf(rule.lang) !== -1) {
                    return true;
                }

                return false;
            }

            return true;
        })
    }

    // sort
    let maxOrder = 1;
    for (let i = 0; i < rules.length; i++) {
        if (rules[i].order && rules[i].order > maxOrder) {
            maxOrder = Number(rules[i].order);
        }
    }

    // order rules that don't have the order attribute set in order of scanning
    for (let i = 0; i < rules.length; i++) {
        if (rules[i].order) {
            rules[i].order = rules[i].order * 1000;
        }
        else if (rules[i].order !== 0) {
            rules[i].order = (maxOrder + 1) * 1000;
            maxOrder++;
        }

        let order = rules[i].order;
        for (let j = 0; j < rules[i].views.length; j++) {
            let ruleView = rules[i].views[j];
            if (ruleView.order) {
                ruleView.order = ruleView.order + rules[i].order;
                if (ruleView.order > order) {
                    order = ruleView.order + 1;
                }
            }
        }

        for (let j = 0; j < rules[i].views.length; j++) {
            let ruleView = rules[i].views[j];
            if (!ruleView.order && ruleView._default) {
                ruleView.order = order;
                order++;
            }
        }

        for (let j = 0; j < rules[i].views.length; j++) {
            let ruleView = rules[i].views[j];
            if (!ruleView.order) {
                ruleView.order = order;
                order++;
            }
        }

        rules[i].views = rules[i].views.sort((a, b) => {
            return Number(a.order) < Number(b.order) ? -1 : 1;
        });

        if (rules[i]["item-pattern"].length > 0) {
            if (!isPatternPure(rules[i]["item-pattern"])) {
                let itemRule = {
                    pattern: rules[i]["item-pattern"],
                    name: `${rules[i].name}-item`,
                    type: rules[i].itemType,
                    forced: rules[i].forced,
                    casesensitive: rules[i].casesensitive
                };

                let subinfo = compilePattern(itemRule);
                rules[i]["item-pattern"] = subinfo.pattern;
                rules[i]["fullItemPattern"] = subinfo.fullPattern;
            }
        }

        if (rules[i]["guard-pattern"].length > 0) {
            if (!isPatternPure(rules[i]["guard-pattern"])) {
                let guardRule = {
                    pattern: rules[i]["guard-pattern"],
                    name: `${rules[i].name}-guard`,
                    type: `${rules[i].name}-guard`,
                    forced: rules[i].forced,
                    casesensitive: rules[i].casesensitive
                };

                let subinfo = compilePattern(guardRule);
                rules[i]["guard-pattern"] = subinfo.pattern;
                rules[i]["fullGuardPattern"] = subinfo.fullPattern;
            }
        }

        if (rules[i]["skip-pattern"].length > 0) {
            if (!isPatternPure(rules[i]["skip-pattern"])) {
                let skipRule = {
                    pattern: rules[i]["skip-pattern"],
                    name: `${rules[i].name}-skip`,
                    type: `${rules[i].name}-skip`,
                    forced: false,
                    casesensitive: true,
                };

                let subinfo = compilePattern(skipRule);
                rules[i]["skip-pattern"] = subinfo.pattern;
                rules[i]["fullSkipPattern"] = subinfo.fullPattern;
            }
        }

        if (rules[i]["strict-pattern"].length > 0) {
            if (!isPatternPure(rules[i]["strict-pattern"])) {
                let strictRule = {
                    pattern: rules[i]["strict-pattern"],
                    name: `${rules[i].name}-strict`,
                    type: `${rules[i].name}-strict`,
                    forced: false,
                    casesensitive: true
                }

                let subinfo = compilePattern(strictRule);
                rules[i]["strict-pattern"] = subinfo.pattern;
                rules[i]["fullStrictPattern"] = subinfo.fullPattern;
            }
        }

        if (rules[i]["trim-pattern"].length > 0) {
            if (!isPatternPure(rules[i]["trim-pattern"])) {
                let trimRule = {
                    pattern: rules[i]["trim-pattern"],
                    name: `${rules[i].name}-trim`,
                    type: `${rules[i].name}-trim`,
                    forced: false,
                    casesensitive: true
                };

                let subinfo = compilePattern(trimRule);
                rules[i]["trim-pattern"] = subinfo.pattern;
                rules[i]["fullTrimPattern"] = subinfo.fullPattern;
            }
        }

        let info = compilePattern(rules[i]);
        rules[i].pattern = info.pattern;
        rules[i].fullPattern = info.fullPattern;
    }

    return rules.sort((a, b) => {
        return Number(a.order) < Number(b.order) ? -1 : 1;
    });
}

function compilePattern(rawRule, stack) {
    stack = stack || [];
    let pattern = rawRule.pattern;
    let patternName = rawRule.name;

    if (stack.indexOf(patternName) !== -1) {
        throw new Error("Recursive pattern loop");
    }
    if (stack.length > 30) {
        throw new Error(`Max pattern recursion limit of 30 reached for ${patternName}`);
    }

    let rule = { ...rawRule };
    rule.pattern = pattern;
    rule.patternTemplate = pattern;
    rule.name = patternName;
    rule.stack = stack;
    rule.subpatterns = {};

    if (rule.itemPatternTemplate) {
        let itemPatternName = replaceList(rule.itemPatternTemplate, "({{,({{?:,({{?!,({{?=,{{?:,{{?!,{{!=,{{,}}),}}", " , , , , , , , , , ").trim();
        let simpleItemPattern = getNonCapturingPattern(rule.fullItemPattern);
        rule.pattern = rule.pattern.replace(new RegExp(escapeRegExp(`{{ ${itemPatternName} }}`), 'g'), rule.fullItemPattern);
        rule.pattern = rule.pattern.replace(new RegExp(escapeRegExp(`{{?: ${itemPatternName} }}`), 'g'), simpleItemPattern);
        rule.pattern = rule.pattern.replace(new RegExp(escapeRegExp(`{{?= ${itemPatternName} }}`), 'g'), `(?=${simpleItemPattern})`);
        rule.pattern = rule.pattern.replace(new RegExp(escapeRegExp(`{{?! ${itemPatternName} }}`), 'g'), `(?!${simpleItemPattern})`);
    }

    if (!isPatternPure(pattern)) {
        let items = pattern.match(new RegExp('\\{\\{(?:\\?[:!=])?\\s*([^\\}]+?)\\s*\\}\\}', "g"));
        let subpatterns = Array.from(new Set(items));
        for (let i = 0; i < subpatterns.length; i++) {
            if (!subpatterns[i]) {
                continue;
            }
            let subpatternName = replaceList(subpatterns[i], "{{?:,{{?!,{{?=,{{,}}", " , , , , ");
            subpatternName = subpatternName.trim();

            let subrule = {};
            if (purePatterns[subpatternName]) {
                /**
                 * Try to use the language-specific pattern eg: 
                 *   {{ law }} becomes {{ law_ES }} when compiling Spanish
                 */
                if (LANGUAGE && purePatterns[formatPatternName(subpatternName, LANGUAGE)]) {
                    subrule = compilePattern(purePatterns[formatPatternName(subpatternName, LANGUAGE)]);
                }
                else {
                    subrule = compilePattern(purePatterns[subpatternName]);
                }
            }
            else {
                if (namedPatterns[subpatternName]) {
                    /**
                     * Try to use the language-specific pattern eg: 
                     *   {{ law }} becomes {{ law_ES }} when compiling Spanish
                     */
                    if (LANGUAGE && namedPatterns[formatPatternName(subpatternName, LANGUAGE)]) {
                        subrule = compilePattern(namedPatterns[formatPatternName(subpatternName, LANGUAGE)]);
                    }
                    // fallback to ENDEFR when possible
                    else if (["EN", "DE", "FR"].indexOf(LANGUAGE) > -1 && namedPatterns[formatPatternName(subpatternName, "ENDEFR")]) {
                        subrule = compilePattern(namedPatterns[formatPatternName(subpatternName, "ENDEFR")]);
                    }
                    else {
                        subrule = compilePattern(namedPatterns[subpatternName]);
                    }
                }
                else {
                    throw new Error(`Cannot find subpattern ${subpatternName}`);
                }
            }
            if (Object.keys(subrule).length > 0) {
                let replacementPattern = subrule.pattern;
                if (subrule.type && subrule.type.length > 0) {
                    replacementPattern = subrule.fullPattern;
                }

                let nonCapturingVariant = getNonCapturingPattern(replacementPattern);
                let shortVariants = [`{{ ${subpatternName} }}`, `{{?: ${subpatternName} }}`, `{{?! ${subpatternName} }}`, `{{?= ${subpatternName} }}`];
                let compiledVariants = [`${replacementPattern}`, `${nonCapturingVariant}`, `(?!${nonCapturingVariant})`, `(?=${nonCapturingVariant})`];

                // we don't support possesive quantifiers
                if (subpatternName === "possesive_quantifier") {

                    for (let j = 0; j < compiledVariants.length; j++) {
                        compiledVariants[j] = "";
                    }
                }

                for (let i = 0; i < shortVariants.length; i++) {
                    rule.pattern = rule.pattern.replace(new RegExp(escapeRegExp(shortVariants[i]), "g"), compiledVariants[i]);
                }

                rule.subpatterns[subpatternName] = subrule;
                purePatterns[subpatternName] = subrule;
            }
        }
    }

    let forced = "";
    let typePattern = "";
    if (!rule.converter && rule.type && rule.type.length > 0) {
        forced = "?";
        if (rule.forced) {
            forced = "";
        }
        typePattern = `(${escapeRegExp(rule.type)})${forced}`;
    }

    let simplifiedPattern = getNonCapturingPattern(rule.pattern);
    let lefthandPattern = simplifiedPattern;
    if (rule.allowTitle === false) {
        lefthandPattern = "jf2VJw5";
    }

    let titlePattern = "[^\\]]+?";
    if (rule.converter) {
        rule.fullPattern = `${simplifiedPattern}`;
    }
    else {
        rule.fullPattern = `(?:${typePattern}(?:(?:\\[(${lefthandPattern})\\s?\\|\\s?(${titlePattern})\\s?\\])|(?:\\[${forced}(${simplifiedPattern})\\]${forced})))`;
    }


    return rule;
}

function isPatternPure(pattern) {
    return pattern.indexOf("{{") === -1;
}

function parseTemplate(template) {

    template = replaceList(template, REF2LINK_SPECIAL_ESCAPEES, REF2LINK_SPECIAL_ESCAPED);
    template = replaceList(template, REF2LINK_ESCAPEES, REF2LINK_ESCAPED);
    let result = getWrappedTemplate(`'${template}'`);

    result = parseTemplateFormat(template, result, "\\{\\{\\s*\\$(\\d*)\\|?(.*?)\\s*\\}\\}", "' + , + '");

    result = parseJSTemplateFormat(template, result, "\\[\\[\\s*(.*?)\\s*\\]\\]", "' + , + '");
    result = parseTemplateFormat(template, result, "\\$(\\d+)", "' + , + '");

    result = replaceList(result, REF2LINK_ESCAPED, REF2LINK_ACTUAL);
    result = replaceList(result, REF2LINK_SPECIAL_ESCAPED, REF2LINK_SPECIAL_ACTUAL);

    return result;
}

function parseTemplateCondition(templateCondition) {
    let result = "function() {return true;}"
    if (templateCondition.trim().length > 0) {
        let tpl = replaceList(replaceList(templateCondition, JS_OPERATORS, CF_OPERATORS), CF_OPERATORS, JS_OPERATORS);
        result = parseTemplateFormat(tpl, getWrappedTemplate(tpl), "\\{\\{\\s*\\$(\\d+)\\|?(.*?)\\s*\\}\\}", " , ");
        result = parseJSTemplateFormat(tpl, result, "\\[\\[\\s*(.*?)\\s*\\]\\]", " , ");
        result = parseTemplateFormat(tpl, result, "\\$(\\d+)", " , ", " , ");
    }

    return result;
}


/**
 *  Use [[ ]] syntax to insert JS directly into the template
 *  Example: `data.europa.eu?param=[[ String(arguments[1]).slice(0, 10) ]]` will be turned directly into: 
 *     `data.europa.eu?param=' + String(arguments[1]).slice(0, 10)`
 */
function parseJSTemplateFormat(template, compiledTemplate, exprRE, wrappers) {
    wrappers = wrappers || "' + , + '";

    let wrappersList = wrappers.split(",");
    let matches = template.match(new RegExp(exprRE, "g")) || [];
    for (let i = 0; i < matches.length; i++) {
        // get the parts
        let parts = (new RegExp(exprRE, "g")).exec(matches[i]);
        compiledTemplate = compiledTemplate.replace(new RegExp(escapeRegExp(matches[i]), 'g'), `${wrappersList[0]}${parts[1]}${wrappersList[1]}`);
    }

    return compiledTemplate;
}

/**
 * Will parse a template string into Javascript executable code
 * Example: `data.europa.eu?param={{ $1|slice(0, 10) }}` will be turned into: 
 *     `data.europa.eu?param=' + R2L.converters.slice(arguments[1], 0, 10)`
 * 
 */
function parseTemplateFormat(template, compiledTemplate, exprRE, wrappers) {
    wrappers = wrappers || "' + , + '";

    let wrappersList = wrappers.split(",");
    let matches = template.match(new RegExp(exprRE, "g")) || [];
    for (let i = 0; i < matches.length; i++) {
        let expr = parseExpression(matches[i], exprRE);
        compiledTemplate = compiledTemplate.replace(new RegExp(escapeRegExp(matches[i]), 'g'), `${wrappersList[0]}${expr}${wrappersList[1]}`);
    }

    return compiledTemplate;
}

function parseExpression(expr, regexMatcher) {
    let regex = new RegExp(regexMatcher, 'g');
    let matches = [];
    let modifiers = "";
    let result = null;

    while (result = regex.exec(expr)) {
        matches.push({ result: result, index: regex.lastIndex - result[0].length });
    }

    let match = matches.pop();
    if (match) {
        let backreference;
        if (match.result.length > 1) {

            backreference = Number(match.result[1]);
            if (match.result.length > 2) {
                backreference = Number(match.result[1])
                modifiers = match.result[2];
            }

            if (match.result.length > 3) {
                backreference = Number(match.result[2])
                modifiers = match.result[3];
            }
        }

        result = parseModifiers(backreference, modifiers);
    }
    return result;
}

function parseModifiers(backreference, modifiers) {
    let rawModifiers = [];
    if (modifiers && modifiers.length > 0) {
        let subModifiers = parseTemplateFormat(modifiers, modifiers, "\\(\\s*\\$(\\d+)\\|?(.*?)\\s*\\)", "( , )");
        rawModifiers = subModifiers.split("|").filter(part => !!part);
    }

    let result = wrapBackreference(backreference);
    if (rawModifiers.length > 0) {
        for (let modifierIndex = 0; modifierIndex < rawModifiers.length; modifierIndex++) {
            let modifierArguments = rawModifiers[modifierIndex].trim().split(':').filter(part => !!part);
            let modifierName = wrapModifier(modifierArguments[0]);
            if (modifierArguments.length > 0 && modifierArguments[0].length > 0) {
                modifierArguments[0] = result;
                result = `${modifierName}(${modifierArguments.join(", ")})`;
            }
            else {
                result = `${modifierName}(${result})`;
            }
        }
    }

    return result;
}

function getWrappedTemplate(template) {

    let tpl = template.trim().replace(/\s+/g, " ");
    let result = `function() { return ${tpl}; } `;

    result = replaceAll(result, "return '' + ", "return ");
    result = replaceAll(result, " + '';", ";");
    result = replaceAll(result, " + '' + ", " + ");

    return result;
}

function wrapBackreference(backreference) {
    return `arguments[${backreference}]`;
}

function wrapModifier(modifierName) {
    return modifierName;
}

function parseRulesFile(filePath) {
    let rules = [];

    // parse a file 
    let xml = fs.readFileSync(filePath, { encoding: 'utf8' });
    let doc = new dom().parseFromString(xml);

    // Parse XML with XPath:
    let ruleNodes = xpath.select('//rule', doc);
    for (let i = 0; i < ruleNodes.length; i++) {
        try {
            let localRule = parseRule(ruleNodes[i]);
            if (localRule && localRule.type && localRule.pattern) {
                localRule.file = filePath;
                rules.push(localRule);
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    return rules;
}

function parseRuleFootnotes(footnoteNodes) {
    let ruleFootnotes = [];
    for (let i = 0; i < footnoteNodes.length; i++) {
        let ruleFootnote = {};
        try {
            ruleFootnote.template = getNodeData(footnoteNodes[i]);
            let type = footnoteNodes[i].getAttribute("type") || null;
            ruleFootnote.type = type;

            ruleFootnotes.push(ruleFootnote);
        }
        catch (e) {
            console.error(e);
        }
    }

    return ruleFootnotes;

}

function parseRuleViews(viewNodes) {
    let ruleViews = [];
    for (let i = 0; i < viewNodes.length; i++) {
        let ruleView = {};
        try {
            ruleView.template = parseTemplate(getNodesChildOrAttribute(viewNodes[i], 'template', '', true));
            let target = viewNodes[i].getAttribute("target") || null;
            ruleView.target = target;
            ruleView.baseTarget = target;
            ruleView.ldCondition = viewNodes[i].getAttribute("ld-condition") || null;
            ruleView.groupTarget = viewNodes[i].getAttribute("group-target") || null;

            ruleView.libelle = viewNodes[i].getAttribute("libelle") || "";
            ruleView.condition = parseTemplateCondition(getNodesChildOrAttribute(viewNodes[i], 'condition', '', false));
            ruleView.order = viewNodes[i].getAttribute("order") ? Number(viewNodes[i].getAttribute("order")) : null;
            ruleView.baseTarget = viewNodes[i].getAttribute("base-target") || target;
            ruleView._default = viewNodes[i].getAttribute("_default") ? true : false;

            ruleView.environments = ["*"];
            if (viewNodes[i].getAttribute("environment")) {
                ruleView.environments = viewNodes[i].getAttribute("environment").split("|").filter(e => !!e);
            }
            ruleViews.push(ruleView);
        }
        catch (e) {
            console.error(e);
        }
    }

    return ruleViews;
}

function parseRule(ruleNode) {
    let rule = {};

    let attributesMap = {};
    for (let key in (ruleNode.attributes || {})) {
        if (ruleNode.attributes.hasOwnProperty(key) && key) {
            let attribute = ruleNode.attributes[key];
            attributesMap[attribute.name] = attribute.value;
        }
    }

    rule.converter = Boolean(attributesMap["converter"]) || false;
    rule.ruleLibelle = attributesMap["libelle"] || "";
    rule.ld = String(attributesMap["ld"] || "").split(" ").filter(t => !!t);
    rule.allowTitle = attributesMap["allow-title"] === "false" ? false : true;
    rule.customTitle = attributesMap["custom-title"] === "true" ? true : false;
    rule.allowAttribute = attributesMap["allow-attribute"] === "false" ? false : true;
    rule.baseLibelle = attributesMap["base-libelle"] || "";
    rule.prefix = attributesMap["list-prefix"] || null;
    rule.skip = attributesMap["list-skip"] || null;
    rule.vars = attributesMap["list-vars"] || null;
    rule.identifiers = attributesMap["list-identifiers"] || null;
    rule.coreIdentifiers = attributesMap["list-core-identifiers"] || null;
    rule.shared = attributesMap["list-shared"] || null;
    rule.commonRules = String(attributesMap["common-rules"] || "").split(" ").filter(t => !!t);
    rule.slots = attributesMap["slots"] ? Number(attributesMap["slots"]) : 1;

    let pattern = getNodesChildOrAttribute(ruleNode, "pattern", "", false);
    rule.pattern = normalizePattern(pattern);
    rule.patternTemplate = rule.pattern;

    let itemPattern = getNodesChildOrAttribute(ruleNode, "item-pattern", "", false);
    let guardPattern = getNodesChildOrAttribute(ruleNode, "guard-pattern", "", false);
    let skipPattern = getNodesChildOrAttribute(ruleNode, "skip-pattern", "", false);
    let strictPattern = getNodesChildOrAttribute(ruleNode, "strict-pattern", "", false);
    let trimPattern = getNodesChildOrAttribute(ruleNode, "trim-pattern", "", false);

    rule.type = "";
    if (attributesMap["type"]) {
        rule.type = attributesMap["type"];
        rule.baseType = rule.type;
    }

    rule.baseType = attributesMap["base-type"] || rule.baseType;
    rule.itemType = attributesMap["item-type"] || "";

    let booleanAttributesMap = {
        forced: 'forced',
        itemForced: 'item-forced',
        casesensitive: 'casesensitive',
        common: 'common'
    }

    for (let booleanKey in booleanAttributesMap) {
        let attrKey = booleanAttributesMap[booleanKey];
        rule[booleanKey] = 0;
        if (attributesMap[attrKey] && (attributesMap[attrKey] === "true" || attributesMap[attrKey] === '1')) {
            rule[booleanKey] = 1;
        }
    }

    rule.name = attributesMap["name"] || rule.ruleLibelle;
    rule.base = attributesMap["base"] || rule.name;
    rule.lang = attributesMap["lang"] || "";

    if (!rule.type) {
        namedPatterns[rule.name] = rule;
        return {};
    }

    rule["item-pattern"] = "";
    if (itemPattern.length > 0) {
        rule["item-pattern"] = normalizePattern(itemPattern);
        rule.itemPatternTemplate = rule["item-pattern"];
    }

    rule["guard-pattern"] = "";
    if (guardPattern.length > 0) {
        rule["guard-pattern"] = normalizePattern(guardPattern);
        rule.guardPatternTemplate = rule["guard-pattern"];
    }

    rule["skip-pattern"] = "";
    if (skipPattern.length > 0) {
        rule["skip-pattern"] = normalizePattern(skipPattern);
        rule.skipPatternTemplate = rule["skip-pattern"];
    }

    rule["strict-pattern"] = "";
    if (strictPattern.length > 0) {
        rule["strict-pattern"] = normalizePattern(strictPattern);
        rule.strictPatternTemplate = rule["strict-pattern"];
    }

    rule["trim-pattern"] = "";
    if (trimPattern.length > 0) {
        rule["trim-pattern"] = normalizePattern(trimPattern);
        rule.trimPatternTemplate = rule["trim-pattern"];
    }

    rule.replacement = 1;
    rule.version = "N/A";

    if (attributesMap["order"]) {
        rule.order = Number(attributesMap["order"]);
    }

    if (attributesMap["version"]) {
        rule.version = attributesMap["version"];
    }

    let children = [];
    let footnoteChildren = [];
    for (let ruleNodeChildIndex = 0; ruleNodeChildIndex < ruleNode.childNodes.length; ruleNodeChildIndex++) {
        if (ruleNode.childNodes[ruleNodeChildIndex].nodeName === "view") {
            children.push(ruleNode.childNodes[ruleNodeChildIndex]);
        }
        if (ruleNode.childNodes[ruleNodeChildIndex].nodeName === "footnote") {
            footnoteChildren.push(ruleNode.childNodes[ruleNodeChildIndex]);
        }
    }

    rule.views = [];
    try {
        rule.views = parseRuleViews(children);
        rule.footnotes = parseRuleFootnotes(footnoteChildren);

    }
    catch (e) {
        console.error(e);
    }

    namedPatterns[rule.name] = rule;
    if (itemPattern) {
        namedPatterns[`${rule.name}-item`] = rule;
    }

    return rule;
}

function serializeRules(rules) {
    let strippedRules = [];

    for (let i = 0; i < rules.length; i++) {
        let packedViews = [];
        let rule = rules[i];
        let packedRule = {};
        if (rule.views) {
            for (let j = 0; j < rule.views.length; j++) {
                let view = rule.views[j];
                let packedView = {};
                for (let sourceKey in VIEW_KEYMAP) {
                    if (VIEW_KEYMAP[sourceKey]) {
                        packedView[VIEW_KEYMAP[sourceKey]] = view[sourceKey];
                    }
                }
                packedViews.push(packedView);
            }
            rule.views = packedViews;
        }
        for (let sourceKey in RULE_KEYMAP) {
            if (RULE_KEYMAP[sourceKey]) {
                let destKey = RULE_KEYMAP[sourceKey];
                packedRule[destKey] = rule[sourceKey];
            }
        }
        strippedRules.push(packedRule);
    }

    return strippedRules;
}

function formatPatternName(patternName, language) {
    return `${patternName}_${String(language)}`;
}

let rules = parseRules(ROOT_DIR, VALID_EXTENSIONS);
let languageMap = new Map([['GLE', 'GA'], ['HRV', 'HR'], ['HUN', 'HU'], ['ITA', 'IT'], ['LAV', 'LV'], ['LIT', 'LT'], ['CES', 'CS'], ['POL', 'PL'], ['SLK', 'SK'], ['BUL', 'BG'], ['MLT', 'MT'], ['NLD', 'NL'], ['SLV', 'SL'], ['SPA', 'ES'], ['SWE', 'SV'], ['POR', 'PT'], ['RON', 'RO'], ['DAN', 'DA'], ['DEU', 'DE'], ['ELL', 'EL'], ['ENG', 'EN'], ['EST', 'ET'], ['FIN', 'FI'], ['FRA', 'FR']]);
let languageItem = [...languageMap].find(([key, val]) => val === LANGUAGE)

// The `constants` object can be imported by the Ref2Link engine at runtime. 
let constants = {
    'R2L_RULE_MAP': JSON.stringify(RULE_KEYMAP),
    'R2L_VIEW_MAP': JSON.stringify(VIEW_KEYMAP),
    'R2L_VERSION': VERSION,
    'R2L_BUILD_INFO': BUILD_INFO,
    'R2L_CSS_MAP': JSON.stringify({ 'ref2link.css': Base64.encode(REF2LINK_CSS) }),
    'R2L_VIEW_OPTIONS': '{ "viewUsesTarget": true, "viewTitleSuffix": "", "viewTitlePrefix": "to", "linkClassName": "" }',
    'R2L_NAMED_PATTERNS': 'W10=',
    'R2L_TYPED_RULES': LZString.compressToBase64(JSON.stringify(serializeRules(rules))),
    'R2L_FINLEX_ENDPOINT': 'https://ldf.fi/finlex/sparql',
    'R2L_PUBLICATIONS_ENDPOINT': 'https://publications.europa.eu/webapi/rdf/sparql',
    'R2L_DEFAULT_LANG_ISO3': languageItem ? languageItem[0] : null // source language
}

fs.writeFile(path.resolve(BASE_PATH, OUTPUT_PATH), JSON.stringify(constants), (err) => {
    if (err) {
        console.log(err);
    }
    console.log("Exported rules file");
});
