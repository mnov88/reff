import { extractAttributes } from "../../../../utils/functions.js";
import { extractCelexId, extractCelexAttributes } from "../../../../utils/data.js";
import { LD_TYPE_CELEX } from "../../../../manager/index.js";
import { replace, LD_CELLAR_ACT_URL_ELI } from "../../../utils/index.js";
import { getRequestPromise } from "../../../../utils/request.js";

/**
 * Resolve legacy act ELIs (urls). Very old acts (before 1962) do not reference the year so we need to query Cellar for it. 
 * Example: `Règlement n 12 de la Commission` - http://data.europa.eu/eli/reg/1961/12/oj
 * 
 * Processes placeholders: LD_CELLAR_ACT_NUMBER_CELEX, LD_CELLAR_ACT_URL_ELI
 * @param {Object} matches
 * @returns {Promise<Object>}  
 */
export const resolveLegacyActs = function (matches) {
    return new Promise((resolve, reject) => {

        // fill CELEX placeholders
        let attributesList = extractCelexAttributes(matches, LD_CELLAR_ACT_URL_ELI).map(attributes => {
            // strip placeholders
            return {
                number: attributes["data-ref-no"],
                author: attributes["data-ref-author"],
                type: attributes["data-ref-type"],
                celexId: String(attributes['data-ref-celex']).replace(new RegExp('{{\\s?[A-Z:]+\\s?}}', 'gi'), ''),
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

                    let optimalBinding = findOptimalBinding(attributes, bindings);
                    //try to resolve duplicate using matched reference

                    offset.rule.ld.forEach(placeholder => {
                        if (placeholder.indexOf(":ACT:NUMBER:CELEX") !== -1) {
                            // use the subnumber from the optimal CELEX id
                            let replacementCelex = optimalBinding ? (optimalBinding.id.value.slice(6).replace(rawCelexId, '')) : '';
                            offset = replace(offset, placeholder, replacementCelex);
                        }
                        if (placeholder.indexOf(":ACT:URL:ELI") !== -1) {
                            let replacementEliUrl = optimalBinding ? (optimalBinding.eli.value) : '';
                            offset = replace(offset, placeholder, replacementEliUrl);
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

        filters += `(STRSTARTS(?workId, "celex:") AND STR(?year)<'1962-01-01' AND ?author=<http://publications.europa.eu/resource/authority/corporate-body/${attributesList[i].author}> AND ?type='${attributesList[i].type}'^^xsd:string AND ?no = ${attributesList[i].number})`;
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
        ?year
        ?type
        ?author
        ?no
        ?title_ as ?title
    WHERE {  
        graph ?ge { 
            ?exp cdm:expression_belongs_to_work ?s .
            ?exp cdm:expression_title ?title_
        }
        graph ?g { 
            ?exp cdm:expression_uses_language ?lang
            filter(?lang=lang:FRA).  
        } 
    
        ?s cdm:resource_legal_eli ?eli.
        ?s cdm:work_id_document ?workId. 
        ?s cdm:resource_legal_type ?type .
        ?s cdm:resource_legal_number_natural ?no .
        ?s cdm:resource_legal_year ?year .
        ?s cdm:work_created_by_agent ?author
    
    FILTER (${filters}) 
}`;

    return query;
}

/**
 * Find the best binding to use for the match.
 * 
 * @param {Object} attributes
 * @param {Array} bindings
 * 
 * @returns {Object} binding
 */
function findOptimalBinding(attributes, bindings) {

    // find the right ref
    return bindings.filter(binding => {
        return binding.author.value === "http://publications.europa.eu/resource/authority/corporate-body/" + attributes['data-ref-author'] &&
            binding.no.value === attributes['data-ref-no'] &&
            binding.type.value === attributes['data-ref-type'];
    }).pop();
}