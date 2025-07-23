import { $ } from '../jquery.js';
import { settings } from '../settings/index.js';
import { cleanLinkedDataBinding, SPARQL_STATUS_SUCCESS } from '../manager/index.js';
import { getUuid } from './functions.js';
import { extractLinkedDataId } from '../utils/data.js';

/**
 * Embed linked-data into HTML content based on CELLAR identifiers
 * @param {String} html 
 * @param {Object} linkedData 
 * 
 * @returns {String} HTML content enriched with `data-ref2link-ld` attributes for detected references
 */
export function insertLinkedData(html, linkedData) {
    let $container = $(`<div>${html}</div>`);
    let $nodes = $(`.${settings.generatedClassName}`, $container);
    $nodes.each((idx, node) => {
        let initialHtml = node.outerHTML;
        let data = buildAttributesMap(node);
        let linkedDataId = extractLinkedDataId(data);

        if (linkedData[linkedDataId] && linkedData[linkedDataId].status === SPARQL_STATUS_SUCCESS) {
            // set linked data object
            $(node).attr("data-ref2link-ld", JSON.stringify(cleanLinkedDataBinding(linkedData[linkedDataId])));
            // replace in content
            html = html.split(initialHtml).join(node.outerHTML);
        }
    });

    return html;
}

/**
 * 
 * @param {String} html content 
 * @param {Object} references 
 * 
 * @returns {String} HTML content with additional `data-ref2link-*` attributes containing all targets.
 */
export function insertNodeData(html, references) {
    let matchNodes = R2L.getNodes(references);

    let $container = $(`<div>${html}</div>`);
    let $nodes = $(`.${settings.generatedClassName}`, $container);
    $nodes.each((idx, node) => {
        let initialHtml = node.outerHTML;
        let data = buildAttributesMap(node);

        // find the right node match using the context/matched-text pair
        let foundMatchNode = matchNodes.filter(matchNode => {
            let foundOffset = matchNode.matches.filter(offset => {

                return offset.context === data['data-ref2link-context'] &&
                    (offset.match === data['data-ref2link-initial'] || offset.match === node.textContent || offset.match.replace(/&nbsp;/g, String.fromCharCode(160)) === node.textContent);
            }).pop();
            return !!foundOffset;
        }).pop();

        if (foundMatchNode) {
            // set linked data object
            $(node).attr("data-ref2link-urls", JSON.stringify(foundMatchNode.urls.map(url => {
                return {
                    title: url.title,
                    href: url.href
                }
            })));

            $(node).attr("data-ref2link-type", foundMatchNode.type);
            $(node).attr("data-ref2link-uuid", getUuid());

            // replace in content (only first occurence because the uuid is different even for duplicate matches)
            html = html.replace(initialHtml, node.outerHTML);
        }
        else {
            console.debug("Node not found", data);
        }
    });

    return html;
}

function buildAttributesMap(node) {
    if (!node.attributes) {
        return {};
    }

    let data = {};
    try {
        for (let i = 0; i < node.attributes.length; i++) {
            data[node.attributes[i].name] = node.attributes[i].value;
        }
        return data;
    }
    catch (e) {
        return data;
    }
}