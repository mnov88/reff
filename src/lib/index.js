import { $ } from './jquery.js';
import { regExpEscape, getNonCapturingPattern, mergeMatches, cleanMatches } from './utils/functions.js';
import { letters } from './utils/letters.js';
import { getExtracts, unExtractRaw, unExtractNode, replaceDOMNodes, replaceHtmlNodes } from './utils/processor.js';
import { cloneListIdentifiers, cloneListCore, getListCore, getListIdentifiers, cloneCoreIdentifiers, getCoreIdentifiers } from './utils/list.js';
import { resetTooltips } from './ux/index.js';
import { settings, LD_ADVANCED_MODE_KM_HANDOC, LD_ADVANCED_MODE_KM_CIS } from './settings/index.js';
import { replaceAliases, replaceAliasMatches } from './alias/index.js';
import { sharedCtx } from './utils/shared.js';
import { fillPlaceholders } from './transformers/index.js';
import { clearPlaceholders } from './transformers/utils/index.js';
import { clearLdTargets, filterTargets } from './transformers/filter.js';
import { getTranslation } from './translations/index.js';
import { clearTooltips } from './jquery/index.js';
import { clearExtracts, clearTextCaches } from './utils/processor.js';
import { LD_MODE_ALL, LD_ADVANCED_MODE_SHORT_TITLES, LD_ADVANCED_MODE_CORRECTIONS, LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT, LD_MODE_METADATA, LD_MODE_SEQ_NUMBER, LD_MODE_CHECK_EXISTS } from './settings/index.js';

// R2L global. Must be exposed globally: `window.R2L` (browser) or `global.R2L` (server-side)
let R2L = {};

// Confluence binding
let _jQuery = $;

// We can't do much without JQuery
if (!_jQuery) {
    throw new Error("JQuery is not loaded.");
}

// alias function
R2L.getJQuery = R2L.getJquery = function () {
    return _jQuery;
}

/**
 * Inject JQuery dependency
 * @param {JQuery} jQuery 
 */
R2L.setJQuery = function (jQuery) {
    _jQuery = jQuery;
}

/**
 * Constants are properties pre-set by the JSON rules file loaded into the library. Source language and the corresponding base64-encoded rules are among them.
 * @see R2L.settings.constants  
 * @param {String} name
 * 
 * @returns
 */
R2L.getConstant = function (name) {
    let isBrowser = new Function("try { return this === window; } catch(e){ return false; }").call();
    if (!isBrowser && global && global["R2L_CONSTANTS"]) {

        // defaults
        if (name === "R2L_EULANG") {
            return settings.constants[name];
        }

        return global["R2L_CONSTANTS"][name];
    }

    return settings.constants[name];
}

R2L.setConstant = function (name, value) {
    let isBrowser = new Function("try { return this === window; } catch(e){ return false; }").call();
    if (!isBrowser && global && global["R2L_CONSTANTS"]) {
        global["R2L_CONSTANTS"][name] = value;
    }

    settings.constants[name] = value;
}

/**
 * Apply rules to text 
 * @param {String} text
 * @param {Object} globalRule (optional)
 * @param {Boolean} isAlias (optional) - when it's an alias parse we need to polish the matches before saving them
 * 
 * @returns {Promise<Object>} returns a `matches` object
 */
R2L.applyGlobalRule = function (text, globalRule, isAlias) {
    let matches = {};
    try {
        if (!globalRule) {
            /** Guard checks optimization */
            let rules = this.runGuards(text, this.getRules());
            globalRule = this.compileGlobalRule(rules);
        }
        matches = cleanMatches(R2L.applyMultipleRules(text, globalRule, [], 0));
    }
    catch (e) {
        console.error(e);
    }

    // linked-data processing
    return fillPlaceholders(matches).then((matches) => {
        return filterTargets(matches).then(matches => {
            if (!isAlias) {
                R2L.setGlobalMatches(matches);
            }
            return matches;
        });
    });
};

/**
 * Synchronous parsing API (will clear linked-data placeholders)
 * @param {string} text 
 * @param {Object} globalRule 
 * @param {boolean} isAlias 
 */
