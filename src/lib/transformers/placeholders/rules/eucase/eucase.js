import { LD_CELLAR_EUCASE_SUBNUMBER_CELEX, LD_CELLAR_EUCASE_JOINED_JUDGEMENT } from "../../../utils/index.js";
import { getRequestPromise } from "../../../../utils/request.js";
import { LD_TYPE_CELEX } from "../../../../manager/index.js";
import { extractAttributes, regExpEscape } from "../../../../utils/functions.js";
import { extractCelexAttributes, extractCelexIdList } from "../../../../utils/data.js";
import { LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT } from "../../../../settings/index.js";



/**
 * The CELEX ids of EU cases is not deterministic for Orders, Judgments, Opinions. For example: 
 *   `T-184/01` order has CELEX id 62001TO0184(02)
 *   `T-184/01 R` order has CELEX id 62001TO0184
 * 
 * This transformer will:
 *   - query all CELEX orders which contain '62001TO0184';
 *   - match the titles with the case label eg. 'T-184/01 R';
 *   - resolve the correct CELEX ids matching the case label;
 * 
 * @param {Object} matches
 * 
 * @return {Promise<Object>} 
 */
export const resolveEucaseCelexIds = function (matches) {
    return new Promise((resolve, reject) => {
        // fill CELEX placeholders
        let attributesArr = extractCelexAttributes(matches, LD_CELLAR_EUCASE_SUBNUMBER_CELEX);
        let celexMap = {};
        attributesArr.forEach(attributes => {
            let celexId = null;
            Object.keys(attributes).forEach(key => {
                if (attributes[key].indexOf(LD_CELLAR_EUCASE_SUBNUMBER_CELEX) > -1) {
                    celexId = attributes[key];
                    let suffix = key.split("celex")[1] || '';
                    celexMap[celexId] = celexMap[celexId] || [];
                    if (attributes['data-ref-label' + suffix]) {
                        celexMap[celexId].push(attributes['data-ref-label' + suffix]);
                    }
                }
            });
        });

        // nothing to check
        if (Object.keys(celexMap).length === 0) {
            resolve(matches);
            return;
        }

        let query = getQuery(celexMap);
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

            let newCelexMap = {};
            Object.keys(celexMap).forEach(celexId => {
                let labels = celexMap[celexId];

                labels.forEach((label) => {
                    // reconcile the celex ids with the case labels (with/without the 'R' suffix)
                    response.results.bindings.forEach(binding => {
                        // we look for the pattern: `<caseLabel>.` (with an ending dot). Example: 
                        //   Affaire C-78/14 P-R.

                        if (!binding.title || !binding.title.value) {
                            return;
                        }

                        // clean spaces
                        let val = String(binding.title.value).split("#").pop().replace(/[\u202F\u00A0]/g, " ").replace(/ /g, "");
                        if (val.indexOf(String(label).replace(/\s/g, '') + '.') > -1 && celexId.substr(0, 10) === binding.id.value.replace("celex:", "").substr(0, 10)) {
                            //matched
                            newCelexMap[celexId] = newCelexMap[celexId] || [];
                            newCelexMap[celexId].push({
                                celexId: binding.id.value.replace('celex:', ''),
                                label: label
                            });
                        }
                        // if there is no label match we will keep the Order/Judgment/Opinion document of the main CELEX id, there is no target filtering happening here
                    });
                });
            });

            Object.keys(matches).forEach(key => {
                matches[key].offsets.forEach(offset => {
                    let attributes = extractAttributes(offset.views);
                    let celexIds = extractCelexIdList(attributes);

                    celexIds = celexIds.filter(celexId => {
                        return celexId.indexOf(LD_CELLAR_EUCASE_SUBNUMBER_CELEX) > -1;
                    });
                    if (celexIds.length === 0) {
                        return;
                    }

                    celexIds.forEach(celexId => {
                        // find in newCelexMap
                        let finalCelexIds = newCelexMap[celexId] || [];
                        finalCelexIds.forEach(finalCelexIdData => {
                            let finalCelexId = finalCelexIdData.celexId;
                            let finalLabel = finalCelexIdData.label;

                            let regex = new RegExp("data-ref-label(?:-\\d+)?=\"" + regExpEscape(finalLabel) + "\"", "i");

                            // raw replacement
                            Object.keys(offset.views).forEach(key => {
                                if (regex.test(String(offset.views[key]))) {
                                    offset.views[key] = String(offset.views[key]).replaceAll(celexId, finalCelexId);
                                }
                            });
                            offset.alternatives.forEach(alternative => {
                                if (regex.test(String(alternative.view))) {
                                    alternative.view = String(alternative.view).replaceAll(celexId, finalCelexId);
                                }
                            });
                        });
                    });
                });
            });

            resolve(matches);
        }).catch(function (error) {
            console.error(error);
            resolve(matches);
        });
    });
}

