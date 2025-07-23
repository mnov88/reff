import { $ } from '../jquery.js';
import { buildDocumentObject, getLookAhead, getLookBehind, getTextNodesIn, hasTags, regExpEscape } from "./functions.js";
import { letters } from "./letters.js";
import { getOffsetMap } from "./list.js";


export function _replaceTextInNode(node, search, replacement) {

    let newTextContent = node.textContent.replace(new RegExp(regExpEscape(search), 'g'), replacement); // only set the prop when updated to avoid re-drawing
    if (newTextContent !== node.textContent) {
        node.textContent = newTextContent;
    }
    return node;
}

export function _replaceHtmlInNode(node, search, replacement) {

    let newInnerHTML = node.innerHTML.replace(new RegExp(regExpEscape(search), 'g'), replacement); // only set the prop when updated to avoid re-drawing
    if (newInnerHTML !== node.innerHTML) {
        node.innerHTML = newInnerHTML;
    }
    return node;
}

/**
 * Text replace function; Works on both raw text and HTML input which will require building a DOM tree and replacing only leaf text nodes;
 * Replaces only where the search string is neighboured by boundaries
 * @param {String} toReplace
 * @param {String} replacement
 * @param {String} context
 * @param {Boolean} allowAttribute
 * @param {Boolean} isMain
 * @param {Array<HTMLElement>} prevTextNodes - array of text nodes (leaf nodes) extracted from input (to be reused by subsequent calls)
 * @param {HTMLElement} prevCtx - wrapper node (to be reused by subsequent calls)
 *
 * @returns {Object}  
 *   { 
 *     content: replaced text,
 *     textNodes: HTML nodes parsed from input (used for caching) 
 *     ctx: HTML element wrapper (used for caching)
 *   }
 */
export function replaceBoundariedWords(toReplace, replacement, context, allowAttribute, isMain, prevTextNodes, prevCtx) {
    if (allowAttribute !== false) {
        allowAttribute = true;
    }

    var letterPattern = "[/0-9" + letters.latin + letters.cyrillic + letters.greek + letters.specialChars + (allowAttribute ? '' : '"') + "]";
    var lookahead = getLookAhead(letterPattern);
    var lookbehind = getLookBehind(letterPattern);
    toReplace = lookbehind + toReplace + lookahead;

    // doc can be an HTMLElement or an HTMLDocument (with body)
    let doc = prevCtx;
    if (R2L.settings.htmlMode && isMain && (prevCtx || (hasTags(context) && (doc = buildDocumentObject(context))))) {
        // we parse the HTML content so we need to only replace text while preserving attributes
        try {
            let textNodes = prevTextNodes || getTextNodesIn(doc.body || doc, false);

            let i = textNodes.length;
            let node;

            let escapedToReplace = toReplace.replace(/&nbsp;/g, String.fromCharCode(160)).replace(/&amp;/g, "&");
            let escapedReplacement = replacement.replace(/&nbsp;/g, String.fromCharCode(160)).replace(/&amp;/g, "&");

            let toReplaceRegexp = new RegExp(escapedToReplace, 'g');
            while (i--) {
                node = textNodes[i]; // handle &nbsp; in textContent

                let newTextContent = (node.r2lTextContent || node.textContent).replace(toReplaceRegexp, escapedReplacement); // only set the prop when updated to avoid re-drawing

                if (newTextContent !== node.textContent) {
                    node.r2lTextContent = newTextContent;
                }
            }

            return {
                toRender: true,
                content: null, // let the caller calculate content as it is a heavy computation
                ctx: doc,
                textNodes: textNodes
            }
        }
        catch (e) {
            //console.error(e, "Cannot be parsed as HTML content");
            // not HTML content, move on.
        }
    }

    return {
        ctx: prevCtx,
        content: context.replace(new RegExp(toReplace, 'g'), replacement)
    }
};

/**
 * Will replace detected references with <ref2link> nodes, operating on the current HTMLElement.
 * This preserves existing DOM events.
 * Used by the JQuery API only: $('.selector').parseDeferred();
 * 
 * @param {HTMLElement} node 
 * @param {Object} matches 
 * @returns {HTMLElement}
 */
