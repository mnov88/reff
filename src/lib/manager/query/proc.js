

/**
 * Parlamentary Procedure ids query
 * @param {Array<String>} procIds 
 * @param {String} langISO3 
 * 
 * @returns {String}
 */
export const getProcedureQuery = function (procIds, langISO3) {
    let langISO3Filters = `FILTER (?workLang IN (lang:${String(langISO3).toUpperCase()}, lang:ENG, lang:FRA))`;

    procIds = procIds.filter((v, i, a) => a.indexOf(v) === i);
    let filters = "FILTER (";
    for (let i = 0; i < procIds.length; i++) {
        filters += (`?id="${procIds[i]}"^^xsd:string`);
        if (i < procIds.length - 1) {
            filters += " || ";
        }
    }
    filters += ")";

    let query = `
    PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>
        SELECT DISTINCT
            ?id
            ?workLang as ?lang
            ?dateAdopted
            ?isAdopted
            ?publishedWorkId
            ?workTitle as ?baseTitle
            CONCAT((CONCAT(?dossierType, CONCAT(CONCAT('(', CONCAT(?dossierYear, ')'), ?dossierRef)))), CONCAT(': ', ?workTitle)) AS ?title
            (CONCAT(?dossierType, CONCAT(CONCAT('(', CONCAT(?dossierYear, ')'), ?dossierRef)))) AS ?reference
        WHERE {
            ?s cdm:procedure_code_interinstitutional_reference_procedure ?id
            ${filters}
            ?s cdm:dossier_contains_work ?work .
            OPTIONAL {
                ?s cdm:dossier_date_adopted ?dateAdopted.    
            }
            ?s cdm:dossier_adopted-proposal ?isAdopted .

            # find OJ publication
            OPTIONAL {
                ?s cdm:dossier_contains_event ?evt .
                ?evt cdm:event_legal_has_type_concept_type_event_legal <http://publications.europa.eu/resource/authority/event/PUB_OJ> .
                ?evt cdm:event_legal_contains_work ?publishedWork .
                ?publishedWork cdm:work_id_document ?publishedWorkId 
                FILTER regex(str(?publishedWorkId), "celex")
            }

            ?s cdm:dossier_number_reference ?dossierRef.   
            ?s cdm:dossier_type_reference ?dossierType.  
            ?s cdm:dossier_year_reference ?dossierYear.  
            ?s cdm:dossier_contains_work ?work.

            ?work cdm:work_id_document ?workId.
            ?work cdm:work_date_document ?workDate
            FILTER NOT EXISTS {
                ?s cdm:dossier_contains_work ?work2.
                ?work2 cdm:work_date_document ?workDate2
                FILTER (?workDate2 > ?workDate)
            }
   
            ?exp cdm:expression_belongs_to_work ?work .
            ?exp cdm:expression_title ?workTitle .
            ?exp cdm:expression_uses_language ?workLang .
            ${langISO3Filters}
        }
        ORDER BY ?id ?lang
    `;

    return query;
};

export const processProcResponse = (response, langISO3) => {
    // resolve language
    let idMap = {};
    response.results.bindings = response.results.bindings.map(binding => {
        if (binding.title && binding.title.value) {
            binding.title.value = binding.title.value.replace(new RegExp("&#13;\n", 'g'), ' ');
            // add status
            if (binding.isAdopted.value === '1') {
                binding.title.value += '\n' + "✔ Completed";
                if (binding.publishedWorkId) {
                    binding.title.value += ` (Adopted act: ${String(binding.publishedWorkId.value).replace("celex:", "")})`;
                }
            }
            else {
                binding.title.value += '\n' + "↻ Ongoing";
            }
        }
        if (!idMap[binding.id.value]) {
            idMap[binding.id.value] = [];
        }
        idMap[binding.id.value].push(binding);
        return binding;
    });

    let newBindings = [];
    // default to english or french
    Object.keys(idMap).forEach(id => {
        let foundLang = idMap[id].filter(m => m.lang.value === 'http://publications.europa.eu/resource/authority/language/' + String(langISO3).toUpperCase()).pop();
        if (!foundLang) {
            foundLang = idMap[id].filter(m => m.lang.value === 'http://publications.europa.eu/resource/authority/language/ENG').pop();
        }
        if (!foundLang) {
            foundLang = idMap[id].filter(m => m.lang.value === 'http://publications.europa.eu/resource/authority/language/FRA').pop();
        }
        if (foundLang) {
            newBindings.push(foundLang);
        }
    })

    response.results.bindings = newBindings;

    return response;
}
