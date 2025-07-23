import { TRANSLATIONS, LANGUAGE_MAP } from './config/params.js';

export const DEFAULT_LD_LANG = "EN";

/**
 * Resolves a translation tag in the language of choice. Supports templating eg. "Repealed by {{ date }} immediately"
 * 
 * Usage: 
 *   getTranslation("eurlex.act.no.longer.in.force", "FR")
 * 
 * @param {String} name 
 * @param {String} language ISO2 language
 * @param {Object} params { key: value } pairs to inject into the templated strings
 * 
 * @returns {String}
 */
export const getTranslation = ((name, language, params) => {
    if (!TRANSLATIONS[name]) {
        return null;
    }
    language = String(language).toUpperCase();

    let str = TRANSLATIONS[name][language] || TRANSLATIONS[name][DEFAULT_LD_LANG];
    if (!str) {
        return null;
    }

    params = params || {};
    Object.keys(params).forEach((key) => {
        try {
            str = str.replace(new RegExp("{{\\s?" + key + "\\s?}}", 'gi'), params[key]);
        }
        catch (e) {
            console.error(e);
        }
    });

    return str;
});

/**
 * Language conversion utility function ISO2 -> ISO3
 * @param {String} iso3 
 * @returns {String}
 */
export function getISO2Lang(iso3) {
    let iso2 = null;
    LANGUAGE_MAP.forEach((value, key) => {
        if (value.iso3 === iso3) {
            iso2 = key;
        }
    });

    return iso2;
}

/**
 * Language conversion utility function ISO3 -> ISO2
 * @param {String} iso2 
 * @returns {String}
 */
export function getISO3Lang(iso2) {
    let data = LANGUAGE_MAP.get(iso2);
    return data ? data.iso3 : null;
}