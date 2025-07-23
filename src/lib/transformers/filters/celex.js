import {
    LD_CELEX_CONDITION, LD_ACTIVE,
    hasItem
} from "../utils/index.js";
import { extractCelexId, extractCelexIdList } from '../../utils/data.js';
import { LD_TYPE_CELEX, LD_CELEX_SUFFIXES } from "../../manager/index.js";
import { extractAttributes, regExpEscape } from "../../utils/functions.js";
import { getRequestPromise } from "../../utils/request.js";


/**
 * All targets that have a CELEX id (EU legal acts, EU Treaties, EU Case law) will be checked against the Cellar graph.
 * When not found the targets will be discarded (removed from the detection results).
 * @param {Object} matches
 * @returns {Promise<Object>} - the filtered `matches 
 */
export function filterCelexTargets(matches) {
    return new Promise((resolve, reject) => {

        // collect targets that need to be checked
        let celexIds = [];
        let celexActiveIds = []; // if request fails we will automatically remove these
        Object.keys(matches).forEach(key => {
            matches[key].offsets.forEach(offset => {
                // targets to be inspected
                let targets = offset.rule.views.filter(v => {
                    return hasItem(v.ldCondition, LD_CELEX_CONDITION) || hasItem(v.ldCondition, LD_ACTIVE);
                }).map(t => t.target);

                let filteredViews = {};
                Object.keys(offset.views).forEach(target => {
                    if (targets.indexOf(target) !== -1) {
                        filteredViews[target] = offset.views[target];
                    }
                });

                let attributes = extractAttributes(filteredViews);
                let extractedCelexIds = extractCelexIdList(attributes);

                celexIds = celexIds.concat(extractedCelexIds);
            })
        });

        if (celexIds.length === 0) {
            resolve(matches);
            return;
        }

        // unique ids only
        celexIds = celexIds.filter((v, i, a) => a.indexOf(v) === i);

        let query = getCelexLookupQuery(celexIds, R2L.getLanguage() || "ENG");
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

            let foundIds = response.results.bindings.map(binding => {
                let id = binding && binding.id ? binding.id.value : null;
                return id.replace("celex:", "");
            });

            let missingIds = celexIds.filter(id => {
                return foundIds.indexOf(id) === -1;
            });

            // remove missing celex ids
            matches = removeCelexIds(matches, missingIds);
            resolve(matches);
        }).catch(err => {
            console.error(err);
            // remove them all if the request fails
            let activeCelexIds = []; // if request fails we will automatically remove these
            Object.keys(matches).forEach(key => {
                matches[key].offsets.forEach(offset => {
                    // targets to be inspected
                    let activeTargets = offset.rule.views.filter(v => {
                        return hasItem(v.ldCondition, LD_ACTIVE);
                    }).map(t => t.target);

                    let activeFilteredViews = {};
                    Object.keys(offset.views).forEach(target => {
                        if (activeTargets.indexOf(target) !== -1) {
                            activeFilteredViews[target] = offset.views[target];
                        }
                    });

                    let activeAttributes = extractAttributes(activeFilteredViews);
                    let activeExtractedCelexIds = extractCelexIdList(activeAttributes);

                    activeCelexIds = activeCelexIds.concat(activeExtractedCelexIds);
                })
            });

            matches = removeCelexIds(matches, activeCelexIds);
            resolve(matches);
        });
    });
}

/**
 * Build CELEX lookup query
 * @param {Array<string>} celexIds 
 * @returns {String} 
 */
export function getCelexLookupQuery(celexIds, langISO3) {
    // unique ids only
    celexIds = celexIds.filter((v, i, a) => a.indexOf(v) === i);

    let filters = "FILTER (?workId IN (";
    for (let i = 0; i < celexIds.length; i++) {
        filters += `"celex:${celexIds[i]}", "celex:${celexIds[i]}"^^xsd:string`; // query both types
        if (i < celexIds.length - 1) {
            filters += ",";
        }
    }
    filters += "))";

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

        SELECT DISTINCT 
            ?workId as ?id 
        WHERE {  
            graph ?ge { 
                ?exp cdm:expression_belongs_to_work ?s .
                ?exp cdm:expression_title ?title_
            }`;

    // disable the language filter - do not exclude the act if the specific language does not exist. REFTOLINK-2016
    if (langISO3 && false) {
        query += `
            graph ?g { 
                ?exp cdm:expression_uses_language ?lang
                filter(?lang=lang:${String(langISO3).toUpperCase()}).  
            }`;
    }
    query += ` 
            ?s cdm:work_id_document ?workId.
            ${filters}   
        }`;

    return query;
}

/**
 * Remove LD_ACTIVE targets which have the ids we are looking for
 * @param {Object} matches 
 * @param {Array<String>} ids - an aggregate list of CELEX/ECLI/ELI/HANDOC/CIS/PROC/CONSIL ids
 * 
 * @return {Object} matches
 */
export function removeIds(matches, ids) {
    Object.keys(matches).forEach(key => {
        matches[key].offsets.forEach(offset => {

            // targets to be inspected
            let targets = offset.rule.views.filter(v => {
                return hasItem(v.ldCondition, LD_ACTIVE);
            }).map(t => t.target);

            ids.forEach(id => {
                // build a regex str  
                let regexStr = new RegExp(`="${regExpEscape(id)}"`);

                offset.alternatives = offset.alternatives.filter(alt => {
                    return (targets.indexOf(alt.viewName) === -1 || regexStr.test(alt.view) === false);
                });
                offset.alternatives.map(alternative => {
                    // remove the celex id from the view
                    alternative.view = alternative.view.replace(regexStr, "");
                });

                let newViews = {};
                Object.keys(offset.views).forEach(target => {
                    if (targets.indexOf(target) === -1 || regexStr.test(offset.views[target]) === false) {
                        newViews[target] = offset.views[target].replace(regexStr, "");
                    }
                });
                offset.views = newViews;
            });
        });
    });
    return matches;
}

/**
 * @param {Object} matches 
 * @param {Array<string>} celexIds
 * @returns {Object} matches 
 */
export function removeCelexIds(matches, celexIds) {
    Object.keys(matches).forEach(key => {
        matches[key].offsets.forEach(offset => {

            // targets to be inspected
            let targets = offset.rule.views.filter(v => {
                return hasItem(v.ldCondition, LD_CELEX_CONDITION) || hasItem(v.ldCondition, LD_ACTIVE);
            }).map(t => t.target);

            celexIds.forEach(celexId => {
                // celex are not unique across views. might use ordinal suffixes eg. data-ref-celex-1, data-ref-celex-2 etc.
                // build a regex str for all possible CELEX suffixes 
                let regexCelexStr = new RegExp(`data-ref-celex(?:${LD_CELEX_SUFFIXES.join("|")})="${regExpEscape(celexId)}"`);

                offset.alternatives = offset.alternatives.filter(alt => {
                    return (targets.indexOf(alt.viewName) === -1 || regexCelexStr.test(alt.view) === false);
                });
                offset.alternatives.map(alternative => {
                    // remove the celex id from the view
                    alternative.view = alternative.view.replace(regexCelexStr, "");
                });

                let newViews = {};
                Object.keys(offset.views).forEach(target => {
                    if (targets.indexOf(target) === -1 || regexCelexStr.test(offset.views[target]) === false) {
                        newViews[target] = offset.views[target].replace(regexCelexStr, "");
                    }
                });
                offset.views = newViews;
            });
        });
    });

    return matches;
}
