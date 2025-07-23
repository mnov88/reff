/**
 * Query by ELI ids
 * @param {Array<String>} eliIds
 * @param {String} langISO3
 *
 * @returns {String}
 */
export const getEliQuery = function (eliIds, langISO3) {
    langISO3 = langISO3 || 'ENG';
    langISO3 = String(langISO3).toUpperCase();

    eliIds = eliIds.filter((v, i, a) => a.indexOf(v) === i);

    let filters = "FILTER (";
    for (let i = 0; i < eliIds.length; i++) {

        // provides better perfs for small eli sets but is unreliable. @TODO verify . 
        if (eliIds.length < 10) {
            filters += (`?eli = "${eliIds[i]}"^^<http://www.w3.org/2001/XMLSchema#anyURI>`);
        }
        else {
            filters += (`(STR(?eli) = "${eliIds[i]}")`);
        }

        if (i < eliIds.length - 1) {
            filters += " || ";
        }
    }
    filters += ")";

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
            ?date 
            ?id 
            ?title 
            ?eli 
            ?force 
            MIN(?dateForce) as ?dateForce 
            (REPLACE(?oj, " /, \\\\.\\\\.", "", "i") as ?oj)
            ?ojResourceUrl
            ?consolidatedDate 
            ?consolidatedEli
            ?consolidatedId
            ?initialEli
            ?initialForce
            ?initialDateValidity
            ?finalConsolidatedEli
            ?finalConsolidatedDate
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
            ?title_ as ?title 
            ?eli 
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
            ?initialCelexId 
            ?initialEli
            ?initialForce
            ?initialDateValidity
            ?finalConsolidatedEli
            ?finalConsolidatedDate
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
                filter(?lang=lang:${langISO3}).                  
            }    

            ?s cdm:resource_legal_eli ?eli .
            ${filters}
            {
                ?s cdm:work_date_document ?date .
                ?s rdf:type ?type .
                ?s cdm:work_id_document ?workId
                FILTER (STRSTARTS(?workId, "celex:")) . 
            }		

            OPTIONAL {
                ?s cdm:case-law_ecli ?ecli
            }
            OPTIONAL {
                ?s cdm:resource_legal_date_end-of-validity ?dateValidity .
            }

            OPTIONAL {
                # INITIAL ACT
                ?s cdm:act_consolidated_consolidates_resource_legal ?actInitial .
                ?actInitial cdm:resource_legal_eli ?initialEli . 
                ?actInitial cdm:work_id_document ?initialCelexId .
                # STATUS OF THE INITIAL ACT
                ?actInitial cdm:resource_legal_in-force ?initialForce .

                BIND(REPLACE(?initialEli, "/oj", "", "i") AS ?initialEliRaw) .

                FILTER regex(str(?initialCelexId), "celex:") 
                # make sure we focus on the right consolidated act REFTOLINK-1310
                FILTER STRSTARTS(?eli, ?initialEliRaw) 

                FILTER regex(str(?initialCelexId), "celex:") 
                FILTER NOT EXISTS {
                    ?actInitial cdm:resource_legal_corrects_resource_legal ?corrigendumEli .
                }

                OPTIONAL {
                    ?actInitial cdm:resource_legal_date_end-of-validity ?initialDateValidity .
                }

                # GET FINAL CONSOLIDATION OF INITIAL ACT
                OPTIONAL {
                    ?finalActConsolidated cdm:act_consolidated_based_on_resource_legal ?actInitial .
                    ?finalActConsolidated cdm:act_consolidated_date ?finalConsolidatedDate .
                    ?finalActConsolidated cdm:resource_legal_eli ?finalConsolidatedEli . 
                    # latest consolidation date only
                    filter not exists {
                        ?finalActConsolidated2 cdm:act_consolidated_based_on_resource_legal ?actInitial .
                        ?finalActConsolidated2 cdm:act_consolidated_date ?finalConsolidatedDate2
                        filter (?finalConsolidatedDate2 > ?finalConsolidatedDate)
                    }
                }
            }
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
                    ?actConsolidated2 cdm:act_consolidated_based_on_resource_legal ?s .
                    ?actConsolidated2 cdm:act_consolidated_date ?consolidatedDate2 .
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
                # FORCE
                ?s cdm:resource_legal_in-force ?force .
                ?s cdm:resource_legal_date_entry-into-force ?dateForce .
            }        
            OPTIONAL {
                # MANIFEST 
                ?manif cdm:manifestation_manifests_expression ?exp. 
                ?manif cdm:manifestation_type ?manifType .
                FILTER(STR(?manifType)="print" || BOUND(?ojPageFirst)) .

                # MANIFEST OJ PAGE
                OPTIONAL {
                    ?manif cdm:manifestation_official-journal_part_page_first ?ojPageFirst.
                    ?manif cdm:manifestation_official-journal_part_page_last ?ojPageLast.
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
                
                BIND(CONCAT(STR(DAY(?ojDateOld)), 
                ".", 
                STR(MONTH(?ojDateOld)), 
                ".", 
                STR(YEAR(?ojDateOld))) as ?ojDatePublicationOld)

                # cross match with parent OJ resource
                ?q owl:sameAs ?mainOjResourceUrlOld .
                ?q cdm:work_id_document ?ojIdOld.
                
                # multiple OJ publications can cause trouble so we cross-match the OJ url with the manifest's (where available)
                # DISABLED - using the first result 
                # FILTER (!BOUND(?manifOjResourceUrl) || STRSTARTS(STR(?manifOjResourceUrl), STR(?mainOjResourceUrlOld)) || (REGEX(STR(?langSpecificManif), 'resource/oj/DD_')))
                FILTER (STRSTARTS(STR(?ojIdOld), "oj:") AND STRSTARTS(STR(?mainOjResourceUrlOld), "http://publications.europa.eu/resource/oj/")) 
                BIND(?mainOjResourceUrlOld as ?ojResourceUrlOld)

                # OJ label; do not modify as it will be processed for translation
                BIND(IF(BOUND(?ojPartLabelOld), 
                CONCAT(CONCAT(REPLACE(?ojPartLabelOld, "-", " ", "i"), " ", 
                CONCAT(?ojNumberOld, 
                CONCAT(IF (STR(?ojClassOld) != "R", ?ojClass, ""),
                CONCAT(", ", CONCAT($ojDatePublicationOld,
                    CONCAT(IF(BOUND(?ojPageFirst), ", p. ", ""), 
                    CONCAT(IF(BOUND(?ojPageFirst), xsd:integer(?ojPageFirst), ""), 
                    CONCAT(IF(BOUND(?ojPageLast), "-", ""), IF(BOUND(?ojPageLast), xsd:integer(?ojPageLast), "")))))))))), "") as ?ojOld) .


                FILTER ( lang(?ojPartLabelOld) = "en" )
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
        }
    }`;

    return query;
};

export const getEliConsolidationsQuery = function (eliIds) {

    // remove last segment
    eliIds = eliIds.map(eid => eid.split("/").slice(0, -1).join("/") + "/");
    // unique values
    eliIds = eliIds.filter((v, i, a) => a.indexOf(v) === i);

    let filters = "FILTER (";
    for (let i = 0; i < eliIds.length; i++) {
        filters += (`(STRSTARTS(STR(?eli), "${eliIds[i]}"))`);


        if (i < eliIds.length - 1) {
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

    SELECT DISTINCT
        ?eli 
    WHERE {                  
        ?exp cdm:expression_belongs_to_work ?s .                                       
        ?s cdm:resource_legal_eli ?eli .
        ${filters}

        ?s cdm:work_id_document ?workId .
        FILTER (STRSTARTS(?workId, "celex:")) . 
}`;

    return query;
}


export const computeEliIdsMap = function (eliIds, consolidationEliIds) {

    consolidationEliIds = consolidationEliIds.map(item => item.eli.value);
    consolidationEliIds.sort((a, b) => {
        return a < b ? -1 : 1;
    });

    let computedEliIds = eliIds.map(eliId => {
        let eliRoot = eliId.split("/").slice(0, -1).join("/") + "/";
        let filtered = consolidationEliIds.filter(consEliId => {
            return consEliId.indexOf(eliRoot) === 0;
        });
        let found = filtered[filtered.length - 1] || eliId; // default is last one - the `/oj`
        // return last element from filtered smaller than our eliId
        if (eliId.slice(-3) !== "/oj") {
            for (let i = 0; i < filtered.length; i++) {
                if (filtered[i] <= eliId) {
                    found = filtered[i];
                }
                if (filtered[i] > eliId) {
                    break;
                }
            }
        }

        return [eliId, found];
    })

    console.debug("Computed ELI ids", computedEliIds);
    let map = {};
    computedEliIds.forEach(item => {
        map[item[0]] = item[1];
    });

    return map;
}