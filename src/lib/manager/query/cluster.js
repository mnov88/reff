import { regExpEscape, normalizeString } from "../../utils/functions";

/**
 * Build query to retrieve all the acts cited by a specific CELEX id
 * @param {String} celexIds
 * @param {String} langISO3
 * @param {String} searchText (optional)
 * @param {String} documentType (optional) - celex sector number (3 for legal acts, 6 for case law)
 * @returns {String} 
 */
export function getActsCitedByActQuery(celexId, langISO3, searchText, documentType) {

    let filters = `FILTER (?workId IN ("celex:${celexId}", "celex:${celexId}"^^xsd:string))`; // query both types

    let searchTextEscaped = searchText ? normalizeString(regExpEscape(searchText.toLowerCase())).replaceAll('"', '\\"') : null;
    let searchFilter = searchTextEscaped ? `FILTER(regex(?title, "${searchTextEscaped}", "i" ))` : ``;
    let docTypeFilter = documentType ? `FILTER(STRSTARTS(?citedWorkId, "celex:${documentType}"))` : `FILTER(STRSTARTS(?citedWorkId, "celex"))`;

    let searchTriples = searchTextEscaped ? `
        ?exp cdm:expression_belongs_to_work ?citedWork .
        ?exp cdm:expression_title ?title .
        ?exp cdm:expression_uses_language ?lang .
        filter(?lang=lang:${langISO3.toUpperCase()}).` : ``;

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
            ?workId as ?id ?citedWorkId ?citedWorkEcli ?fragmentCitedTarget ?fragmentCitedSource
        WHERE {  
            ?exp cdm:expression_belongs_to_work ?s .

            ?s cdm:work_cites_work ?citedWork .
            OPTIONAL {
                ?citedWork cdm:case-law_ecli ?citedWorkEcli
            }
            ?citedWork cdm:work_id_document ?citedWorkId .
            ${searchTriples}
            OPTIONAL{
                ?bn owl:annotatedSource ?s.
                ?bn owl:annotatedTarget ?citedWork.
                ?bn owl:annotatedProperty <http://publications.europa.eu/ontology/cdm#work_cites_work>.
                OPTIONAL{
                   ?bn <http://publications.europa.eu/ontology/annotation#fragment_cited_target> ?fragmentCitedTarget.
                }
                OPTIONAL{
                   ?bn <http://publications.europa.eu/ontology/annotation#fragment_citing_source> ?fragmentCitedSource.
                }
          }
            `;


    query += ` 
            ?s cdm:work_id_document ?workId.
            ${filters}.
            ${searchFilter}
            ${docTypeFilter}
        }
        order by ?citedWorkId  ?fragmentCitedTarget ?fragmentCitedSource
        LIMIT 501
        `;

    return query;
}


/**
 * Build list of acts citing a specific CELEX id
 * @param {String} celexIds
 * @param {String} langISO3
 * @param {String} searchText (optional)
 * @param {String} documentType - celex sector number (3 for legal acts, 6 for case law)
 * @returns {String} 
 */
export function getActsCitingActQuery(celexId, langISO3, searchText, documentType) {

    let filters = `FILTER (?workId IN ("celex:${celexId}", "celex:${celexId}"^^xsd:string))`; // query both types

    let searchTextEscaped = searchText ? normalizeString(regExpEscape(searchText.toLowerCase())).replaceAll('"', '\\"') : null;
    let searchFilter = searchTextEscaped ? `FILTER(regex(?title, "${searchTextEscaped}", "i" ))` : ``;

    let docTypeFilter = documentType ? `FILTER(STRSTARTS(?citingWorkId, "celex:${documentType}"))` : `FILTER(STRSTARTS(?citingWorkId, "celex"))`;

    let searchTriples = searchTextEscaped ? `
        ?exp cdm:expression_belongs_to_work ?citingWork .
        ?exp cdm:expression_title ?title .
        ?exp cdm:expression_uses_language ?lang .
        filter(?lang=lang:${langISO3.toUpperCase()}).` : ``;

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
            ?workId as ?id ?citingWorkId ?citingWorkEcli ?fragmentCitedTarget ?fragmentCitedSource
        WHERE {  
            ${searchTriples}
            ?citingWork cdm:work_cites_work ?s .
            OPTIONAL {
                ?citingWork cdm:case-law_ecli ?citingWorkEcli
            }
            ?citingWork cdm:work_id_document ?citingWorkId .
            OPTIONAL{
                ?bn owl:annotatedSource ?citingWork.
                ?bn owl:annotatedTarget ?s.
                ?bn owl:annotatedProperty <http://publications.europa.eu/ontology/cdm#work_cites_work>.
                OPTIONAL{
                   ?bn <http://publications.europa.eu/ontology/annotation#fragment_cited_target> ?fragmentCitedTarget.
                }
                OPTIONAL{
                   ?bn <http://publications.europa.eu/ontology/annotation#fragment_citing_source> ?fragmentCitedSource.
                }
          }
            `;

    query += ` 
            ?s cdm:work_id_document ?workId.
            ${filters}
            ${searchFilter}
            ${docTypeFilter}
            FILTER(!regex(?citingWorkId, "_SUM$") AND !regex(?citingWorkId, "_INF$"))
        }
        order by ?citingWorkId  ?fragmentCitedTarget ?fragmentCitedSource
        LIMIT 501
        `;

    return query;
}

/**
* Build query to retrieve all the acts that this act is based on
* @param {String} celexId
* @param {String} langISO3
* @returns {String} 
*/
export function getBasisActsByActQuery(celexId, langISO3) {

    let filters = `FILTER (?workId IN ("celex:${celexId}", "celex:${celexId}"^^xsd:string))`; // query both types

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
       ?workId as ?id ?basisWorkId
        WHERE {  
            ?exp cdm:expression_belongs_to_work ?s .

            ?s cdm:resource_legal_based_on_resource_legal ?basisWork .
            ?basisWork cdm:work_id_document ?basisWorkId .
            FILTER(STRSTARTS(?basisWorkId, "celex")) .
            ?s cdm:work_id_document ?workId.`

    query += ` 
        ${filters}.
    }
    order by ?basisWorkId
    LIMIT 501
    `;

    return query;
}

/**
* Build query to retrieve all the acts that use this act as a legal basis
* @param {String} celexId
* @param {String} langISO3
* @returns {String} 
*/
export function getActsByBasisActQuery(celexId, langISO3) {

    let filters = `FILTER (?workId IN ("celex:${celexId}", "celex:${celexId}"^^xsd:string))`; // query both types

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
       ?workId as ?id ?resultingWorkId
        WHERE {  
            ?exp cdm:expression_belongs_to_work ?s .

            ?resultingWork cdm:resource_legal_based_on_resource_legal ?s .
            ?resultingWork cdm:work_id_document ?resultingWorkId .
            FILTER(STRSTARTS(?resultingWorkId, "celex")) .
            ?s cdm:work_id_document ?workId.`

    query += ` 
        ${filters}.
    }
    order by ?resultingWorkId
    LIMIT 501
    `;

    return query;
}