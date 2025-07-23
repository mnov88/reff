import { $ } from '../jquery.js';
import { orderSorter } from '../ux/index.js';
import { settings } from '../settings/index.js';

export function regExpEscape(pattern) {
    return pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export function xmlEscape(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

export function supportNegativeLookbehind() {
    try {
        var r = new RegExp("(?<!1)");
        return true;
    }
    catch (e) {
        return false;
    }
};

export function intersect(a, b) {
    var t;
    if (b.length > a.length) t = b, b = a, a = t; // indexOf to loop over shorter
    return a.filter(function (e) {
        return b.indexOf(e) > -1;
    });
};

export function getLookBehind(pattern) {
    return supportNegativeLookbehind() ? '(?<!' + pattern + ')' : '';
};

export function getLookAhead(pattern) {
    return '(?!' + pattern + ')';
};

export function delimiter2RegExp(delimiter) {
    var expr = null;
    if (Object.prototype.toString.call(delimiter) !== "[object RegExp]") {
        if (R2L.getNamedRule(delimiter)) {
            expr = R2L.getNamedRule(delimiter).pattern;
        }
        if (!expr && delimiter) {
            if (delimiter[0] === '/' && delimiter.length > 1) {
                var parts = delimiter.split('/');
                parts.shift();
                var modifiers = parts.pop();
                expr = new RegExp(parts.join('/'), modifiers);
            }
        }
        if (!expr && delimiter) {
            expr = new RegExp(regExpEscape(delimiter), 'gi');
        }
    } else {
        expr = delimiter;
    }

    return expr;
};


let _div;
/**
 * Sanitizes a string to make sure it does not contain HTML markup;
 * @param {String} str 
 * @returns {String} HTML encoded string
 */
export function sanitizeHtml(str) {
    str = String(str);
    // reuse DOM Element instead of creating a new one every time this function is called
    _div = _div || document.createElement('div');
    _div.innerHTML = str;
    return _div.textContent;
}

export function simpleParse(tpl, data) {
    return tpl.replace(/\{\{\s*\$([^}]{1,50}?)\s*\}\}/ig, function (match, varName) {
        return varName && data.hasOwnProperty(varName) ? data[varName] : '';
    });
};

export function getNonCapturingPattern(pattern) {
    return pattern.replace(/\((?!\?[<!=:])/g, function (match, position) {
        if (position > 3) {
            if ((pattern[position - 3] + pattern[position - 2] + pattern[position - 1]) === '(?=') {
                return match;
            }
        }
        if (position == 0 || (position > 0 && pattern[position - 1] !== '\\')) {
            return '(?:';
        }

        return match;
    });
};

export function matchIdentity() {
    let match = {
        count: this.counter,
        match: this.match,
        wholeMatch: this.wholeMatch,
        type: this.rule.type,
        label: this.rule.ruleLibelle,
        views: [],
        rule: this.rule,
    },
        renderedViews = []
        ;

    this.alternatives.sort(orderSorter);
    let defaultRendered = false;
    this.alternatives.reverse.forEach(function (_alternative) {
        if (_alternative.viewName == '_default' || !String(_alternative.view || '').trim() || renderedViews.indexOf(_alternative.view) >= 0) {
            return;
        }
        match.views.push({
            target: _alternative.viewName,
            view: _alternative.view,
            _default: !defaultRendered,
            order: _alternative.order,
        });
        defaultRendered = true;
        renderedViews.push(_alternative.view);
    });

    return match;
}

export function identity(inTextMatches) {
    let result = [];

    Object.keys(inTextMatches || {}).forEach((_matchKey) => {
        result.push(matchIdentity.call(inTextMatches[_matchKey]));
    });

    return result;
};



export function getReferences() {
    let $this = $(this),
        inTextMatches = {},
        $ref2links = $this.find(`.${settings.generatedClassName}`);
    ;
    if (!$ref2links.length && !$($this).attr(settings.parsedAttribute)) {

        // parsing should already have happened
        return {};
    }

    $ref2links.each(function () {
        let reference = $(this).getRef2linkMatch();
        if (!reference || !reference.reference) {
            return;
        }

        if (!inTextMatches.hasOwnProperty(reference.reference)) {
            inTextMatches[reference.reference] = Object.assign({}, reference);
            inTextMatches[reference.reference].counter = 0;
        }
        else {
            // the reference offsets should already be grouped, but not in the case of aliases
            reference.offsets.forEach(offset => {
                let existing = inTextMatches[reference.reference].offsets.filter(o => o.position === offset.position).length > 0;
                if (!existing) {
                    inTextMatches[reference.reference].offsets.push(offset);
                }
            })
        }
        inTextMatches[reference.reference].counter++;
    });

    return inTextMatches;
};

export function mergeMatches(matches1, matches2) {
    Object.keys(matches1).forEach(key => {
        if (matches2[key]) {
            // add offsets
            matches1[key].offsets = matches1[key].offsets.concat(matches2[key].offsets);
            matches1[key].counter += matches2[key].counter;
        }
    });
    return { ...matches2, ...matches1 };
}

export function buildAttributesData(attributesList) {
    let data = {};
    // custom handling for CELEX ids
    let celexIds = [];

    attributesList.forEach((attrItem) => {
        let attrKey = attrItem.key;
        let attrValue = attrItem.value;
        let key = attrKey.replace("data-ref-", "");
        key = key.replace("data-", "");

        // a ref might have multiple (CELEX) ids (celex-1, celex-2 ...), add them all to an array
        if (key.match(/celex-\d+$/)) {
            celexIds.push(attrValue);
        }
        else {
            data[key] = attrValue;
            // add main celex id if any
            if (key === 'celex') {
                celexIds.push(data[key]);
            }
        }
    });

    if (celexIds.length > 0) {
        data['celexIds'] = celexIds.filter((value, index, array) => array.indexOf(value) === index);
        //REFTOLINK-1474
        data['celex'] = celexIds[0];
    }

    return data;
}

/**
 * Returns an ordered list of attribute data
 * @param {Array<Object>} alternatives 
 * @returns {Array<Object}
 */
export function extractOrderedAttributes(alternatives) {
    let attributes = [];
    let keys = [];
    alternatives.forEach(alternative => {
        if (alternative.viewName === "table") {
            return;
        }

        let view = alternative.view || "";
        if (!view) {
            return;
        }

        // extract attributes from HTML using a REGEX
        let regex = /\s(data-(?:[^=]+))="([^"]+)"/gi;

        var result;
        while ((result = regex.exec(view)) !== null) {
            if (!result) {
                continue;
            }

            let name = result[1] || "";
            let value = result[2] || "";
            if (name.slice(0, 4) !== 'data') {
                continue;
            }
            if (!value || value === "null") {
                continue;
            }

            if (keys.indexOf(name) === -1 && ['data-debug', 'data-ref2link-initial', 'data-ref2link-context'].indexOf(name) === -1) {
                attributes.push({ key: name, value: value });
                keys.push(name);
            }
        }
    });

    return attributes;
}