R2L.applyGlobalRuleSync = function (text, globalRule, isAlias) {
    if (!globalRule) {
        /** Guard checks optimization */
        let rules = this.runGuards(text, this.getRules());
        globalRule = this.compileGlobalRule(rules);
    }

    let matches = R2L.applyMultipleRules(text, globalRule, [], 0);
    matches = cleanMatches(matches);
    matches = clearLdTargets(matches);
    matches = clearPlaceholders(matches);
    if (!isAlias) {
        R2L.setGlobalMatches(matches);
    }
    return matches;
};

/**
 * Iterator function that abstracts over the webworker execution, making it behave like a Regexp iterator
 * 
 * @param {String} text 
 * @param {RegExp} multiMatchPattern 
 * @param {Number} level
 * 
 * @returns {Array<String>} Regex matches
 */
let _executor = function (text, multiMatchPattern, level) {
    let data = level === 0 ? sharedCtx.getData(text) : null;
    if (R2L.options.worker && level === 0 && data && Array.isArray(data.matches)) {
        if (data.matches.length > data.cursor) {
            data.cursor++;
            multiMatchPattern.lastIndex = data.matches[data.cursor - 1].lastIndex;
            return data.matches[data.cursor - 1].args;
        }
        else {
            // we reached the end of the matches
            return false;
        }
    }
    else {
        return multiMatchPattern.exec(text);
    }
};

/**
 * Actual parsing function. Calls itself recursively in case of lists
 * Should not be called from the outside
 * @param {String} text - text to parse
 * @param {RegExp} multiMatchRule - For level 0 it is the compiled global rule (celex|ecli|act|eucase...). For level 1 it is the list-item pattern.
 * @param {Array<Ref2link>} history - list items are stored for passing data in-between 
 * @param {Number} level - the recursion level (0 or 1)
 * 
 * @returns {Object} matches - map of matches
 */
