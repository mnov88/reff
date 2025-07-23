import { getTranslation } from "../../translations/index.js";

/**
 * Extracts information from the OJ label returned by SPARQL queries 
 * Example: OJ L 119, 4.5.2016, p. 1–88
 * @param {String} ojLabel 
 * @returns {Object} 
 */
export function extractOjData(ojLabel) {
    let regex = /OJ ([a-zA-Z-]+) (\d+(?:[a-zA-Z]+)?), (\d{1,2}\.\d{1,2}\.\d{4}), p\. (\d+)-(\d+)/i;

    let regexActByAct = /OJ ([a-zA-Z-]+) (\d{4})\/(\d+(?:[a-zA-Z]+)?), (\d{1,2}\.\d{1,2}\.\d{4})/i;

    let regexWithoutPage = /OJ ([a-zA-Z-]+) (\d+(?:[a-zA-Z]+)?), (\d{1,2}\.\d{1,2}\.\d{4})/i;

    let matches = regex.exec(ojLabel);
    if (!matches) {
        matches = regexActByAct.exec(ojLabel);
        if (!matches) {
            matches = regexWithoutPage.exec(ojLabel);
            if (!matches) {
                return null;
            }
            else {
                return {
                    ojPart: matches[1],
                    ojNumber: matches[2],
                    ojPublicationDate: matches[3],
                    ojPublicationDateDay: matches[3].split(".")[0],
                    ojPublicationDateMonth: matches[3].split(".")[1],
                    ojPublicationDateYear: matches[3].split(".")[2],
                    isActByAct: false,
                    isNoPage: true
                }
            }
        }
        else {
            return {
                ojPart: matches[1],
                ojPartPrefix: matches[1] === 'C' ? 'C/' : '',
                ojYear: matches[2],
                ojNumber: matches[3],
                ojPublicationDate: matches[4],
                ojPublicationDateDay: matches[4].split(".")[0],
                ojPublicationDateMonth: matches[4].split(".")[1],
                ojPublicationDateYear: matches[4].split(".")[2],
                isActByAct: true,
                isNoPage: false
            }
        }
    }
    else {
        return {
            ojPart: matches[1],
            ojNumber: matches[2],
            ojPublicationDate: matches[3],
            ojPublicationDateDay: matches[3].split(".")[0],
            ojPublicationDateMonth: matches[3].split(".")[1],
            ojPublicationDateYear: matches[3].split(".")[2],
            ojPageFirst: matches[4],
            ojPageLast: matches[5],
            isActByAct: false,
            isNoPage: false
        }
    }
}

/**
 * Translate OJ label
 * @param {*} response 
 * @param {*} langISO2 
 * @returns 
 */
export function translateOjData(response, langISO2) {
    if (!response || !response.results || !response.results.bindings) {
        return response;
    }

    response.results.bindings = response.results.bindings.map(binding => {
        try {
            if (!binding.oj || !binding.oj.value) {
                return binding;
            }

            let ojString = binding.oj.value;
            let ojData = extractOjData(ojString);
            if (ojData) {
                if (ojData.isActByAct) {
                    binding.oj.value = getTranslation('official.journal.label.new', langISO2, ojData);
                }
                else if (ojData.isNoPage) {
                    binding.oj.value = getTranslation('official.journal.label.nopage', langISO2, ojData);
                }
                else {
                    binding.oj.value = getTranslation('official.journal.label', langISO2, ojData);
                }
            }
            return binding;
        }
        catch (e) {
            console.debug(e); //missing OJ data; moving on;
            return binding;
        }
    });

    return response;
}