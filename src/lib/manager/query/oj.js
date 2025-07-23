/**
 * Query by OJ ids
 * @param {Array<String>} ojIds 
 * @param {String} langISO3 (optional, will default to ENG)
 * 
 * @returns {String}
 */
export const getOjQuery = function (ojIds, langISO3) {

    let langISO3s = langISO3 ? [String(langISO3).toUpperCase()] : ["ENG", "FRA"]; // default to english or french
    let langISO3Filters = "FILTER (?lang IN (";
    for (let i = 0; i < langISO3s.length; i++) {
        langISO3Filters += `lang:${langISO3s[i]}`;
        if (i < langISO3s.length - 1) {
            langISO3Filters += ",";
        }
    }
    langISO3Filters += "))";

    // unique ids only
    ojIds = ojIds.filter((v, i, a) => a.indexOf(v) === i);

    let filters = "FILTER (?workId IN (";
    for (let i = 0; i < ojIds.length; i++) {
        filters += `"oj:${ojIds[i]}", "oj:${ojIds[i]}"^^xsd:string`; // query both types
        if (i < ojIds.length - 1) {
            filters += ",";
        }
    }
    filters += "))";

    let pointInTimeFilter1 = '';
    let pointInTimeFilter2 = '';
    let pointInTimeFilter3 = '';
    let pointInTimeFilter4 = '';
    if (R2L.options.pointInTime) {
        pointInTimeFilter1 = `FILTER(?consolidatedDate < "${R2L.options.pointInTime}"^^xsd:date)`;
        pointInTimeFilter2 = `FILTER(?consolidatedDate2 < "${R2L.options.pointInTime}"^^xsd:date)`;
        pointInTimeFilter3 = `FILTER(?repealDate < "${R2L.options.pointInTime}"^^xsd:date)`;
        pointInTimeFilter4 = `FILTER(?repealDate2 < "${R2L.options.pointInTime}"^^xsd:date)`;
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
            ?date ?id 
            ?title 
            ?baseTitle
            ?eli 
            ?ecli
            ?force 
            MIN(?dateForce) as ?dateForce
            (REPLACE(?oj, " /, \\\\.\\\\.", "", "i") as ?oj)
            ?ojId 
            ?ojResourceUrl
            ?ojDate
            ?consolidatedDate 
            ?consolidatedEli 
            ?consolidatedId
            MAX(?dateValidity) as ?dateValidity
            ?repealCelexId 
            ?repealEli
            ?lastRepealCelexId
            ?lastRepealEli
            ?resourceUrl
            ?lang
{
        SELECT 
            ?date ?workId as ?id 
            ?title 
            ?baseTitle
            ?eli 
            ?ecli
            ?force 
            ?dateForce 
            (IF(BOUND(?ojIdOld), ?ojIdOld, ?ojActId) as ?ojId)
            (IF(BOUND(?ojResourceUrlOld), ?ojResourceUrlOld, ?ojActResourceUrl) as ?ojResourceUrl)
            (IF(BOUND(?ojDateOld), ?ojDateOld, ?ojActDate) as ?ojDate)
            (IF(BOUND(?ojOld), ?ojOld, CONCAT(CONCAT(CONCAT(CONCAT(CONCAT(REPLACE(STR(?ojCollectionDocumentIdentifier ) , "-", " ", "i"), " "), CONCAT(?ojActYear, "/"))), CONCAT(?ojActNumber, ", ")), 
            CONCAT(CONCAT(SUBSTR(STR(?ojActDate), 9, 2), "."), CONCAT(CONCAT(SUBSTR(STR(?ojActDate), 6, 2), ".")), SUBSTR(STR(?ojActDate), 1, 4)))) as ?oj)
            ?consolidatedDate 
            ?consolidatedEli 
            ?consolidatedId
            ?dateValidity
            ?repealCelexId 
            ?repealEli
            ?lastRepealCelexId
            ?lastRepealEli
            ?resourceUrl
            ?lang
        WHERE {  
            graph ?ge { 
                ?exp cdm:expression_belongs_to_work ?s .
                ?exp cdm:expression_title ?title_ .
                OPTIONAL {
                    ?exp owl:sameAs ?resourceUrl .
                    FILTER (REGEX(?resourceUrl, "resource/oj/"))
                }
            }
            graph ?g { 
                ?exp cdm:expression_uses_language ?lang
                ${langISO3Filters}
            }  
            ?s cdm:work_date_document ?date .
            ?s rdf:type ?type .
            ?s cdm:work_id_document ?workId.
            OPTIONAL {
                ?s cdm:case-law_ecli ?ecli
            }
            OPTIONAL {
                ?s cdm:resource_legal_date_end-of-validity ?dateValidity .
            }
            ${filters}

            OPTIONAL {
                # CONSOLIDATION
                ?actConsolidated cdm:act_consolidated_based_on_resource_legal ?s .
                ?actConsolidated cdm:act_consolidated_date ?consolidatedDate .
                ?actConsolidated cdm:resource_legal_date_entry-into-force ?consolidatedDateEntryForce .
                ?actConsolidated cdm:resource_legal_eli ?consolidatedEli . 
                ?actConsolidated cdm:work_id_document ?consolidatedId_ .
                
                # we only need results before the end of the act validity
                ?s cdm:resource_legal_date_end-of-validity ?act_end_of_validity .

                ${pointInTimeFilter1}
                FILTER (?consolidatedDateEntryForce < ?act_end_of_validity)     
                FILTER regex(str(?consolidatedId_), "celex:")     
                # latest consolidation date only
                FILTER not exists {
                    ?actConsolidated2 cdm:resource_legal_date_entry-into-force ?consolidatedDateEntryForce2 .
                    ?actConsolidated2 cdm:act_consolidated_date ?consolidatedDate2 .
                    ?actConsolidated2 cdm:act_consolidated_based_on_resource_legal ?s .
                    ?s cdm:resource_legal_date_end-of-validity ?act_end_of_validity2 .
                    ${pointInTimeFilter2}
                    FILTER (?consolidatedDateEntryForce2 > ?consolidatedDateEntryForce AND (?consolidatedDateEntryForce2 < ?act_end_of_validity2))
                }

                BIND(SUBSTR(?consolidatedId_, 7) as ?consolidatedId)
            }
            OPTIONAL {
                # REPEALING
                ?actRepeal cdm:resource_legal_repeals_resource_legal ?s .
                ?actRepeal cdm:resource_legal_eli ?repealEli . 
                ?actRepeal cdm:work_date_document ?repealDate . 
                ?actRepeal cdm:work_id_document ?repealCelexId_.
                ${pointInTimeFilter3}
                FILTER regex(str(?repealCelexId_), "celex:")                    
                BIND(SUBSTR(?repealCelexId_, 7) as ?repealCelexId)

                OPTIONAL {
                    # REPEALING LAST
                    ?lastActRepeal cdm:resource_legal_repeals_resource_legal+ ?s .
                    ?lastActRepeal cdm:resource_legal_eli ?lastRepealEli . 
                    ?lastActRepeal cdm:work_id_document ?lastRepealCelexId_.
                    FILTER regex(str(?lastRepealCelexId_), "celex:")                    
                    FILTER not exists {
                       ?actRepeal_ cdm:resource_legal_repeals_resource_legal ?lastActRepeal .
                       ?actRepeal_ cdm:work_date_document ?repealDate2
                       ${pointInTimeFilter4}
                    } 
                    BIND(SUBSTR(?lastRepealCelexId_, 7) as ?lastRepealCelexId)
                }
            }
            OPTIONAL {
                ?s cdm:resource_legal_eli ?eli .
            }
            OPTIONAL {
                # FORCE
                ?s cdm:resource_legal_in-force ?force .
                ?s cdm:resource_legal_date_entry-into-force ?dateForce .
            }        
            OPTIONAL {
                # MANIFEST 
                ?manif cdm:manifestation_manifests_expression ?exp. 
                ?manif cdm:manifestation_type ?manifType .
                FILTER(STR(?manifType)="print" || BOUND(?ojPageFirst)) .

                # MANIFEST OJ PAGE (optional)
                OPTIONAL {
                    ?manif cdm:manifestation_official-journal_part_page_first ?ojPageFirst.
                    ?manif cdm:manifestation_official-journal_part_page_last ?ojPageLast.
                }

                ?manif cdm:manifestation_part_of_manifestation ?parentManif.
                OPTIONAL {
                    ?parentManif owl:sameAs ?langSpecificManif.
                }
                OPTIONAL {
                    ?manif owl:sameAs ?manifOjResourceUrl .
                    # We need to use the MANIFEST to get to the OJ
                    FILTER (STRSTARTS(STR(?manifOjResourceUrl), "http://publications.europa.eu/resource/oj/"))
                }

                # OJ info
                ?s cdm:resource_legal_published_in_official-journal ?q .
                ?q cdm:official-journal_part_of_collection_document ?ojPartOld .
                ?q cdm:official-journal_number ?ojNumberOld .
                OPTIONAL {
                    ?q cdm:official-journal_class ?ojClassOld .
                }
                ?ojPartOld skos:prefLabel ?ojPartLabelOld .
                ?q cdm:official-journal_volume ?ojVolumeOld .
                ?q cdm:publication_general_date_publication ?ojDateOld .
                
                # cross match with parent OJ resource
                ?q owl:sameAs ?mainOjResourceUrlOld .
                ?q cdm:work_id_document ?ojIdOld.
                
                # multiple OJ publications can cause trouble so we cross-match the OJ url with the manifest's (where available)
                FILTER (!BOUND(?langSpecificManif) || STRSTARTS(STR(?langSpecificManif), STR(?mainOjResourceUrlOld)))
                FILTER (STRSTARTS(STR(?ojIdOld), "oj:") AND STRSTARTS(STR(?mainOjResourceUrlOld), "http://publications.europa.eu/resource/oj/")) 
                BIND(?mainOjResourceUrlOld as ?ojResourceUrlOld)

                BIND(CONCAT(STR(DAY(?ojDateOld)), 
                ".", 
                STR(MONTH(?ojDateOld)), 
                ".", 
                STR(YEAR(?ojDateOld))) as ?ojDatePublicationOld)

                # OJ label; do not modify as it will be processed for translation
                BIND(IF(BOUND(?ojPartLabelOld), 
                CONCAT(CONCAT(REPLACE(?ojPartLabelOld, "-", " ", "i"), " ", 
                CONCAT(?ojNumberOld, 
                CONCAT(IF (STR(?ojClassOld) != "R", ?ojClassOld, ""),
                CONCAT(", ", CONCAT($ojDatePublicationOld,
                    CONCAT(IF(BOUND(?ojPageFirst), ", p. ", ""), 
                    CONCAT(IF(BOUND(?ojPageFirst), xsd:integer(?ojPageFirst), ""), 
                    CONCAT(IF(BOUND(?ojPageLast), "-", ""), IF(BOUND(?ojPageLast), xsd:integer(?ojPageLast), "")))))))))), "") as ?ojOld) .

                FILTER (lang(?ojPartLabelOld) = "en" )
            }

            # OJ act-by-act (not in use as it is very slow)
            OPTIONAL {
                FILTER NOT EXISTS {
                    ?s cdm:resource_legal_published_in_official-journal ?_ojTemp
                }
                ?s cdm:official-journal-act_date_publication ?ojActDate .
                ?s cdm:official-journal-act_part_of_collection_document ?ojCollectionDocument .
                ?ojCollectionDocument dc:identifier ?ojCollectionDocumentIdentifier .
                ?s cdm:official-journal-act_subsubsection_oj ?ojSubsection .
                ?s cdm:official-journal-act_number ?ojActNumber .
                ?s cdm:official-journal-act_year ?ojActYear .
                
                ?s cdm:work_id_document ?ojActId. 
                FILTER (STRSTARTS(STR(?ojActId), "oj:"))
                ?s cdm:resource_legal_eli ?ojActResourceUrl . 
            } 

            BIND(CONCAT(?title_, IF(BOUND(?ecli), CONCAT("\\nECLI identifier: ", ?ecli), "")) as ?title) 
            BIND(?title_ as ?baseTitle)
        }
    }
    ORDER BY ?id ?lang`;

    return query;
}