R2L.applyMultipleRules = function (text, multiMatchRule, history, level) {
    var args, matches = {};
    var rules = multiMatchRule.rules,
        multiMatchPattern = multiMatchRule.pattern,
        lastIndex = 0;

    if (!rules.length) {
        return {};
    }

    if (!history) {
        history = [];
    }

    if (!level) {
        level = 0;
    }

    detection:
    while (args = _executor(text, multiMatchPattern, level)) {
        var match = args[0], startPosition = multiMatchPattern.lastIndex - match.length;
        if (!match) { /** pattern matched empty string; the regexp will infinitely recurse */
            multiMatchPattern.lastIndex++;
            lastIndex = multiMatchPattern.lastIndex;
        }

        if (level === 0) {
            //polyfill for engines not supporting negative lookbehind 
            if (startPosition > 1) {
                let letterPattern = "[/0-9" + letters.latin + letters.cyrillic + letters.greek + letters.specialChars + "]";
                if (new RegExp(letterPattern, 'i').test(text[startPosition - 1])) {
                    console.debug("Discarding match because of left neighbour", text[startPosition - 1]);
                    continue;
                }
            }

            /** smooth over args since some rules have multiple groups */
            var offset = 0;
            for (var i = 0; i < rules.length; i++) {
                offset += rules[i].slots;
                if (rules[i].slots === 2) {
                    args.splice(offset, 1);
                    offset -= 1;
                }
            }
        }

        /** scan which of the arguments is not empty and apply respective rule */
        for (var i = 1; i <= args.length; i++) {
            if (args[i] && i - 1 < rules.length) {
                var itemMatches = {},
                    rule = rules[i - 1];

                let trimPattern = (rule ? (rule.trimPattern || rule["trim-pattern"]) : null);
                if (trimPattern) {
                    try {
                        let trimRegex = new RegExp(trimPattern);
                        match = match.replace(trimRegex, '');
                    }
                    catch (e) {
                        // move on
                    }
                }

                /** check the skip rule */
                let skipPattern = (rule ? (rule.skipPattern || rule["skip-pattern"]) : null);
                if (skipPattern) {
                    try {
                        let skipRegex = new RegExp(skipPattern);
                        if (skipRegex.test(match)) {
                            multiMatchPattern.lastIndex = multiMatchPattern.lastIndex - match.length + 1;
                            lastIndex = multiMatchPattern.lastIndex;
                            continue detection;
                        }
                    }
                    catch (e) {
                        // move on
                    }
                }

                /** check the strict rule settings and patterns */
                let strictPattern = (rule ? (rule.strictPattern || rule["strict-pattern"]) : null);
                if (level === 0 && strictPattern && R2L.options.strictRules && (R2L.options.strictRules[rule.baseType] || R2L.options.strictRules[rule.type])) {
                    try {
                        let strictRegex = new RegExp(strictPattern, "i");
                        if (!strictRegex.test(match)) {
                            // no need to move cursor back, let detection skip this ref
                            //multiMatchPattern.lastIndex = multiMatchPattern.lastIndex - match.length + 1;
                            //lastIndex = multiMatchPattern.lastIndex;
                            continue detection;
                        }
                    }
                    catch (e) {
                        // move on
                    }
                }

                var ruleType = rule.type;
                var title = match;
                var reference = match;

                if (rule.allowTitle) {
                    var normalizePattern = function (p, iFlag, surroundAndEscape) {
                        surroundAndEscape = surroundAndEscape || false;
                        var pattern = (p.source || p).replace(/^\/|\/[giumxns]*$/g, '');
                        if (surroundAndEscape) {
                            pattern = '(' + getNonCapturingPattern(pattern) + ')';
                        }
                        return new RegExp(pattern, 'gm' + iFlag);
                    };

                    var fullPattern = normalizePattern(rule.fullPattern, rule.casesensitive ? '' : 'i');
                    var fullArgs = fullPattern.exec(args[i]);
                    var controlExpr = "(?:[^\\]\\|\\r\\n\\v]*)";

                    ruleType = String(fullArgs ? (fullArgs[1] || '') : '').trim();
                    reference = fullArgs ? fullArgs[2] || fullArgs[4] || '' : '';
                    title = fullArgs ? fullArgs[3] || '' : '';

                    if (!reference || reference.length > R2L.settings.maxReferenceLength || (ruleType && rule.type.toLowerCase() !== ruleType.toLowerCase())) {
                        multiMatchPattern.lastIndex = startPosition + 1;
                        continue detection;
                    }

                    if (title) {
                        if (title.length > R2L.settings.maxTitleLength) {
                            title = match = reference;
                            multiMatchPattern.lastIndex = startPosition + reference.length;
                        }
                        else {
                            controlExpr = "\\[" + controlExpr + "\\s*\\|\\s*(?:[^\\]\\n\\r\\v]*?)\\]";
                        }
                    }
                    else {
                        if (!rule.forced && !ruleType) {
                            match = String((R2L.converters.trim(reference, '[]')) || '').trim();
                            reference = match;
                        }
                    }
                    controlExpr = '(' + regExpEscape(rule.type) + ')' + (rule.forced ? '' : '?') + "[\t ]*" + controlExpr;
                    controlExpr = new RegExp(controlExpr, 'i');
                    if (!controlExpr.test(match)) {
                        multiMatchPattern.lastIndex = ++lastIndex;
                        continue detection;

                    }
                }
                else {
                    if (level === 1) {
                        title = null;
                    }
                }

                lastIndex = multiMatchPattern.lastIndex;

                if (level === 0) {
                    history = [];
                }

                /** If there's an itemRule go straight to item matching */
                if (rule.itemRule) {
                    var itemMultiMatchRule = R2L.compileGlobalRule([rule.itemRule]);
                    itemMatches = R2L.applyMultipleRules(match, itemMultiMatchRule, history, 1);
                }
                else {
                    var appliedRule = R2L.applyRule(match, rule, (rule.customTitle ? null : title), match, history);
                    if (appliedRule) {
                        match = appliedRule.wholeMatch;
                        appliedRule.startPosition = startPosition;
                        if (!rule.itemRule) {
                            itemMatches[match] = appliedRule;
                            if (level === 1) {
                                history.push(appliedRule);
                            }
                        }
                    }
                    else {
                        console.debug('Multi match, no rule match', i, match, rule, appliedRule);
                    }
                }

                if (level === 0 && history.length > 1) {
                    var listRef = getListCore(history[0].rule, history[0].matches);
                    if (listRef.length === 0) {
                        /** Inverted lists might need some help */
                        for (var hI = 0; hI < history.length; hI++) {
                            if (hI > 0) {
                                /**
                                 * We clone identifiers forward eg:
                                 * articles 5 paragraphs 6, 7       # 6 & 7 are paragraphs of art. 5
                                 */
                                cloneListIdentifiers(history[hI - 1], history[hI]);
                            }
                            if (hI < history.length - 1) {
                                /**
                                 * We clone list core data from the last element in the case of inverted lists
                                 * 
                                 * articles 5, 6, 7 of Dir. 78/99   # articles 5, 6 need directive info
                                 */
                                cloneListCore(history[history.length - 1], history[hI]);

                                /** 
                                 * If identifiers are not complete we copy those also 
                                 */
                                var identifiers = getListIdentifiers(history[history.length - 1].rule, history[history.length - 1].matches);

                                /**
                                 * points 5 and 7 of article 2(3) Dir. 78/99      # point 5 & 7 belongs to an article
                                 */
                                var coreIdentifiers = getCoreIdentifiers(history[hI].rule, history[hI].matches);
                                if (coreIdentifiers.length === 0 && identifiers.length > 0) {
                                    cloneCoreIdentifiers(history[history.length - 1], history[hI]);
                                }
                            }

                            var hItem = history[hI];

                            /** Re-render */
                            var sPos = hItem.startPosition;
                            var appliedRule = R2L.applyRule(hItem.reference, hItem.rule, hItem.link, hItem.wholeMatch, [], history[hI].matches);
                            if (appliedRule) {
                                match = appliedRule.wholeMatch;
                                appliedRule.startPosition = sPos;
                                itemMatches[match] = appliedRule;
                            }
                        }
                    }
                }

                if (level === 0 && rule["item-pattern"]) {
                    Object.keys(itemMatches).forEach(function (itemKey) {
                        let itemReference = itemMatches[itemKey];
                        itemReference.startPosition = startPosition + itemReference.startPosition;
                    })
                }

                Object.keys(itemMatches).forEach(function (_itemMatch) {
                    let _item = itemMatches[_itemMatch];
                    if (!matches.hasOwnProperty(_itemMatch)) {
                        if (Object.keys(_item.views).length > 0) {
                            matches[_itemMatch] = _item;
                        }
                    }
                })

                if (level === 0 && Object.keys(itemMatches).length > 0) {
                    Object.keys(itemMatches).forEach(function (_itemMatch) {
                        let _item = itemMatches[_itemMatch];

                        if (!matches[_itemMatch]) {
                            return;
                        }

                        matches[_itemMatch].offsets.push({
                            matches: _item.matches,
                            match: _itemMatch,
                            position: _item.startPosition,
                            views: _item.views,
                            rule: rule,
                            counter: 1,
                            alternatives: _item.alternatives,
                            context: args[0],
                        });

                        matches[_itemMatch].counter++;
                    });

                    Object.keys(itemMatches).forEach(function (_itemMatch) {
                        let _item = itemMatches[_itemMatch];
                        if (!matches[_itemMatch]) {
                            return;
                        }

                        Object.keys(_item.alternatives).forEach(function (_index) {
                            let _alternative = _item.alternatives[_index];
                            _alternative.context = args[0];
                            try {
                                if (_alternative.viewName === 'table') {
                                    return;
                                }

                                var _v = $(_alternative.view);
                                _v.attr(R2L.dataRef2linkContextAttribute, args[0]);
                                _alternative.view = _v[0].outerHTML;
                            }
                            catch (e) {
                                console.error(e);
                            }
                        });
                    });
                }
            }
        }
    }

    return matches;
};

