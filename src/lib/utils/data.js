
import { LD_CELEX_SUFFIXES, LD_TYPE_CELEX, LD_TYPE_ECLI, LD_TYPE_ELI, LD_TYPE_PROCEDURE, LD_TYPE_FINLEX, LD_TYPE_HANDOC, LD_TYPE_CIS, LD_TYPE_CONSIL, LD_TYPE_OJ } from "../manager/index.js";
import { extractAttributes } from "../utils/functions.js";
import { LD_ADVANCED_MODE_KM_HANDOC, LD_ADVANCED_MODE_KM_CIS } from "../settings/index.js";

/**
 * Extract CELEX id from attributes map
 * @param {Object} data
 * @returns {String|null} celex id if found 
 */
export const extractCelexId = (data) => {
    for (let i = 0; i < LD_CELEX_SUFFIXES.length; i++) {
        let suffix = LD_CELEX_SUFFIXES[i];
        if (data[LD_TYPE_CELEX + suffix] || data["data-" + LD_TYPE_CELEX + suffix] || data["data-ref-" + LD_TYPE_CELEX + suffix]) {
            return data[LD_TYPE_CELEX + suffix] || data["data-" + LD_TYPE_CELEX + suffix] || data["data-ref-" + LD_TYPE_CELEX + suffix];
        }
    }
    return null;
}

/**
 * Returns a list of celex ids from the attributes (sometimes views have different celex id variants eg. Compos/AG)
 * @param {Object} data
 * @returns {Array<string>} 
 */
export const extractCelexIdList = (data) => {
    let ids = [];
    let suffixes = LD_CELEX_SUFFIXES;
    Object.keys(data).forEach(key => {
        suffixes.forEach((suffix) => {
            let id = data[LD_TYPE_CELEX + suffix] || data["data-" + LD_TYPE_CELEX + suffix] || data["data-ref-" + LD_TYPE_CELEX + suffix];
            if (id) {
                ids.push(id);
            }
        })
    });

    //unique ids only
    return ids.filter((v, i, a) => a.indexOf(v) === i);
};

export const extractIdList = (data) => {
    let ids = [];

    let id;

    // collect CELEX ids
    let suffixes = LD_CELEX_SUFFIXES;
    Object.keys(data).forEach(key => {
        suffixes.forEach((suffix) => {
            id = data[LD_TYPE_CELEX + suffix] || data["data-" + LD_TYPE_CELEX + suffix] || data["data-ref-" + LD_TYPE_CELEX + suffix];
            if (id) {
                ids.push(id);
            }
        })
    });

    // collect ELI ids
    id = data[LD_TYPE_ELI] || data["data-" + LD_TYPE_ELI] || data["data-ref-" + LD_TYPE_ELI];
    if (id) {
        ids.push(id);
    }

    // collect ECLI ids
    id = data[LD_TYPE_ECLI] || data["data-" + LD_TYPE_ECLI] || data["data-ref-" + LD_TYPE_ECLI];
    if (id) {
        ids.push(id);
    }

    // collect OJ ids
    id = data[LD_TYPE_OJ] || data["data-" + LD_TYPE_OJ] || data["data-ref-" + LD_TYPE_OJ];
    if (id) {
        ids.push(id);
    }

    // collect PROC ids
    id = data[LD_TYPE_PROCEDURE] || data["data-" + LD_TYPE_PROCEDURE] || data["data-ref-" + LD_TYPE_PROCEDURE];
    if (id) {
        ids.push(id);
    }

    // collect CONSIL ids
    id = data[LD_TYPE_CONSIL] || data["data-" + LD_TYPE_CONSIL] || data["data-ref-" + LD_TYPE_CONSIL];
    if (id) {
        ids.push(id);
    }

    // collect CIS ids
    id = data[LD_TYPE_CIS] || data["data-" + LD_TYPE_CIS] || data["data-ref-" + LD_TYPE_CIS];
    if (id) {
        ids.push(id);
    }

    // collect HANDOC ids
    id = data[LD_TYPE_HANDOC] || data["data-" + LD_TYPE_HANDOC] || data["data-ref-" + LD_TYPE_HANDOC];
    if (id) {
        ids.push(id);
    }

    //unique ids only
    ids = ids.filter((v, i, a) => a.indexOf(v) === i);

    return ids;
};

