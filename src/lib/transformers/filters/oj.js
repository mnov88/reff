import { LD_TYPE_CELEX } from "../../manager/index.js";
import { LD_OJ_CONDITION } from "../utils/index.js";
import { extractAttributes } from "../../utils/functions.js";
import { getRequestPromise } from "../../utils/request.js";


/**
 * Official Journal targets that have a `uriserv` URI will be checked against the Cellar graph.
 * When not found the targets will be discarded (removed from detection results). 
 * @param {Object} matches
 * @returns {Promise<Object>} - the filtered `matches 
 */
export function filterOjTargets(matches) {
    return new Promise((resolve, reject) => {
        // collect targets that need to be checked
        let attributesList = [];

        Object.keys(matches).forEach(key => {
            matches[key].offsets.forEach(offset => {
                // targets to be inspected
                let targets = offset.rule.views.filter(v => {
                    return v.ldCondition === LD_OJ_CONDITION;
                }).map(t => t.target);

                let filteredViews = {};
                Object.keys(offset.views).forEach(target => {
                    if (targets.indexOf(target) !== -1) {
                        filteredViews[target] = offset.views[target];
                    }
                });

                let attributes = extractAttributes(filteredViews);
                if (attributes["data-ref-oj"] && attributes["data-ref-uriserv"]) {
                    attributesList.push({ oj: attributes["data-ref-oj"], uriserv: attributes["data-ref-uriserv"] });
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
                    let ojId = binding && binding.ojId ? binding.ojId.value : null;
                    let uriserv = binding && binding.uriserv ? binding.uriserv.value : null;
                    return (ojId === item.oj && uriserv.indexOf(item.uriserv) !== -1);
                }).length;
                return !found;
            });

            // remove missing items
            matches = removeOjTargets(matches, missingItems);
            matches = appendCelexIds(matches, response);
            resolve(matches);
        }).catch(err => {
            console.error(err);
            // no removal
            resolve(matches);
        });
    });
}


/**
 * Eliminate OJ targets which don't have a valid URL
 * @param {Object} matches 
 * @param {Array<object>} items 
 */
function removeOjTargets(matches, items) {
    Object.keys(matches).forEach(key => {
        matches[key].offsets.forEach(offset => {

            // targets to be inspected
            let targets = offset.rule.views.filter(v => {
                return v.ldCondition === LD_OJ_CONDITION;
            }).map(t => t.target);

            items.forEach(item => {
                let ojStr = `data-ref-uriserv="${item.uriserv}"`;
                offset.alternatives = offset.alternatives.filter(alt => {
                    return (targets.indexOf(alt.viewName) === -1 || alt.view.indexOf(ojStr) === -1);
                });
                offset.alternatives.map(alternative => {
                    // remove the oj id from the view
                    alternative.view = alternative.view.replace(ojStr, "");
                });

                let newViews = {};
                Object.keys(offset.views).forEach(target => {
                    if (targets.indexOf(target) === -1 || offset.views[target].indexOf(ojStr) === -1) {
                        newViews[target] = offset.views[target].replace(ojStr, "");
                    }
                });
                offset.views = newViews;
            });
        });
    });

    return matches;
}

/**
 * Append CELEX ids to the targets
 * @param {Object} matches 
 * @param {Object} items 
 */
function appendCelexIds(matches, response) {

    Object.keys(matches).forEach(key => {
        matches[key].offsets.forEach(offset => {

            response.results.bindings.forEach(binding => {
                if (!binding.celexId || !binding.celexId.value) {
                    return;
                }

                let celexId = String(binding.celexId.value).toUpperCase().replace("CELEX:", "");

                let uriservUrlValue = String(binding.uriserv ? binding.uriserv.value : '').split('.').slice(0, -1).join('.');
                let uriservValue = uriservUrlValue.split('/uriserv/')[1] || '';

                let ojStr = `data-ref-uriserv="${uriservValue}"`;
                offset.alternatives = offset.alternatives.map(alt => {
                    alt.view
                    if (alt.view.indexOf(ojStr) > -1) {
                        alt.view = alt.view.replace(ojStr, ojStr + " data-ref-celex=\"" + celexId + "\"");
                    }
                    return alt;
                });

                let newViews = {};
                Object.keys(offset.views).forEach(target => {
                    if (offset.views[target].indexOf(ojStr) > -1) {
                        newViews[target] = offset.views[target].replace(ojStr, ojStr + " data-ref-celex=\"" + celexId + "\"");
                    }
                    else {
                        newViews[target] = offset.views[target];
                    }
                });
                offset.views = newViews;
            });
        });
    });

    return matches;
}

/**
 * Build OJ uri lookup query
 * @param {Array<Object>} ojItems 
 * @returns {String}
 */
function getQuery(ojItems) {

    let idFilters = "";
    let uriFilters = "";
    for (let i = 0; i < ojItems.length; i++) {
        idFilters += `"${ojItems[i].oj}"^^xsd:string`;
        uriFilters += `(REGEX(?manifUrl, "${ojItems[i].uriserv}"))`
        if (i < ojItems.length - 1) {
            idFilters += `,`;
            uriFilters += " || ";
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

SELECT DISTINCT ?celexId ?ojId ?manifUrl as ?uriserv WHERE {
    graph ?ge { 
        ?exp cdm:expression_belongs_to_work ?s 
    }
   
    # MANIFEST 
    ?manif cdm:manifestation_manifests_expression ?exp. 
    ?manif owl:sameAs ?manifUrl .

    OPTIONAL {
        ?s owl:sameAs ?celexResourceUrl .
        FILTER (REGEX(?celexResourceUrl, "/celex/"))
        ?celexWork owl:sameAs ?celexResourceUrl .
        ?celexWork cdm:work_id_document ?celexId .
        FILTER (REGEX(STR(?celexId), "celex:"))
    }

    ?s cdm:resource_legal_published_in_official-journal ?q .
    ?q cdm:work_id_document ?ojId
     
    # first filter on all OJ ids         
    FILTER (?ojId IN (${idFilters}))
   
    # filter urls
    FILTER (
        ${uriFilters}
    )
}
    `;

    return query;
}