/**
 * Apply sort over a list of nodes
 * @param {Array<Object>} list - list of nodes
 * 
 * @returns {Array<Object>} sorted list
 */
R2L.applySort = function (nodes) {
    if (nodes.length < 2) {
        return nodes;
    }

    /* Supported sort fields */
    var fields = new Array("count", "position", "reference", "type", "libelle");
    var sort = settings.sort.toLowerCase();

    if (typeof sort !== "string") {
        return nodes;
    }

    var pieces = sort.split(".");
    var direction = "asc";
    var field = pieces[0];
    if (fields.indexOf(field) === -1) {
        return nodes;
    }

    if (pieces.length > 1) {
        direction = (pieces[1] === "asc" || pieces[1] === "desc") ? pieces[1] : direction;
    }

    nodes.sort(function (a, b) {
        if (direction === "asc") {
            return a[field] < b[field] ? -1 : 1;
        }
        else {
            return a[field] > b[field] ? -1 : 1;
        }
    });

    return nodes;
};

/**
 * (DEPRECATED) Helper function to get the last results. Previous parsing is required.
 * @param {String} format - xml/json/html
 * 
 * @returns {Object|null} - result 
 */
R2L.getFormattedReferences = function (format) {
    format = format || 'html';
    if (format === 'ref2table') {
        format = 'xml';
    }

    if (!this.$el) {
        return null;
    }

    var formatter = format,
        references = this.$el.getReferences();
    ;

    if (Object.prototype.toString.call(format) === "[object String]") {
        formatter = this.formatters[format];
    }

    if (format === 'html') {
        // we already have the html content from the parsed node
        return {
            result: this.$el.html(),
            type: 'text/html',
            ext: 'html',
        }
    }
    else {
        return formatter(references);
    }
};