/**
 * Extract the id from a target attributes (CELEX/ELI/ECLI/HANDOC/CIS/PROCDOC/CONSIL)
 * @param {Object} data
 * @returns {String|null} celex id if found 
 */
export const extractId = (data) => {
    let id;

    for (let i = 0; i < LD_CELEX_SUFFIXES.length; i++) {
        let suffix = LD_CELEX_SUFFIXES[i];
        if (data[LD_TYPE_CELEX + suffix] || data["data-" + LD_TYPE_CELEX + suffix] || data["data-ref-" + LD_TYPE_CELEX + suffix]) {
            id = data[LD_TYPE_CELEX + suffix] || data["data-" + LD_TYPE_CELEX + suffix] || data["data-ref-" + LD_TYPE_CELEX + suffix];
        }
    }

    if (id) {
        return id;
    }

    // collect ELI ids
    id = data[LD_TYPE_ELI] || data["data-" + LD_TYPE_ELI] || data["data-ref-" + LD_TYPE_ELI];
    if (id) {
        return id;
    }

    // collect ECLI ids
    id = data[LD_TYPE_ECLI] || data["data-" + LD_TYPE_ECLI] || data["data-ref-" + LD_TYPE_ECLI];
    if (id) {
        return id;
    }

    // collect PROC ids
    id = data[LD_TYPE_PROCEDURE] || data["data-" + LD_TYPE_PROCEDURE] || data["data-ref-" + LD_TYPE_PROCEDURE];
    if (id) {
        return id;
    }

    // collect CONSIL ids
    id = data[LD_TYPE_CONSIL] || data["data-" + LD_TYPE_CONSIL] || data["data-ref-" + LD_TYPE_CONSIL];
    if (id) {
        return id;
    }

    // collect CIS ids
    id = data[LD_TYPE_CIS] || data["data-" + LD_TYPE_CIS] || data["data-ref-" + LD_TYPE_CIS];
    if (id) {
        return id;
    }

    // collect HANDOC ids
    id = data[LD_TYPE_HANDOC] || data["data-" + LD_TYPE_HANDOC] || data["data-ref-" + LD_TYPE_HANDOC];
    if (id) {
        return id;
    }

    // collect OJ ids
    id = data[LD_TYPE_OJ] || data["data-" + LD_TYPE_OJ] || data["data-ref-" + LD_TYPE_OJ];
    if (id) {
        return id;
    }

    return null;
};


/**
 * Used to extract target attributes from matches marked with a specific LD type
 * @param {Object} matches
 * @param {String} type LD_CELLAR_NUMBER_CELEX|LD_CELLAR_SUBNUMBER_CELEX
 * @returns {Array<Object>} list of attributes 
 */
export const extractCelexAttributes = (matches, type) => {
    let attributesList = [];
    Object.keys(matches).forEach(key => {
        matches[key].offsets.forEach(offset => {
            let attributes = extractAttributes(offset.views);
            let celexId = extractCelexId(attributes);
            //if the rule has linked-data markings we add the celexId 
            if (offset.rule.ld.length > 0 && offset.rule.ld.indexOf(type) !== -1 && celexId) {
                attributesList.push(attributes);
            }
        });
    });
    return attributesList;
}


/**
 * Extract property to be used as identifier (of a supported type) from target attributes
 * @param {Object} data
 * @returns {String|null} unique linked data identifier 
 */