export function extractUrls(views) {
    let urls = [];
    Object.keys(views).forEach(function (_view) {
        if (_view === "table") {
            return;
        }

        let view = views[_view];
        if (!view) {
            return;
        }

        // extract attributes from HTML using a REGEX
        let regex = /\shref="([^"]+)"/gi;

        var result;
        while ((result = regex.exec(view)) !== null) {
            if (!result) {
                continue;
            }

            let url = result[1] || "";
            if (url) {
                urls.push(url);
            }
        }
    });

    return urls;
};


/**
 * Extract data-* attributes from views
 * @param {Array<Object>} views 
 * 
 * @returns {Object} map of attr => values
 */
export function extractAttributes(views) {
    let attributes = {};
    Object.keys(views).forEach(function (_view) {
        if (_view === "table") {
            return;
        }

        let view = views[_view];
        if (!view) {
            return;
        }

        // extract attributes from HTML using a REGEX
        let regex = /\s(data-(?:[^=]+))="([^"]+)"/gi;

        var result;
        while ((result = regex.exec(view)) !== null) {
            if (!result) {
                continue;
            }

            let name = result[1] || "";
            let value = result[2] || "";
            if (name.slice(0, 4) !== 'data') {
                continue;
            }
            if (!value || value === "null") {
                continue;
            }

            if (['data-debug', 'data-ref2link-initial', 'data-ref2link-context'].indexOf(name) === -1) {
                attributes[name] = value;
            }
        }
    });

    return attributes;
};

/**
 * Remove CELEX suffixes `-0`, `-1` from attributes `data-ref-celex-0`, `data-ref-celex-1` ...
 * @param {Object} attributes
 * 
 * @return {Object}  
 */
export function cleanAttributes(attributes) {
    let newAttributes = {};
    Object.keys(attributes).reverse().forEach(key => {
        newAttributes[key.replace(/-\d+$/, '')] = attributes[key];
    });
    return newAttributes;
}

/**
 * Remove top-level match info as we manage the data using the offsets property
 * @param {Object} matches
 * @returns {Object} matches 
 */
export function cleanMatches(matches) {
    Object.keys(matches).forEach(key => {
        matches[key].alternatives = null;
        matches[key].views = null;
        matches[key].startPosition = null;
        matches[key].rule = null;
        matches[key].matches = null;
    });

    return matches;
}

