
import { extractAttributes } from "../../../../utils/functions.js";
import { extractCelexId, extractCelexAttributes } from "../../../../utils/data.js";
import { LD_TYPE_CELEX } from "../../../../manager/index.js";
import { replace, sanitize, replaceStr, LD_CELLAR_SUBNUMBER_CELEX } from "../../../utils/index.js";
import { getRequestPromise } from "../../../../utils/request.js";

/**
 * Will resolve CELEX and ELI ambiguous references in CELEX-based rules (EUR-Lex acts).
 * Processes placeholders: LD_CELLAR_SUBNUMBER_CELEX, LD_CELLAR_SUBNUMBER_ELI
 * 
 * Example: `Decision No 70/2008/EC of the European Parliament and of the Council` - 32008D0070(01) - http://data.europa.eu/eli/dec/2008/70(1)/oj 
 * 
 * @param {Object} matches
 * @returns {Promise<Object>}  
 */
export const resolveCelexSubnumber = (matches) => {
    return new Promise((resolve, reject) => {
        // fill CELEX placeholders
        let celexIds = extractCelexAttributes(matches, LD_CELLAR_SUBNUMBER_CELEX).map(attributes => {
            // strip placeholders
            let id = extractCelexId(attributes);
            return id.replace(new RegExp('{{\\s?[A-Z:]+\\s?}}', 'gi'), '');
        });

        // nothing to check
        if (celexIds.length === 0) {
            resolve(matches);
            return;
        }

        let query = getQuery(celexIds, R2L.getLanguage() || "ENG");
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

            // de-duplicate celex ids
            let bindings = response.results.bindings;

            Object.keys(matches).forEach(key => {
                matches[key].offsets.forEach(offset => {
                    let attributes = extractAttributes(offset.views);
                    let celexId = extractCelexId(attributes);

                    if (!celexId) {
                        return;
                    }

                    let rawCelexId = String(celexId).replace(new RegExp('{{\\s?[A-Z:]{1,50}\\s?}}', 'gi'), '');

                    //nothing to parse
                    if (celexId === rawCelexId) {
                        return;
                    }

                    let match = offset.context || offset.match;

                    let celexIdVariation = getCelexIdVariation(rawCelexId);

                    // check if celexId is unique among the bindings
                    let currentBindings = bindings.filter(binding => {
                        if (celexIdVariation) {
                            return binding.id.value.includes(rawCelexId) || binding.id.value.includes(celexIdVariation);
                        }
                        else {
                            return binding.id.value.includes(rawCelexId);
                        }
                    });

                    if (currentBindings.length >= 1) {
                        let optimalBinding = findOptimalBinding(match, currentBindings);
                        //try to resolve duplicate using matched reference

                        offset.rule.ld.forEach(placeholder => {
                            if (placeholder.indexOf(":SUBNUMBER:CELEX") !== -1) {
                                // replace CELEX id entirely
                                let replacementCelex = optimalBinding ? optimalBinding.id.value.slice(6) : '';

                                Object.keys(offset.views).forEach(key => {
                                    offset.views[key] = String(offset.views[key]).replaceAll(celexId, replacementCelex);
                                });
                                offset.alternatives.forEach(alternative => {
                                    alternative.view = String(alternative.view).replaceAll(celexId, replacementCelex);
                                });
                            }

                            if (placeholder.indexOf(":SUBNUMBER:ELI") !== -1) {
                                // use the subnumber from the optimal ELI URL
                                let eliParts = optimalBinding && optimalBinding.eli ? (optimalBinding.eli.value || "").split("/eli/") : [];
                                if (eliParts.length > 1) {
                                    let arr = (eliParts[1]).match(/^[a-z_]+\/\d+\/\d+(\(\d+\))/i);

                                    let replacementEli = (arr && arr[1]) ? arr[1] : "";
                                    offset = replace(offset, placeholder, replacementEli);
                                }
                            }
                        });
                    }
                });
            });

            resolve(matches);
        }).catch(function (error) {
            console.error(error);
            resolve(matches);
        });
    });
}

function getCelexIdVariation(celexId) {
    let year = parseInt(celexId.slice(1, 5));
    let type = celexId.slice(5, 6);
    // ECSC celex ids can use an 'S' instead of 'D'
    if (year <= 2002 && type === 'D') {
        let ecscCelexId = celexId.replace('D', 'S');
        return ecscCelexId;
    }
    return null;
}


/**
 * Query by CELEX ids (CONTAINS)
 * @param {Array<String>} celexIds 
 * @returns {String}
 */
function getQuery(celexIds, langISO3) {
    langISO3 = langISO3 || "ENG";
    langISO3 = String(langISO3).toUpperCase();

    // unique ids only
    celexIds = celexIds.filter((v, i, a) => a.indexOf(v) === i);

    let filters = ``;

    for (let i = 0; i < celexIds.length; i++) {
        if (i > 0) {
            filters += ` UNION `;
        }


        let celexIdVariationFilter = ``;
        let celexIdVariation = getCelexIdVariation(celexIds[i]);
        if (celexIdVariation) {
            celexIdVariationFilter = `,  "celex:${celexIdVariation}", "celex:${celexIdVariation}"^^xsd:string`
        }

        filters += `{
            ?s cdm:work_id_document ?workId. 

            FILTER (?workId IN (
                "celex:${celexIds[i]}", "celex:${celexIds[i]}"^^xsd:string, 
                "celex:${celexIds[i]}(01)", "celex:${celexIds[i]}(01)"^^xsd:string,
                "celex:${celexIds[i]}(02)", "celex:${celexIds[i]}(02)"^^xsd:string,
                "celex:${celexIds[i]}(03)", "celex:${celexIds[i]}(03)"^^xsd:string
                ${celexIdVariationFilter}
            ))
        }`;
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

        SELECT DISTINCT 
            ?workId as ?id 
            ?title_ as ?title
            ?eli
        WHERE {  
            graph ?ge { 
                ?exp cdm:expression_belongs_to_work ?s .
                ?exp cdm:expression_title ?title_
            }
            graph ?g { 
                ?exp cdm:expression_uses_language ?lang
                filter(?lang=lang:${langISO3}).  
            } 
            OPTIONAL {
                ?s cdm:resource_legal_eli ?eli .
            }

            ${filters}   
        }
        
        ORDER BY DESC(?workId)
        `;

    return query;
}

/**
 * Find the best subnumber binding to use for the match.
 * @param {String} match (reference) 
 * @param {Array} bindings
 * 
 * @returns {Object} binding
 */
function findOptimalBinding(match, bindings) {

    // find the reference word eg. 70/2008(/EC)
    let optimalBinding = bindings.filter(binding => {
        let parts = sanitize(binding.title.value).split(" ").filter(part => {
            return String(part).match("\\d{1,8}\\/\\d{1,8}");
        });

        let matchParts = sanitize(match).split(" ").filter(part => {
            return String(part).match("\\d{1,8}\\/\\d{1,8}");
        });

        //check whether parts and matchParts have a common reference token
        if (parts.length > 0 && matchParts.length > 0) {
            // in old acts we might find a colon at the end eg: '2003/426/EC:
            let str = String(parts[0]).slice(-1) === ':' ? String(parts[0]).slice(0, -1) : String(parts[0]);
            let matchStr = String(matchParts[0]).slice(-1) === ':' ? String(matchParts[0]).slice(0, -1) : String(matchParts[0]);
            return str === matchStr;
        }

        return false;
    }).pop();

    if (!optimalBinding) {
        return bindings[0];
    }

    return optimalBinding;
}
