
import { $ } from '../jquery.js';
import { regExpEscape, getLookAhead, getLookBehind } from '../utils/functions.js';
import { settings } from '../settings/index.js';
import { letters } from '../utils/letters.js';
import { LD_TARGET_CELLAR, LD_TYPE_CELEX } from '../manager/index.js';
import { sanitize } from '../transformers/utils/index.js';
import { padCounter } from '../utils/processor.js';
import { getRequestPromise } from '../utils/request.js';
import { getEcasTicket } from '../manager/ecas.js';
import { getEUTreatyShortTitle } from '../manager/data/treaty.js';

/**
 * The ALIAS feature tricks Ref2Link into detecting legal references in the text by applying the rules 
 *   on a different text than the original input text. Once detected, the engine will revert to the original (alias reference) instead of the captured reference and continues its processing pipeline.
 * 
 * Example: 
 *     Input text: `Article 3 of GDPR is now repealed`;
 *     ALIAS_MAP: { GDPR: "Regulation (EU) 2016/679" }     # We define here that `GDPR` in text actually means `Regulation (EU) 2016/679`
 * 
 *     Text that Ref2Link will process: `Article 3 of Regulation (EU) 2016/679 is now repealed`;  # GDPR has been replaced by the formal legal reference so that Ref2Link can detect it.
 *     Detected reference (includes subdivision): `Article 3 of Regulation (EU) 2016/679`
 *     Processed reference (includes subdivision): `Article 3 of GDPR`
 * 
 * Prerequisite:
 *    It is important to remember that Ref2Link processes input in 2 steps: 
 *        1. Apply regular expressions to the text and replace detected references with intermediary `<ref2link-object oid="*"></ref2link-object>` nodes.
 *           This allows the engine to isolate references and avoid overlapping;
 *        2. Replace all intermediary nodes with the final hyperlinks;
 *  
 * 
 * Enabling aliases adds extra steps to the pipeline. Here is how it works:
 * 
 * 1. Submit input text for processing;
 *    Example input text: `C-99/99 lorem ipsum GDPR`
 * 
 * 2. If the ALIAS feature is enabled and we have aliases defined we proceed with the ALIAS replacement - @see `replaceAliases` function:
 *    ALIAS_MAP = { GDPR: "Regulation (EU) 2016/679" }
 *    
 *    Text now becomes: `C-99/99 lorem ipsum Regulation (EU) 2016/679`;
 *     
 *    *If we have no aliases enabled we skip this step and move to step 6;
 * 
 * 3. Parse the text.
 *    Text now becomes: `<ref2link-object oid="1"></ref2link-object> lorem ipsum <ref2link-object oid="2"></ref2link-object>`;
 *    
 * 4. Process the results of the parse operation - replace the detected back-references with their aliases - @see `replaceAliasMatches` function
 * 
 * 5. Post-process the input text and replace all `<ref2link-object>` intermediary elements with hyperlinks;
 * 
 */

const WIKIDATA_ENDPOINT = "https://query.wikidata.org/sparql";

/**
* Aliases manager
* 
* Provides the API methods to get/set alias maps (key => value pairs)
* The manager also provides functionality to load Aliases from Wikidata, for a specific language, using SPARQL queries.
* 
*/
export class AliasManager {

    constructor() {
        this.endpoint = WIKIDATA_ENDPOINT;

        /** 
         * Internal map used for aliases extracted from text (usually by an AI engine). 
         * Example local alias: 'article 3 thereof' which maps to a specific legal act.
         * 
         * This map needs to be reset before each parse operation
         */
        this.localMap = {};

        /**
         * Knowing that aliases are mapped to CELEX ids, ELIs and eurlex acts we can exclude rest of the target types
         */
        this.includeTypes = ['eurlex.act.1', 'eurlex.act.3', 'eurlex.celexId', 'ecli', 'eucase', 'eli.url', 'genericurl'];
    }

    getEndpoint() {
        return this.endpoint;
    }

    setEndpoint(endpoint) {
        this.endpoint = endpoint;
    }

    enable() {
        R2L.options.aliases = true;
    }