export function extractLinkedDataId(data) {
    // attributes might contain multiple celex ids (suffixed by numbers eg. data-ref-celex-1)
    let celexId = extractCelexId(data);
    if (celexId) {
        return celexId;
    }

    if (data[LD_TYPE_ECLI] || data["data-" + LD_TYPE_ECLI] || data["data-ref-" + LD_TYPE_ECLI]) {
        let ecliLinkedDataId = data[LD_TYPE_ECLI] || data["data-" + LD_TYPE_ECLI] || data["data-ref-" + LD_TYPE_ECLI];
        // For non-EU ECLI ids we don't have linked data
        if (ecliLinkedDataId && String(ecliLinkedDataId).slice(0, 5) === "ECLI:" && String(ecliLinkedDataId).slice(0, 7) !== "ECLI:EU") {
            return null;
        }
        return ecliLinkedDataId;
    }

    if (data[LD_TYPE_OJ] || data["data-" + LD_TYPE_OJ] || data["data-ref-" + LD_TYPE_OJ]) {
        let eliId = data[LD_TYPE_OJ] || data["data-" + LD_TYPE_OJ] || data["data-ref-" + LD_TYPE_OJ];
        return eliId;
    }

    if (data[LD_TYPE_ELI] || data["data-" + LD_TYPE_ELI] || data["data-ref-" + LD_TYPE_ELI]) {
        let eliId = data[LD_TYPE_ELI] || data["data-" + LD_TYPE_ELI] || data["data-ref-" + LD_TYPE_ELI];
        return eliId;
    }

    if (data[LD_TYPE_PROCEDURE] || data["data-" + LD_TYPE_PROCEDURE] || data["data-ref-" + LD_TYPE_PROCEDURE]) {
        return data[LD_TYPE_PROCEDURE] || data["data-" + LD_TYPE_PROCEDURE] || data["data-ref-" + LD_TYPE_PROCEDURE];
    }

    if (data[LD_TYPE_CONSIL] || data["data-" + LD_TYPE_CONSIL] || data["data-ref-" + LD_TYPE_CONSIL]) {
        return data[LD_TYPE_CONSIL] || data["data-" + LD_TYPE_CONSIL] || data["data-ref-" + LD_TYPE_CONSIL];
    }

    if (data[LD_TYPE_FINLEX] || data["data-" + LD_TYPE_FINLEX] || data["data-ref-" + LD_TYPE_FINLEX]) {
        return data[LD_TYPE_FINLEX] || data["data-" + LD_TYPE_FINLEX] || data["data-ref-" + LD_TYPE_FINLEX];
    }

    if (R2L.hasLinkedDataMode(LD_ADVANCED_MODE_KM_HANDOC)) {
        if (data[LD_TYPE_HANDOC] || data["data-" + LD_TYPE_HANDOC] || data["data-ref-" + LD_TYPE_HANDOC]) {
            return data[LD_TYPE_HANDOC] || data["data-" + LD_TYPE_HANDOC] || data["data-ref-" + LD_TYPE_HANDOC];
        }
    }

    if (R2L.hasLinkedDataMode(LD_ADVANCED_MODE_KM_CIS)) {
        if (data[LD_TYPE_CIS] || data["data-" + LD_TYPE_CIS] || data["data-ref-" + LD_TYPE_CIS]) {
            return data[LD_TYPE_CIS] || data["data-" + LD_TYPE_CIS] || data["data-ref-" + LD_TYPE_CIS];
        }
    }



    return null;
}

export function extractLinkedDataType(data) {
    // attributes might contain multiple celex ids (suffixed by numbers eg. data-ref-celex-1)
    let celexId = extractCelexId(data);
    if (celexId) {
        return LD_TYPE_CELEX;
    }

    if (data[LD_TYPE_ECLI] || data["data-" + LD_TYPE_ECLI] || data["data-ref-" + LD_TYPE_ECLI]) {
        let ecliLinkedDataId = data[LD_TYPE_ECLI] || data["data-" + LD_TYPE_ECLI] || data["data-ref-" + LD_TYPE_ECLI];
        // For non-EU ECLI ids we don't have linked data
        if (ecliLinkedDataId && String(ecliLinkedDataId).slice(0, 5) === "ECLI:" && String(ecliLinkedDataId).slice(0, 7) !== "ECLI:EU") {
            return null;
        }
        return LD_TYPE_ECLI;
    }

    if (data[LD_TYPE_ELI] || data["data-" + LD_TYPE_ELI] || data["data-ref-" + LD_TYPE_ELI]) {
        return LD_TYPE_ELI;
    }

    if (data[LD_TYPE_PROCEDURE] || data["data-" + LD_TYPE_PROCEDURE] || data["data-ref-" + LD_TYPE_PROCEDURE]) {
        return LD_TYPE_PROCEDURE;
    }

    if (data[LD_TYPE_FINLEX] || data["data-" + LD_TYPE_FINLEX] || data["data-ref-" + LD_TYPE_FINLEX]) {
        return LD_TYPE_FINLEX;
    }

    if (data[LD_TYPE_HANDOC] || data["data-" + LD_TYPE_HANDOC] || data["data-ref-" + LD_TYPE_HANDOC]) {
        return LD_TYPE_HANDOC;
    }

    if (data[LD_TYPE_CIS] || data["data-" + LD_TYPE_CIS] || data["data-ref-" + LD_TYPE_CIS]) {
        return LD_TYPE_CIS;
    }

    if (data[LD_TYPE_CONSIL] || data["data-" + LD_TYPE_CONSIL] || data["data-ref-" + LD_TYPE_CONSIL]) {
        return LD_TYPE_CONSIL;
    }

    if (data[LD_TYPE_OJ] || data["data-" + LD_TYPE_OJ] || data["data-ref-" + LD_TYPE_OJ]) {
        return LD_TYPE_OJ;
    }

    return null;
}

