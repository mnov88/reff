
import { extractAttributes, extractUrls } from "../../../../utils/functions.js";
import { extractCelexId, extractCelexAttributes } from "../../../../utils/data.js";
import { LD_TYPE_CELEX } from "../../../../manager/index.js";
import { replace, replaceStr, LD_CELLAR_ECB_CELEX, LD_CELLAR_ECB_ELI } from "../../../utils/index.js";
import { getRequestPromise } from "../../../../utils/request.js";

/**
 * Will query Cellar to retrieve the ELI of the act behind an ECB reference - REFTOLINK-1978
 * 
 * Processes placeholders: LD_CELLAR_ECB_CELEX, LD_CELLAR_ECB_ELI
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
export const resolveEcbEli = function (matches) {
    return new Promise((resolve, reject) => {

        // we lookup matches that have the LD_CELLAR_ECB_CELEX marking and have a valid 'data-ref-ecb' attribute
        let attributesList = extractCelexAttributes(matches, LD_CELLAR_ECB_CELEX).map(attributes => {
            return {
                no: attributes['data-ref-no'],
                year: attributes['data-ref-year'],
                ecb: attributes['data-ref-ecb']
            };
        }).filter(attr => {
            return attr.ecb;
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

            // de-duplicate celex ids
            let bindings = response.results.bindings;

            Object.keys(matches).forEach(key => {
                matches[key].offsets.forEach(offset => {
                    let attributes = extractAttributes(offset.views);
                    let celexId = extractCelexId(attributes);

                    if (!celexId) {
                        return;
                    }
                    let currentBindings = bindings;

                    let optimalBinding = findOptimalBinding(attributes, currentBindings);
                    //try to resolve duplicate using matched reference

                    offset.rule.ld.forEach(placeholder => {
                        if (placeholder.indexOf(":ECB:CELEX") !== -1) {
                            // use the celex id
                            let replacementCelex = optimalBinding ? (optimalBinding.id.value.replace('celex:', '')) : 'INVALID'; // 'INVALID' will be discarded by the `cellar-exists-celex` attribute
                            offset = replace(offset, placeholder, replacementCelex);
                        }
                        if (placeholder.indexOf(":ECB:ELI") !== -1 && optimalBinding) {
                            let targetLang = R2L.getLanguage();
                            offset = replace(offset, placeholder, optimalBinding.eli ? (optimalBinding.eli.value + (targetLang ? ('/' + targetLang) : '')) : optimalBinding.ojUrl.value);
                        }
                    });
                });
            });

            resolve(matches);
        }).catch(function (error) {
            console.error(error);
            resolve(matches);
        });
    });
};


/**
 * Cache old ECB Guideline acts internally 
 */
let __oldEcbGuidelineActs;

function getOldEcbGuidelineActs() {
    return new Promise((resolve, reject) => {
        if (__oldEcbGuidelineActs) {
            resolve(__oldEcbGuidelineActs);
        }

        let query = getOldEcbGuidelineActsQuery();

        let format = 'application/json';

        return getRequestPromise(R2L.ldm.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: format,
            origin: '*'
        }).then(response => {
            __oldEcbGuidelineActs = response;
            resolve(__oldEcbGuidelineActs);
        });
    });
}
/**
 * Will query Cellar to retrieve the CELEX of the act behind an ECB act - REFTOLINK-1978
 * 
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
export const resolveEcbActCelex = function (matches) {
    return new Promise((resolve, reject) => {

        // check if we have ECB acts to avoid querying CELLAR for no reason
        let foundGuidelines = false;
        Object.keys(matches).forEach(key => {
            matches[key].offsets.forEach(offset => {
                let urls = extractUrls(offset.views);
                urls.forEach(url => {
                    let match = /https?:\/\/data.europa.eu\/eli\/guideline\/(\d+)\/(\d+)/gi.exec(url);
                    if (match) {
                        foundGuidelines = true;
                    }
                });
            });
        });

        if (!foundGuidelines) {
            resolve(matches);
            return;
        }

        getOldEcbGuidelineActs().then(function (response) {
            if (!response || !response.results) {
                resolve(matches);
                return;
            }

            let bindings = response.results.bindings;

            Object.keys(matches).forEach(key => {
                matches[key].offsets.forEach(offset => {
                    let attributes = extractAttributes(offset.views);
                    let celexId = extractCelexId(attributes);
                    let urls = extractUrls(offset.views);
                    if (!celexId) {
                        return;
                    }

                    // find the eli fragment and compare to the celex 
                    let eliUrlData;
                    let celexData;
                    urls.forEach(url => {
                        let match = /https?:\/\/data.europa.eu\/eli\/guideline\/(\d+)\/(\d+)/gi.exec(url);
                        if (match) {
                            eliUrlData = {
                                year: match[1],
                                no: match[2],
                                root: match[0]
                            }
                        }
                    });
                    let match = /^3(\d{4})O(\d{4})/gi.exec(celexId);
                    if (match) {
                        celexData = {
                            year: match[1],
                            no: String(parseInt(match[2])),
                            root: match[0]
                        }
                    }

                    if (celexData && eliUrlData) {
                        // we need to adjust the CELEX id as it does not follow the same numbering. the ELI is the correct one. See example: https://eur-lex.europa.eu/eli/guideline/2014/528/oj

                        bindings.forEach(binding => {
                            if (binding.eli.value.indexOf(eliUrlData.root + "/") > -1) {
                                // find the right CELEX number
                                let bindingCelexId = binding.id.value.replace("celex:", "");
                                if (bindingCelexId !== celexData.root) {
                                    // raw replacement
                                    Object.keys(offset.views).forEach(key => {
                                        if (String(offset.views[key]).indexOf(celexData.root) > -1) {
                                            offset.views[key] = String(offset.views[key]).replaceAll(celexData.root, bindingCelexId);
                                        }
                                    });
                                    offset.alternatives.forEach(alternative => {
                                        if (String(alternative.view).indexOf(celexData.root) > -1) {
                                            alternative.view = String(alternative.view).replaceAll(celexData.root, bindingCelexId);
                                        }
                                    });
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
};

/**
 * Query by CELEX year prefix and ref number
 * @param {Array<Object>} attributesList
 * @returns {String}
 */
