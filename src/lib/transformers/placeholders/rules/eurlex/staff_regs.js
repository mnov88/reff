
import { extractAttributes } from "../../../../utils/functions.js";
import { LD_TYPE_CELEX } from "../../../../manager/index.js";
import { replace, replaceStr, LD_CELLAR_CONSOLIDATION_CELEX, LD_CELLAR_CONSOLIDATION_ELI } from "../../../utils/index.js";
import { getRequestPromise } from "../../../../utils/request.js";
import { extractCelexId } from "../../../../utils/data.js";

/**
 * NOT IN USE
 * Staff Regulations rule can use this transformer to resolve the latest consolidation. 
 * 
 * Processes placeholders: LD_CELLAR_CONSOLIDATION_CELEX, LD_CELLAR_CONSOLIDATION_ELI
 * @param {Object} matches
 * @returns {Promise<Object>} matches 
 */
export const resolveStaffRegsConsolidation = (matches) => {
    return new Promise((resolve, reject) => {

        let query = getQuery();
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

                    let rawCelexId = String(celexId).replace(new RegExp('{{\\s?[^\\s}]{1,50}\\s?}}', 'gi'), '');

                    //nothing to parse
                    if (celexId === rawCelexId) {
                        return;
                    }

                    let optimalBinding = bindings.pop();

                    offset.rule.ld.forEach(placeholder => {
                        if (placeholder.indexOf(":CONSOLIDATION:CELEX") !== -1) {
                            // use the subnumber from the optimal CELEX id
                            let replacementCelex = optimalBinding ? (optimalBinding.id.value.slice(6).replace(rawCelexId, '')) : '';
                            offset = replace(offset, placeholder, replacementCelex);
                        }
                        if (placeholder.indexOf(":CONSOLIDATION:ELI") !== -1) {
                            // use the subnumber from the optimal ELI URL
                            let eliParts = (optimalBinding.eli.value || "").split("/eli/");
                            if (eliParts.length > 1) {
                                let date = eliParts[1].split("/").slice(-1).pop();
                                let replacementEli = (date && /^\d\d\d\d-\d\d-\d\d$/.test(date)) ? date : "";
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
}


function getQuery() {

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
            filter(?lang=lang:ENG).  
        } 
        ?s cdm:work_id_document ?workId. 
        ?s cdm:resource_legal_year '1962'^^xsd:gYear . 
        ?s cdm:resource_legal_type 'R'^^xsd:string .
        ?s cdm:resource_legal_eli ?eli

        FILTER ( (STRSTARTS( ?workId, "celex:01962R0031"))) 
        }
        ORDER BY DESC(?workId)
        LIMIT 1
        `;

    return query;
}

