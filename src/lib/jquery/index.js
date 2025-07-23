import { $ } from '../jquery.js';
import { orderSorter, bindTooltips } from '../ux/index.js';
import { getReferences, mergeMatches, getUuid } from '../utils/functions.js';
import { _replaceHtmlInNode, clearTextCaches, clearExtracts, getExtracts, replaceDOMNodes } from '../utils/processor.js';
import { replaceAliases, replaceAliasMatches } from '../alias/index.js';
import { settings } from '../settings/index.js';
import { sharedCtx } from '../utils/shared.js';


export function clearTooltips() {
    $('.ref2link-tooltip').remove();
}

export const R2L_INITIAL_DATA_ATTR = "initial";

/**
 * Binds the JQuery API to the `$` prototype, allowing users to call Ref2Link-specific methods on JQuery nodes:
 *   $('.selector').parseDeferred()
 *  
 * @param {Object} R2L 
 */
export function bindJquery(R2L) {

    /**
     * Parses one JQuery object with a set of rules
     * @param {Array} rules
     * @param {Boolean} useWorker - whether to use the WebWorker (needs to be enabled)
     * @param {Boolean} withLinkedData - whether to preload metadata (needs to be enabled)
     * @returns {Promise<JQuery>} 
     */
    $.fn.parseReferences = function (rules, useWorker, withLinkedData) {
        rules = rules || R2L.getRules();
        clearTooltips();
        // reset extracts (keep last 30 seconds extracts to avoid removing items from a parallel search)
        clearExtracts(30000);
        console.debug("Extracts size", getExtracts());

        bindTooltips(R2L);
        let $self = $(this);
        let initialContent = $self.html();
        $self.data(R2L_INITIAL_DATA_ATTR, initialContent);

        let html = '';
        $self.each(function () {
            // REFTOLINK-1367 - use tabs instead of spaces
            html += $(this).html() + "\t";
        });

        /** Guard checks optimization */
        rules = R2L.runGuards(html, rules);
        let globalRule = R2L.compileGlobalRule(rules);

        if (useWorker && R2L.worker) {
            return new Promise(function (resolve, reject) {

                let uuid = getUuid();

                sharedCtx.setCallback(uuid, html, function () {
                    let promises = [];

                    // if aliases are enabled we parse each node separately inside parseNodeReferences()
                    (R2L.options.aliases ? Promise.resolve({}) : R2L.applyGlobalRule(html, globalRule)).then(matches => {
                        $self.each(function () {
                            promises.push($(this).parseNodeReferences(matches));
                        });

                        Promise.all(promises).then(values => {
                            if (R2L.options.metadata && withLinkedData) {
                                setTimeout(() => {
                                    R2L.loadMetadata($self.getFormattedReferences("json").result).then(result => {
                                        resolve($self);
                                    }).catch((e) => {
                                        console.error(e);
                                        resolve($self);
                                    });
                                }, 0);
                            }
                            else {
                                resolve($self);
                            }
                        });
                    });
                });

                R2L.worker.postMessage({
                    text: html,
                    uuid: uuid,
                    pattern: globalRule.pattern
                });
            });
        }
        else {
            return new Promise((resolve, reject) => {
                let promises = [];
                (R2L.options.aliases ? Promise.resolve({}) : R2L.applyGlobalRule(html, globalRule)).then(matches => {
                    $self.each(function () {
                        promises.push($(this).parseNodeReferences(matches));
                    });
                    Promise.all(promises).then(() => {
                        if (R2L.options.metadata && withLinkedData) {
                            setTimeout(() => {
                                R2L.loadMetadata($self.getFormattedReferences("json").result).then(result => {
                                    resolve($self);
                                }).catch((e) => {
                                    console.error(e);
                                    resolve($self);
                                });
                            }, 0);
                        }
                        else {
                            resolve($self);
                        }
                    });
                });
            })
        }
    };

    /**
     * Performs the replacement of parsed content into a JQuery node
     * Runs an extra parse operation if aliases are enabled
     * @param {Object} matches 
     * @returns {Promise<JQuery>}
     */
    $.fn.parseNodeReferences = function (matches) {
        return new Promise((resolve, reject) => {
            let $self = $(this);

            if (!R2L.options.aliases) {
                //already parsed
                $self = $(R2L.replaceDOM($self[0], matches));
                $self.attr(settings.parsedAttribute);
                resolve(this);
                return;
            }
            else {
                let replaceAliasesResult;
                R2L.alias.getAIAliases($self.text()).then(localAliasItems => {
                    console.debug("AI aliases", localAliasItems);
                    let localAliasMap = {};
                    localAliasItems.forEach(item => {
                        localAliasMap[item.context] = item.act;
                    });

                    // when running on multiple nodes we should be careful about race conditions
                    R2L.alias.resetLocal();
                    R2L.alias.addLocal(localAliasMap);
                    // parsing will follow
                    let html = $self.html();
                    replaceAliasesResult = replaceAliases(html, getExtracts());
                    let tempHtml = replaceAliasesResult.text;

                    let rules = R2L.getRules();
                    rules = R2L.runGuards(tempHtml, rules);
                    let globalRule = R2L.compileGlobalRule(rules);

                    return R2L.applyGlobalRule(tempHtml, globalRule, true);
                }).then(newMatches => {
                    newMatches = replaceAliasMatches(newMatches, replaceAliasesResult);
                    R2L.setGlobalMatches(newMatches);
                    $self = $(R2L.replaceDOM($self[0], newMatches));

                    $self.attr(settings.parsedAttribute);
                    resolve(this);
                });
            }
        });
    };

    $.fn.reverse = $.fn.reverse || [].reverse;

    /**
     * @returns {Array<Object>} 
     */
    $.fn.getReferences = function () {
        var inTextMatches = getReferences.call(this);
        var asArray = [];
        Object.keys(inTextMatches || {}).forEach((_matchKey) => {
            asArray.push(inTextMatches[_matchKey]);
        });

        return asArray;
    };

    /**
     * Returns formatted references object (json/xml/html)
     * @param {String} format 
     * @returns {Object}
     */
    $.fn.getFormattedReferences = function (format) {
        format = format || 'identity';
        var formatter = format,
            references = $(this).getReferences();
        ;
        if (Object.prototype.toString.call(format) === "[object String]") {
            formatter = R2L.formatters[format];
        }

        return formatter(references, $(this).data(R2L_INITIAL_DATA_ATTR) || "");
    };

    $.fn.setAlternative = function (alternative) {
        R2L.setAlternative.call(R2L, this, alternative);
    };

    $.fn.removeReference = function () {
        return R2L.removeReference(this);
    };

    $.fn.getR2L = function () {
        return R2L;
    };

    $.fn.setRef2linkMatch = function (ref2link) {
        var isMultiple = 0;

        ref2link.alternatives.sort(orderSorter);

        for (var i = 0; i < ref2link.alternatives.length; i++) {
            isMultiple++;
            if (isMultiple >= 2) {
                break;
            }
        };

        $(this).data(R2L.settings.dataAttribute, ref2link);

        if (isMultiple >= 2) {
            $(this).addClass(settings.multipleGeneratedClassName);
        }

        return $(this).addClass(settings.generatedClassName);
    };

    $.fn.getRef2linkMatch = function () {
        var $this = $(this),
            ref2link = $this.data(R2L.settings.dataAttribute) || {};

        if ($.isEmptyObject(ref2link)) {
            ref2link = R2L.getGlobalMatch($this.attr(R2L.dataRef2linkInitialAttribute), $this.attr(R2L.dataRef2linkContextAttribute));
        }

        if ($.isEmptyObject(ref2link)) { /** not parsed or no matches */
            return ref2link;
        }

        ref2link.reference = ref2link.hasOwnProperty('match')
            ? ref2link.match
            : $this.html();

        return ref2link;
    };

    $.fn.unparseTextRules = function () {
        /** undo all links with their initial full match */
        ($(this).is(`.${settings.generatedClassName}`) ? $(this) : $(this).find(`.${settings.generatedClassName}`)).each(function () {
            var $ref2linkContainer = $(this).parentsUntil(`:not(.${settings.generatedClassName})`);

            if (!$ref2linkContainer.length) {
                $ref2linkContainer = $(this);
            }

            var reference = $ref2linkContainer.attr(R2L.settings.dataInitialAttribute);
            $(this).replaceWith(reference);
        });

        clearTextCaches();
        clearTooltips();
    };

    /**
     * Wrapper parser of multiple JQuery objects with a set of rules
     * Will also load linked-data (asynchronously) if the option is enabled
     * @param {Array} rules
     * @returns {Array<Promise<JQuery>>} 
     */
    $.fn.parseDeferred = function (rules) {
        if (!Array.isArray(rules) || !rules.length) {
            rules = R2L.getRules();
        }
        let s = (new Date()).getTime();

        let stack = [];
        // store the element 
        R2L.$el = $(this);

        $(this).each(function () {
            var self = this,
                $self = $(self);

            let p = new Promise(function (resolve, reject) {
                if ($(self).is(`[${settings.parsedAttribute}]`)) {
                    return reject(false);
                }

                let text = $self.html();
                setTimeout(function () {
                    $self.parseReferences(rules, R2L.worker ? true : false).then(($el) => {
                        $(self)
                            .trigger('before-replace.ref2link')
                            .attr(settings.parsedAttribute, true)
                            .trigger('after-replace.ref2link');

                        resolve($(self));
                    });
                }, 1);
            })

            stack.push(p);
        });

        stack = stack.map((promise) => {
            let resolver, rejecter;
            let parser = new Promise(function (resolve, reject) {
                resolver = resolve;
                rejecter = reject;
            });

            return {
                p: promise,
                resolver: resolver,
                rejecter: rejecter,
                parser: parser
            }
        });

        let elements = [...stack];

        Promise.all(stack.map(item => item.p)).then(function (values) {
            setTimeout(function () { /** now that processing has finished reset parsed nodes status */
                $(`[${settings.parsedAttribute}]`).addClass('ref2link-container').removeAttr(settings.parsedAttribute);

                let duration = (new Date()).getTime() - s;
                console.log('Parsed in ', duration, 'ms');

                elements.forEach((p, index) => {
                    p.resolver(values[index]);
                });

                // linked data is fetched independently from the parsing 
                if (R2L.options.metadata) {
                    setTimeout(() => {
                        R2L.loadMetadata(R2L.getFormattedReferences("json").result).then(result => {
                            $(document).trigger('ref2link.ld', true);
                        }).catch((e) => {
                            $(document).trigger('ref2link.ld', false);
                            console.error(e);
                        });
                    }, 0);
                }
            }, 0);
        });

        return stack.map(item => item.parser);
    };

    $.fn.parseTextRules = $.fn.parseDeferred;
}