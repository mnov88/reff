/**
 * Consil ids query
 * @param {Array<String>} consilIds 
 * @param {String} langISO3 
 * 
 * @returns {String}
 */
export const getConsilQuery = function (consilIds, langISO3) {
    let langISO3Filters = `FILTER (?workLang IN (lang:${String(langISO3).toUpperCase()}, lang:ENG, lang:FRA))`;

    consilIds = consilIds.filter((v, i, a) => a.indexOf(v) === i);
    let filters = "FILTER (";
    for (let i = 0; i < consilIds.length; i++) {
        filters += (`?id="consil:${consilIds[i]}"^^xsd:string`);
        if (i < consilIds.length - 1) {
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
            ?title
            ?date
            ?workLang as ?lang
        WHERE {
            
            ${filters}
        
            ?work cdm:work_id_document ?id .
            ?work cdm:work_date_document ?date .
   
            ?exp cdm:expression_belongs_to_work ?work .
            ?exp cdm:expression_title ?title .
            ?exp cdm:expression_uses_language ?workLang .
            ${langISO3Filters}
        }
        ORDER BY ?id ?workLang
    `;

    return query;
};

export const processConsilResponse = (response, langISO3) => {
    // resolve language
    let idMap = {};
    response.results.bindings = response.results.bindings.map(binding => {
        if (binding.title && binding.title.value) {
            binding.title.value = binding.title.value.replace(new RegExp("&#13;\n", 'g'), ' ');
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
