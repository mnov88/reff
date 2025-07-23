
import { extractAttributes } from "../../../../utils/functions.js";
import { extractCelexId, extractCelexAttributes } from "../../../../utils/data.js";
import { LD_TYPE_CELEX } from "../../../../manager/index.js";
import { replace, LD_CELLAR_OJ_CELEX, LD_CELLAR_OJ_TYPE_ELI } from "../../../utils/index.js";
import { getRequestPromise } from "../../../../utils/request.js";

/**
 * Will query Cellar to retrieve the ELI of the act behind an OJ reference - REFTOLINK-1516
 * 
 * Processes placeholders: LD_CELLAR_OJ_CELEX, LD_CELLAR_OJ_TYPE_ELI
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
export const resolveOjEli = function (matches) {
    return new Promise((resolve, reject) => {

        // fill CELEX placeholders
        let attributesList = extractCelexAttributes(matches, LD_CELLAR_OJ_CELEX).map(attributes => {
            // strip placeholders
            return {
                no: attributes['data-ref-no'],
                eliType: attributes['data-ref-eli-type'],
                year: attributes['data-ref-year'],
                month: attributes['data-ref-month'],
                day: attributes['data-ref-day'],
                date: `${attributes['data-ref-year']}-${String(attributes['data-ref-month']).padStart(2, '0')}-${String(attributes['data-ref-day']).padStart(2, '0')}`
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


                    let optimalBinding = findOptimalBinding(attributes, currentBindings);
                    //try to resolve duplicate using matched reference

                    offset.rule.ld.forEach(placeholder => {
                        if (placeholder.indexOf(":OJ:CELEX") !== -1) {
                            // use the celex id
                            let replacementCelex = optimalBinding ? (optimalBinding.id.value.replace('celex:', '')) : 'INVALID'; // 'INVALID' will be discarded by the `cellar-exists-celex` attribute
                            offset = replace(offset, placeholder, replacementCelex);
                        }
                        if (placeholder.indexOf(":OJ:TYPE:ELI") !== -1) {
                            if (attributes.eliType) {
                                offset = replace(offset, placeholder, attributes.eliType);
                            }
                            else {
                                // use the type from the optimal ELI URL
                                let eliParts = optimalBinding ? (optimalBinding.eli.value || "").split("/eli/") : [];
                                if (eliParts.length > 1) {
                                    let arr = (eliParts[1]).match(/^([a-z_]+)\/\d+\/.+$/i);

                                    let replacementEli = (arr && arr[1]) ? arr[1] : "";
                                    offset = replace(offset, placeholder, replacementEli);
                                }
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

        filters += `(?natNumber IN (${attributesList[i].no}) AND (STR(?ojDatePublication) = '${attributesList[i].date}') AND regex(str(?workId), "celex:"))`;
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
        ?ojDatePublication
        ?year
        ?natNumber
        ?eli
    WHERE {  
        graph ?ge { 
            ?exp cdm:expression_belongs_to_work ?s .
            ?exp cdm:expression_title ?title_
        } 
        ?s cdm:resource_legal_year ?year .
        ?s cdm:resource_legal_number_natural ?natNumber .
        ?s cdm:work_id_document ?workId.
        ?s cdm:resource_legal_eli ?eli .
        OPTIONAL {
            ?s cdm:resource_legal_published_in_official-journal ?q .
            ?q cdm:publication_general_date_publication ?ojDatePublicationOld .
        }
        OPTIONAL {
            FILTER (!BOUND(?ojDatePublicationOld))
            ?s cdm:official-journal-act_date_publication ?ojDatePublicationNew .
        }
        BIND(IF(BOUND(?ojDatePublicationOld), ?ojDatePublicationOld, ?ojDatePublicationNew) as ?ojDatePublication)

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
function findOptimalBinding(attributes, bindings) {

    return bindings.filter(binding => {
        return binding.ojDatePublication.value === `${attributes['data-ref-year']}-${String(attributes['data-ref-month']).padStart(2, '0')}-${String(attributes['data-ref-day']).padStart(2, '0')}` &&
            binding.year.value === String(attributes['data-ref-year']) &&
            binding.natNumber.value === String(attributes['data-ref-no']);

    }).pop();
}