export function replaceDOMNodes(node, matches) {
    let et1 = performance.now();
    console.log("Start replace DOMNodes", et1);
    var keys = Object.keys(matches);

    keys.sort(function (left, right) {
        return right.length - left.length;
    });

    var allOffsets = getOffsetMap(Object.values(matches));
    /** replace keys in descending order */
    var offsetKeys = Object.keys(allOffsets);
    offsetKeys.sort(function (a, b) {
        return a.length < b.length ? 1 : -1;
    });

    for (var oIndex = 0; oIndex < offsetKeys.length; oIndex++) {
        var offset = allOffsets[offsetKeys[oIndex]];
        var replacement = offsetKeys[oIndex];
        /** replace inside list in descending order **/
        offset.sort(function (a, b) {
            return a.match.length > b.match.length ? -1 : 1;
        });

        let allowAttribute = true;
        for (var k = 0; k < offset.length; k++) {
            if (offset[k].alternatives.length > 0) {
                let view = "";
                for (var l = 0; l < offset[k].alternatives.length; l++) {
                    var _alternative = offset[k].alternatives[l];
                    if (_alternative.view && _alternative.viewName !== "table") {
                        view = _alternative.view;
                        break;
                    }
                };
                if (!view) {
                    continue;
                }

                var $view = $('<div>' + view + '</div>');
                extract($view, R2L.settings.class, false);
                var viewHtml = $view.html();
                var search = offset[k].match;

                offset[k].alternatives.forEach(alt => {
                    if (alt.rule && alt.rule.allowAttribute === false) {
                        allowAttribute = false;
                    }
                })

                if (search.length > 0) {
                    replacement = replaceBoundariedWords(regExpEscape(search), viewHtml, replacement, allowAttribute, false, null, node).content;
                }
            }
        }

        /** replace all */
        let toReplace = regExpEscape(offsetKeys[oIndex]);

        let replacementResult = replaceBoundariedWords(toReplace, replacement, "", allowAttribute, true, null, node);
        node = replacementResult.ctx;

    };

    let et2 = performance.now();
    console.log("Stop replace DOMNodes", et2);
    return node;
}

/**
 * First step of replacement. Will replace the initial content with <ref2link oid="$id"></ref2link> nodes 
 * Used by the R2L programatic API eg: R2L.parse('<div><span>C-99/99</span></div>', 'html');
 * @param {String} html 
 * @param {Object} matches
 * 
 * @returns {String} - content with <ref2link></ref2link> nodes 
 */
export function replaceHtmlNodes(html, matches) {
    let _cachedTextNodes = null;
    let _cachedCtx = null;
    let _toRender = false;
    let _originalHtml = html;

    var keys = Object.keys(matches);

    keys.sort(function (left, right) {
        return right.length - left.length;
    });

    var allOffsets = getOffsetMap(Object.values(matches));
    /** replace keys in descending order */
    var offsetKeys = Object.keys(allOffsets);
    offsetKeys.sort(function (a, b) {
        return a.length < b.length ? 1 : -1;
    });

    for (var oIndex = 0; oIndex < offsetKeys.length; oIndex++) {
        var offset = allOffsets[offsetKeys[oIndex]];
        var replacement = offsetKeys[oIndex];
        /** replace inside list in descending order **/
        offset.sort(function (a, b) {
            return a.match.length > b.match.length ? -1 : 1;
        });

        let allowAttribute = true;
        for (var k = 0; k < offset.length; k++) {
            if (offset[k].alternatives.length > 0) {
                let view = "";
                for (var l = 0; l < offset[k].alternatives.length; l++) {
                    var _alternative = offset[k].alternatives[l];
                    if (_alternative.view && _alternative.viewName !== "table") {
                        view = _alternative.view;
                        break;
                    }
                };
                if (!view) {
                    continue;
                }

                var $view = $('<div>' + view + '</div>');
                extract($view, R2L.settings.class, false);
                var viewHtml = $view.html();
                var search = offset[k].match;

                offset[k].alternatives.forEach(alt => {
                    if (alt.rule && alt.rule.allowAttribute === false) {
                        allowAttribute = false;
                    }
                })

                if (search.length > 0) {
                    replacement = replaceBoundariedWords(regExpEscape(search), viewHtml, replacement, allowAttribute).content;
                }
            }
        }

        /** replace all */
        let toReplace = regExpEscape(offsetKeys[oIndex]);

        let replacementResult = replaceBoundariedWords(toReplace, replacement, html, allowAttribute, true, _cachedTextNodes, _cachedCtx);
        // content might be empty as we don't want to re-calculate after each replacement
        html = replacementResult.content;
        _toRender = replacementResult.toRender || false;
        // cache the tree (expensive to re-calculate after each ref replacement)
        _cachedTextNodes = replacementResult.textNodes;
        _cachedCtx = replacementResult.ctx;
    };

    // only render HTML output once for perf improvements
    if (_toRender && _cachedCtx && _cachedCtx.body) {

        // generate HTML from r2lTextContent props
        _cachedTextNodes.forEach(textNode => {
            if (textNode.r2lTextContent && textNode.r2lTextContent !== textNode.textContent) {
                textNode.textContent = textNode.r2lTextContent;
            }
        });

        // if  the input contains a <head> and <body> we replace only inside the <body> contents
        let bodyMatches = /<body[^>]*>([\s\S]*)<\/body>/gi.exec(_originalHtml);
        if (bodyMatches && bodyMatches[1]) {
            html = _originalHtml.replace(bodyMatches[1], _cachedCtx.body.innerHTML);
        }
        else {
            html = _cachedCtx.body.innerHTML;
        }
    }

    return html;
}