    disable() {
        R2L.options.aliases = false;
    }

    /**
     * 
     * @returns 
     */
    __getMap() {
        return R2L.getConstant("R2L_ALIAS_MAP") || {};
    }

    __setMap(map) {
        R2L.setConstant("R2L_ALIAS_MAP", map);
    }

    add(obj) {
        this.__setMap({ ...this.__getMap(), ...obj });
        return this.__getMap();
    }


    addLocal(obj) {
        this.localMap = { ...this.localMap, ...obj };
        return this.localMap;
    }

    getAll() {
        return this.__getMap();
    }

    getAllLocal() {
        return this.localMap;
    }

    get(key) {
        return this.__getMap()[key];
    }

    reset() {
        this.__setMap({});
        this.localMap = {};
    }

    resetLocal() {
        this.localMap = {};
    }

    remove(key) {
        let map = this.__getMap();
        delete map[key];
        this.__setMap(map);
    }

    /**
     * Runs a SPARQL query against Wikidata to fetch aliases
     * @param {String} type 'eurlex.act|eucase'
     * @param {String} langISO2 en/fr... 
     * @param {String} langISO3 eng/fra... 
     * @returns {Promise<Object>}
     */
    fetch(type, langISO2, langISO3) {
        return getRequestPromise(this.getEndpoint(), "GET",
            { query: this.buildQuery(type, langISO2, langISO3) },
            { accept: 'application/sparql-results+json' }
        );
    }

    /**
     * Will load aliases into the engine
     * @param {String} type 
     * @param {String} langISO2 
     * @param {String} langISO3
     * @returns {Promise<Object>}
     */
    load(type, langISO2, langISO3) {
        return this.fetch(type, langISO2).then(response => {
            console.log(type, "Loaded aliases for lang", langISO2, langISO3, response);

            // process result
            return this.processResponse(response, langISO3).then((aliasMap) => {
                this.add(aliasMap);
            });
        })
    }

    processResponse(response, langISO2, langISO3) {
        let map = {};
        try {
            let items = response.results.bindings.map(item => {
                return {
                    celexId: item.celexId.value,
                    label: item.label.value
                }
            });
            items.forEach(item => {
                map[item.label] = item.celexId;
            });
        }
        catch (e) {
            console.error(e);
        }

        return this.getShortTitles(Object.values(map), langISO3).then(titleMap => {
            //Turns Celex ids into an act eg: 32006L0066 => Directive 2006/66/EC which can be captured by the act rule (with subdivisions)
            Object.keys(map).forEach(aliasTitle => {
                // if refrence not found then fallback to the Celex
                map[aliasTitle] = titleMap[map[aliasTitle]] || map[aliasTitle];
            });

            return map;
        }).catch(err => {
            console.error(err);
            return map;
        });
    }

    buildQuery(type, langISO2, langISO3) {
        langISO2 = String(langISO2).toLowerCase();

        return `
            SELECT DISTINCT ?label (MAX(?celex) as ?celexId)
            WHERE 
            {
            ?act wdt:P476 ?celex .
            OPTIONAL {
                ?act rdfs:label ?label .
                FILTER (lang(?label) = '${langISO2}') .
            }
            FILTER (REGEX(?celex, "^3....[LRD]....")) .
            FILTER (REGEX(?label, "^.")) .
            FILTER (!REGEX(?label, "[0-9]")) .
            }
            GROUP BY ?label
        `;
    }

    getAIAliases(text) {
        if (!R2L.options.ai) {
            return new Promise((resolve, reject) => {
                console.debug("AI alias feature not enabled, no AI aliases found");
                resolve([]);
            })
        }

        return getEcasTicket(settings.constants.R2L_AI_ENDPOINT, R2L.ldm.proxyTicket).then(proxyTicket => {
            let headers = { Authorization: proxyTicket };
            return getRequestPromise(settings.constants.R2L_AI_ENDPOINT, "POST",
                {
                    inputtext: text
                }, headers).catch(err => {
                    console.error(err);
                    return [];
                });
        }).catch((err) => {
            console.error(err);
            return [];
        });
    }

