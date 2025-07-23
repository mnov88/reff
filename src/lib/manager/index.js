import { LD_MODE_METADATA, LD_ADVANCED_MODE_KM_HANDOC, LD_ADVANCED_MODE_CORRECTIONS, LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT, settings, LD_ADVANCED_MODE_SHORT_TITLES, LD_ADVANCED_MODE_KM_CIS } from '../settings/index.js';
import { DEFAULT_LD_LANG, getISO2Lang } from '../translations/index.js';
import { getCelexQuery } from './query/celex.js';
import { getEliQuery, getEliConsolidationsQuery, computeEliIdsMap } from './query/eli.js';
import { getEcliQuery } from './query/ecli.js';
import { getFinlexEliQuery } from './query/finlex.js';
import { appendCorrectionsData } from './data/corrections.js';
import { extractLinkedDataIds } from '../utils/data.js';
import { appendShortTitlesData } from './data/short_titles.js';
import { sanitizeHtml } from '../utils/functions.js';
import { getRequestPromise, getEurlexRequestPromise } from '../utils/request.js';
import { translateOjData } from './data/oj.js';
import { getEcasTicket } from './ecas.js';
import { getActsCitingActQuery, getActsCitedByActQuery, getBasisActsByActQuery, getActsByBasisActQuery } from './query/cluster.js';
import { getClassificationsQuery } from './query/classifications.js';
import { parseEurlexResponse, parseFragment } from './parser/eurlex.js';
import { fixCaseLawCitation, cleanFootnote, FOOTNOTE_BLACKLIST, getJoinedCasesTranslation } from './modifiers/footnote.js';
import { getProcedureQuery, processProcResponse } from './query/proc.js';
import { appendPointInTimeData } from './data/pit.js';
import { getConsilQuery, processConsilResponse } from './query/consil.js';
import { getEUTreatyShortTitle } from './data/treaty.js';
import { getOjQuery } from './query/oj.js';
import { getJoinedCaseQuery } from './query/joined_eucase.js';
import { parseJoinedCaseResponse } from './data/joined_eucase.js';

export const SPARQL_STATUS_INIT = 'init';
export const SPARQL_STATUS_SUCCESS = 'success';
export const SPARQL_STATUS_PENDING = 'pending';
export const SPARQL_STATUS_ERROR = 'error';

export const CELLAR_JOINED_EUCASE_DATA_CACHE_KEY = 'CELLAR:JOINED_EUCASE_DATA';
export const CELLAR_JOINED_EUCASE_DATA_PROCESSED_CACHE_KEY = 'CELLAR:JOINED_EUCASE_PROCESSED_DATA';

export const LD_TYPE_CELEX = 'celex';
export const LD_TYPE_OJ = 'oj';
export const LD_TYPE_ECLI = 'ecli';
export const LD_TYPE_ELI = 'eli';
export const LD_TYPE_PROCEDURE = 'procedure';
export const LD_TYPE_CONSIL = 'consil';
export const LD_TYPE_HANDOC = 'handoc';
export const LD_TYPE_CIS = 'cis';
export const LD_TYPE_FINLEX = 'finlex-eli';

export const LD_CELEX_SUFFIXES = ["", "-0", "-1", "-2", "-3", "-4", "-5", "-6", "-7", "-8", "-9", "-10"];

export const LD_TARGET_CELLAR = 'cellar';
export const LD_TARGET_FINLEX = 'finlex';
export const LD_TARGET_ELI = 'eli';
export const LD_TARGET_KM = 'km';


/**
 * Holds metadata associated to a reference
 */
export class Binding {
    /**
     * Constructs a binding object. Holds error state. 
     * @param {Object} data - Data object as returned by the SPARQL query @CELLAR
     * @param {string} type   
     * @param {string} status 
     */
    constructor(data, type, status) {
        this.data = data;
        this.type = type;
        this.status = status;
    }
}

/**
 * 
 * @param {Binding} binding 
 * @returns {Object}
 */
export function cleanLinkedDataBinding(binding) {
    let data = binding.data;
    Object.keys(data).forEach(key => {
        let v = data[key];
        if (v) {
            delete v.datatype;
            data[key] = v;
        }
    });

    return data;
}