/**
 * Removes anchor links which contain an annotation eg: "(12)"
 * NOT IN USE
 * @param {String} text 
 * @returns {String} 
 */
R2L.parseAnnotations = function (text) {
    let $el = $("<div>" + text + "</div>");
    let links = $el.find("a").toArray();
    links = links.filter((link) => {
        return /\(\d+\)/.test($(link).text());
    });

    links.map((link) => {
        text = text.replace(new RegExp(regExpEscape(link.outerHTML), 'g'), "");
    });

    return text;
};

/**
 * Replace the default link with an alternative
 * @param {Object} target - the ref2link object 
 * @param {Object} alternative - the rendered alternative object
 */
R2L.setAlternative = function (target, alternative) {
    try {
        var $self = $(target).closest(R2L.settings.class + ', .ref2link-tooltip'),
            $parents = $self.parents(R2L.settings.class + ', .ref2link-tooltip').last(),
            $view = $(alternative.view)
            ;
        if ($parents.length) {
            $self = $parents;
        }
        if (!$self.length || !$view.length) {
            return;
        }

        var reference = $self.getRef2linkMatch();
        $view.setRef2linkMatch(reference);
        $self.replaceWith($view);
    } catch (e) { }

};

/**
 * Remove the link from a reference
 */
R2L.removeReference = function (target) {

    var $container = $(target).parentsUntil(`:not(.${settings.generatedClassName})`);
    if ($container.length) {
        return $container.unparseTextRules();
    }
    return $(target).unparseTextRules();
};

/**
 * Fetch linked data
 * @param {Array<Ref2Link>} nodes from the scan
 * 
 * @returns {Promise<Object>} Key-value object with CELEX/ELI identifiers as keys
 */
R2L.loadMetadata = function (nodes) {
    return this.ldm.fetch(nodes).then(data => {
        resetTooltips();
        return data;
    }).catch(e => {
        console.error(e);
    });
};

/**
 * Expose label translation fn
 */
R2L.getTranslation = getTranslation;

/**
 * Apply an order map to ref2link
 * 
 *  { ruletype1: [target1, target2 ...], ruletype2: [target3, target1, target2], ... }
 * 
 * @param {Object} order
 */
