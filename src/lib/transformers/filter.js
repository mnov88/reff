import { extractAttributes } from "../utils/functions.js";
import { extractCelexIdList, extractIdList } from "./../utils/data.js";
import { hasItem, LD_ACTIVE } from "./utils/index.js";
import { LD_MODE_CHECK_EXISTS } from "../settings/index.js";
import { filterCelexTargets, removeCelexIds, removeIds } from "./filters/celex.js";
import { filterOjTargets } from "./filters/oj.js";
import { filterConsilTargets } from "./filters/consil.js";

/**
 * Will filter targets annotated with an `ld-condition` which are not found in the Cellar graph. Targets filtered: 
 *   - CELEX - views annotated with (ld-condition="cellar-exists-celex") - will lookup the CELEX id in the graph and remove the target if not found
 *   - OJ - views annotated with (ld-condition="cellar-exists-oj") - will lookup the manifest URL in the graph and remove the target if not found
 *   - CONSIL - views annotated with (ld-condition="cellar-exists-consil") - will lookup the CONSIL id in the graph and remove the target if not found
 * 
 * @param {Object} matches
 * @returns {Promise<Object>} - the filtered `matches`
 */
export function filterTargets(matches) {

    return new Promise((resolve, reject) => {
        if (!R2L.options.metadata || !R2L.hasLinkedDataMode(LD_MODE_CHECK_EXISTS)) {
            let result = clearLdTargets(matches);
            resolve(result);

        }
        else {
            // sequential filtering - first filter CELEX targets then OJ
            filterCelexTargets(matches).then(matches => {
                return filterOjTargets(matches);
            }).then(matches => {
                return filterConsilTargets(matches);
            }).then(matches => {
                resolve(matches);
            });
        }
    })
}



/**
 * Remove targets that need filtering (ld-condition="ld-active") (used when LD is not available)
 * @param {Object} matches
 * @returns {Object} filtered matches 
 */
export function clearLdTargets(matches) {
    // collect targets that need to be checked
    let ids = [];

    Object.keys(matches).forEach(key => {
        matches[key].offsets.forEach(offset => {
            // targets to be inspected
            let targets = offset.rule.views.filter(v => {
                return hasItem(v.ldCondition, LD_ACTIVE);
            }).map(t => t.target);

            let filteredViews = {};
            let hasItems = false;
            Object.keys(offset.views).forEach(target => {
                if (targets.indexOf(target) !== -1) {
                    filteredViews[target] = offset.views[target];
                    hasItems = true;
                }
            });

            if (hasItems) {
                let attributes = extractAttributes(filteredViews);
                let _ids = extractIdList(attributes);
                ids = ids.concat(_ids);
            }
        })
    });

    if (ids.length === 0) {
        return matches;
    }

    // unique ids only
    ids = ids.filter((v, i, a) => a.indexOf(v) === i);
    matches = removeIds(matches, ids);
    return matches;
}
