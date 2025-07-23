import { replace, LD_ELI_BASE_URL } from "../../../utils/index.js";
/**
 * Resolve subdivisions - inject a context legal act (ELI) to use with detected subdivisions
 * The base ELI is fetched from the $LD_ELI_BASE_URL global (@see R2L.settings.constants)
 * 
 * Processes placeholders: ELI_BASE_URL
 * @param {Object} matches
 * @returns {Promise<Object>}  
 */
export const resolveEliBaseUrl = function (matches) {
    return new Promise((resolve, reject) => {
        Object.keys(matches).forEach(key => {
            matches[key].offsets.forEach(offset => {
                offset.rule.ld.forEach(placeholder => {
                    if (placeholder === LD_ELI_BASE_URL) {
                        let replacementEliUrl = R2L.getConstant(LD_ELI_BASE_URL) || "";
                        offset = replace(offset, placeholder, replacementEliUrl);
                    }
                });
            });
        });

        resolve(matches);
    });
};
