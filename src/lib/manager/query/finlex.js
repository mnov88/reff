
export const getFinlexEliQuery = function (eliIds, langISO3) {
    langISO3 = String(langISO3).toUpperCase();
    // unique ids only
    eliIds = eliIds.filter((v, i, a) => a.indexOf(v) === i);

    let filters = "FILTER (";
    for (let i = 0; i < eliIds.length; i++) {
        filters += `?eli = <${eliIds[i]}>`;
        if (i < eliIds.length - 1) {
            filters += " || ";
        }
    }
    filters += ")";

    let query = `
    prefix xsd: <http://www.w3.org/2001/XMLSchema#>
    prefix dct: <http://purl.org/dc/terms/>
    prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    prefix owl: <http://www.w3.org/2002/07/owl#>
    prefix skos: <http://www.w3.org/2004/02/skos/core#>
    prefix foaf: <http://xmlns.com/foaf/0.1/>
    prefix eli: <http://data.europa.eu/eli/ontology#>
    
    SELECT distinct ?title ?date ?publicationDate ?id {
        
        ?eli eli:date_document ?date .
        ?eli eli:date_publication ?publicationDate .
        ?eli eli:is_realized_by ?eliFin .
        ?eliFin eli:language <http://publications.europa.eu/resource/authority/language/FIN> .
        ?eliFin eli:title ?t .
        BIND (?eli as ?id) .
        BIND (CONCAT(STR(?t), 
            CONCAT(
                CONCAT("\\n\\nPublication date: ", STR(?publicationDate) ), 
                CONCAT("\\nDocument date: ", STR(?date) ) 
            )
        ) as ?title)
        ${filters}
    }
   `;

   return query;
}