R2L.setViewOrder = function (order) {
    let rules = this.getRules();
    for (let ruleType in order) {
        rules.filter((r) => {
            return r.type === ruleType || r.baseType === ruleType;
        }).map((rule) => {
            rule.views.map((view) => {
                let index = order[ruleType].indexOf(view.target);
                view.order = index === -1 ? (view.order + order[ruleType].length) : index;
                return view;
            });
            // child rule update
            if (rule.itemRule && rule.itemRule.views) {
                rule.itemRule.views.map((view) => {
                    let index = order[ruleType].indexOf(view.baseTarget);
                    if (index === -1) {
                        index = order[ruleType].indexOf(view.target);
                    }

                    view.order = index === -1 ? (view.order + order[ruleType].length) : index;
                    return view;
                });
            }
        });
    }
};

/**
 * Apply an order map to ref2link
 * @deprecated use `R2L.setViewOrder()`
 */
R2L.applyViewOrder = R2L.setViewOrder;

/**
 * Set view options (attributes) eg: 'target=_self'
 * { 
 *   ruletype1: { target1: {target: '_self'}, target2: {target: '_blank'} ...}, 
 *   ruletype2: {target3: {target: '_self'}...}
 * }
 */
R2L.setViewAttributes = function (viewAttributes) {
    this.settings.viewAttributes = viewAttributes;
}

/**
 * Returns view attribute settings. Pass a view name (target) to return attributes for that target only
 * @param {String} viewName (optional) 
 * @returns 
 */
R2L.getViewAttributes = function (viewName) {
    if (!viewName) {
        return this.settings.viewAttributes || null;
    }

    if (this.settings.viewAttributes) {
        let viewAttributes = this.settings.viewAttributes;
        try {
            for (let _ruleType in viewAttributes) {
                if (viewAttributes[_ruleType] && viewAttributes[_ruleType][viewName]) {
                    return viewAttributes[_ruleType][viewName];
                }
            }
        }
        catch (e) {
            console.error(e);
            // move on
        }
    }

    return null;
}


/**
 * Direct parse API method
 * @param {String} text
 * @param {String} format (html|xml|json)
 * @param {Object} opts @see R2L.options
 * 
 * @returns {Promise<Object>}
 */
R2L.parse = function (text, format, opts) {
    if (opts) {
        this.setOptions(opts);
    }

    format = String(format).toLowerCase();

    return new Promise((resolve, reject) => {
        // we first process aliases and then we do a single global parse

        let replaceAliasesResult;
        (R2L.options.aliases ? R2L.alias.getAIAliases(text) : Promise.resolve([])).then(localAliasItems => {

            console.debug("AI aliases extracted", localAliasItems);
            let localAliasMap = {};
            localAliasItems.forEach(item => {
                localAliasMap[item.context] = item.act;
            });
            R2L.alias.resetLocal();
            R2L.alias.addLocal(localAliasMap);
            replaceAliasesResult = replaceAliases(text, []);
            let tempText = replaceAliasesResult.text;

            // run parser again after replacing aliases
            let rules = R2L.getRules();
            rules = R2L.runGuards(tempText, rules);
            let globalRule = R2L.compileGlobalRule(rules);

            return R2L.applyGlobalRule(tempText, globalRule, true);

        }).then(newMatches => {
            newMatches = replaceAliasMatches(newMatches, replaceAliasesResult);
            R2L.setGlobalMatches(newMatches);
            resolver(format, text, newMatches, resolve);
        }).catch(e => {
            console.error("Failed to apply globalRule", e);
            resolver(format, text, {}, resolve);
        });
    });
};

/**
 * Expose function to directly replace a string
 * @param {String} html
 * @param {Object} matches
 * 
 * @returns {String} Final content with links
 */
R2L.replaceHtml = function (html, matches) {
    let temp = replaceHtmlNodes(html, matches);
    return unExtractRaw(temp);
}

