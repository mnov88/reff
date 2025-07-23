/**
 * ECLI ids query
 * @param {Array<String>} ecliIds 
 * @param {String} langISO3 
 * 
 * @returns {String}
 */
export const getEcliQuery = function (ecliIds, langISO3) {
    let langISO3s = langISO3 ? [String(langISO3).toUpperCase()] : ["ENG", "FRA"]; // default to english or french
    let langISO3Filters = "FILTER (?lang IN (";
    for (let i = 0; i < langISO3s.length; i++) {
        langISO3Filters += `lang:${langISO3s[i]}`;
        if (i < langISO3s.length - 1) {
            langISO3Filters += ",";
        }
    }
    langISO3Filters += "))";

    ecliIds = ecliIds.filter((v, i, a) => a.indexOf(v) === i);
    let filters = "FILTER (";
    for (let i = 0; i < ecliIds.length; i++) {
        filters += (`?ecli="${ecliIds[i]}"^^xsd:string`);
        if (i < ecliIds.length - 1) {
            filters += " || ";
        }
    }
    filters += ")";

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

        SELECT DISTINCT ?workId as ?celexId ?date ?ecli as ?id ?title_ as ?title ?force ?dossierTitle ?lang WHERE {   
            graph ?ge { 
                ?exp cdm:expression_belongs_to_work ?s .
                ?exp cdm:expression_title ?title_
            }
            graph ?g { 
                ?exp cdm:expression_uses_language ?lang
                ${langISO3Filters}
            }       
        
            ?s cdm:case-law_ecli ?ecli .
            ?s cdm:work_date_document ?date .
            ?s cdm:work_id_document ?workId.

            OPTIONAL {
                ?s2 cdm:case-law_ecli ?ecli .
                ?s2 cdm:work_part_of_dossier ?dossier.
                ?dossier cdm:dossier_title ?dossierTitle
            }

            ${filters} .
            FILTER regex(str(?workId), "celex")
            FILTER (!regex(str(?workId), "_"))
            OPTIONAL {
                ?s cdm:resource_legal_in-force ?force .
            }
        }
        ORDER BY ?id ?lang
    `;

    return query;
};