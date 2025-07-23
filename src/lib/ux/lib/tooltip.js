import { R2L } from '../../index.js';
import { getLinkedDataLanguage, SPARQL_STATUS_PENDING, SPARQL_STATUS_ERROR } from '../../manager/index.js';
import { getTranslation } from '../../translations/index.js';

const STATUS_IN_FORCE = "inforce";
const STATUS_NOT_IN_FORCE = "notinforce";
const STATUS_NO_LONGER_IN_FORCE = "nolongerinforce";
const STATUS_PENDING_IN_FORCE = "pendinginforce";

export function buildConsolidationLabel(binding) {
    let metadata = binding ? binding.data : null;
    let result = '';

    if (!metadata) {
        return result;
    }

    if (!metadata.consolidatedEli || !metadata.consolidatedDate) {
        return result;
    }

    result += getTranslation('eurlex.act.changed', getLinkedDataLanguage()) + ` <a href="${metadata.consolidatedEli.value}" target="_blank">${toPrettyDate(metadata.consolidatedDate.value)}</a>`;

    return result;
}

export function buildOjLabel(binding) {
    let metadata = binding ? binding.data : null;
    return metadata && metadata.oj && metadata.oj.value ? "<br>" + (String(metadata.oj.value) + "<br>") : "";
}

export function buildForceLabel(binding) {
    let status = buildForceStatus(binding);
    let consolidationLabel = buildConsolidationLabel(binding);

    let content = "";

    if (!binding || !binding.data) {
        return content;
    }

    if (status === STATUS_IN_FORCE) {
        content += getTranslation('eurlex.act.in.force', getLinkedDataLanguage());

        if (binding.data.initialEli && binding.data.initialEli.value) {
            let suffixLabel = `(<a target="_blank" href="${binding.data.initialEli.value}">` + getTranslation('eurlex.act.initial', getLinkedDataLanguage()) + `</a>)`;
            content = content + ' ' + suffixLabel;
        }
    }

    if (status === STATUS_NOT_IN_FORCE) {
        content += getTranslation('eurlex.act.not.in.force', getLinkedDataLanguage());
        if (binding.data.initialEli && binding.data.initialEli.value) {
            let suffixLabel = `(<a target="_blank" href="${binding.data.initialEli.value}">` + getTranslation('eurlex.act.initial', getLinkedDataLanguage()) + `</a>)`;
            content = content + ' ' + suffixLabel;
        }
    }

    if (status === STATUS_NO_LONGER_IN_FORCE && binding) {
        content += getTranslation('eurlex.act.no.longer.in.force', getLinkedDataLanguage());
        if (binding.data.dateValidity) {
            content += `, ` + getTranslation('eurlex.act.validity.date.end', getLinkedDataLanguage());
            content += ` ` + toPrettyDate(binding.data.dateValidity.value);
        }

        // used by ELI queries
        if (binding.data.initialEli && binding.data.initialEli.value) {
            let suffixLabel = `(<a target="_blank" href="${binding.data.initialEli.value}">` + getTranslation('eurlex.act.initial', getLinkedDataLanguage()) + `</a>)`;
            content = content + ' ' + suffixLabel;
        }
    }

    if ((status === STATUS_NOT_IN_FORCE || status === STATUS_NO_LONGER_IN_FORCE) && binding && binding.data.repealCelexId && binding.data.repealEli) {
        content += `; ` + getTranslation('eurlex.act.repealed.by', getLinkedDataLanguage()) + ` <a href="${binding.data.repealEli.value}" target="_blank">${binding.data.repealCelexId.value}</a>`;
    }

    if (status === STATUS_PENDING_IN_FORCE) {
        content += (getTranslation('eurlex.act.notification.pending', getLinkedDataLanguage()) + binding.data.dateForce.value);
    }

    if (consolidationLabel) {
        content += "\r\n" + consolidationLabel;
    }

    // used by CELEX queries (Point in time)
    if (binding.data.originalEli) {
        content += `\r\n<a target="_blank" href="${binding.data.originalEli.value}">` + getTranslation('eurlex.act.original', getLinkedDataLanguage()) + `</a>`;
    }
    else if (binding.data.originalId) {
        let url = `https://eur-lex.europa.eu/legal-content/${getLinkedDataLanguage() || 'EN'}/AUTO/?uri=${binding.data.originalId.value}`;
        content += `\r\n<a target="_blank" href="${url}">` + getTranslation('eurlex.act.original', getLinkedDataLanguage()) + `</a>`;
    }

    /**
     * if this is a consolidation but there's a newer one available show a link to the latest version
     * eg. http://data.europa.eu/eli/dec/2006/415/2015-12-02
     */
    if (binding && binding.data && binding.data.initialEli && binding.data.initialEli.value) {
        // check if the final consolidation is older than current act
        if (binding.data.finalConsolidatedEli &&
            binding.data.finalConsolidatedDate &&
            binding.data.date &&
            binding.data.finalConsolidatedDate.value > binding.data.date.value
        ) {
            let finalLabel = (getTranslation('eurlex.act.access.current.version', getLinkedDataLanguage()) + ` (${toPrettyDate(binding.data.finalConsolidatedDate.value)})`);
            content = content + '\r\n' + `<a href="${binding.data.finalConsolidatedEli.value}" target="_blank">${finalLabel}</a>`;
        }
    }

    return content;
}