    /**
     * Turns Celex ids into an act eg: 32006L0066 => Directive 2006/66/EC which can be captured by the act rule (with subdivisions)
     *
     * @param {Array<String>} celexIds 
     * @param {String} langISO3 
     * @returns {Promise<Object>} Returns a KV map { [celexId] => short title }
     */
    getShortTitles(celexIds, langISO3) {
        // sector 1 is handled differently
        let treatyShortTitlesMap = this.extractTreatyShortTitlesMap(celexIds);
        // full titles required to extract short titles for sector 3
        return this.getFullTitles(celexIds, langISO3).then(titleMap => {
            return { ...this.extractShortTitlesMap(titleMap), ...treatyShortTitlesMap };
        }).catch(err => {
            console.error(err);
            return {};
        });
    }

    extractTreatyShortTitlesMap(celexIds, langISO3) {
        celexIds = celexIds.filter((celexId) => celexId.slice(0, 1) === '1');
        console.debug("Extract treaty short titles", celexIds, langISO3);

        let map = {};
        celexIds.forEach(celexId => {
            let title = getEUTreatyShortTitle(celexId, langISO3);
            if (title) {
                map[celexId] = title;
            }
        });

        return map;
    }

    /**
     * Process full title map and return the short titles
     * @param {Object} titleMap - { KV map of [celexId] => title }
     * @returns {Object} - { KV map of [celexId] => shortTitle }
     */
    extractShortTitlesMap(fullTitlesMap) {
        /**
         * We need to tune Ref2Link for parsing the titles effectively
         *   - Only use eurlex.act rules
         *   - disable linked data 
         */
        let _metadata = R2L.options.metadata;
        let _targets = R2L.filters.targets;
        let allTargets = [];
        R2L.getAllRules().forEach(r => {
            r.views.forEach(v => {
                allTargets.push(v.target);
            })
        });
        R2L.options.metadata = false;

        // eliminate eurlex.act.3 as it only deals with subdivisions in addition to the other act targets
        R2L.setFilter('targets', allTargets.filter(t => t.indexOf('eurlex.act') === 0 && t.indexOf('eurlex.act.3' !== 0)), true);

        let inputs = [];
        // Ref2link will only process titles for Celex ids starting with "3"
        // for the others it will use placeholders 
        Object.keys(fullTitlesMap).forEach((celexId) => {
            if (celexId.charAt(0) === '3') {
                inputs.push(fullTitlesMap[celexId]);
            }
            else {
                inputs.push("");
            }
        });

        // concatenate everything together for Ref2Link to process
        let inputText = inputs.map(input => {
            // sanitize input
            return sanitize(input);
        }).join("\t\t\t\t");
        return R2L.parse(inputText, "html").then(response => {
            // restore settings
            R2L.options.metadata = _metadata;
            R2L.setFilter('targets', _targets, true);

            // split back content and get first ref.
            let matches = response.result.split("\t\t\t\t").map((item, index) => {
                // return first captured text from each part
                let regex = /<a[^>]*?data-short-reference=(["\'])?((?:.(?!\1|>))*.?)\1?/
                let matches = item.match(regex);
                let match = matches ? (matches[2]) || null : null;
                // it's a short title only if the match is at the beginning

                let srcText = inputs[index].replace(new RegExp(String.fromCharCode(160), "g"), " ");
                // if the match is close to the beginning we use it
                if (match && srcText.indexOf(match) < 30) {
                    return match;
                }
                return null;
            });

            // merge results together
            let shortTitlesMap = {};
            Object.keys(fullTitlesMap).forEach((celexId, index) => {
                shortTitlesMap[celexId] = matches[index];
            })

            return shortTitlesMap;
        });

    }

    /**
     * Get full act titles from Cellar
     * @param {Array<String>} celexIds
     * @param {String} langISO3
     * 
     * @returns {Object} Returns a KV map: { [celexId] => title }   
     */
    getFullTitles(celexIds, langISO3) {
        // first we query the titles from Cellar
        let query = getCelexFullTitlesQuery(celexIds, langISO3);

        return getRequestPromise(R2L.ldm.getEndpoint(LD_TYPE_CELEX), "POST", {
            query: query,
            format: 'application/json',
            origin: '*',
            target: LD_TARGET_CELLAR
        }).then(function (response) {
            let map = {};
            // fill map with empty values as some ids might not be found
            celexIds.forEach(celexId => {
                map[celexId.toUpperCase()] = null;
            });

            try {
                response.results.bindings.forEach(binding => {
                    map[binding.id.value.replace("celex:", "").toUpperCase()] = sanitize(binding.title.value);
                });
            }
            catch (e) {
                console.error(e);
            }

            return map;
        });
    }
}


/**
 * Add tolerance to alias definitions (replace " ", "&" with all variants)
 * 
 * @param {String} alias 
 * @param {boolean} isRaw - whether to escape the pattern or not
 * 
 * @returns {String} 
 */
function getRegExp(alias, isRaw) {
    // use the full space pattern
    let spacePattern = "(?:(?:(?:[\\u00a0\\u202F ]|(?:\\u2003|(?:(?:\\x26(?:amp;)?)emsp;))|(?:\\u2002|(?:(?:\\x26(?:amp;)?)ensp;))|(?:\\u2005|(?:(?:\\x26(?:amp;)?)emsp14;))|(?:(?:\\x26(?:amp;)?)nbsp;))+))";
    let ampPattern = "&(?:amp;)?";
    let quotePattern = "(?:['`’])";

    if (!isRaw) {
        alias = regExpEscape(alias);
    }

    return alias.replace(new RegExp(" ", 'g'), spacePattern).replace(new RegExp("&", 'g'), ampPattern).replace(new RegExp("'", 'g'), quotePattern);
}


export function getCelexFullTitlesQuery(celexIds, langISO3) {
    langISO3 = String(langISO3 || "ENG").toUpperCase(); // default to english
    // unique ids only
    celexIds = celexIds.filter((v, i, a) => a.indexOf(v) === i);

    //only support acts for now (ids starting with '3')
    celexIds = celexIds.filter(id => id.slice(0, 1) === '3');

    let filters = "FILTER (?workId IN (";
    for (let i = 0; i < celexIds.length; i++) {
        filters += `"celex:${celexIds[i]}", "celex:${celexIds[i]}"^^xsd:string`; // query both types
        if (i < celexIds.length - 1) {
            filters += ",";
        }
    }
    filters += "))";

    let query = `
    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
    PREFIX cdm:<http://publications.europa.eu/ontology/cdm#>
    PREFIX skos:<http://www.w3.org/2004/02/skos/core#>
    PREFIX dc:<http://purl.org/dc/elements/1.1/>
    PREFIX lang:<http://publications.europa.eu/resource/authority/language/>
    PREFIX xsd:<http://www.w3.org/2001/XMLSchema#>
    PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#>
    PREFIX owl:<http://www.w3.org/2002/07/owl#>

    SELECT DISTINCT 
        ?workId as ?id 
        ?title 
        WHERE {  
            graph ?ge { 
                ?exp cdm:expression_belongs_to_work ?s .
                ?exp cdm:expression_title ?title
            }
            graph ?g { 
                ?exp cdm:expression_uses_language lang:${langISO3} . 
            }  
            ?s cdm:work_id_document ?workId.
            ${filters}
        }    
    `;
    return query;
}

/**
 * Alias replacement in text, based on the Alias maps provided as input to Ref2Link.
 * 
 * Example: 
 *     Input text: "GDPR is now in use."
 *     Defined alias map: { "GDPR": "Regulation (EU) 2016/679"}
 * 
 *     Output text: "Regulation (EU) 2016/679 is now in use."
 * 
 * This result will be again submitted for parsing and the newly detected references will be merged with the previous parsing results.
 * 
 * @param {String} text - Input text AFTER the initial Ref2Link processing, which contains <ref2link-object> nodes for the initially detected references.
 * @param {Object} extracts - previously detected references (before Alias processing) which need to be 
 * temporarily eliminated from the text so that the second Ref2Link processing (the Alias processing) 
 * does not interfere with them. We temporarily replace them with '***' masks.
 * 
 * @returns {Object} text with replaced aliases
 */
export function replaceAliases(text, extracts) {
    text = text || '';

    let letterPattern = "[/0-9" + letters.latin + letters.cyrillic + letters.greek + letters.specialChars + "]";
    let lookahead = getLookAhead(letterPattern);
    let lookbehind = getLookBehind(letterPattern);

    let offsets = [];
    let map = R2L.alias.getAll();

    if (R2L.options.ai) {

        // we keep the AI retrieved aliases separately (in a 'localMap')
        // here we merge the 2 maps together
        // the AI engine should have populated the local map if any were detected 
        map = { ...R2L.alias.getAllLocal(), ...map };
    }

    // We now use the alias map in the text to do the replacements.
    // First we strip the text of already detected references
    for (let i = extracts.length - 1; i >= 0; i--) {
        let ex = extracts[i]
        let length = (ex.$this.attr(R2L.dataRef2linkInitialAttribute) || "").trim().length;

        let extractHtml = '<ref2link-object oid="' + padCounter(i) + '"></ref2link-object>';
        let wildcard = "";
        for (let i = 0; i < length; i++) {
            wildcard += "*";
        }

        text = text.split(extractHtml).join(wildcard);
    };

    // build global pattern of aliases
    let globalPatterns = [];
    let args;
    let sortedKeys = Object.keys(map).sort((a, b) => {
        return a.length > b.length ? -1 : 1;
    });
    sortedKeys.forEach(key => {
        let isRegex = (key.substr(0, 1) === "/" && key.substr(key.length - 1, 1) === "/");
        let r = isRegex ? key.substr(1, key.length - 2) : getRegExp(key);
        let slots = 1;
        //clean internal capture groups
        if (isRegex) {
            r = r.replace(new RegExp("\\((?!\\?:)", "g"), (match, index) => {
                if (index >= 1 && r[index - 1] !== "\\") {
                    return "(?:";
                }
                else {
                    return match;
                }
            });
        }
        globalPatterns.push({ key: key, regexp: ('(' + r + ')'), value: map[key], slots: slots, isRegex: isRegex });
    });

    if (globalPatterns.length === 0) {
        return {
            text: text,
            offsets: offsets
        };
    }

    let globalPattern = new RegExp('(?![\r\n\v\f])' + lookbehind + `(?:${globalPatterns.map(g => g.regexp).join('|')})` + lookahead, 'ig');

    while (args = globalPattern.exec(text)) {
        let index = null;
        for (let i = 1; i < args.length; i++) {
            if (args[i]) {
                index = i;
                break;
            }
        }

        let reg;
        let key = (globalPatterns[index - 1]).key;
        if (globalPatterns[index - 1].isRegex) {
            key = key.substr(1, key.length - 2);
            reg = new RegExp(regExpEscape(key));
        }
        else {
            reg = new RegExp(globalPatterns[index - 1].regexp);
        }

        let matches = reg.exec(args[0]);
        let pattern = globalPatterns[index - 1];
        let offset = {
            source: args[0],
            replacement: pattern.isRegex ? replaceBackrefs(matches, pattern.value) : pattern.value,
            position: args.index
        }

        offsets.push(offset);
    }

    let cursorOffset = 0;
    // Add after-replacement offsets too
    offsets.map((o, index) => {
        o.replacementPosition = o.position + cursorOffset;
        cursorOffset += (o.replacement.length - o.source.length);
    });

    let currentDelta = 0;
    let currentCursor = 0;
    offsets.forEach(offset => {
        currentCursor = offset.position + currentDelta;
        text = text.slice(0, currentCursor) + offset.replacement + text.slice(currentCursor + offset.source.length, text.length);
        currentDelta += offset.replacement.length - offset.source.length;
    });

    return {
        text: text,
        offsets: offsets
    };
}

let replaceBackrefs = (args, val) => {
    if (!args) {
        return val;
    }

    for (let i = 0; i < args.length; i++) {
        if (!args[i]) {
            continue;
        }

        let regex = new RegExp("\\{\\{\\s?\\$" + i + "\\s?\\}\\}", "g");
        val = val.replace(regex, args[i]);
    }

    return val;
}

/**
 * Mutates the `matches` (Ref2Link processing result) object to merge the alias processing result
 * @param {Object} matches 
 * @param {Object} replaceAliasesResult 
 * @returns {Object} matches
 */
export function replaceAliasMatches(matches, replaceAliasesResult) {
    let offsets = [...replaceAliasesResult.offsets];

    offsets = offsets.sort((a, b) => {
        return a.replacement.length > b.replacement.length ? -1 : 1;
    });

    // we need to replace the match (+ its offsets and its key) back with the alias

    // all the matches should be alias-based
    Object.keys(matches).forEach(key => {
        let newMatch = matches[key];

        newMatch.offsets = newMatch.offsets.map((matchOffset) => {

            let aliasOffset = null;
            if (matchOffset.context.indexOf(matchOffset.match) === -1) {
                return matchOffset;
            }

            // get the correct offset using the replacementPosition of the alias offsets
            let referenceStart = matchOffset.position - (matchOffset.context.indexOf(matchOffset.match));
            let referenceEnd = referenceStart + matchOffset.context.length;

            for (let i = 0; i < replaceAliasesResult.offsets.length; i++) {

                if (replaceAliasesResult.offsets[i].replacementPosition >= referenceStart && replaceAliasesResult.offsets[i].replacementPosition < referenceEnd) {
                    // can also be the next alias offset
                    aliasOffset = replaceAliasesResult.offsets[i];
                    break;
                }
            }

            if (aliasOffset) {
                matchOffset = replaceFn(matchOffset, aliasOffset.replacement, aliasOffset.source);
                matchOffset.alias = aliasOffset;
                //adjust position by applying the delta of its aliasOffset
                matchOffset.position += (aliasOffset.position - aliasOffset.replacementPosition);
                matchOffset.positionDelta = (aliasOffset.source.length - aliasOffset.replacement.length);
            }

            return matchOffset;
        });
    });

    let newMatches = {};

    // replace keys and match objects
    Object.keys(matches).forEach(function (key) {
        for (let i = 0; i < matches[key].offsets.length; i++) {
            let matchOffset = matches[key].offsets[i];
            if (matchOffset.alias) {
                let newKey = key.replace(matchOffset.alias.replacement, matchOffset.alias.source);
                let newMatch = matches[key];
                newMatches[newKey] = replaceFn(newMatch, matchOffset.alias.replacement, matchOffset.alias.source);
                break;
            }
            else {
                newMatches[key] = matches[key];
            }
        }
    });

    // we also need to adjust the offsets for refs that are not aliases now
    let offsetsArr = [];
    // apply all position deltas caused by aliases
    Object.values(newMatches).forEach(match => {
        match.offsets.forEach(offset => {
            // find all matches with a lower position and apply delta
            offsetsArr.push(offset);
        });
    });
    // sort matches by position
    offsetsArr.sort((off1, off2) => {
        if (off1.alias && !off2.alias) {
            return off1.alias.replacementPosition < off2.position ? -1 : 1;
        }
        if (off2.alias && !off1.alias) {
            return off1.position < off2.alias.replacementPosition ? -1 : 1;
        }

        return off1.position < off2.position ? -1 : 1;
    });
    offsetsArr.forEach((offset, index) => {
        for (let idx = 0; idx < index; idx++) {
            // apply all deltas from aliases
            if (!offset.alias && offsetsArr[idx].positionDelta) {
                offset.position += offsetsArr[idx].positionDelta;
            }
        }
    });

    return newMatches;
}

// reuse the same element
let _textarea;
let replaceFn = function (obj, search, replace) {

    let subAlias = calculateSubAlias(search, replace, obj.context);
    console.debug("Subalias", subAlias);
    search = subAlias.search;
    replace = subAlias.replace;

    let searchRegexp = new RegExp(regExpEscape(search), 'g');

    // use a text area which is not vulnerable to XSS injection as it will not process tags (only entities)
    _textarea = _textarea || document.createElement("textarea");
    _textarea.innerHTML = replace;
    let replaceTextContent = _textarea.value;

    obj.match = obj.match.replace(searchRegexp, replace);

    if (obj.reference) {
        obj.reference = obj.reference.replace(searchRegexp, replace);
    }
    if (obj.wholeMatch) {
        obj.wholeMatch = obj.wholeMatch.replace(searchRegexp, replace);
    }
    if (obj.context) {
        obj.context = obj.context.replace(searchRegexp, replace);
    }
    if (obj.link) {
        obj.link = obj.link.replace(searchRegexp, replace);
    }
    if (obj.views) {
        Object.keys(obj.views).forEach((k) => {
            if (k === 'table') {
                return;
            }

            // Only replace the content and some attributes. We must be careful not to replace inside hrefs.
            try {
                let $el = $(obj.views[k]);
                if ($el.length) {
                    $el[0].textContent = $el[0].textContent.replace(searchRegexp, replaceTextContent);
                    //$el.html($el.html().replace(searchRegexp, replace));

                    if ($el.attr(R2L.dataRef2linkInitialAttribute)) {
                        $el.attr(R2L.dataRef2linkInitialAttribute, $el.attr(R2L.dataRef2linkInitialAttribute).replace(searchRegexp, replace));
                    }
                    obj.views[k] = $el[0].outerHTML;
                }
                else {
                    obj.views[k] = obj.views[k].replace(searchRegexp, replace);
                }
            }
            catch (e) {
                // table view, ignore
            }
        });
    }

    if (obj.alternatives) {
        obj.alternatives = obj.alternatives.map((alt) => {
            try {
                let $el = $(alt.view);
                if ($el.length) {
                    // replace textContent as it is not escaped
                    $el[0].textContent = $el[0].textContent.replace(searchRegexp, replaceTextContent);
                    //$el.html($el.html().replace(searchRegexp, replace));
                    if ($el.attr(R2L.dataRef2linkInitialAttribute)) {
                        $el.attr(R2L.dataRef2linkInitialAttribute, $el.attr(R2L.dataRef2linkInitialAttribute).replace(searchRegexp, replace));
                    }

                    if ($el.attr(R2L.dataRef2linkContextAttribute)) {
                        $el.attr(R2L.dataRef2linkContextAttribute, $el.attr(R2L.dataRef2linkContextAttribute).replace(searchRegexp, replace));
                    }
                    alt.view = $el[0].outerHTML;
                }
                else {
                    alt.view = alt.view.replace(searchRegexp, replace);
                }
            }
            catch (e) {
                // table view, ignore
            }

            alt.reference = alt.reference.replace(searchRegexp, replace);
            alt.match = alt.match.replace(searchRegexp, replace);
            alt.wholeMatch = alt.wholeMatch.replace(searchRegexp, replace);
            alt.context = alt.context.replace(searchRegexp, replace);
            alt.link = alt.link.replace(searchRegexp, replace);
            return alt;
        });
    }

    return obj;
}

/**
 * Substract the common block from 2 strings. Example: 
 *   str1 = 'Article 12(4) and (5) of Directive 2004/109/EC of the European Commission regarding bla bla'
 *   str2 = 'Article 12(4) and (5) of that Directive'
 *   context = 'Article 12(4) and (5) of Directive 2004/109/EC'
 * Returns: { search: 'that Directive', replace: 'Directive 2004/109/EC' }
 * @param {String} str1 
 * @param {String} str2 
 * 
 * @returns {Object}
 */
export function calculateSubAlias(str1, str2, context) {

    // if the alias coming from OpenAI is too verbose and Ref2Link only matches a part of it we drop the ending
    if (str1.indexOf(context) === 0 && str1.length > context.length) {
        str1 = context;
    }

    let length1 = str1.length;
    let length2 = str2.length;

    let minLength = length1 < length2 ? length1 : length2;

    let stopper = 0;
    for (let i = 0; i < minLength; i++) {
        if (str1[i] !== str2[i]) {
            stopper = i;
            break;
        }
    }

    return {
        search: str1.substr(stopper),
        replace: str2.substr(stopper)
    }
}
