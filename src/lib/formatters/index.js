import { $ } from '../jquery.js';
import { insertNodeData, insertLinkedData } from '../utils/decorators.js';
import { identity, extractOrderedAttributes, indent, escapeHTML, getBaseTargetName, getAllViewTargetMap, buildAttributesData, getFullTitle, getUuid } from '../utils/functions.js';
import { settings } from '../settings/index.js';
import { extractLinkedDataId } from '../utils/data.js';

export function bindFormatters(R2L) {
    /**
    * Build output nodes from the references map. Group/count accordingly.
    *
    * @param {Object} references
    */
    R2L.getNodes = function (references) {
        var idx = 0;
        var rendered = {};
        var nodes = new Array();
        // compute targets list 
        let _allViewTargets = getAllViewTargetMap(true);

        Object.keys(references).forEach((_refKey) => {
            if (!references[_refKey]) {
                return;
            }

            let _ref = references[_refKey];
            for (var k = 0; k < _ref.offsets.length; k++) {

                var views = [];
                var offsetUid = _ref.match;
                var urls = [];
                var attributesList = extractOrderedAttributes(_ref.offsets[k].alternatives);

                var label = _ref.match;

                if (Object.keys(_ref.offsets[k].views).length === 0 || (Object.keys(_ref.offsets[k].views).length === 1 && _ref.offsets[k].views['table'])) {
                    // skipping invalid ref or ref filtered by linked data
                    continue;
                }

                Object.keys(_ref.offsets[k].views).forEach((_view) => {
                    var view = _ref.offsets[k].views[_view];
                    if (!view) {
                        return;
                    }

                    if (String(_view) === "table") {
                        label = view;
                        offsetUid = view;
                    }
                    else {

                        views.push('<view target="' + escapeHTML(_view) + '"'
                            + '>' +
                            '<![CDATA[' + view + ']]>' +
                            '</view>'
                        );
                        var $view = $(view);
                        if ($view.attr("href")) {
                            if (urls.indexOf($view.attr("href")) === -1) {
                                urls.push({
                                    title: $view.attr("title"),
                                    href: $view.attr("href"),
                                    target: _view,
                                    fullTitle: getFullTitle($view.attr("title"), _ref.offsets[k].alternatives.filter(a => a.viewName === _view).map(a => a.groupTarget).pop()),
                                    baseTarget: getBaseTargetName(_view),
                                    position: _ref.offsets[k].position
                                });
                            }
                        }
                        else {
                            // can be a nested link
                            $view = $(view).children("a");
                            if ($view.attr("href")) {
                                if (urls.indexOf($view.attr("href")) === -1) {
                                    urls.push({
                                        title: $view.attr("title"),
                                        fullTitle: getFullTitle($view.attr("title"), _ref.offsets[k].alternatives.filter(a => a.viewName === _view).map(a => a.groupTarget).pop()),
                                        href: $view.attr("href"),
                                        target: _view,
                                        baseTarget: getBaseTargetName(_view),
                                        position: _ref.offsets[k].position
                                    });
                                }
                            }
                        }
                    }
                });

                let data = buildAttributesData(attributesList);

                let linkedDataId = extractLinkedDataId(data);
                if (linkedDataId) {
                    let binding = this.ldm.getMetadataById(linkedDataId);
                    data.metadata = binding && binding.data ? binding.data : {};
                }

                if (rendered[offsetUid]) {
                    rendered[offsetUid].data.push(data);
                    rendered[offsetUid].urls = urls;
                    rendered[offsetUid].matches.push({
                        uuid: getUuid(),
                        views: views,
                        position: _ref.offsets[k].position,
                        positionDelta: _ref.offsets[k].alias ? (_ref.offsets[k].alias.source.length - _ref.offsets[k].alias.replacement.length) : 0,
                        match: _ref.offsets[k].match,
                        context: _ref.offsets[k].context,
                        alias: _ref.offsets[k].alias
                    });
                    rendered[offsetUid].count++;

                    continue;
                }

                let node = {
                    output: "",
                    number: (idx + 1),
                    count: 1,
                    data: [],
                    urls: urls,
                    reference: label.trim(),
                    type: _ref.offsets[k].rule.baseType ? _ref.offsets[k].rule.baseType : _ref.offsets[k].rule.type,
                    libelle: _ref.offsets[k].rule.baseLibelle ? _ref.offsets[k].rule.baseLibelle : _ref.offsets[k].rule.ruleLibelle,
                    matches: []
                };

                node.data.push(data);

                node.output += indent(1, '<record number="$nodeNumber">');
                node.output += indent(2, '<reference count="$nodeCounter' + (idx + 1) + '">' + node.reference + '</reference>');
                node.output += indent(2, '<type>' + escapeHTML(node.type) + '</type>');
                node.output += indent(2, '<libelle>' + escapeHTML(node.libelle) + '</libelle>');

                if (settings.views) {
                    node.output += '$matches' + (idx + 1);
                    node.output += '$urls' + (idx + 1);
                }

                node.output += indent(1, '</record>');
                idx++;

                rendered[offsetUid] = node;
                node.matches.push({
                    uuid: getUuid(),
                    views: views,
                    position: _ref.offsets[k].position,
                    positionDelta: _ref.offsets[k].alias ? (_ref.offsets[k].alias.source.length - _ref.offsets[k].alias.replacement.length) : 0,
                    match: _ref.offsets[k].match,
                    context: _ref.offsets[k].context,
                    alias: _ref.offsets[k].alias
                });
                nodes.push(node);
            }

        });

        for (var i = nodes.length - 1; i >= 0; i--) {
            let matchStr = "";
            matchStr += indent(2, "<matches>");
            nodes[i].output = nodes[i].output.replace("$nodeCounter" + (i + 1), nodes[i].count);
            nodes[i].matches.sort(function (a, b) {
                return a.position < b.position ? -1 : 1;
            });

            for (var mI = 0; mI < nodes[i].matches.length; mI++) {
                var m = nodes[i].matches[mI];
                if (mI === 0) {
                    nodes[i].position = m.position;
                }

                matchStr += indent(3, `<match position='${m.position}' context='${escapeHTML(m.context)}' reference='${escapeHTML(m.match)}'>`);
                for (var vI = 0; vI < m.views.length; vI++) {
                    matchStr += indent(4, m.views[vI]);
                }
                matchStr += indent(3, "</match>");

            }
            matchStr += indent(2, "</matches>");

            let urlStr = "";
            if (nodes[i].urls.length > 0) {
                urlStr += indent(2, '<urls>');
                for (let urlIndex = 0; urlIndex < nodes[i].urls.length; urlIndex++) {
                    urlStr += indent(3, `<url position="${nodes[i].urls[urlIndex].position}" target="${nodes[i].urls[urlIndex].target}">${nodes[i].urls[urlIndex].href}</url>`);
                }
                urlStr += indent(2, '</urls>');
            }

            nodes[i].output = nodes[i].output.replace("$urls" + (i + 1), urlStr);
            nodes[i].output = nodes[i].output.replace("$matches" + (i + 1), matchStr);
        }

        nodes = R2L.applySort(nodes);
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].output = nodes[i].output.replace("$nodeNumber", (i + 1));
        }

        return nodes;
    };


    R2L.formatters = {
        xml: function (references, text) {
            let nodes = R2L.getNodes(references);
            return {
                result: `<resultset size="${nodes.length}">\r\n
                    ${nodes.map(function (node) { return node.output }).join("")}\r\n
                    </resultset>`,
                type: 'application/xml',
                nodes: nodes,
                ext: 'xml',
            };
        },
        json: function (references, text) {
            let nodes = R2L.getNodes(references);
            return {
                result: nodes.map(node => {
                    // filter out data which can't be grouped by. this data belong to the 'matches' sub-elements
                    delete node["output"];
                    delete node["position"];
                    return node;
                }),
                size: nodes.length,
                type: 'application/json',
                ext: 'json',
            };
        },
        html: function (references, text, linkedData) {
            let html = linkedData ? insertLinkedData(R2L.replaceHtml(text, references), linkedData) : R2L.replaceHtml(text, references);
            html = insertNodeData(html, references);
            return {
                result: html,
                type: 'text/html',
                ext: 'html',
            };
        }
    }

    /**
     * Will flatten the Ref2Link JSON data structure, which groups references by their 'match'
     * The ordered nodes will not perform any grouping and will return 
     *   each detected reference (subdivision) in order, including duplicates
     * 
     * @param {Array<R2LNode>} nodes expects as input the JSON nodes list
     * @returns {Array<R2LOrderedNode>} 
     */
    R2L.getOrderedNodes = function (nodes) {
        let arr = [];
        nodes.forEach(node => {
            node.matches.forEach(match => {
                arr.push({
                    alias: match.alias,
                    match: match.match,
                    context: match.context,
                    position: match.position,
                    type: node.type,
                    reference: node.reference,
                    urls: node.urls,
                    data: node.data
                });
            })
        });

        arr.sort((a, b) => a.position < b.position ? -1 : 1);
        // add local position
        let currentContext;
        let currentContextPosition = -1;
        for (let i = 0; i < arr.length; i++) {
            if (currentContext !== arr[i].context) {
                arr[i].localPosition = 0;
                currentContextPosition = arr[i].position;
                currentContext = arr[i].context;
            }
            else if (arr[i - 1] && (arr[i].position < (arr[i - 1].position - arr[i - 1].localPosition + arr[i - 1].context.length))) {
                arr[i].localPosition = arr[i].position - currentContextPosition;
            }
            else {
                arr[i].localPosition = 0;
                currentContextPosition = arr[i].position;
                currentContext = arr[i].context;
            }
        }

        return arr;
    }
};