export function buildDate(binding) {
    let metadata = binding ? binding.data : null;
    if (!metadata) {
        return "";
    }

    try {
        return (new Date(metadata.date.value.slice(0, 10))).toISOString().slice(0, 10);
    }
    catch (e) {
        return "";
    }
}

export function buildForceStatus(binding) {
    let metadata = binding ? binding.data : null;
    let today = (new Date()).toISOString().slice(0, 10);
    if (!metadata || !metadata.force || metadata.force.value === "") {
        if (metadata && metadata.initialForce && metadata.initialForce.value) { // "0" or "1"
            if (parseInt(metadata.initialForce.value)) {
                return STATUS_IN_FORCE;
            }
            else {
                //  check the initial act
                if (metadata.initialDateValidity && metadata.initialDateValidity.value < today) {
                    return STATUS_NO_LONGER_IN_FORCE;
                }

                return STATUS_NOT_IN_FORCE;
            }
        }
        return "";
    }
    else {
        if (metadata.force && parseInt(metadata.force.value)) {
            return STATUS_IN_FORCE;
        }
        else {
            // check current act
            if (metadata.dateForce && metadata.dateForce.value && String(metadata.dateForce.value).slice(0, 10) > today) {
                return STATUS_PENDING_IN_FORCE;
            }
            else {
                if (metadata.dateValidity && metadata.dateValidity.value < today) {
                    return STATUS_NO_LONGER_IN_FORCE;
                }
                else {
                    return STATUS_NOT_IN_FORCE;
                }
            }
        }
    }
}

export function buildEliLabel(binding) {
    if (!binding || !binding.data || !binding.data.eli) {
        return "";
    }

    return `ELI: <a href="${binding.data.eli.value}" target="_blank">${binding.data.eli.value}</a>`;
}

export function buildTitleLabel(binding, defaultTitle, linkedDataId) {
    let title = binding && binding.data && binding.data.title ? String(binding.data.title.value).replace(/#/g, "<br>") : defaultTitle;

    if (R2L.options.metadata) {
        // if there's a Linked Data id we can add state info
        if (linkedDataId && (!binding || !binding.data) && R2L.ldm.getStatus() === SPARQL_STATUS_PENDING) {
            title += `<br><div data-status="${R2L.ldm.getStatus()}" class="r2l-title-status">
            <div class="r2l-loading-bar-spinner spinner">
                    <div class="spinner-icon"></div>
                </div>
            </div>`;
        }

        if (linkedDataId && (!binding || binding.status === SPARQL_STATUS_ERROR)) {
            if (!binding && R2L.ldm.getStatus() !== SPARQL_STATUS_PENDING) {
                title += `<br><div data-status="info" class="r2l-title-status">` + getTranslation('ld.not.found', getLinkedDataLanguage()) + `</div>`;
            }
            if (binding) {
                title += `<br><div data-status="error" class="r2l-title-status">` + getTranslation('ld.connection.failure', getLinkedDataLanguage()) + `</div>`;
            }

        }
    }

    return title;
}

/**
 * Turns 2020-05-21 into 21/05/2020
 * @param {string} str 
 */
function toPrettyDate(str) {
    return (str || "").split("-").reverse().join("/");
}