/**
 * Will replace detected references with <a> tags, operating on the current node.
 * This helps preserve existing DOM events.
 * 
 * @param {HTMLElement} node 
 * @param {Object} matches 
 * @returns {HTMLElement} Node with (detected) text nodes replaced as `<a>` tags 
 */
R2L.replaceDOM = function (node, matches) {
    node = replaceDOMNodes(node, matches);
    if (node) {
        unExtractNode(node);
    }
    return node;
}

/**
 * Import new rules object (result of the compilation) 
 * @param {Object} constants
 * 
 * @returns {Boolean}
 */
R2L.importRules = function (constants) {
    let lang = constants.R2L_DEFAULT_LANG_ISO3 || null;
    let langMap = R2L.getConstant('R2L_EULANG');
    if (lang && !langMap.get(String(lang).toUpperCase())) {
        return false;
    }

    this.setConstant('R2L_DEFAULT_LANG_ISO3', lang);
    this.setConstant('R2L_TYPED_RULES', constants.R2L_TYPED_RULES);
    this.clearCache();
    this.reloadRules();
    return true;
};

R2L.clearCache = function () {
    this.globalMatches = {};
    this.globalViews = {};
    clearTextCaches();
    clearExtracts();
    // the Shared Context object should not be exposed
    sharedCtx.clear();

    clearTooltips();
    this.ldm.clearCache();

};

R2L.unbind = function () {
    this.unbindTooltips();
}

/**
 * Configuration of options
 * @param ${options} object 
 */
R2L.setOptions = function (options) {
    if (!options) {
        return;
    }

    if (options.worker !== undefined) {
        options.worker = Boolean(options.worker);
        if (Boolean(R2L.options.worker) !== Boolean(options.worker)) {
            if (options.worker) {
                R2L.registerWorker();
            }
            else {
                R2L.destroyWorker();
            }
        }
    }

    if (options.enableSpecialRules !== undefined) {
        options.enableSpecialRules = Boolean(options.enableSpecialRules);
        if (Boolean(R2L.options.enableSpecialRules) !== options.enableSpecialRules) {
            R2L.options.enableSpecialRules = options.enableSpecialRules;
            R2L.reloadRules();
        }
    }

    // linkeddata/metadata equivalency
    if (options.linkeddata !== undefined && options.metadata === undefined) {
        options.metadata = options.linkeddata;
    }

    if (options.metadata !== undefined) {
        options.metadata = Boolean(options.metadata);
        if (Boolean(R2L.options.metadata) !== options.metadata) {
            R2L.options.ruleHeading = options.metadata ? R2L.viewOptions.enhancedHeading : '';
        }
    }

    if (options.linkedDataMode) {
        let ldOpts = [LD_MODE_ALL, LD_ADVANCED_MODE_SHORT_TITLES, LD_ADVANCED_MODE_CORRECTIONS, LD_MODE_METADATA, LD_ADVANCED_MODE_KM_HANDOC, LD_ADVANCED_MODE_KM_CIS, LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT, LD_MODE_SEQ_NUMBER, LD_MODE_CHECK_EXISTS];

        if (Array.isArray(options.linkedDataMode)) {
            options.linkedDataMode = options.linkedDataMode.filter(o => {
                return ldOpts.indexOf(o) !== -1;
            });
        }
        else if (typeof options.linkedDataMode === "string" && ldOpts.indexOf(options.linkedDataMode) > -1) {
            options.linkedDataMode = [options.linkedDataMode];
        }
        else {
            options.linkedDataMode = [LD_MODE_ALL];
        }
    }

    if (options.pointInTime !== undefined) {
        R2L.ldm.clearCache();
    }

    R2L.options = { ...R2L.options, ...options };
    console.debug("Configured R2L options", R2L.options);
}

/**
 * Check if a certain linked-data mode is active
 * @param {String} mode
 * @returns {Boolean} 
 */
