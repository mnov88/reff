
import { extractAttributes } from "../../../../utils/functions.js";
import { extractCelexId, extractCelexAttributes } from "../../../../utils/data.js";
import { LD_TYPE_CELEX } from "../../../../manager/index.js";
import { replace, replaceStr, sanitize, LD_CELLAR_EEAJC_NUMBER_CELEX, LD_CELLAR_EEAJC_NUMBER_ELI } from "../../../utils/index.js";
import { getRequestPromise } from "../../../../utils/request.js";

/**
 * EEA Joint committee decisions use a different register for numbering acts which does not correspond to the URL:
 * 
 * Example: `DECISION OF THE EEA JOINT COMMITTEE No 188/2019` - http://data.europa.eu/eli/dec/2019/1401/oj
 * 
 * Processes placeholders: LD_CELLAR_EEAJC_NUMBER_CELEX, LD_CELLAR_EEAJC_NUMBER_ELI
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
export const resolveEeaJointCommitteeDecisionNumber = function (matches) {
    return new Promise((resolve, reject) => {

        // fill CELEX placeholders
        let attributesList = extractCelexAttributes(matches, LD_CELLAR_EEAJC_NUMBER_CELEX).map(attributes => {
            // strip placeholders
            return {
                number: attributes["data-ref-no"],
                celexId: String(attributes['data-ref-celex']).replace(new RegExp('{{\\s?[A-Z:]+\\s?}}', 'gi'), ''),
                year: String(attributes["data-ref-celex"]).substr(1, 4)
            };
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

                    let rawCelexId = String(celexId).replace(new RegExp('{{\\s?[A-Z:]{1,50}\\s?}}', 'gi'), '');

                    //nothing to parse
                    if (celexId === rawCelexId) {
                        return;
                    }

                    let match = offset.context || offset.match;
                    // check if celexId is unique among the bindings
                    let currentBindings = bindings.filter(binding => {
                        return binding.id.value.includes(rawCelexId);
                    });


                    let optimalBinding = findOptimalBinding(match, currentBindings);
                    //try to resolve duplicate using matched reference

                    offset.rule.ld.forEach(placeholder => {
                        if (placeholder.indexOf(":EEAJC:NUMBER:CELEX") !== -1) {
                            // use the subnumber from the optimal CELEX id
                            let replacementCelex = optimalBinding ? (optimalBinding.id.value.slice(6).replace(rawCelexId, '')) : '';
                            offset = replace(offset, placeholder, replacementCelex);
                        }
                        if (placeholder.indexOf(":EEAJC:NUMBER:ELI") !== -1) {
                            // use the subnumber from the optimal ELI URL
                            let eliParts = optimalBinding ? (optimalBinding.eli.value || "").split("/eli/") : [];
                            if (eliParts.length > 1) {
                                let arr = (eliParts[1]).match(/^[a-z_]+\/\d+\/(.+)$/i);

                                let replacementEli = (arr && arr[1]) ? arr[1] : "";
                                offset = replace(offset, placeholder, replacementEli);
                            }
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

        filters += `(
            STRSTARTS( ?workId, "celex:${attributesList[i].celexId}") AND 
            REGEX( ?title_, "[\u202F\u00A0 ]${attributesList[i].number}/${attributesList[i].year}")
        )`;
    }

    let query = `
PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>
PREFIX owl:<http://www.w3.org/2002/07/owl#>
PREFIX lang:<http://publications.europa.eu/resource/authority/language/>
        
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
        filter(?lang=lang:ENG).  
    } 
    ?s cdm:resource_legal_eli ?eli.
    ?s cdm:work_created_by_agent <http://publications.europa.eu/resource/authority/corporate-body/CMT_MIX_EEAREA> . 
    ?s cdm:work_id_document ?workId. 
    FILTER (${filters}) 
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
function findOptimalBinding(match, bindings) {

    // find the reference number eg. 18/2020
    return bindings.filter(binding => {
        let parts = sanitize(binding.title.value).split(" ").filter(part => {
            return String(part).match("\\d+\\/\\d+");
        });

        let matchParts = sanitize(match).split(" ").filter(part => {
            return String(part).match("\\d+\\/\\d+");
        });

        //check whether parts and matchParts have a common reference {{no}}/{{year}}
        if (parts.length > 0 && matchParts.length > 0) {
            return parts[0] === matchParts[0];
        }

        return false;
    }).pop();
}