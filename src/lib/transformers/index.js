
import { clearPlaceholders } from "./utils/index.js";
import { LD_MODE_SEQ_NUMBER } from "../settings/index.js";
import { resolveCorDecisionNumber } from "./placeholders/rules/eurlex/committee_regions_dec.js";
import { resolveCelexSubnumber } from "./placeholders/rules/eurlex/act.js";
import { resolveStaffRegsConsolidation } from './placeholders/rules/eurlex/staff_regs.js';
import { resolveLegacyActs } from "./placeholders/rules/eurlex/act_legacy.js";
import { resolveEeaJointCommitteeDecisionNumber } from "./placeholders/rules/eurlex/eea_joint_committee_dec.js";
import { resolvePartnershipCouncilDecisionNumber } from "./placeholders/rules/eurlex/partnership_council_dec.js";

import { resolveUnitedNationsRegulationActs } from "./placeholders/rules/eurlex/united_nations_reg.js";
import { resolveOjEli } from "./placeholders/rules/eurlex/oj_eli.js";
import { clearLdTargets } from "./filter.js";
import { resolveEliBaseUrl } from "./placeholders/rules/eurlex/subdivision.js";
import { resolveEucaseCelexIds, resolveEucaseJoinedJudgements } from "./placeholders/rules/eucase/eucase.js";
import { resolveEcbEli, resolveEcbActCelex } from "./placeholders/rules/ecb/ecb_eli.js";

/**
 * Will settle (fill or remove) CELEX and ELI placeholders {{ LD:CELLAR:NUMBER:CELEX}}, {{ LD:CELLAR:SUBNUMBER:CELEX }} in case of ambiguos identifiers
 * `Decision No 70/2008/EC` will resolve to CELEX id `32008D0070(01)` and ELI `/eli/dec/2008/70(1)/oj`
 * The filling is done by looking up information on the matched text in Cellar and resolving the ambiguity
 * 
 * @param {Object} matches 
 * @returns {Promise<Object>} - the settled `matches 
 */
export function fillPlaceholders(matches) {
    return new Promise((resolve, reject) => {

        let promises = [];

        if (!R2L.options.metadata || !R2L.hasLinkedDataMode(LD_MODE_SEQ_NUMBER)) {
            matches = clearLdTargets(matches);
            matches = clearPlaceholders(matches);
            resolve(matches);
            return;
        }

        // will mutate the matches object
        promises.push(fillEliBaseUrls(matches));
        promises.push(fillLegacyActsPlaceholders(matches));
        promises.push(fillCelexConsolidationPlaceholders(matches));
        promises.push(fillEcbIds(matches));
        promises.push(fillCelexSubnumberPlaceholders(matches));
        promises.push(fillCelexNumberPlaceholders(matches));
        promises.push(fillUnitedNationsRegulationPlaceholders(matches));
        promises.push(fillOjEli(matches));
        promises.push(fillEucaseCelexIds(matches));
        promises.push(fillEucaseJoinedJudgements(matches));

        Promise.all(promises).then((_) => {
            // clear remaining placeholders
            matches = clearPlaceholders(matches);
            resolve(matches);
        }).catch(e => {
            console.error(e);
            // can't do much
            matches = clearPlaceholders(matches);
            resolve(matches);
        });
    });
}

function fillEucaseCelexIds(matches) {
    return resolveEucaseCelexIds(matches);
}

function fillEucaseJoinedJudgements(matches) {
    return resolveEucaseJoinedJudgements(matches);
}


function fillEcbIds(matches) {
    return resolveEcbEli(matches).then(matches => {
        return resolveEcbActCelex(matches);
    });
}

/**
 * Resolve CELEX subnumber placeholders eg: 32008D0070 {{ (01) }}
 * @param {Object} matches
 * @returns {Promise<Object>} 
 */
function fillCelexSubnumberPlaceholders(matches) {
    return resolveCelexSubnumber(matches);
}

/**
 * Resolve ELIs for OJ new references
 * @param {Object} matches
 * @returns {Promise<Object>} 
 */
function fillOjEli(matches) {
    return resolveOjEli(matches);
}

/**
 * Resolve CELEX number placeholders eg: 32020{{ Q1120(01) }}
 * @param {Object} matches
 * @returns {Promise<Object>} 
 */
function fillCelexNumberPlaceholders(matches) {

    // resolve committee of regions decisions which don't have a (type + number)
    return resolveCorDecisionNumber(matches).then(matches => {
        // resolve EEA decisions
        return resolveEeaJointCommitteeDecisionNumber(matches).then(matches => {
            // resolve Partnership Council decisions
            return resolvePartnershipCouncilDecisionNumber(matches);
        })
    });
}

/**
 * Resolve CELEX number & ELI url placeholders for legacy acts eg: 3{{ 1959R0007 }}
 * @param {Object} matches
 * @returns {Promise<Object>} 
 */
function fillLegacyActsPlaceholders(matches) {
    //legacy acts with missing year
    return resolveLegacyActs(matches);
}

/**
 * Resolve CELEX number & ELI url placeholders for UN regulations eg: 3{{ 1959R0007 }}
 * @param {Object} matches
 * @returns {Promise<Object>} 
 */
function fillUnitedNationsRegulationPlaceholders(matches) {
    return resolveUnitedNationsRegulationActs(matches);
}

/**
 * Resolve CELEX consolidation placeholders eg: 01962R0031{{ -20200101 }}
 * @param {Object} matches
 * @returns {Promise<Object>} 
 */
function fillCelexConsolidationPlaceholders(matches) {
    return new Promise((resolve, reject) => {
        resolve(matches);
        /**
         * staff regs consolidation numbers
         * currently disabled as we use default values
        resolveStaffRegsConsolidation(matches).then(matches => {
            resolve(matches);
        })
        */
    });
}

function fillEliBaseUrls(matches) {
    return resolveEliBaseUrl(matches);
}
