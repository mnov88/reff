

export function getJoinedCaseQuery() {
    return `
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
        ?exp cdm:expression_belongs_to_work ?s .
        ?exp cdm:expression_title ?title .
        ?exp cdm:expression_uses_language ?lang
        FILTER (?lang IN (lang:FRA))
          
        ?s cdm:work_id_document ?workId.
        ?s cdm:resource_legal_type ?type .
        ?s cdm:resource_legal_id_sector "6"^^xsd:string .         
        FILTER (?type IN ("TA"^^xsd:string, "CA"^^xsd:string))
        FILTER (REGEX(?title, "^Affaires.jointes") AND REGEX(STR(?workId), "^celex:6"))
    }`;
}