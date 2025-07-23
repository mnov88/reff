import { $ } from '../jquery.js';
import { letters } from '../utils/letters.js';
import { Base64 } from '../utils/base64.js';
import { orderSorter } from '../ux/index.js';
import { converters } from '../utils/converters.js';
import LZString from '../utils/lzstring.js';
import { getListCore, cloneListIdentifiers, cloneListCore } from '../utils/list.js';
import { regExpEscape, getNonCapturingPattern, getLookAhead, getLookBehind, supportNegativeLookbehind, extractAttributes, intersect, getUuid } from '../utils/functions.js';

/**
 * Internal variables to store rules/patterns
 */
let _ref2linkRules = [];
let _runtimeRules = [];
let _namedPatterns = {};

export function clearRuntimeRules() {
    _runtimeRules = [];
}

export function clearRef2LinkRules() {
    _ref2linkRules = [];
}

/**
 * Binds the API functions to work with rules
 * @param {Object} R2L 
 */
export function bindRules(R2L) {

    let rK, rV;
    try {
        rK = JSON.parse(R2L.getConstant("R2L_RULE_MAP"));
        rV = JSON.parse(R2L.getConstant("R2L_VIEW_MAP"));
    }
    catch (e) {
        rK = {};
        rV = {};
        console.error(e);
    }

    R2L.compileGlobalRule = function (rules) {
        var patterns = [];
        var offset = 0;
        rules.forEach(function (_rule) {
            if (_rule.hasOwnProperty('views') && _rule.views && _rule.views.hasOwnProperty('length') && _rule.views.length) {
                offset += parseInt(_rule.slots);
                var p = '' + (_rule.fullPattern.source || _rule.fullPattern);
                var nonCapturing = R2L.getNonCapturingPattern(p);
                nonCapturing = nonCapturing.replace('{$i}', offset);
                patterns.push('(' + nonCapturing + ')');
            }
        });
        var joinedPattern = '(?:' + patterns.join('|') + ')';
        var letterPattern = "[/0-9" + letters.latin + letters.cyrillic + letters.greek + letters.specialChars + "]";
        var lookahead = getLookAhead(letterPattern);
        var lookbehind = getLookBehind(letterPattern);

        return {
            'pattern': new RegExp('(?![\r\n\v\f])' + lookbehind + joinedPattern + lookahead, 'ig'),
            'rules': rules
        };
    };

    R2L.addRules = function (rules) {
        // Only IE11 lacks Regex negative lookbehind - still in use in Word2016
        let hasNegativeLookbehind = supportNegativeLookbehind();
        console.debug("Negative lookbehind support", hasNegativeLookbehind);

        _runtimeRules = [];
        rules.forEach(function (_rule) {
            // Our patterns use negative lookbehind for improved detection. 
            // If it is not supported by the underlying platform we need to remove these parts from the patterns as they will not compile.
            if (!hasNegativeLookbehind) {
                let r = new RegExp("\\(\\?<!((?!\\)).)+\\)", "g");
                //replace pattern
                _rule.p = _rule.p.replace(r, "");
                if (_rule.ip) {
                    //replace item pattern
                    _rule.ip = _rule.ip.replace(r, "");
                }
            }
            R2L.addRule(_rule);
        });

        R2L.getAllRules().map(rule => {
            // append common targets if needed
            if (rule.commonRules.length > 0) {

                rule.views = rule.views.map(v => {
                    v.common = false;
                    return v;
                });

                rule.commonRules.map(commonRuleType => {
                    let commonRule = R2L.getAllRules().filter(r => r.type === commonRuleType).pop();
                    let views = commonRule ? commonRule.views : null;
                    if (views) {
                        views = views.map(v => {
                            // common views have a flag
                            v.common = true;
                            return v;
                        });

                        rule.views = rule.views.concat(views);
                        if (rule.itemRule) {
                            rule.itemRule.views = rule.views;
                        }
                    }
                })
            }
            else {
                rule.views = rule.views.map(view => {
                    view.common = false;
                    return view;
                })
            }
        });
    };

    R2L.reloadRules = function () {
        _ref2linkRules = [];
        this.addRules(JSON.parse(LZString.decompressFromBase64(R2L.getConstant("R2L_TYPED_RULES"))));
    };

    R2L.addRule = function (ruleSpecs) {
        let rule = R2L.compileRule(ruleSpecs);
        if (!rule) {
            return;
        }
        rule.allowTitle = !!rule.allowTitle && R2L.options.enableSpecialRules;
        _ref2linkRules.push(rule);
        R2L.globalMatches = {};// at least one rule changed; reset all matches
    };

    R2L.getNamedRule = function (name) {
        if (_namedPatterns.hasOwnProperty(name)) {
            return _namedPatterns[name];
        }

        var namedRule;
        _ref2linkRules.forEach(function (rule, i) {
            if (rule.name === name) {
                namedRule = rule;
                return false;
            }
        });
        if (namedRule) {
            return namedRule;
        }

        return null;
    };

    R2L.getRules = function (filters) {
        if (!_runtimeRules.length) {
            _runtimeRules = R2L.getFilteredRules(filters || R2L.filters, true);
        }

        return _runtimeRules;
    };

    R2L.getAllRules = function () {
        return _ref2linkRules;
    }

    R2L.getConverterRules = function () {
        let rules = [];
        _ref2linkRules.forEach((_ref2linkRule) => {
            if (_ref2linkRule.converter) {
                rules.push(_ref2linkRule);
            }
        });
        return rules;
    };

    R2L.getFilteredRules = function (filters, includePublic) {
        let rules = [];
        _ref2linkRules.forEach((_ref2linkRule) => {
            if (!this.options.enableSpecialRules && _ref2linkRule.forced) {
                return;
            }

            if (_ref2linkRule.converter) {
                return;
            }

            /** filter rules */
            if (!filters.hasOwnProperty('types') || !filters.types || !filters.types.length || filters.types.indexOf(_ref2linkRule.type) >= 0) {
                var rule = Object.assign({}, _ref2linkRule),
                    views = [], foundView = false;
                rule.views = views;
                (_ref2linkRule.views || []).forEach((_view) => {
                    /** if filters types is false then include it if has the right env */
                    var isPublic = (includePublic && _view.environments.indexOf('*') >= 0),
                        hasEnv = (isPublic || !!intersect(filters.environments, _view.environments).length),
                        hasTarget = !filters.hasOwnProperty('targets') || !filters.targets || !filters.targets.length || filters.targets.indexOf(_view.target) >= 0,
                        isTargetAllowed = hasEnv && filters.types === false
                        ;
                    if ((hasEnv || isPublic) && (hasTarget || isTargetAllowed)) {
                        views.push(Object.assign({}, _view));
                        foundView = true;
                    }
                });

                // only table view - do not include rule
                if (views.length === 1 && views[0].target === "table") {
                    foundView = false;
                }

                if (foundView) {
                    views.sort(orderSorter);
                    rules.push(rule);
                }
            }
        });
        rules.sort(orderSorter);

        return rules;
    };


    R2L.getGlobalTypes = function () {
        var types = {};
        _ref2linkRules.forEach(function (_ref2linkRule) {
            if (!_ref2linkRule.type) {
                return;
            }

            types[_ref2linkRule.type] = _ref2linkRule.ruleLibelle || _ref2linkRule.name;
        });

        return types;
    };


    R2L.getGlobalTargets = function () {
        var targets = {};
        _ref2linkRules.forEach(function (_ref2linkRule) {
            _ref2linkRule.views.forEach(function (_view) {
                targets[_view.target] = _view.target;
            });
        });

        return targets;
    };

    R2L.getGlobalTypeTargets = function () {
        let data = {};
        _ref2linkRules.forEach(function (_ref2linkRule) {
            if (!_ref2linkRule.type) {
                return;
            }

            let type = _ref2linkRule.type;
            let label = _ref2linkRule.ruleLibelle || _ref2linkRule.name
            data[type] = [];
            _ref2linkRule.views.forEach(function (_view) {
                // we exclude the common views
                if (_ref2linkRule.common || !_view.common) {
                    data[type].push({ target: _view.target, label: label });
                }
            });
        });

        return data;
    };

    R2L.getBaseTypeTargets = function () {
        let data = {};
        _ref2linkRules.forEach(function (_ref2linkRule) {
            if (!_ref2linkRule.type) {
                return;
            }

            let baseType = _ref2linkRule.baseType || _ref2linkRule.type;
            let label = _ref2linkRule.baseLibelle || _ref2linkRule.ruleLibelle || _ref2linkRule.name;
            data[baseType] = data[baseType] || { targets: [], types: [], label: label };
            data[baseType].types.push(_ref2linkRule.type);
            _ref2linkRule.views.forEach(function (_view) {
                if (_ref2linkRule.common || !_view.common) {
                    data[baseType].targets.push({
                        target: _view.target,
                        baseTarget: _view.baseTarget,
                        baseLabel: label,
                        label: _ref2linkRule.ruleLibelle || _ref2linkRule.name
                    });
                }
            });
        });

        return data;
    };

    R2L.getFiltersWithDependencies = function () {
        var byEnv = {};
        var byRule = {};

        _ref2linkRules.forEach(function (_ref2linkRule) {
            var rule = _ref2linkRule;
            if (!byRule.hasOwnProperty(rule.type)) {
                byRule[rule.type] = [];
            }
            (_ref2linkRule.views || []).forEach(function (_view) {
                var view = _view;
                (_view.environments || []).forEach(function (_env) {
                    if (!byEnv.hasOwnProperty(_env)) {
                        byEnv[_env] = {
                            types: [],
                            targets: [],
                        }
                    }
                    if (byEnv[_env].types.indexOf(rule.type) < 0) {
                        byEnv[_env].types.push(rule.type);
                    }
                    if (byEnv[_env].targets.indexOf(view.target) < 0) {
                        byEnv[_env].targets.push(view.target);
                    }
                });
                byRule[rule.type].push(view.target);
            });
        });

        return {
            byEnvironment: byEnv,
            byRule: byRule
        };
    };

    R2L.getGlobalEnvironments = function () {
        var envs = {};
        _ref2linkRules.forEach(function (_ref2linkRule) {
            _ref2linkRule.views.forEach(function (_view) {
                _view.environments.forEach(function (_env) {
                    envs[_env] = _env;
                });
            });
        });
        envs['*'] = 'Public';

        return envs;
    };


    R2L.compileGuards = function (rules) {
        var map = {};
        for (var i = 0; i < rules.length; i++) {
            if (rules[i]["guard-pattern"]) {
                if (!map[rules[i]["guard-pattern"]]) {
                    map[rules[i]["guard-pattern"]] = { ruleTypes: [], found: false };
                }

                map[rules[i]["guard-pattern"]].ruleTypes.push(rules[i].type);
            }
        }
        return map;
    };

    /**
     * Optimize detection by dropping useless rules according to guard patterns.
     * Use case: 
     *   The EUR-Lex act rule has a guard pattern that looks for a (directive|regulation|resolution|common position) label in the input text. 
     *   If the input text does not contain this label it makes no sense to attempt matching the EUR-Lex act rule at all as it will definitely not find anything.
     *   This quick lookup for the label is very fast and can improve detection speed significantly.  
     * 
     * @see <guard-pattern> definitions in the XML rules (eg. `eurlex/rule_act.xml`)
     * 
     * @param string text
     * @param Object[] rules
     */
    R2L.runGuards = function (text, rules) {
        var letterPattern = "[0-9" + letters.latin + letters.cyrillic + letters.greek + letters.specialChars + "]";
        var lookahead = getLookAhead(letterPattern);
        var guards = this.compileGuards(rules);
        for (var pattern in guards) {
            var reg = new RegExp(pattern + lookahead, "i");
            if (!reg.test(text)) {
                rules = rules.filter(function (rule) {
                    return guards[pattern].ruleTypes.indexOf(rule.type) === -1;
                });
            }
        }

        console.debug("Guard check done");
        // applying pattern optimizers based on text. 
        // @see R2L.settings.patternOptimizers

        let t0 = performance.now();

        Object.keys(R2L.settings.patternOptimizers || {}).forEach(optimizerKey => {
            let optimizers = R2L.settings.patternOptimizers[optimizerKey];
            console.debug("[PATTERN OPTIMIZERS] Running for key:", optimizerKey);
            // Each optmizer runs only once
            let handled = false;
            optimizers.forEach(optimizer => {
                if (handled) {
                    return;
                }

                let found = optimizer.guardRegExp.test(text);
                console.debug("[PATTERN OPTIMIZERS] Found extended pattern?", found, optimizer.guardRegExp);
                if (found) {
                    return;
                }
                console.debug("[PATTERN OPTIMIZERS] Proceed with replacement");
                let searchRegExp = new RegExp(regExpEscape(optimizer.searchSubpattern), 'g');
                let replaceSubpattern = optimizer.replaceSubpattern;
                handled = true;
                rules = rules.map(rule => {
                    let newRule = { ...rule }; //deep copy
                    let replacedPatternSource = newRule.pattern.source.replace(searchRegExp, replaceSubpattern);
                    let replacedFullPatternSource = newRule.fullPattern.source.replace(searchRegExp, replaceSubpattern);
                    newRule.pattern = new RegExp(replacedPatternSource, newRule.pattern.flags);
                    newRule.fullPattern = new RegExp(replacedFullPatternSource, newRule.fullPattern.flags);

                    if (newRule["item-pattern"]) {
                        let replacedItemPattern = newRule["item-pattern"].replace(searchRegExp, replaceSubpattern);
                        newRule["item-pattern"] = replacedItemPattern;

                        // Update Item rule
                        if (newRule.itemRule) {
                            let replacedItemPatternSource = newRule.itemRule.pattern.source.replace(searchRegExp, replaceSubpattern);
                            let replacedFullItemPatternSource = newRule.itemRule.fullPattern.source.replace(searchRegExp, replaceSubpattern);
                            newRule.itemRule = { ...newRule.itemRule };// deep copy
                            newRule.itemRule.pattern = new RegExp(replacedItemPatternSource, newRule.itemRule.pattern.flags);
                            newRule.itemRule.fullPattern = new RegExp(replacedFullItemPatternSource, newRule.itemRule.fullPattern.flags);
                        }
                    }

                    // deep copy
                    return newRule;
                });
            });
        });

        console.debug("[PATTERN OPTIMIZERS] DONE", performance.now() - t0, "ms");

        return rules;
    };

    R2L.lintRule = function (rule) {
        var result = {
            warnings: [],
            errors: [],
        };
        try {
            rule.pattern = new RegExp(rule.pattern, "gm" + (rule.casesensitive ? '' : 'i'));
            if (rule.hasOwnProperty('fullPattern') && rule.fullPattern) {
                rule.fullPattern = new RegExp(rule.fullPattern, 'gm' + (rule.casesensitive ? '' : 'i'));
            }
        } catch (e) {
            if (
                ('' + e).toLowerCase().indexOf('invalid escape') >= 0
            ) {
                result.warnings.push('' + e);
            } else {
                result.errors.push('' + e);
            }
        }

        return result;
    };

    R2L.compileRule = function (rule, noUnpacking) {
        rule.allowTitle = rule.allowTitle && (R2L.options.enableSpecialRules !== false);
        var unpack = noUnpacking ? false : true;

        if (unpack) {
            var unpackedRule = {};
            Object.keys(rK).forEach(function (destKey) {
                unpackedRule[destKey] = rule[rK[destKey]];
            })

            if (unpackedRule.hasOwnProperty('views') && Array.isArray(unpackedRule.views)) {
                var unpackedViews = [], unpackedView;
                unpackedRule['views'].forEach(function (_view) {
                    var view = _view;
                    unpackedView = {};

                    Object.keys(rV).forEach(function (destKey) {
                        unpackedView[destKey] = view[rV[destKey]];
                    })

                    unpackedViews.push(unpackedView);
                });
                unpackedRule['views'] = unpackedViews;
            }
            rule = unpackedRule;
        }

        var linterResult = R2L.lintRule(rule);
        rule.errors = linterResult.errors;
        rule.warnings = linterResult.warnings;

        var fullPatternCompiler = function (rule) {
            if (rule.hasOwnProperty('type') && rule.type) {
                rule.allowTitle = !!rule.allowTitle && R2L.options.enableSpecialRules;
                var forced = rule.hasOwnProperty('forced') && rule.forced ? '' : '?';
                var typePattern = '(' + ((rule.forced && !R2L.options.enableSpecialRules) ? '1jf9jqgk' : regExpEscape(rule.type)) + ')';
                var simplifiedPattern = getNonCapturingPattern(rule.pattern.source || rule.pattern);
                var titlePattern = '[^\\]]+?';
                var beginning = rule.allowTitle ? ('\\[' + forced) : '';
                var ending = rule.allowTitle ? ('\\]' + forced) : '';

                /**
                 * $1 - type, $2 - match, $3 - title, $4 - match
                 */
                var expr = '(?:' + typePattern + forced +
                    '(?:' +
                    '(?:' +
                    '\\[' +
                    '(' + (rule.allowTitle ? simplifiedPattern : 'm2CVjK') + ')' +
                    '\\s?\\|\\s?' +
                    '(' + titlePattern + ')' +
                    '\\s?\\]' +
                    ')' +
                    '|' +
                    '(?:' +
                    beginning +
                    '(' + simplifiedPattern + ')' +
                    ending +
                    ')' +
                    ')' +
                    ')';

                try {
                    return new RegExp(expr, 'gi');
                }
                catch (e) {
                    console.error(rule.type, e);
                    return null;
                }
            }

            return rule.pattern;
        };

        rule.fullPattern = fullPatternCompiler(rule);
        if (!rule.fullPattern) {
            return null;
        }

        rule.matches = function (text) {
            return rule.pattern.test(text);
        };

        if (rule["item-pattern"]) {
            rule.itemRule = R2L.compileRule({
                name: rule.name + '-item',
                pattern: rule["item-pattern"],
                skipPattern: rule["skip-pattern"],
                trimPattern: rule["trim-pattern"],
                fullPattern: fullPatternCompiler({ force: rule.itemForced, pattern: rule['item-pattern'] }),
                type: rule['itemType'],
                ld: rule['ld'],
                baseType: rule["baseType"],
                baseLibelle: rule["baseLibelle"],
                forced: rule['itemForced'],
                ruleLibelle: rule["ruleLibelle"] + ' item',
                prefix: rule["prefix"],
                skip: rule["skip"],
                vars: rule["vars"],
                identifiers: rule["identifiers"],
                coreIdentifiers: rule["coreIdentifiers"],
                commonRules: rule["commonRules"],
                shared: rule["shared"],
                views: rule.views,
                isListItem: true
            }, true);
        }

        if (rule.hasOwnProperty('views') && Array.isArray(rule.views)) {
            rule.views.sort(orderSorter);
            rule.views.forEach(function (_view) {
                // use R2L.converters.* to prefix functions
                let converterNames = Object.keys(converters).sort((a, b) => {
                    return a.length > b.length ? -1 : 1;
                });

                if (_view.template !== "function(){return '{{ $match }}';}") {
                    if (typeof _view.template === 'string') {
                        converterNames.forEach((converterName) => {
                            _view.template = _view.template.replace(new RegExp('(?<!\\.)' + converterName + '\\(', 'g'), 'R2L.converters.' + converterName + '(');
                        });
                    }
                    try {
                        eval(' _view.template = function(){ return (' + _view.template + ').apply(this, arguments);}');
                    }
                    catch (e) {
                        console.error(e);
                        throw e;
                    }
                }
                else {
                    _view.template = function () {
                        return arguments;
                    };
                }

                if (_view.hasOwnProperty('condition')) {
                    if (typeof _view.condition === 'string') {
                        converterNames.forEach((converterName) => {
                            _view.condition = _view.condition.replace(new RegExp('(?<!\\.)' + converterName + '\\(', 'g'), 'R2L.converters.' + converterName + '(');
                        });
                    }

                    try {
                        eval('_view.condition = function(){ return (' +
                            (_view.condition ? _view.condition : 'function(){return true;}') +
                            ').apply(this, arguments);}');
                    }
                    catch (e) {
                        console.error(e);
                        throw e;
                    }
                }
                else {
                    _view.condition = function () {
                        return true;
                    }
                }

            });
        }

        rule.compiled = true;
        return rule;
    };


    R2L.applyRule = function (text, rule, overrideTitle, wholeMatch, history, overrideMatches) {
        var rawReference = text.trim();
        wholeMatch = wholeMatch.trim();

        var p = rule.pattern.source;
        if (rule.forced) {
            p = '(?:' + rule.type + '\\s*\\[\\s*(?:' + p + '(?:\\s*\\|\\s*(?:[^\\]]+))?' + ')\\s*\\])';
        }

        var pattern = new RegExp(p, 'gm' + (rule.casesensitive ? '' : 'i')),
            args = overrideMatches ? overrideMatches : pattern.exec(rawReference),
            ref2link = {
                rule: rule,
                match: rawReference,
                views: {},
                alternatives: [],
                matches: [],
                offsets: [],
                counter: 0,
                reference: text,
                link: overrideTitle || text,
                wholeMatch: wholeMatch || text,
            }
            ;
        if (!args) {
            return null;
        }

        ref2link.reference = args[1];
        ref2link.matches = args;

        if (history.length > 0) {
            for (var index = history.length - 1; index >= 0; index--) {
                var listRef = getListCore(history[index].rule, history[index].matches);
                if (listRef.length > 0) {
                    cloneListCore(history[index], ref2link);
                    cloneListIdentifiers(history[index], ref2link);
                    break;
                }
            }

            args = ref2link.matches;
        }

        /** Could be an inverted list so if the item still has no prefix/data don't bother */
        if (rule.isListItem) {
            var listRef = getListCore(rule, ref2link.matches);
            if (listRef.length === 0) {
                /** Cannot render item, we need to get to the end of the list */
                return ref2link;
            }
        }

        rule.views.sort(orderSorter);
        let contextObj = {
            data: {}
        };

        rule.views.forEach(function (_view) {
            let viewName = _view.target;
            let isEnabled = (intersect(R2L.filters.environments, _view.environments).length || _view.environments.indexOf('*') >= 0)
                && (!R2L.filters.targets || !R2L.filters.targets.length || R2L.filters.targets.indexOf(_view.target) >= 0)
                && (!R2L.filters.types || !R2L.filters.types.length || R2L.filters.types.indexOf(rule.type) >= 0)
                ;

            // Check if there are any custom target options to be applied
            let _currentViewAttributes = R2L.getViewAttributes(_view.baseTarget || _view.target);

            if (isEnabled && _view.condition.apply(contextObj, args)) {
                ref2link.views[viewName] = _view.template.apply(contextObj, args);

                // append the attributes of the view to the args so they can be subsequently reused
                let attributes = extractAttributes(Object.values(ref2link.views));
                Object.keys(attributes).forEach(key => {
                    let cleanKey = key.replace('data-ref-', '');
                    cleanKey = cleanKey.replace('data-', '');
                    contextObj.data[cleanKey] = attributes[key];
                })

                /**                
                 * keep a map of initial match and what was rendered
                 * han and curiaj rule render something different than it matches
                 */
                let $rendered = $('<div></div>').append(ref2link.views[viewName]),
                    renderedText
                    ;

                $rendered
                    .find(R2L.settings.classSimple)
                    .each(function () {
                        let $view = $(this);
                        $view.addClass(R2L.settings.generatedClassName);
                        $view.attr('id', 'r2l-' + getUuid());
                        R2L.linkClassName && $view.addClass(R2L.linkClassName);
                        if (R2L.viewUsesTarget) {
                            ($view.is(R2L.settings.classSimple) ? $view : $view.find(R2L.settings.classSimple)).attr('target', '_blank');
                        } else {
                            ($view.is(R2L.settings.classSimple) ? $view : $view.find(R2L.settings.classSimple)).removeAttr('target');
                        }
                        if ((R2L.viewTitlePrefix || R2L.viewTitleSuffix) && $view.attr('title')) {
                            let titleParts = [
                                (R2L.viewTitlePrefix || '').toString(),
                                $view.attr('title').toString(),
                                (R2L.viewTitleSuffix || '').toString()
                            ];
                            $view.attr('title', titleParts.join(' ').trim());
                        }
                        if (overrideTitle) {
                            ($view.is(R2L.settings.classSimple) ? $view : $view.find(R2L.settings.classSimple)).html(overrideTitle);
                        }

                        $view.attr(R2L.settings.dataInitialAttribute, wholeMatch);
                        if (_currentViewAttributes && typeof _currentViewAttributes === 'object') {
                            Object.keys(_currentViewAttributes).forEach(key => {
                                $view.attr(key, _currentViewAttributes[key]);
                            })
                        }
                    })
                    ;

                ref2link.views[viewName] = $rendered.html();
                ref2link.alternatives.push({
                    rule: { ...rule, ...{ pattern: null, fullPattern: null } },
                    view: ref2link.views[viewName],
                    viewName: viewName,
                    match: text,
                    order: _view.order,
                    common: _view.common,
                    groupTarget: _view.groupTarget,
                    reference: args[1],
                    link: overrideTitle || text,
                    wholeMatch: wholeMatch || text,
                });
                renderedText = overrideTitle || $rendered.find('[href]').text();

                R2L.globalViews[renderedText] = wholeMatch || text;
            }
        });

        return ref2link;
    };


    R2L.getGlobalMatch = function (match, context) {
        return this.globalMatches[context] && this.globalMatches[context][match] ? this.globalMatches[context][match] : {};
    };

    R2L.setGlobalMatches = function (matches) {
        Object.keys(matches).forEach((_match) => {
            let offsets = matches[_match] ? matches[_match].offsets : [];
            for (let i = 0; i < offsets.length; i++) {
                let offset = offsets[i];
                if (!this.globalMatches[offset.context]) {
                    this.globalMatches[offset.context] = {};
                }


                /** Deep clone the match **/
                var newMatch = {
                    alternatives: offset.alternatives,
                    views: offset.views,
                    context: offset.context,
                    rule: { ...matches[_match].rule, ...{ pattern: null, fullPattern: null } }, //without patterns
                    match: matches[_match].match,
                    offsets: matches[_match].offsets,
                    reference: matches[_match].reference,
                };

                this.globalMatches[offset.context][offset.match] = newMatch;
            }
        });
    };

    try {
        R2L.addRules(JSON.parse(LZString.decompressFromBase64(R2L.getConstant("R2L_TYPED_RULES"))));
    }
    catch (e) {
        console.error(e);
    }
}