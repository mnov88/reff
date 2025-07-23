import { getISO2Lang } from "../../translations/index.js"

export const SHORT_TITLE_WITH_ARTICLE_TEMPLATE = {
    'EN': 'Article {{ TREATY_ARTICLE_NO }} {{ TREATY_ACRONYM }}',
    'FR': 'Article {{ TREATY_ARTICLE_NO }} {{ TREATY_ACRONYM }}',
    'DE': 'Artikel {{ TREATY_ARTICLE_NO }} {{ TREATY_ACRONYM }}'
}

export const SHORT_TITLE_WITH_ANNEX_TEMPLATE = {
    'EN': 'Annex {{ TREATY_ANNEX_NO }} {{ TREATY_ACRONYM }}',
    'FR': 'Annexe {{ TREATY_ANNEX_NO }} {{ TREATY_ACRONYM }}',
    'DE': 'ANHANG {{ TREATY_ANNEX_NO }} {{ TREATY_ACRONYM }}'
}

export const SHORT_TITLE_TEMPLATE = {
    'EN': '{{ TREATY_ACRONYM }}',
    'FR': '{{ TREATY_ACRONYM }}',
    'DE': '{{ TREATY_ACRONYM }}'
}

export const TEU_TRANSLATIONS = {
    'EN': 'TEU',
    'FR': 'TUE',
    'DE': 'EUV'
}

export const TEU_TRANSLATIONS_LONG = {
    'EN': 'Treaty on European Union',
    'FR': 'Traité sur l\'Union européenne',
    'DE': 'Vertrag über die Europäische Union'
}

export const TFEU_TRANSLATIONS = {
    'EN': 'TFEU',
    'FR': 'TFUE',
    'DE': 'AEUV'
}

export const TFEU_TRANSLATIONS_LONG = {
    'EN': 'Treaty on the Functioning of the EU',
    'FR': 'Traité sur le fonctionnement de l\'UE',
    'DE': 'Vertrag über die Arbeitsweise der EU'
}


export const EURATOM_TRANSLATIONS = {
    'EN': 'EAEC',
    'FR': 'CEEA',
    'DE': 'EAG'
}

export const EURATOM_TRANSLATIONS_LONG = {
    'EN': 'EAEC Treaty',
    'FR': 'traité CEEA',
    'DE': 'EAG-Vertrag'
}

export const LISBON_TRANSLATIONS = {
    'EN': 'Treaty of Lisbon',
    'FR': 'Traité de Lisbonne',
    'DE': 'Vertrag von Lissabon'
}

export const LISBON_TRANSLATIONS_LONG = LISBON_TRANSLATIONS;

export const ECSC_TREATY = {
    'EN': 'ECSC',
    'FR': 'CECA',
    'DE': 'EGKS'
}

export const ECSC_TREATY_LONG = {
    'EN': 'ECSC Treaty',
    'FR': 'traité CECA',
    'DE': 'EGKS-Vertrag'
}

export function getAcronym(celexId, langISO2) {
    let root = String(celexId).slice(1, 6);
    let hasSubdivision = getAnnexNo(celexId) || getArticleNo(celexId);
    if (root === '2016M') {
        return hasSubdivision ? TEU_TRANSLATIONS[langISO2] : TEU_TRANSLATIONS_LONG[langISO2];
    }

    if (root === '2016E') {
        return hasSubdivision ? TFEU_TRANSLATIONS[langISO2] : TFEU_TRANSLATIONS_LONG[langISO2];
    }

    if (root === '2016A') {
        return hasSubdivision ? EURATOM_TRANSLATIONS[langISO2] : EURATOM_TRANSLATIONS_LONG[langISO2];
    }

    if (root === '2007L') {
        return hasSubdivision ? LISBON_TRANSLATIONS[langISO2] : LISBON_TRANSLATIONS_LONG[langISO2];
    }

    if (root === '1951K') {
        return hasSubdivision ? ECSC_TREATY[langISO2] : ECSC_TREATY_LONG[langISO2];
    }

    return null;
}

export function getArticleNo(celexId) {
    let digits = String(celexId).slice(-3);
    if (/^\d+$/gi.exec(digits)) {
        return String(parseInt(digits));
    }

    return null;
}

export function getAnnexNo(celexId) {
    let matches = /N(\d+)$/gi.exec(String(celexId));
    if (matches && matches[1]) {
        return String(parseInt(matches[1]));
    }

    return null;
}

/**
 * Returns a short title for an EU treaty, based on the CELEX id.
 * @param {String} celexId 
 * @param {String} langISO3
 * 
 * @return {String|null} 
 */
export function getEUTreatyShortTitle(celexId, langISO3) {
    langISO3 = langISO3 || 'ENG';
    let langISO2 = getISO2Lang(langISO3);
    let articleNo = getArticleNo(celexId);
    let annexNo = getAnnexNo(celexId);
    let annexNoRoman = R2L.converters.toRoman(annexNo);
    let acronym = getAcronym(celexId, langISO2);
    let tmpl = SHORT_TITLE_TEMPLATE;
    if (articleNo) {
        tmpl = SHORT_TITLE_WITH_ARTICLE_TEMPLATE;
    }

    if (annexNoRoman) {
        tmpl = SHORT_TITLE_WITH_ANNEX_TEMPLATE;
    }

    if (acronym && tmpl[langISO2]) {
        return tmpl[langISO2].replace('{{ TREATY_ACRONYM }}', acronym).replace('{{ TREATY_ARTICLE_NO }}', articleNo).replace('{{ TREATY_ANNEX_NO }}', annexNoRoman)
    }

    return null;
}