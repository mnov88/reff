/**
 * Build classifications query (eurovoc + subject matters) for a specific CELEX id
 * @param {String} celexIds
 * @returns {String} 
 */
export function getClassificationsQuery(celexId, langISO2) {

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
    PREFIX skos-xl: <http://www.w3.org/2008/05/skos-xl#>
    PREFIX core: <http://www.w3.org/2004/02/skos/core#>
    SELECT  
    DISTINCT ?eurovoc ?eurovocLabel ?subjectMatter ?subjectMatterLabel
    WHERE {  
      ?exp cdm:expression_belongs_to_work ?s .
      ?exp cdm:expression_title ?title_ . 
      ?s cdm:work_id_document ?workId.
      ?s cdm:work_is_about_concept_eurovoc ?eurovoc .
      ?eurovoc skos:prefLabel ?eurovocLabel.  
      ?s cdm:resource_legal_is_about_subject-matter ?subjectMatter .
      ?subjectMatter skos:prefLabel ?subjectMatterLabel. 
        ${filters}.
        FILTER (lang(?eurovocLabel) = "${String(langISO2).toLowerCase()}" AND lang(?subjectMatterLabel) = "${String(langISO2).toLowerCase()}")
    }`;

    return query;
}