/**
 * 
 * @param {Binding} binding 
 * @returns 
 */
export function sanitizeLinkedDataBinding(binding) {
    if (typeof binding !== 'object' || typeof binding.data !== 'object') {
        return binding;
    }

    Object.keys(binding.data || {}).forEach(key => {
        let v = binding.data[key];
        if (v && typeof v.value === "string") {
            v.value = sanitizeHtml(v.value);
        }
    });

    return binding;
}

/**
 * The LinkedDataManager is responsible for fetching linked-data from external repositories
 * It can fetch data based on: 
 *   - CELEX and ECLI identifiers - using the Publication Office Cellar repository
 *   - Finnish ELI identifiers - using the Finlex Graph
 * 
 * DO NOT TRUST THE DATA
 * Make sure the data is sanitized and contains no HTML entities
 */
export class LinkedDataManager {

    constructor() {
        /* Holds raw linked-data object (KV) */
        this._metadata = {};

        this.status = SPARQL_STATUS_INIT;

        this.supportedTypes = [LD_TYPE_CELEX, LD_TYPE_OJ, LD_TYPE_CONSIL, LD_TYPE_CIS, LD_TYPE_PROCEDURE, LD_TYPE_ECLI, LD_TYPE_ELI, LD_TYPE_FINLEX, LD_TYPE_HANDOC];

        this.proxyTicket = null;

        this.user = null;

        this._customHeaders = {};

        this._localCache = {

        };
    }

    getCustomHeaders() {
        return this._customHeaders;
    }

    setCustomHeaders(customHeaders) {
        this._customHeaders = customHeaders;
    }

    getStatus() {
        return this.status;
    }

    setProxyTicket(proxyTicket) {
        this.proxyTicket = proxyTicket;
    }

    setUser(user) {
        this.user = user;
    }

    getEndpoint(type) {
        if (type === LD_TYPE_FINLEX) {
            return settings.constants.R2L_FINLEX_ENDPOINT;
        }
        else {
            return settings.constants.R2L_PUBLICATIONS_ENDPOINT;
        }
    }

    getEurlexContentEndpoint(type) {
        return settings.constants.R2L_CONTENT_ENDPOINT;
    }

    /**
     * @param {String} id
     * @returns {Binding|null} 
     */
    getMetadataById(id) {
        return this._metadata[id];
    };

    /**
     * Get metadata by a list of ids 
     * @param {string[]} ids 
     */
    getMetadata(ids) {
        if (Array.isArray(ids)) {
            let data = {};
            ids.forEach(id => {
                if (this._metadata[id]) {
                    data[id] = this._metadata[id];
                }
            });
            return data;
        }
        else {
            return this._metadata;
        }
    }

    setMetadata(metadata) {
        // sanitize all strings coming from Cellar (REFTOLINK-1523)
        Object.keys(metadata).forEach((key) => {
            metadata[key] = sanitizeLinkedDataBinding(metadata[key]);
        });

        this._metadata = { ...this._metadata, ...metadata };
    }

    clearCache() {
        this._metadata = {};
    }