/**
 * Collect linked data ids by type from nodes
 * @param {Array<Object>} nodes
 * 
 * @returns {Object} map of identifiers
 */
export function extractLinkedDataIds(nodes) {
    let celexIds = [];
    let ecliIds = [];
    let eliIds = [];
    let procedureIds = [];
    let finlexEliIds = [];
    let aresHandocIds = [];
    let cisIds = [];
    let consilIds = [];
    let ojIds = [];

    nodes.forEach((ref) => {
        celexIds = celexIds.concat(ref.data.map(d => extractCelexId(d)))
        eliIds = eliIds.concat(ref.data.map(d => d[LD_TYPE_ELI]));
        procedureIds = procedureIds.concat(ref.data.map(d => d[LD_TYPE_PROCEDURE]));
        finlexEliIds = finlexEliIds.concat(ref.data.map(d => d[LD_TYPE_FINLEX]));
        aresHandocIds = aresHandocIds.concat(ref.data.map(d => d[LD_TYPE_HANDOC]));
        cisIds = cisIds.concat(ref.data.map(d => d[LD_TYPE_CIS]));
        consilIds = consilIds.concat(ref.data.map(d => d[LD_TYPE_CONSIL]));
        ojIds = ojIds.concat(ref.data.map(d => d[LD_TYPE_OJ]));
    });

    celexIds = celexIds.filter(function (celexId) {
        return !!celexId;
    });

    eliIds = eliIds.filter(function (eliId) {
        return !!eliId;
    });

    procedureIds = procedureIds.filter(function (procedureId) {
        return !!procedureId;
    });

    finlexEliIds = finlexEliIds.filter(function (finlexEliId) {
        return !!finlexEliId;
    });

    aresHandocIds = aresHandocIds.filter(function (aresId) {
        return !!aresId;
    });

    consilIds = consilIds.filter(function (consilId) {
        return !!consilId;
    });

    cisIds = cisIds.filter(function (cisId) {
        return !!cisId;
    });

    ojIds = ojIds.filter(function (ojId) {
        return !!ojId;
    });

    nodes.forEach((ref) => {
        ecliIds = ecliIds.concat(ref.data.map(d => { return d[LD_TYPE_CELEX] ? null : d[LD_TYPE_ECLI] })); //if there's a CELEX don't load anything
    });
    ecliIds = ecliIds.filter(function (ecliId) {
        return !!ecliId && String(ecliId).slice(0, 7) === "ECLI:EU"; // only use ECLI EU ids
    });

    return {
        [LD_TYPE_CELEX]: celexIds,
        [LD_TYPE_ECLI]: ecliIds,
        [LD_TYPE_ELI]: eliIds,
        [LD_TYPE_PROCEDURE]: procedureIds,
        [LD_TYPE_FINLEX]: finlexEliIds,
        [LD_TYPE_HANDOC]: aresHandocIds,
        [LD_TYPE_CIS]: cisIds,
        [LD_TYPE_CONSIL]: consilIds,
        [LD_TYPE_OJ]: ojIds
    }
}