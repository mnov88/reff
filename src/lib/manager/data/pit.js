import { LD_TARGET_CELLAR, LD_TYPE_CELEX } from "../index.js";
import { getRequestPromise } from "../../utils/request.js";
import { getCelexQuery } from "../query/celex.js";
import { getISO2Lang, getTranslation } from "../../translations/index.js";
import { translateOjData } from "./oj.js";

/**
 * Will apply the Point-in-time parameter to the Cellar response by overriding the linked-data of the original acts with the consolidated acts if needed. 
 * Example: 
 *   pointInTime = 2023-01-01; 
 *   text = 32006R0765; 
 * 
 * Output: 
 *   title: Consolidated text: Council Regulation (EC) No 765/2006 of 18 May 2006 concerning restrictive measures in view of the situation in Belarus and the involvement of Belarus in the Russian aggression against Ukraine
 *   eli: http://data.europa.eu/eli/reg/2006/765/2022-07-20
 * 
 * @param {R2LCellarResponse} response 
 * @param {String} langISO3 
 * 
 * @return {Promise<R2LCellarResponse>}
 */
export function appendPointInTimeData(response, langISO3) {
    return new Promise(function (resolve, reject) {
        let celexIds = [];
        if (!response || !response.results || !response.results.bindings) {
            resolve(response);
            return;
        }

        response.results.bindings.forEach(binding => {
            let idList = binding && binding.consolidatedId ? binding.consolidatedId.value : "";
            let ids = String(idList || "").split(",").filter(id => !!id).map(id => id.replace("celex:", ""));
            celexIds = celexIds.concat(ids);
        });
        // unique ids only
        celexIds = celexIds.filter((v, i, a) => a.indexOf(v) === i);

        console.debug("Extracted CELEX ids", celexIds);
        if (celexIds.length === 0) {
            resolve(response);
            return;
        }

        // load linked data for all these CELEX ids
        let query = getCelexQuery(celexIds, langISO3);
        let format = 'application/json';

        getRequestPromise(R2L.ldm.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: format,
            origin: '*',
            target: LD_TARGET_CELLAR
        }).then(function (consolidationResponse) {
            // apply OJ translations
            let langISO2 = getISO2Lang((langISO3 || "ENG").toUpperCase());
            consolidationResponse = translateOjData(consolidationResponse, langISO2);


            // merge the data
            let celexDataMap = {};

            consolidationResponse.results.bindings.forEach(binding => {
                let id = String(binding && binding.id ? binding.id.value : "").replace("celex:", "");
                if (binding.title && binding.title.value) {
                    binding.title.value = getTranslation('eurlex.consolidated.text', langISO2) + ': ' + binding.title.value;
                }

                celexDataMap[id] = binding;
            });

            response.results.bindings = response.results.bindings.map(binding => {
                // override data if found in the consolidation map
                if (binding.consolidatedId && celexDataMap[binding.consolidatedId.value]) {
                    let _binding = celexDataMap[binding.consolidatedId.value];
                    // add a  property to keep track of the original CELEX id and the consolidation CELEX id
                    if (binding.id) {
                        _binding.originalId = { type: 'xsd: string', value: binding.id.value };
                    }

                    if (binding.eli) {
                        _binding.originalEli = { type: 'xsd: string', value: binding.eli.value };
                    }

                    // we merge some data from the main act
                    let obj = {
                        ..._binding, ...{
                            force: binding.force,
                            dateForce: binding.dateForce,
                            dateValidity: binding.dateValidity,
                            repealCelexId: binding.repealCelexId,
                            repealEli: binding.repealEli,
                            lastRepealCelexId: binding.lastRepealCelexId,
                            lastRepealEli: binding.lastRepealEli,
                        }
                    };
                    return obj;
                }

                return binding;
            })

            resolve(response);
        }).catch((e) => {
            console.error(e);
            resolve(response);
        });
    });
}