import { extractAttributes } from "../../../../utils/functions.js";
import { extractCelexId, extractCelexAttributes } from "../../../../utils/data.js";
import { LD_TYPE_CELEX } from "../../../../manager/index.js";
import { replace, LD_CELLAR_COR_NUMBER_CELEX, sanitize } from "../../../utils/index.js";
import { getRequestPromise } from "../../../../utils/request.js";

/**
 * The Committee of the Regions uses a different register for act numbering and thus the captured number does not correspond the ELI/CELEX.
 * 
 * Example: `COMMITTEE OF THE REGIONS DECISION No 18/2020` - https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32020Q1120(01)
 * 
 * 
 * Processes placeholders: LD_CELLAR_COR_NUMBER_CELEX
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
export const resolveCorDecisionNumber = function (matches) {
    return new Promise((resolve, reject) => {

        // fill CELEX placeholders
        let attributesList = extractCelexAttributes(matches, LD_CELLAR_COR_NUMBER_CELEX).map(attributes => {
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
                        if (placeholder.indexOf(":COR:NUMBER:CELEX") !== -1) {
                            // use the subnumber from the optimal CELEX id
                            let replacementCelex = optimalBinding ? (optimalBinding.id.value.slice(6).replace(rawCelexId, '')) : '';
                            offset = replace(offset, placeholder, replacementCelex);
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
WHERE {  
    graph ?ge { 
        ?exp cdm:expression_belongs_to_work ?s .
        ?exp cdm:expression_title ?title_
    }
    graph ?g { 
        ?exp cdm:expression_uses_language ?lang
        filter(?lang=lang:ENG).  
    } 
    ?s cdm:work_created_by_agent <http://publications.europa.eu/resource/authority/corporate-body/COR> . 
    ?s cdm:work_id_document ?workId. 
    FILTER (${filters})
}`;

    return query;
}

/**
 * Find the best binding to use for the match.
 * 
 * @param string match
 * @param {Array} bindings
 * 
 * @returns {Object} binding
 */
function findOptimalBinding(match, bindings) {

    // find the reference number eg. 18/2020
    return bindings.filter(binding => {
        let parts = sanitize(binding.title.value).split(" ").filter(part => {
            return String(part).match("\\d{1,8}\\/\\d{1,8}");
        });

        let matchParts = sanitize(match).split(" ").filter(part => {
            return String(part).match("\\d{1,8}\\/\\d{1,8}");
        });

        //check whether parts and matchParts have a common reference {{no}}/{{year}}
        if (parts.length > 0 && matchParts.length > 0) {
            return parts[0] === matchParts[0];
        }

        return false;
    }).pop();
}