R2L.hasLinkedDataMode = function (mode) {
    // LD_MODE_ALL does not include advanced modes
    if ([LD_ADVANCED_MODE_CORRECTIONS, LD_ADVANCED_MODE_KM_HANDOC, LD_ADVANCED_MODE_SHORT_TITLES, LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT].indexOf(mode) !== -1) {
        return this.options.linkedDataMode.indexOf(mode) > -1;
    }

    return Array.isArray(this.options.linkedDataMode) &&
        (this.options.linkedDataMode.indexOf(mode) > -1 || this.options.linkedDataMode.indexOf(LD_MODE_ALL) > -1);
}

/** 
 * Set target language
 * @param {string} - ISO 3 language 
 */
R2L.setLanguage = function (language) {
    let parts = String(language).split("-");
    if (parts.length > 1) {
        this.options.language = parts[0];
        // multi language detected
        this.options.multiLanguage = language;
    }
    else {
        this.options.language = language;
    }
}

/** 
 * Get current target language
 * @returns {String} - ISO 3 language (or empty string)
 */
R2L.getLanguage = function () {
    let lang = this.options.language;
    return lang || '';
}

/** 
 * Set multi language 
 * @param {string} - ISO 3 language list separated by dash or comma eg: ENG-FRA
 */
R2L.setMultiLanguage = function (multiLanguage) {
    if (multiLanguage) {
        multiLanguage = String(multiLanguage).replace(/,/g, "-");
    }
    this.options.multiLanguage = multiLanguage;
}

/** 
 * Get current multi-language
 * @returns {String} - ISO 3 language list separated by dash eg: ENG-FRA (or empty string)
 */
R2L.getMultiLanguage = function () {
    let lang = this.options.multiLanguage;
    return lang || '';
}

R2L.registerWorker = function () {
    if (this.worker || !window.Worker) {
        return false;
    }

    // URL.createObjectURL
    window.URL = window.URL || window.webkitURL;

    let response = `
    self.addEventListener('message', function(event) {
        var matches = [];
        while((args = event.data.pattern.exec(event.data.text))) {
            matches.push({
                args: args,
                lastIndex: event.data.pattern.lastIndex
            });
        }
        postMessage({ uuid: event.data.uuid, text: event.data.text, matches: matches });
    });`;

    let blob;
    try {
        blob = new Blob([response], { type: 'application/javascript' });
    }
    catch (e) { // Backwards-compatibility
        window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
        blob = new BlobBuilder();
        blob.append(response);
        blob = blob.getBlob();
    }

    // init worker
    this.worker = new Worker(URL.createObjectURL(blob));
    this.worker.onmessage = function (e) {
        if (e.data) {
            sharedCtx.setMatches(e.data.uuid, e.data.text, e.data.matches);
            sharedCtx.callback(e.data.uuid, e.data.text);
            sharedCtx.reset(e.data.uuid);
        }
    };
};

R2L.destroyWorker = function () {
    if (this.worker) {
        this.worker.terminate();
        this.worker = null;
    }
}


/**
 * Utility function used by the `R2L.parse()` API to resolve a promise with data 
 */
function resolver(format, text, matches, resolve) {
    // send results
    switch (format) {
        case "html":
            if (R2L.options && R2L.options.metadata) { // linked data is enabled?
                R2L.loadMetadata(R2L.getNodes(matches)).then((linkedData) => {
                    resolve(R2L.formatters.html(matches, text, linkedData));
                }).catch(e => {
                    console.error("Failed to load metadata", e);
                    resolve(R2L.formatters.html(matches, text, {}));
                });
            }
            else {
                resolve(R2L.formatters.html(matches, text));
            }

            break;
        case "xml":
            // no linked-data
            resolve(R2L.formatters.xml(matches, text));
            break;
        case "json":
            if (R2L.options && R2L.options.metadata) { // linked data is enabled?
                R2L.loadMetadata(R2L.getNodes(matches)).then((linkedData) => {
                    resolve(R2L.formatters.json(matches, text)); // will include linked data 
                }).catch(e => {
                    console.error("Failed to load metadata", e);
                    resolve(R2L.formatters.json(matches, text));
                });
            }
            else {
                resolve(R2L.formatters.json(matches, text));
            }
            break;
        default:
            resolve(text);
            break;
    }
}

export {
    R2L
};