function getQuery(attributesList) {
    let filters = ``;

    for (let i = 0; i < attributesList.length; i++) {
        if (i > 0) {
            filters += ` || `;
        }

        let regexCelexId = 'celex:[2345]' + attributesList[i].year + '.{1,2}' + String(attributesList[i].no).padStart(4, '0');
        filters += `(REGEX(STR(?workId), '${regexCelexId}$') || (STR(?ecbRef) = '${attributesList[i].ecb}' AND REGEX(STR(?workId), 'celex:')))`;
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
        ?eli
        ?ecbRef
        ?ojUrl
    WHERE {  
        graph ?ge { 
            ?exp cdm:expression_belongs_to_work ?s .
            ?exp cdm:expression_title ?title_
        } 
        ?s cdm:work_id_document ?workId.
        OPTIONAL {
            ?s cdm:resource_legal_published_in_official-journal ?ojUrl
        }
        OPTIONAL {
            ?s cdm:resource_legal_manuscript_ref ?ecbRef .
        }
        ?s cdm:work_created_by_agent <http://publications.europa.eu/resource/authority/corporate-body/ECB> .
        OPTIONAL {
            ?s cdm:resource_legal_eli ?eli .
        }
        FILTER (${filters}) 
}
ORDER BY ASC(?workId)
`;

    return query;
}

/**
 * Query by CELEX year prefix and ref number
 * @param {Array<Object>} attributesList
 * @returns {String}
 */
function getOldEcbGuidelineActsQuery() {

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
        ?eli
    WHERE {  
        ?s cdm:work_id_document ?workId.
        ?s cdm:work_created_by_agent <http://publications.europa.eu/resource/authority/corporate-body/ECB> .
        ?s cdm:resource_legal_eli ?eli .
        ?s cdm:resource_legal_year ?year
        FILTER (STR(?year) < "2020" AND REGEX(STR(?eli), "http://data.europa.eu/eli/guideline/") AND !REGEX(STR(?eli), "corrigendum") AND REGEX(STR(?workId), "celex:3")) 
    }`;

    return query;
}

/**
 * Find the best binding to use for the match.
 * 
 * @param {String} match
 * @param {Array} bindings
 * 
 * @returns {Object} binding
 */
function findOptimalBinding(attributes, bindings) {
    let found = bindings.filter(binding => {
        return attributes['data-ref-ecb'] === String(binding.ecbRef ? binding.ecbRef.value : "");
    }).shift();

    if (!found) {
        let regexCelexId = 'celex:[2345]' + attributes['data-ref-year'] + '.{1,2}' + String(attributes['data-ref-no']).padStart(4, '0');

        found = bindings.filter(binding => {
            let pattern = new RegExp(regexCelexId, 'gi');
            return pattern.test(String(binding.id.value));
        }).shift();
    }

    return found && (found.eli || found.ojUrl) ? found : null;
}