/**
 * 2nd step of the replacement: 
 *   - takes as input a string containing <ref2link-object> nodes and replaces them with the final links (from extracts)
 * @param {String} html 
 * @returns {String} html string with final links
 */
export function unExtractRaw(html) {
    let parsedHtml = html;
    if (html.indexOf('ref2link-object') === -1) {
        return parsedHtml;
    }

    for (let i = extracts.length - 1; i >= 0; i--) {
        let $node = extracts[i].$this;
        let outerHTML = $node.prop('outerHTML');
        let replacement = outerHTML;

        let search = new RegExp(`(?:<|&lt;)ref2link-object oid="${padCounter(i)}"(?:>|&gt;)(?:<|&lt;)/ref2link-object(?:>|&gt;)`, 'g');
        replacement = outerHTML;
        parsedHtml = parsedHtml.split(search).join(replacement);
    }
    return parsedHtml;
}

/**
 * Remove extracts 
 * @param {int} age - in miliseconds, remove only if all of them are older than `now() - age` 
 */
export function clearExtracts(age) {
    if (!age) {
        extracts = [];
    }
    let t = (new Date().getTime());
    let isExpired = extracts.filter(extract => {
        return t - extract.t < age;
    }).length === 0;
    if (isExpired) {
        extracts = [];
    }
}

// @deprecated
let textCaches = {};

// Used for pre-processing
let extracts = [];

export function clearTextCaches() {
    textCaches = {};
}

export function getExtracts() {
    return extracts;
}

export function padCounter(counter) {
    return 'N' + counter + 'N';
};

export function unpadCounter(paddedCounter) {
    return ("" + paddedCounter).substr(1, paddedCounter.length - 1);
};

export function extract($node, selector, whole) {
    var extractCounter = extracts.length;
    $node.find(selector).each(function () {
        var $this = $(this),
            html = '<ref2link-object oid="' + padCounter(extractCounter) + '">'
            ;
        if (whole) {
            html += $this.html();
        }
        html += '</ref2link-object>';
        $this.replaceWith(html);
        var e = {
            $this: $this,
            whole: whole,
            t: (new Date().getTime())
        };

        extracts.push(e);
        extractCounter++;
    });
};

let _tempEl = document.createElement("p");

/**
 * Used only by the JQuery API to operate on DOM nodes 
 * Example: $('.selector').parseReferences();
 * 
 * @param {HTMLElement} node 
 * @returns {HTMLElement}
 */
export function unExtractNode(node) {

    let textNodes = getTextNodesIn(node, false);

    let j = textNodes.length;

    while (j--) {
        // we use a new prop to mark that the node needs Ref2Link treatment
        let initialTextContent = textNodes[j].r2lTextContent;

        if (!initialTextContent) {
            continue;
        }
        else {
            _tempEl = _tempEl || document.createElement("p");
            _tempEl.textContent = initialTextContent;

            // We need the HTML encoded data
            let convertedTextContent = _tempEl.innerHTML;
            textNodes[j].innerHTML = convertedTextContent;

            for (let i = extracts.length - 1; i >= 0; i--) {
                let $node = extracts[i].$this;
                let outerHTML = $node.prop('outerHTML');
                let replacement = outerHTML;

                let search = `&lt;ref2link-object oid="${padCounter(i)}"&gt;&lt;/ref2link-object&gt;`;
                replacement = outerHTML;

                textNodes[j] = _replaceHtmlInNode(textNodes[j], search, replacement);
            }

            // if the textNode has links we re-create the children
            let span = document.createElement("span")
            span.innerHTML = textNodes[j].innerHTML;
            span.childNodes.forEach(childNode => {
                let newNode = childNode.cloneNode(true);
                textNodes[j].parentNode.insertBefore(newNode, textNodes[j]);
            });
            textNodes[j].parentNode.removeChild(textNodes[j]);

            delete textNodes[j].r2lTextContent;
        }
    }

    return node;
}


