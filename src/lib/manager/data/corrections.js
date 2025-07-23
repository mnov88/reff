import { LD_TARGET_CELLAR, LD_TYPE_CELEX } from "../index.js";
import { getRequestPromise } from "../../utils/request.js";

export function appendCorrectionsData(response, langISO3) {
    return new Promise(function (resolve, reject) {
        let celexIds = [];
        if (!response || !response.results || !response.results.bindings) {
            resolve(response);
            return;
        }

        response.results.bindings.forEach(binding => {
            let idList = binding && binding.id ? binding.id.value : "";
            let ids = String(idList || "").split(",").filter(id => !!id).map(id => id.replace("celex:", ""));
            celexIds = celexIds.concat(ids);
        });
        // unique ids only
        celexIds = celexIds.filter((v, i, a) => a.indexOf(v) === i);
        // remove ids which are already corrections (ending with 'R(01)')
        celexIds = celexIds.filter(id => {
            return !/R\(\d+\)$/.test(id);
        });

        if (celexIds.length === 0) {
            resolve(response);
            return;
        }
        getCorrectionsData(celexIds, langISO3).then(correctionsResponse => {
            try {
                let correctionCelexIds = correctionsResponse.results.bindings.map(res => {
                    return res.correctionCelexId.value;
                });
                response.results.bindings = response.results.bindings.map(binding => {
                    // append correction data
                    binding["correctionCelexIds"] = {
                        datatype: "http://www.w3.org/2001/XMLSchema#string",
                        type: "typed-literal",
                        value: correctionCelexIds.filter(id => {
                            return id.indexOf(binding.id.value.replace("celex:", "") + "R(") === 0
                        }).join(",")
                    };

                    return binding;
                })
            }
            catch (e) {
                console.error(e);
            }
            resolve(response);
        }, (err) => {
            console.error(err);
            resolve(response);
        })
    });
}

export function getCorrectionsData(celexIds, langISO3) {
    let query = getCorrectionsQuery(celexIds, langISO3);
    let format = 'application/json';
    return getRequestPromise(R2L.ldm.getEndpoint(LD_TYPE_CELEX), "POST", {
        query: query,
        format: format,
        origin: '*',
        target: LD_TARGET_CELLAR
    });
}

/**
 * Build query for corrections data
 * @param {Array<string>} celexIds 
 * @param {string} langISO3
 * @returns 
 */
export function getCorrectionsQuery(celexIds, langISO3) {
    langISO3 = langISO3 || "ENG";
    langISO3 = String(langISO3).toUpperCase();
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
    PREFIX owl:<http://www.w3.org/2002/07/owl#>

    SELECT DISTINCT 
        ?corrCelexId as ?correctionCelexId
        
    WHERE {  
        ?s cdm:work_id_document ?workId.
        ${filters}

        # CORRECTIONS
        ?corr cdm:resource_legal_corrects_resource_legal ?s .
        ?corr cdm:resource_legal_id_celex ?corrCelexId .
        FILTER exists {
            ?expCorr cdm:expression_belongs_to_work ?corr .
            ?expCorr cdm:expression_uses_language lang:${langISO3}
        }
    }`;

    return query;
}