export function indent(indent, text) {
    return (' ').repeat(2 * indent) + text + '\r\n';
}

export function getUuid() {
    return 'xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, (c) => {
        const r = Math.floor(Math.random() * 16);
        return r.toString(16);
    });
}

export function escapeHTML(text) {
    return $('<div><div>').text(text).html();
}

/**
 * Check if a string is HTML/XML by looking for ending tags. 
 * Parsing the string using DOMParser might return false positives by randomly using `<` or `>` tags.
 * Example: "He said <hello world>!" 
 * @param {String} str 
 * @returns {Boolean}
 */
export function hasTags(str) {

    // remove <ref2link-object> tags first
    let regex = /<ref2link-object oid="N\d+N"><\/ref2link-object>/g;
    str = str.replace(regex, '');

    // detects closing tags: </element>
    let hasClosingTags = (/<\/[a-zA-Z]\w{0,12}([-_.:]\w{1,10})*\s*>/g.test(str));

    // detects self closing tabs: <element />
    let hasSelfClosingTags = (/<[a-zA-Z]\w{0,12}([-_.:]\w{1,10})*\s*\/>/g.test(str));

    return hasClosingTags || hasSelfClosingTags;
}

/**
 * Returns the document element built from the input string (if valid HTML)
 * 
 * @param {String} str 
 * @returns {HTMLElement|null}
 */
export function buildDocumentObject(str) {
    if (!window || (!global || !global.window)) {
        return null;
    }

    try {
        var doc = new (window || global.window).DOMParser().parseFromString(str, "text/html");
        let hasNodes = Array.from(doc.body.childNodes).some(node => node.nodeType === 1);
        return hasNodes ? doc : null;
    }
    catch (e) {
        console.error(e);
        return null;
    }
}


export function getTextNodesIn(node, includeWhitespaceNodes) {
    var textNodes = [], nonWhitespaceMatcher = /\S/;

    function getTextNodes(node) {
        if (node.nodeType == 3) {
            if (includeWhitespaceNodes || nonWhitespaceMatcher.test(node.nodeValue)) {
                textNodes.push(node);
            }
        } else {
            for (var i = 0, len = node.childNodes.length; i < len; ++i) {
                // we don't parse anchor nodes as we cannot replace inside them
                if (node.localName !== "a") {
                    getTextNodes(node.childNodes[i]);
                }
            }
        }
    }

    getTextNodes(node);
    return textNodes;
}

let _allTargets = {};

/**
 * Returns a map of `target: baseTarget` for easy lookups
 * @param {Boolean} refresh 
 * @returns {Object}
 */
export function getAllViewTargetMap(refresh) {
    if (!refresh && Object.keys(_allTargets).length) {
        return _allTargets;
    }

    let rules = R2L.getAllRules();
    _allTargets = {};
    rules.forEach(rule => {
        rule.views.forEach(view => {
            _allTargets[view.target] = view.baseTarget;
        })
    });

    return _allTargets;
}


export function getBaseTargetName(targetName) {
    let allViewTargets = getAllViewTargetMap();
    return allViewTargets[targetName] || targetName;
}

// if no grouping happens but it's part of a group we need to move the prefix in front
// Example: 'EUR-Lex to Judgement' => 'to EUR-Lex Judgement'
export function getFullTitle(title, groupTarget) {
    let fullTitle = title;
    if (groupTarget && R2L.viewTitlePrefix) {
        let prefix = R2L.viewTitlePrefix + " ";
        if (title.indexOf(prefix) === 0) {
            fullTitle = prefix + groupTarget + " " + (fullTitle.replace(prefix, ""));
        }
    }

    return fullTitle;
}


export function normalizeString(str) {
    return str.replace(/[εέ]/g, "[εέ]")
        .replace(/[ύυ]/g, "[υύ]")
        .replace(/[οό]/g, "[οό]")
        .replace(/[ωώ]/g, "[ωώ]")
        .replace(/[αά]/g, "[αά]")
        .replace(/[ιί]/g, "[ιί]")
        .replace(/[ηή]/g, "[ηή]")
        .replace(/\n/g, " ")
        .replace(/[aáãăâ]/g, "[aáãăâ]")
        .replace(/[eéèê]/g, "[eéèê]")
        .replace(/[iíîïì]/g, "[iíîïì]")
        .replace(/[oóôõ]/g, "[oóôõ]")
        .replace(/[sș]/g, "[sș]")
        .replace(/[tț]/g, "[tț]")
        .replace(/[uúü]/g, "[uúü]")
        .replace(/[cç]/g, "[cç]");
}