// legacy act rule 
export const LD_CELLAR_ACT_NUMBER_CELEX = "LD:CELLAR:ACT:NUMBER:CELEX";
export const LD_CELLAR_ACT_URL_ELI = "LD:CELLAR:ACT:URL:ELI";

// committee of regions decision rule
export const LD_CELLAR_COR_NUMBER_CELEX = "LD:CELLAR:COR:NUMBER:CELEX";

// eea joint committee decision rule
export const LD_CELLAR_EEAJC_NUMBER_CELEX = "LD:CELLAR:EEAJC:NUMBER:CELEX";
export const LD_CELLAR_EEAJC_NUMBER_ELI = "LD:CELLAR:EEAJC:NUMBER:ELI";

// partnership council decision rule
export const LD_CELLAR_PC_NUMBER_CELEX = "LD:CELLAR:PC:NUMBER:CELEX";
export const LD_CELLAR_PC_NUMBER_ELI = "LD:CELLAR:PC:NUMBER:ELI";

// OJ ELI target
export const LD_CELLAR_OJ_CELEX = "LD:CELLAR:OJ:CELEX";
export const LD_CELLAR_OJ_TYPE_ELI = "LD:CELLAR:OJ:TYPE:ELI";

// ECB ELI target
export const LD_CELLAR_ECB_CELEX = "LD:CELLAR:ECB:CELEX";
export const LD_CELLAR_ECB_ELI = "LD:CELLAR:ECB:ELI";

// EUCASE Order subnumber
export const LD_CELLAR_EUCASE_SUBNUMBER_CELEX = "LD:CELLAR:EUCASE:SUBNUMBER:CELEX";

// generic marking used for act rule, celex rule
export const LD_CELLAR_SUBNUMBER_CELEX = "LD:CELLAR:SUBNUMBER:CELEX";

// marking used in subdivision rule
export const LD_ELI_BASE_URL = "LD:ELI:BASE:URL";

export const LD_CELLAR_EUCASE_JOINED_JUDGEMENT = "LD:CELLAR:EUCASE:JOINED:JUDGEMENT";

// staff regs rule
export const LD_CELLAR_CONSOLIDATION_CELEX = "LD:CELLAR:CONSOLIDATION:CELEX";
export const LD_CELLAR_CONSOLIDATION_ELI = "LD:CELLAR:CONSOLIDATION:ELI";

export const LD_CELLAR_UN_REG = "LD:CELLAR:UN:REG";
export const LD_CELLAR_UN_REG_CELEX = "LD:CELLAR:UN:REG:CELEX";
export const LD_CELLAR_UN_REG_ELI = "LD:CELLAR:UN:REG:ELI";

// filter markings
export const LD_ACTIVE = "ld-active";
export const LD_CELEX_CONDITION = "cellar-exists-celex";
export const LD_CELEX_IF_NONE_CONDITION = "cellar-if-none-celex";
export const LD_OJ_CONDITION = "cellar-exists-oj";
export const LD_CONSIL_CONDITION = "cellar-exists-consil";

/**
 * Clears placeholders
 * @param {Object} matches 
 * @param {String|null} type (LD:CELLAR:COR:NUMBER:CELEX, LD:CELLAR:SUBNUMBER:CELEX)
 * @param {String} replacement
 * 
 * @returns {Object} matches 
 */
export function clearPlaceholders(matches, type, replacement) {

    replacement = replacement || "";

    // go through matches and fill LD placeholders
    Object.keys(matches).forEach(key => {
        if (matches[key].offsets) {
            matches[key].offsets.forEach(offset => {
                let rule = offset.rule;
                if (rule.ld && rule.ld.length > 0) {
                    if (!type || rule.ld.indexOf(type) !== -1) {
                        rule.ld.forEach(placeholder => {
                            offset = replace(offset, placeholder, replacement);
                        })
                    }
                }
            });
        }
    });

    return matches;
}

/**
 * Replace linked-data placeholders in the match object
 * @param {Object} match 
 * @param {String} placeholder LD:CELLAR:NUMBER:CELEX|LD:CELLAR:SUBNUMBER:ELI
 * @param {String} replacement (defaults to '')
 * @returns {Object} match
 */
export const replace = (match, placeholder, replacement) => {

    Object.keys(match.views).forEach(key => {
        match.views[key] = replaceStr(String(match.views[key]), placeholder, replacement);
    });
    match.alternatives.forEach(alternative => {
        alternative.view = replaceStr(alternative.view, placeholder, replacement);
    });

    return match;
}

/**
 * Replace placeholder in string
 * @param {String} str 
 * @param {String} placeholder 
 * @param {String} replacement
 * 
 * @returns {String}  
 */
export const replaceStr = (str, placeholder, replacement) => {
    replacement = replacement || '';
    // if the placeholder provides a default and we have no replacement then use it
    // eg. {{ LD:CELLAR:CONSOLIDATION:CELEX|2020-01-01 }} 
    let regex = new RegExp('{{\\s?' + placeholder + '(?:\\|([^\\s}]*))?\\s?}}', 'gi');
    return String(str).replace(regex, (match, capture) => {
        return capture && !replacement ? capture : replacement;
    });
}

/**
 * Smooth over spaces and odd chars
 * @param {String} str
 * @returns {String} 
 */
export const sanitize = (str) => {
    str = str.replace(/[\u202F\u00A0]/g, " ");
    return str;
}

export const hasItem = (str, item) => {
    if (!str) {
        return false;
    }

    let items = String(str).split(" ").filter(l => !!l).map(l => l.trim());
    return items.indexOf(item) !== -1;
}