    getOjData(ojIds, format) {
        let langISO3 = R2L.getLanguage() || 'ENG';
        let query = getOjQuery(ojIds, langISO3);
        format = format || 'application/json';

        return getRequestPromise(this.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_CELLAR
        }).then(function (response) {
            // apply OJ translations
            let langISO2 = getISO2Lang((langISO3 || "ENG").toUpperCase());
            response = translateOjData(response, langISO2);

            let promises = [];

            // explicit LD_ADVANCED_MODE_CORRECTIONS mode (must be set via the API)
            // Note: it will not be included in the "all" mode


            if (R2L.options.pointInTime) {
                promises.push(appendPointInTimeData(response, langISO3));
            }

            if (langISO3 && R2L.options.linkedDataMode.indexOf(LD_ADVANCED_MODE_CORRECTIONS) !== -1) {
                promises.push(appendCorrectionsData(response, langISO3));
            }

            // explicit LD_ADVANCED_MODE_SHORT_TITLES mode (must be set via the API)
            // Note: it will not be included in the "all" mode
            // Note: The SHORT TITLES mode is not compatible with the JQuery tooltips. Tooltips will be reset when performing an extra R2L scan.
            if (langISO3 && R2L.options.linkedDataMode.indexOf(LD_ADVANCED_MODE_SHORT_TITLES) !== -1) {
                promises.push(appendShortTitlesData(response, langISO3));
            }

            if (promises.length) {
                return Promise.all(promises).then((responses) => {
                    return (responses[promises.length - 1]);
                }).catch((err) => {
                    console.error(err);
                    return response;
                });
            }
            else {
                return response;
            }
        });
    }

    getCelexData(celexIds, format) {
        let langISO3 = R2L.getLanguage() || 'ENG';
        let query = getCelexQuery(celexIds, langISO3);
        format = format || 'application/json';

        return getRequestPromise(this.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_CELLAR
        }).then(function (response) {
            // apply OJ translations
            let langISO2 = getISO2Lang((langISO3 || "ENG").toUpperCase());
            response = translateOjData(response, langISO2);

            let promises = [];

            // explicit LD_ADVANCED_MODE_CORRECTIONS mode (must be set via the API)
            // Note: it will not be included in the "all" mode


            if (R2L.options.pointInTime) {
                promises.push(appendPointInTimeData(response, langISO3));
            }

            if (langISO3 && R2L.options.linkedDataMode.indexOf(LD_ADVANCED_MODE_CORRECTIONS) !== -1) {
                promises.push(appendCorrectionsData(response, langISO3));
            }

            // explicit LD_ADVANCED_MODE_SHORT_TITLES mode (must be set via the API)
            // Note: it will not be included in the "all" mode
            // Note: The SHORT TITLES mode is not compatible with the JQuery tooltips. Tooltips will be reset when performing an extra R2L scan.
            if (langISO3 && R2L.options.linkedDataMode.indexOf(LD_ADVANCED_MODE_SHORT_TITLES) !== -1) {
                promises.push(appendShortTitlesData(response, langISO3));
            }

            if (promises.length) {
                return Promise.all(promises).then((responses) => {
                    return (responses[promises.length - 1]);
                }).catch((err) => {
                    console.error(err);
                    return response;
                });
            }
            else {
                return response;
            }
        });
    }

    getEurlexContent(node) {
        let langISO3 = R2L.getLanguage() || 'ENG';
        let langISO2 = getISO2Lang((langISO3 || "ENG").toUpperCase());
        let celex = node.data[0].celex;
        // celex id can also be present in linked data (ECLI)
        if (!celex && node.data[0].metadata && node.data[0].metadata.celexId) {
            celex = String(node.data[0].metadata.celexId.value).replace("celex:", "");
        }

        // pass ELI if present and point in time is enabled
        let eliUrl = node.urls.filter(url => ["eurlex.act.eli", "eurlex.oj.eli", "eurlex.intlagr.eli", "eliurl"].indexOf(url.baseTarget) !== -1).pop();

        // when point in time is enabled we use the ELI
        let eli = (R2L.options.pointInTime && eliUrl) ? ("/eli" + eliUrl.href.split("/eli")[1]) : null;
        let linkedDataEli = node.data[0].metadata && node.data[0].metadata.eli ? node.data[0].metadata.eli.value : null;

        // if no CELEX then use eli if available
        if (eli) {
            // use the linked data ELI if present as it will contain the latest consolidation URL
            let href = linkedDataEli || eli;
            eli = ("/eli" + href.split("/eli")[1]);
        }

        return getEurlexRequestPromise(this.getEurlexContentEndpoint(), "GET", {
            lang: langISO2,
            celex: celex,
            eli: eli
        }).then(function (response) {
            return parseEurlexResponse(response, node);
        });

    }

    getProcedureData(procedureIds, format) {
        let langISO3 = R2L.getLanguage() || 'ENG';
        let query = getProcedureQuery(procedureIds, langISO3);
        format = format || 'application/json';
        return getRequestPromise(this.getEndpoint(LD_TYPE_PROCEDURE), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_CELLAR
        }).then(function (response) {
            return processProcResponse(response, langISO3);
        });
    }

    getEcliData(ecliIds, format) {
        let query = getEcliQuery(ecliIds, R2L.getLanguage() || 'ENG');
        format = format || 'application/json';
        return getRequestPromise(this.getEndpoint(LD_TYPE_ECLI), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_CELLAR
        });
    }

    getConsilData(consilIds, format) {
        let langISO3 = R2L.getLanguage() || 'ENG';
        let query = getConsilQuery(consilIds, langISO3);
        format = format || 'application/json';
        return getRequestPromise(this.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_CELLAR
        }).then(function (response) {

            return processConsilResponse(response, langISO3);
        });;
    }

    getFinlexEliData(eliIds, format) {
        let query = getFinlexEliQuery(eliIds, R2L.getLanguage() || "ENG");
        format = format || 'application/json';
        return getRequestPromise(this.getEndpoint(LD_TYPE_FINLEX), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_FINLEX
        });
    }

    getEliData(eliIds, format) {
        let langISO3 = R2L.getLanguage() || "ENG";
        // filter out /eli/L/ ids because they are not in Cellar
        eliIds = eliIds.filter((eliId) => eliId.indexOf('/eli/L/') === -1);

        if (eliIds.length === 0) {
            //return Promise.resolve(null);
        }

        format = format || 'application/json';
        let computedEliIdsMap = {};
        let computedEliIds = eliIds;
        eliIds.forEach(eliId => {
            computedEliIdsMap[eliId] = eliId;
        });

        // get all ELI consolidations first
        // we don't need to lookup eli ids with /oj
        let consolidationEliIds = eliIds.filter(eid => eid.slice(-3) !== '/oj');

        let consolidationsQuery = getEliConsolidationsQuery(consolidationEliIds);

        return ((consolidationEliIds.length > 0) ? getRequestPromise(this.getEndpoint(LD_TYPE_ELI), "POST", {
            query: consolidationsQuery,
            format: format,
            origin: '*',
            target: LD_TARGET_ELI
        }) : Promise.resolve(null)).then(consolidationEliResponse => {

            if (consolidationEliResponse) {
                // we override the ELI data with ids having the dates closest to ours
                computedEliIdsMap = computeEliIdsMap(eliIds, consolidationEliResponse.results.bindings);
                // we rebuild the map
                computedEliIds = Object.values(computedEliIdsMap);
            }

            let query = getEliQuery(computedEliIds, R2L.getLanguage() || "ENG");
            return getRequestPromise(this.getEndpoint(LD_TYPE_ELI), "POST", {
                query: query,
                format: format,
                origin: '*',
                target: LD_TARGET_ELI
            });
        }).then(response => {
            if (langISO3 && R2L.options.linkedDataMode.indexOf(LD_ADVANCED_MODE_CORRECTIONS) !== -1) {
                return appendCorrectionsData(response, langISO3);
            }
            else {
                return Promise.resolve(response);
            }
        }).then(response => {
            // explicit LD_ADVANCED_MODE_SHORT_TITLES mode (must be set via the API)
            // Note: it will not be included in the "all" mode
            // Note: The SHORT TITLES mode is not compatible with the JQuery tooltips. Tooltips will be reset when performing an extra R2L scan.
            if (langISO3 && R2L.options.linkedDataMode.indexOf(LD_ADVANCED_MODE_SHORT_TITLES) !== -1) {
                return appendShortTitlesData(response, langISO3);
            }
            else {
                return Promise.resolve(response);
            }
        }).then(response => {
            let langISO2 = getISO2Lang((langISO3 || "ENG").toUpperCase());
            response = translateOjData(response, langISO2);
            response._computedEliIdsMap = computedEliIdsMap;
            return response;
        });
    }

    /**
     * Retrieve ARES data from ULM's KM api 
     * 
     * @param {Array<String>} aresHandocIds 
     * @param {String} format
     * 
     * @return Promise<Object> 
     */
    getAresData(aresHandocIds, format) {
        let body = {
            handoc: aresHandocIds
        }

        format = format || 'application/json';

        return getEcasTicket(this.getEndpoint(LD_TYPE_HANDOC), this.proxyTicket).then((proxyTicket) => {
            let headers = { Authorization: proxyTicket };
            return getRequestPromise(this.getEndpoint(LD_TYPE_HANDOC), "POST", {
                query: JSON.stringify(body),
                format: format,
                origin: '*',
                target: LD_TARGET_KM
            }, headers).then(response => {
                return response;
            });
        }).catch(err => {
            console.error(err);
        });
    }

    /**
     * Retrieve data for multiple types from ULM's KM api 
     * 
     * @param {Object} body - Example: { handoc: ["id1", "id2"], cis: ["id3", "id4"]} 
     * @param {String} format
     * 
     * @return Promise<Object> 
     */
    getKMData(body, format) {
        format = format || 'application/json';

        return getEcasTicket(this.getEndpoint(LD_TYPE_HANDOC), this.proxyTicket).then((proxyTicket) => {
            let headers = { Authorization: proxyTicket };
            return getRequestPromise(this.getEndpoint(LD_TYPE_HANDOC), "POST", {
                query: JSON.stringify(body),
                format: format,
                origin: '*',
                target: LD_TARGET_KM
            }, headers).then(response => {
                return response;
            });
        }).catch(err => {
            console.error(err);
        });
    }

    /**
     * Returns a list of citations with titles for a CELEX id
     * @param {String} celexId 
     * @param {String} searchText (optional) 
     * @param {String} documentType (optional) - celex sector number (3 for legal acts, 6 for case law) 
     */
    getActsCitedByAct(celexId, searchText, documentType) {
        let query = getActsCitedByActQuery(celexId, R2L.getLanguage() || "ENG", searchText, documentType);
        let format = 'application/json';
        return getRequestPromise(this.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_CELLAR
        }).then(response => {
            return response;
        }).catch(err => {
            console.error(err);
        });
    }

    /**
     * Returns a list of acts that cite this act (CELEX id)
     * @param {String} celexId 
     * @param {String} searchText (optional)
     * @param {String} documentType (optional) - celex sector number (3 for legal acts, 6 for case law)
     */
    getActsCitingAct(celexId, searchText, documentType) {
        let query = getActsCitingActQuery(celexId, R2L.getLanguage() || "ENG", searchText, documentType);
        let format = 'application/json';
        return getRequestPromise(this.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_CELLAR
        }).then(response => {
            return response;
        }).catch(err => {
            console.error(err);
        });
    }

    /**
     * Returns a list of acts that are based on this act
     * @param {String} celexId 
     * @param {String} searchText  (optional)
     */
    getActsByBasisAct(celexId, searchText) {
        let query = getActsByBasisActQuery(celexId, R2L.getLanguage() || "ENG", searchText);
        let format = 'application/json';
        return getRequestPromise(this.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_CELLAR
        }).then(response => {
            return response;
        }).catch(err => {
            console.error(err);
        });
    }

    /**
     * Returns the base acts for this act (CELEX id)
     * @param {String} celexId 
     * @param {String} searchText
     */
    getBasisActsByAct(celexId, searchText) {
        let query = getBasisActsByActQuery(celexId, R2L.getLanguage() || "ENG", searchText);
        let format = 'application/json';
        return getRequestPromise(this.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_CELLAR
        }).then(response => {
            return response;
        }).catch(err => {
            console.error(err);
        });
    }

    /**
     * Returns classifications (EUROVOC descriptors and subject matter) for a CELEX id
     * @param {String} celexId 
     * @param {String} format (optional) - defaults to 'application/json'
     */
    getClassifications(celexId, format) {
        // ISO2 language
        let query = getClassificationsQuery(celexId, getLinkedDataLanguage());
        format = format || 'application/json';
        return getRequestPromise(this.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_CELLAR
        }).then(response => {
            return response;
        }).catch(err => {
            console.error(err);
        });
    }


    getJoinedCaseDataByCaseLabel(caseLabel) {
        let processedData = this._localCache[CELLAR_JOINED_EUCASE_DATA_PROCESSED_CACHE_KEY];
        if (!processedData) {
            let data = this._localCache[CELLAR_JOINED_EUCASE_DATA_CACHE_KEY];
            if (!data) {
                return null;
            }

            processedData = {};

            // create a map for fast lookups
            data.results.bindings.map(binding => {
                let caseLabels = binding.title.value.split(",").map(cl => cl.replace(/\s/g, "").replace("‑", "-"));
                caseLabels.forEach(caseLabel => {
                    processedData[caseLabel] = binding.title.value.split(",");
                });
            });
            this._localCache[CELLAR_JOINED_EUCASE_DATA_PROCESSED_CACHE_KEY] = processedData;
        }

        let rawCaseLabel = String(caseLabel).replace(/\s/g, "").replaceAll("‑", "-");
        // look for the label in the joined cases list
        let item = processedData[rawCaseLabel];

        console.debug("Getting joined case data by case", rawCaseLabel, item);
        return item;
    }

    getJoinedCaseData() {
        if (this._localCache[CELLAR_JOINED_EUCASE_DATA_CACHE_KEY]) {
            return Promise.resolve(this._localCache[CELLAR_JOINED_EUCASE_DATA_CACHE_KEY]);
        }

        let query = getJoinedCaseQuery();
        let format = 'application/json';
        return getRequestPromise(this.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_CELLAR
        }).then(response => {
            let parsedResponse = parseJoinedCaseResponse(response);
            this._localCache[CELLAR_JOINED_EUCASE_DATA_CACHE_KEY] = parsedResponse;
            return parsedResponse;
        }).catch(err => {
            console.error(err);
            throw err;
        });
    }

    /**
     * Checks whether the external linked data respositories are up by running a dummy query/request.
     * @param {string} ldTarget
     * 
     * @return {Promise<boolean>} 
     */
    checkHealth(ldTarget) {
        ldTarget = ldTarget || LD_TARGET_CELLAR; // default to Cellar
        return new Promise((resolve, reject) => {
            if (ldTarget !== LD_TARGET_CELLAR) {
                //@TODO implement health check for other targets (Finlex/HRS)
                resolve(true);
            }

            let query = `SELECT * WHERE {
                ?s ?p ?o
            }
            LIMIT 1`;

            let format = 'application/json';
            return getRequestPromise(this.getEndpoint(LD_TARGET_CELLAR), "POST", {
                query: query,
                format: format,
                origin: '*',
                target: LD_TARGET_CELLAR
            }).then(response => {
                resolve(response && response.results && response.results.bindings && response.results.bindings.length === 1 ? true : false);
            }).catch(err => {
                console.error(err);
                resolve(false);
            });
        })
    }

    /**
     * Main linked-data retrieval method - will fetch data for all supported node types. A map of linked data ids can directly be passed as `defaultData`.
     * 
     * @param {Array<R2LNode>} nodes 
     * @param {Object} defaultData - pre-defined map of linked data ids (optional)
     * 
     * @returns {Object} A key-value map of linked-data ids (CELEX/ECLI/ELI...) => data 
     */
    fetch(nodes, defaultData) {
        this.status = SPARQL_STATUS_PENDING;
        let data = defaultData || extractLinkedDataIds(nodes);
        let celexIds = data[LD_TYPE_CELEX];
        let ecliIds = data[LD_TYPE_ECLI];
        let consilIds = data[LD_TYPE_CONSIL];
        let eliIds = data[LD_TYPE_ELI];
        let procedureIds = data[LD_TYPE_PROCEDURE];
        let finlexEliIds = data[LD_TYPE_FINLEX];
        let aresHandocIds = data[LD_TYPE_HANDOC];
        let cisIds = data[LD_TYPE_CIS];
        let ojIds = data[LD_TYPE_OJ];

        // if the METADATA mode is off we don't load anything 
        if (!R2L.hasLinkedDataMode(LD_MODE_METADATA)) {
            return new Promise(function (resolve, reject) {
                resolve({});
            });
        }

        // CELEX
        let p1 = new Promise((resolve, reject) => {
            let metadata = {};
            if (celexIds.length === 0) {
                resolve();
                return;
            }
            this.getCelexData(celexIds).then((data) => {
                if (data && data.results && data.results.bindings) {
                    data.results.bindings.map(function (binding) {
                        if (binding.originalId && binding.originalId.value && !metadata[binding.originalId.value.replace("celex:", "")]) {
                            metadata[binding.originalId.value.replace("celex:", "")] = new Binding(binding, LD_TYPE_CELEX, SPARQL_STATUS_SUCCESS);
                        }

                        // only first result is relevant in case of duplication
                        if (binding.id && binding.id.value && !metadata[binding.id.value.replace("celex:", "")]) {
                            metadata[binding.id.value.replace("celex:", "")] = new Binding(binding, LD_TYPE_CELEX, SPARQL_STATUS_SUCCESS);
                        }
                    });
                }

                this.setMetadata(metadata);
                resolve(data);
            }).catch((err) => {
                //set false when failed to fetch metadata
                celexIds.forEach(celexId => {
                    metadata[celexId] = new Binding(null, LD_TYPE_CELEX, SPARQL_STATUS_ERROR);
                });

                this.setMetadata(metadata);
                resolve(null);
            });
        });

        // ECLI
        let p2 = new Promise((resolve, reject) => {
            let metadata = {};
            if (ecliIds.length === 0) {
                resolve();
                return;
            }
            this.getEcliData(ecliIds).then((data) => {
                if (data && data.results && data.results.bindings) {
                    data.results.bindings.map(function (binding) {
                        if (binding.id && binding.id.value && !metadata[binding.id.value]) {
                            metadata[binding.id.value] = new Binding(binding, LD_TYPE_ECLI, SPARQL_STATUS_SUCCESS);
                        }
                    });
                }

                this.setMetadata(metadata);
                resolve(data);
            }).catch((err) => {
                //set false when failed to fetch metadata
                ecliIds.forEach(ecliId => {
                    metadata[ecliId] = new Binding(null, LD_TYPE_ECLI, SPARQL_STATUS_ERROR);
                });
                this.setMetadata(metadata);
                resolve(null);
            });
        });

        // FINLEX
        let p3 = new Promise((resolve, reject) => {
            let metadata = {};
            if (finlexEliIds.length === 0) {
                resolve();
                return;
            }

            this.getFinlexEliData(finlexEliIds).then((data) => {
                if (data && data.results && data.results.bindings) {
                    data.results.bindings.map(function (binding) {
                        if (binding.id && binding.id.value) {
                            metadata[binding.id.value] = new Binding(binding, LD_TYPE_FINLEX, SPARQL_STATUS_SUCCESS);
                        }
                    });
                }

                this.setMetadata(metadata);
                resolve(data);
            }).catch(function (err) {
                console.error(err);
                resolve(null);
            });
        });

        // ELI
        let p4 = new Promise((resolve, reject) => {
            let metadata = {};
            if (eliIds.length === 0) {
                resolve();
                return;
            }

            this.getEliData(eliIds).then((response) => {
                if (response) {
                    let computedEliIdsMap = response._computedEliIdsMap;

                    if (response && response.results && response.results.bindings) {
                        Object.keys(computedEliIdsMap).forEach(key => {
                            // find the right binding
                            let binding = response.results.bindings.filter(b => {
                                return b && b.eli && b.eli.value === computedEliIdsMap[key];
                            }).pop();

                            if (binding) {
                                metadata[key] = new Binding(binding, LD_TYPE_ELI, SPARQL_STATUS_SUCCESS);
                            }
                        })
                    }
                }

                this.setMetadata(metadata);
                resolve(data);
            }).catch(function (err) {
                console.error(err);
                resolve(null);
            });
        });

        // ARES Handoc
        let p5 = new Promise((resolve, reject) => {
            let metadata = {};
            let hasHandocData = true;
            let hasCisData = true;
            if (R2L.options.linkedDataMode.indexOf(LD_ADVANCED_MODE_KM_HANDOC) === -1 || aresHandocIds.length === 0) {
                hasHandocData = false;
            }

            if (R2L.options.linkedDataMode.indexOf(LD_ADVANCED_MODE_KM_CIS) === -1 || cisIds.length === 0) {
                hasCisData = false;
            }

            if (!hasHandocData && !hasCisData) {
                resolve();
                return;
            }

            this.getKMData({
                [LD_TYPE_HANDOC]: aresHandocIds,
                [LD_TYPE_CIS]: cisIds
            }).then((data) => {
                if (data && data.results && data.results.bindings) {
                    data.results.bindings.map(function (binding) {
                        if (binding.id && binding.id.value) {
                            metadata[binding.id.value] = new Binding(binding, binding.type.value, SPARQL_STATUS_SUCCESS);
                        }
                    });
                }

                this.setMetadata(metadata);
                resolve(data);
            }).catch(function (err) {
                console.error(err);
                resolve(null);
            });
        });

        // Parlamentary Procedure
        let p6 = new Promise((resolve, reject) => {
            let metadata = {};
            if (procedureIds.length === 0) {
                resolve();
                return;
            }

            this.getProcedureData(procedureIds).then((data) => {
                if (data && data.results && data.results.bindings) {
                    data.results.bindings.map(function (binding) {
                        if (binding.id && binding.id.value) {
                            metadata[binding.id.value] = new Binding(binding, LD_TYPE_PROCEDURE, SPARQL_STATUS_SUCCESS);
                        }
                    });
                }

                this.setMetadata(metadata);
                resolve(data);
            }).catch(function (err) {
                console.error(err);
                resolve(null);
            });
        });

        // Council docs (consil)
        let p7 = new Promise((resolve, reject) => {
            let metadata = {};
            if (consilIds.length === 0) {
                resolve();
                return;
            }

            this.getConsilData(consilIds).then((data) => {
                if (data && data.results && data.results.bindings) {
                    data.results.bindings.map(function (binding) {
                        if (binding.id && binding.id.value) {
                            metadata[binding.id.value.replace("consil:", "")] = new Binding(binding, LD_TYPE_CONSIL, SPARQL_STATUS_SUCCESS);
                        }
                    });
                }

                this.setMetadata(metadata);
                resolve(data);
            }).catch(function (err) {
                console.error(err);
                resolve(null);
            });
        });

        // OJ
        let p8 = new Promise((resolve, reject) => {
            let metadata = {};
            if (ojIds.length === 0) {
                resolve();
                return;
            }
            this.getOjData(ojIds).then((data) => {
                if (data && data.results && data.results.bindings) {
                    data.results.bindings.map(function (binding) {
                        if (binding.originalId && binding.originalId.value && !metadata[binding.originalId.value.replace("oj:", "")]) {
                            metadata[binding.originalId.value.replace("oj:", "")] = new Binding(binding, LD_TYPE_OJ, SPARQL_STATUS_SUCCESS);
                        }

                        // only first result is relevant in case of duplication
                        if (binding.id && binding.id.value && !metadata[binding.id.value.replace("oj:", "")]) {
                            metadata[binding.id.value.replace("oj:", "")] = new Binding(binding, LD_TYPE_OJ, SPARQL_STATUS_SUCCESS);
                        }
                    });
                }

                this.setMetadata(metadata);
                resolve(data);
            }).catch((err) => {
                //set false when failed to fetch metadata
                celexIds.forEach(celexId => {
                    metadata[celexId] = new Binding(null, LD_TYPE_OJ, SPARQL_STATUS_ERROR);
                });

                this.setMetadata(metadata);
                resolve(null);
            });
        });

        // group all promises
        return Promise.all([p1, p2, p3, p4, p5, p6, p7, p8]).then((results) => {
            this.status = SPARQL_STATUS_SUCCESS;
            return this.getMetadata([...celexIds, ...ecliIds, ...eliIds, ...finlexEliIds, ...aresHandocIds, ...procedureIds, ...consilIds, ...ojIds]);
        }).catch((e) => {
            this.status = SPARQL_STATUS_ERROR;
            console.error(e);
            return {};
        });
    }
}

// bind functions
LinkedDataManager.prototype.fixCaseLawCitation = fixCaseLawCitation;
LinkedDataManager.prototype.cleanFootnote = cleanFootnote;
LinkedDataManager.prototype.parseFragment = parseFragment;
LinkedDataManager.prototype.getEUTreatyShortTitle = getEUTreatyShortTitle;
LinkedDataManager.prototype.getJoinedCasesTranslation = getJoinedCasesTranslation;
LinkedDataManager.prototype.FOOTNOTE_BLACKLIST = FOOTNOTE_BLACKLIST;



/**
 * Target language takes priority over source language
 * @returns {string} Language ISO2 format
 */
export function getLinkedDataLanguage() {
    let langMap = R2L.getConstant('R2L_EULANG');
    return langMap.get(String(R2L.getLanguage().toUpperCase()) || "ENG");
}
