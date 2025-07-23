import { LD_TYPE_CELEX } from "../../manager/index.js";
import { LD_CONSIL_CONDITION } from "../utils/index.js";
import { extractAttributes } from "../../utils/functions.js";
import { getRequestPromise } from "../../utils/request.js";


/**
 * Official Journal targets that have a `consil` identifier will be checked against the Cellar graph.
 * When not found the targets will be discarded (removed from detection results). 
 * @param {Object} matches
 * @returns {Promise<Object>} - the filtered `matches 
 */
export function filterConsilTargets(matches) {
    return new Promise((resolve, reject) => {
        // collect targets that need to be checked
        let attributesList = [];

        Object.keys(matches).forEach(key => {
            matches[key].offsets.forEach(offset => {
                // targets to be inspected
                let targets = offset.rule.views.filter(v => {
                    return v.ldCondition === LD_CONSIL_CONDITION;
                }).map(t => t.target);

                let filteredViews = {};
                Object.keys(offset.views).forEach(target => {
                    if (targets.indexOf(target) !== -1) {
                        filteredViews[target] = offset.views[target];
                    }
                });

                let attributes = extractAttributes(filteredViews);
                if (attributes["data-ref-consil"]) {
                    attributesList.push({ consil: attributes["data-ref-consil"] });
                }
            })
        });

        if (attributesList.length === 0) {
            resolve(matches);
            return;
        }

        let query = getQuery(attributesList);
        let format = 'application/json';

        getRequestPromise(R2L.ldm.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: format,
            origin: '*'
        }).then(function (response) {
            if (!response || !response.results) {
                resolve(matches);
                return;
            }

            let missingItems = attributesList.filter(item => {
                let found = response.results.bindings.filter(binding => {
                    let consilId = binding && binding.id ? binding.id.value : null;
                    return (consilId === "consil:" + item.consil);
                }).length;
                return !found;
            });

            // remove missing items
            matches = removeConsilTargets(matches, missingItems);
            resolve(matches);
        }).catch(err => {
            console.error(err);
            // no removal
            resolve(matches);
        });
    });
}


/**
 * Eliminate Consil targets which don't have a valid URL
 * @param {Object} matches 
 * @param {Array<object>} items 
 */
function removeConsilTargets(matches, items) {
    Object.keys(matches).forEach(key => {
        matches[key].offsets.forEach(offset => {

            // targets to be inspected
            let targets = offset.rule.views.filter(v => {
                return v.ldCondition === LD_CONSIL_CONDITION;
            }).map(t => t.target);

            items.forEach(item => {
                let consilStr = `data-ref-consil="${item.consil}"`;
                offset.alternatives = offset.alternatives.filter(alt => {
                    return (targets.indexOf(alt.viewName) === -1 || alt.view.indexOf(consilStr) === -1);
                });
                offset.alternatives.map(alternative => {
                    // remove the consil id from the view
                    alternative.view = alternative.view.replace(consilStr, "");
                });

                let newViews = {};
                Object.keys(offset.views).forEach(target => {
                    if (targets.indexOf(target) === -1 || offset.views[target].indexOf(consilStr) === -1) {
                        newViews[target] = offset.views[target].replace(consilStr, "");
                    }
                });
                offset.views = newViews;
            });
        });
    });

    return matches;
}

/**
 * Build lookup query
 * @param {Array<Object>} consilItems 
 * @returns {String}
 */
function getQuery(consilItems) {

    let idFilters = "";
    if (consilItems.length === 0) {
        idFilters = "?id = 0"
    }
    for (let i = 0; i < consilItems.length; i++) {
        idFilters += `?id = "consil:${consilItems[i].consil}"^^xsd:string`;
        if (i < consilItems.length - 1) {
            idFilters += ` || `;
        }
    }
    let query = `
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>
PREFIX skos:<http://www.w3.org/2004/02/skos/core#>
PREFIX dc:<http://purl.org/dc/elements/1.1/>
PREFIX lang:<http://publications.europa.eu/resource/authority/language/>
PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>
PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX owl:<http://www.w3.org/2002/07/owl#>

SELECT DISTINCT ?id WHERE {

    ?s cdm:work_id_document ?id
            
    FILTER (${idFilters})

}
    `;

    return query;
}