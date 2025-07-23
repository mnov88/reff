
import { extractAttributes } from "../../../../utils/functions.js";
import { extractCelexId, extractCelexAttributes } from "../../../../utils/data.js";
import { LD_TYPE_CELEX } from "../../../../manager/index.js";
import { replace, replaceStr, sanitize, LD_CELLAR_UN_REG_CELEX, LD_CELLAR_UN_REG_ELI, LD_CELLAR_UN_REG } from "../../../utils/index.js";
import { getRequestPromise } from "../../../../utils/request.js";

/**
 * The UN uses a different register for act numbering so we need CELLAR to resolve the correct identifier/URL.
 * Example: `UN Regulation No 155` - http://data.europa.eu/eli/reg/2021/387/oj
 * 
 * Processes placeholders: LD_CELLAR_UN_REG_CELEX, LD_CELLAR_UN_REG_ELI
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
export const resolveUnitedNationsRegulationActs = function (matches) {
    return new Promise((resolve, reject) => {

        // fill CELEX/ELI placeholders
        let attributesList = extractCelexAttributes(matches, LD_CELLAR_UN_REG).map(attributes => {
            // strip placeholders
            return {
                number: attributes["data-ref-no"]
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


                    let optimalBinding = findOptimalBinding(match, attributes, currentBindings);
                    //try to resolve duplicate using matched reference

                    // use the optimal CELEX id
                    let replacementCelex = (optimalBinding ? optimalBinding.id.value : '').replace("celex:", "");
                    offset = replace(offset, LD_CELLAR_UN_REG_CELEX, replacementCelex);

                    // use optimal ELI url
                    let replacementEli = optimalBinding ? optimalBinding.eli.value : "";
                    offset = replace(offset, LD_CELLAR_UN_REG_ELI, replacementEli);

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
 * Query by ref number and author
 * @param {Array<Object>} attributesList
 * @returns {String}
 */
function getQuery(attributesList) {
    let filters = ``;

    for (let i = 0; i < attributesList.length; i++) {
        if (i > 0) {
            filters += ` || `;
        }

        filters += `(?type='X'^^xsd:string AND REGEX(?title_, '\\\\bRegulation[\u202F\u00A0 ]No[\u202F\u00A0 ]${attributesList[i].number}\\\\b', "i"))`;
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
    ?s cdm:resource_legal_type ?type .
    ?s cdm:work_created_by_agent <http://publications.europa.eu/resource/authority/corporate-body/UNECE> . 
    ?s cdm:work_id_document ?workId . 
    FILTER (${filters}) 
    FILTER (STRSTARTS( ?workId, "celex:"))
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
function findOptimalBinding(match, attributes, bindings) {

    // find the reference number eg. "Regulation No 155"
    return bindings.filter(binding => {
        return sanitize(binding.title.value).match("^(UN )?Regulation No " + attributes["data-ref-no"] + "\\b");
    }).pop();
}