function getQuery(celexMap) {
    let filters = ``;

    let i = 0;
    Object.keys(celexMap).forEach(celexId => {
        if (i > 0) {
            filters += ` || `;
        }

        filters += `(STRSTARTS(STR(?workId), "celex:${celexId.replace('{{ LD:CELLAR:EUCASE:SUBNUMBER:CELEX }}', '')}"))`;
        i++;
    })

    let str = `
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
        ?workId as ?id ?title
    WHERE {  
        graph ?ge { 
            ?exp cdm:expression_belongs_to_work ?s .
            ?exp cdm:expression_title ?title .
            ?exp cdm:expression_uses_language ?lang
            FILTER (?lang IN (lang:FRA))
        } 
        ?s cdm:resource_legal_id_sector "6"^^xsd:string .
        ?s cdm:work_has_resource-type ?resourceType .
        FILTER (
            ?resourceType=<http://publications.europa.eu/resource/authority/resource-type/ORDER> || 
            ?resourceType=<http://publications.europa.eu/resource/authority/resource-type/OPIN_JUR> ||
            ?resourceType=<http://publications.europa.eu/resource/authority/resource-type/JUDG> 
        )  .
        
        ?s cdm:work_id_document ?workId.

        FILTER ((${filters}) AND !REGEX(STR(?workId), "_INF", "i")) 
    }
    ORDER BY ?workId
`

    return str;
}


export const removeEucaseJoinedJudgements = function (matches) {
    let regex = new RegExp("{{\\s?" + LD_CELLAR_EUCASE_JOINED_JUDGEMENT + "\\s?}}");

    Object.keys(matches).forEach(key => {
        matches[key].offsets.forEach(offset => {
            let newViews = {};
            let newAlternatives = [];
            // raw replacement
            Object.keys(offset.views).forEach(key => {
                if (!regex.test(offset.views[key])) {
                    newViews[key] = offset.views[key];
                }
            });
            offset.views = newViews;

            offset.alternatives.forEach(alternative => {
                if (!regex.test(String(alternative.view))) {
                    newAlternatives.push(alternative);
                }
                offset.alternatives = newAlternatives;
            });
        });
    });

    return matches;
}

export const resolveEucaseJoinedJudgements = function (matches) {
    return new Promise((resolve, reject) => {
        // advanced linked data mode must be enabled
        if (R2L.options.linkedDataMode.indexOf(LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT) === -1) {
            // clean them up first
            return resolve(removeEucaseJoinedJudgements(matches));
        }

        // get joined case data
        R2L.ldm.getJoinedCaseData().then((joinedCaseData) => {

            // loop matches and see if they're in the joined cases list
            // build a map for fast lookup
            let fastCaseLabelLookupMap = {};
            joinedCaseData.results.bindings.map(binding => {
                let caseLabels = binding.title.value.split(",").map(cl => cl.replace(/\s/g, "").replace("‑", "-"));
                // we are not interested in the first item of the list (check if position > 0) as that is the main case. 
                caseLabels.forEach((caseLabel, index) => {
                    if (index > 0) {
                        fastCaseLabelLookupMap[caseLabel] = (binding.id ? binding.id.value : '').replace('celex:', '');
                    }
                })
            });

            Object.keys(matches).forEach(key => {
                matches[key].offsets.forEach(offset => {
                    let attributes = extractAttributes(offset.views);
                    let celexIds = extractCelexIdList(attributes);

                    celexIds = celexIds.filter(celexId => {
                        return celexId.indexOf(LD_CELLAR_EUCASE_JOINED_JUDGEMENT) > -1;
                    });
                    if (celexIds.length === 0) {
                        return;
                    }

                    let currentLabel = String(attributes['data-ref-label']).replace(/\s/g, "").replace("‑", "-");

                    // look for the label in the joined cases list
                    let mainJudgementCelexId = fastCaseLabelLookupMap[currentLabel];

                    let regex = new RegExp("{{\\s?" + LD_CELLAR_EUCASE_JOINED_JUDGEMENT + "\\s?}}");
                    let newViews = {};
                    let newAlternatives = [];
                    // raw replacement
                    Object.keys(offset.views).forEach(key => {
                        if (regex.test(offset.views[key])) {
                            if (mainJudgementCelexId) {
                                newViews[key] = String(offset.views[key]).replace(new RegExp("{{\\s?" + LD_CELLAR_EUCASE_JOINED_JUDGEMENT + "\\s?}}", "g"), mainJudgementCelexId);
                            }
                        }
                        else {
                            newViews[key] = offset.views[key];
                        }
                    });
                    offset.views = newViews;

                    offset.alternatives.forEach(alternative => {
                        if (regex.test(String(alternative.view))) {
                            if (mainJudgementCelexId) {
                                alternative.view = String(alternative.view).replace(new RegExp("{{\\s?" + LD_CELLAR_EUCASE_JOINED_JUDGEMENT + "\\s?}}", "g"), mainJudgementCelexId);
                                newAlternatives.push(alternative);
                            }
                        }
                        else {
                            newAlternatives.push(alternative);
                        }

                        offset.alternatives = newAlternatives;
                    });

                });
            });

            resolve(matches);
        }).catch(err => {
            console.error(err);
            resolve(matches);
        })
    });
}