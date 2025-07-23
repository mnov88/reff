/**
 * Utility functions that operate on `list` rules. 
 * 
 * List rules are the rules that capture lists of subdivisions (EU legal acts, treaties). 
 * Example:
 *     articles 101 and 102 of the TFEU    # The engine will detect 2 nodes: `articles 101`, `102 of the TFEU`
 * 
 * Within a reference block containing multiple nodes (subdivision), some will capture more information than others, which means the data needs to be shared between the items.
 * In our example above, the first node `articles 101` does not 'know' we are referring to the TFEU treaty, hence why we need to share the information from the second item to the first.
 * 
 * Data will be shared between nodes based on the `list-prefix` / `list-shared` / `list-identifiers` / `list-vars` / `list-skip` attributes of the XML rule declaration.
 * Only particular offsets should be shared in order to ensure consistency. In the example below: 
 * 
 *     Article 25(6), (7) and (8) of Regulation (EU) 2018/1725
 * 
 *     Detects 3 nodes: 
 *         `Article 25(6)`             # Contains 'article' and 'paragraph' information, but is missing act type/year/number (Regulation/2018/1725);
 *         `(7)`                       # Contains 'paragraph' information, needs 'article' information from node #1 and act type/year/number from node #3;
 *         `(8) of Regulation (EU) 2018/1725` # Contains all information except the 'article' number from node #1;
 * 
 * Note that data needs to be shared between both left-hand nodes and right-hand nodes. 
 * 
 * In the example above, the attributes should be defined as follows:
 *   - `list-prefix` offsets should point to the capture group of the act label: "Regulation";
 *      This data is always copied between nodes;
 * 
 *   - `list-shared` offsets should point to the year and number of the act: "2018" and "1725";
 *      This data is copied only when missing from target nodes;
 * 
 *   - `list-identifiers` offsets should point to the article number: "25";
 *      All division-specific (article/annex and deeper) offsets are identifiers. This data is copied only when missing from target nodes;
 * 
 *   - `list-vars` offsets are a sub-part of identifier offsets, used for nodes which are ambiguous, like a single number. Examples: 
 *        - articles 2, 3 and 4 of TFUE;           # '3' is a variable offset, representing an article number
 *        - article 1 paragraph 2, 3 and 4 of TFUE   # '4' is a variable offset, representing a paragraph number
 * 
 *      Special treatment is required to evaluate what subdivision level a variable offset represents;
 * 
 *   - `list-skip` offsets are used to skip certain identifier offsets from copying left or right;
 *       
 */

/**
 * Copy the identifiers of a subpart - Exclude point level
 * @param {Object} sourceRef match object 
 * @param {Object} destRef match object
 *
 * @returns {Boolean} result
 */
export function cloneCoreIdentifiers(sourceRef, destRef) {
    var sourceIds = getSubpartIdentifiers(sourceRef.rule, sourceRef.matches);
    var coreIndexes = sourceRef.rule.coreIdentifiers ? String(sourceRef.rule.coreIdentifiers).split(" ") : [];
    var destVar = null;

    var destVars = getListVars(destRef.rule, destRef.matches);

    /* Constructs like "32.4" number.number (SV) should not clone identifiers */
    if (/^\d+\.\d+/.test(sourceRef.matches[0])) {
        return true;
    }

    /* Constructs with brackets like "13(b)" article(point letter) should not clone identifiers */
    if (destVars.length === 1 && !(/^\d+\([a-z0-9]+\)/.test(destRef.matches[0]))) {
        destVar = destVars[0].match;
        destRef.matches[parseInt(destVars[0].index)] = undefined;
    }

    var filteredSourceVars = [];
    for (var i = 0; i < sourceIds.length; i++) {
        if (coreIndexes.indexOf(sourceIds[i].index) !== -1) {
            filteredSourceVars.push(sourceIds[i]);
        }
        else {
            if (destVar) {
                destRef.matches[parseInt(sourceIds[i].index)] = destVar;
            }
        }
    }

    for (var i = 0; i < filteredSourceVars.length; i++) {
        if (!destRef.matches[parseInt(filteredSourceVars[i].index)]) {
            destRef.matches[parseInt(filteredSourceVars[i].index)] = filteredSourceVars[i].match;
        }
    }

    return true;
}

/**
 * Adjust destRef identifiers in case of standalone numbers by merging with source
 * @param {Object} sourceRef match object 
 * @param {Object} destRef match object
 *
 * @returns {Boolean} result
 */
export function cloneListIdentifiers(sourceRef, destRef) {
    if (!sourceRef.rule || !sourceRef.rule.type) {
        return false;
    }

    var destVars = getListVars(destRef.rule, destRef.matches);
    var destCoreIds = getListCore(destRef.rule, destRef.matches);
    var destIds = getListIdentifiers(destRef.rule, destRef.matches);
    destIds = destIds.filter(function (id) {
        return id.type === 'identifiers';
    });

    // default behavior "article 5 paragraphs 3 and 4" (copy-right)
    if (destVars.length === 1 && destIds.length === 1) {
        /* This match has variable offsets, meaning we need the context from source
         * Merge the variable value into the matches of the source. 
         */

        /* Don't overwrite prefix data */
        var sourceIds = getSubpartIdentifiers(sourceRef.rule, sourceRef.matches);

        var skipVars = getListSkips(sourceRef.rule, sourceRef.matches);
        var skipIndexes = skipVars.map(function (skipVar) {
            return skipVar.index;
        });

        /** 
         * If the source looks like this: "article 15 (4)" or "article 16(b)" then we need to analyse the destination 
         * in order to find the correct offsets
         */
        if (/\d{1,6}\s?\(([a-z]|[0-9]+)\)/.test(sourceRef.matches[0])) {
            /**
             * Constructs with brackets like "article 3(12) and 4 of Dir 497/2018" should not clone identifiers 
             */
            if (/^\d{1,6}(\(\w\))?$/.test(destRef.matches[0])) {
                // include all but the first sourceId as skip indexes
                for (let skipIndex = 1; skipIndex < sourceIds.length; skipIndex++) {
                    skipIndexes.push(sourceIds[skipIndex].index);
                }
            }
        }

        /** If the raw reference (destination) is wrapped in brackets eg "art. 14(3) and (4)" we don't use skip vars */
        if (/^\(\d{1,6}(?:[a-z])?\)/.test(destRef.matches[0].trim())) {
            skipIndexes = [];
        }

        /** 
         * If the raw reference is a letter we don't use skip vars as it will be last-level
         * Example: article 15 point a) and b)
         */
        if (/^\(?[a-z]/.test(destRef.matches[0])) {
            skipIndexes = [];
        }

        /** 
         * Source constructs like article.paragraph should be handled differently. 
         * All raw subparts after them should be 1st level (SV) 
         */
        if (/\d{1,6}\.[a-nA-N0-9]/.test(sourceRef.matches[0])) {
            for (let skipIndex = 1; skipIndex < sourceIds.length; skipIndex++) {
                skipIndexes.push(sourceIds[skipIndex].index);
            }
        }

        var filteredSourceIds = sourceIds.filter(function (sourceId) {
            return skipIndexes.indexOf(sourceId.index) === -1;
        });

        if (filteredSourceIds.length > 0) {
            destRef.matches[parseInt(destVars[0].index)] = undefined;

            /** 
             * Find a position to insert the variable. 
             * Usually it's last level eg. article 5 paragraphs 1 and 2
             * Sometimes it's one to the left eg. article 5 paragraphs 1(a) and 2(b)
             * If there is a mismatch between type (letter vs number) we can move one position to the left
             */
            let selectedSlot = filteredSourceIds.length - 1;
            if (filteredSourceIds.length > 1 && /\d+/.test(destVars[0].match) && /[a-z]/.test(filteredSourceIds[filteredSourceIds.length - 1].match)) {
                selectedSlot--;
                filteredSourceIds.splice(-1, 1);
            }

            filteredSourceIds[selectedSlot].match = destVars[0].match;

            for (var i = 0; i < filteredSourceIds.length; i++) {
                destRef.matches[parseInt(filteredSourceIds[i].index)] = filteredSourceIds[i].match;
            }
        }
    }

    // right-hand element needs core matches and identifiers
    // REFTOLINK-1184
    if (destIds.length === 0 && destVars.length === 0) {
        var sourceIds = getSubpartIdentifiers(sourceRef.rule, sourceRef.matches);
        for (var i = 0; i < sourceIds.length; i++) {
            destRef.matches[parseInt(sourceIds[i].index)] = sourceIds[i].match;
        }
    }

    return true;
};

/**
 * Copy prefix matches from one object to the other
 * @param {Object} sourceRef match object 
 * @param {Object} destRef match object
 *
 * @returns {Boolean} result
 */
export function cloneListCore(sourceRef, destRef) {
    if (!sourceRef.rule || !sourceRef.rule.type || !sourceRef.rule.prefix) {
        return false;
    }

    var indexes;
    var listRef = getListCore(destRef.rule, destRef.matches);
    if (listRef.length === 0 && sourceRef.rule.prefix) {
        var indexes = String(sourceRef.rule.prefix).split(" ");
        for (var i = 0; i < indexes.length; i++) {
            if (typeof sourceRef.matches[indexes[i]] === "string" && typeof destRef.matches[indexes[i]] === "undefined") {
                destRef.matches[indexes[i]] = sourceRef.matches[indexes[i]];
            }
        }
    }

    var sharedRef = getListShared(destRef.rule, destRef.matches);
    if (sharedRef.length === 0 && sourceRef.rule.shared) {
        indexes = String(sourceRef.rule.shared).split(" ");
        for (var i = 0; i < indexes.length; i++) {
            if (typeof sourceRef.matches[indexes[i]] === "string" && typeof destRef.matches[indexes[i]] === "undefined") {
                destRef.matches[indexes[i]] = sourceRef.matches[indexes[i]];
            }
        }
    }

    return true;
};

/**
 * Get map of offsets for lists
 * @param {Array<Object>} references
 * 
 * @returns {Object} map of full list matches
 */
export function getOffsetMap(references) {
    var allOffsets = {};

    for (var i = 0; i < references.length; i++) {
        if (!Array.isArray(references[i].offsets)) {
            continue;
        }

        for (var j = 0; j < references[i].offsets.length; j++) {
            if (!allOffsets[references[i].offsets[j].context]) {
                allOffsets[references[i].offsets[j].context] = new Array();
            }
            allOffsets[references[i].offsets[j].context].push(references[i].offsets[j]);
        }
    }
    return allOffsets;
};


/**
 * Get base list information from the matches.
 * 
 * @param {Object} rule
 * @param {Array<String>} matches
 * 
 * @returns {Array<String>} 
 */
export function getListCore(rule, matches) {
    var arr = new Array();
    if (rule.prefix) {
        rule.prefix = String(rule.prefix);
        var indexes = rule.prefix.split(" ");
        for (var i = 0; i < indexes.length; i++) {
            if (matches[indexes[i]]) {
                arr.push({ 'index': indexes[i], 'match': matches[indexes[i]], 'type': 'prefix' });
            }
        }
    }

    return arr;
};


/**
 * Get shared list information from the matches.
 * 
 * @param {Object} $rule
 * @param {Array<String>} matches
 * 
 * @returns {Array<String>} 
 */
export function getListShared(rule, matches) {
    var arr = new Array();
    if (rule.shared) {
        rule.shared = String(rule.shared);
        var indexes = rule.shared.split(" ");
        for (var i = 0; i < indexes.length; i++) {
            if (matches[indexes[i]]) {
                arr.push({ 'index': indexes[i], 'match': matches[indexes[i]], 'type': 'shared' });
            }
        }
    }

    return arr;
};

export function getCoreIdentifiers(rule, matches) {
    var arr = new Array();
    if (rule.coreIdentifiers) {
        rule.coreIdentifiers = String(rule.coreIdentifiers);
        var indexes = rule.coreIdentifiers.split(" ");
        for (var i = 0; i < indexes.length; i++) {
            if (matches[indexes[i]]) {
                arr.push({ 'index': indexes[i], 'match': matches[indexes[i]], 'type': 'core-identifiers' });
            }
        }
    }
    return arr;
};

/**
 * Get variables list information from the matches.
 * 
 * @param {Object} rule
 * @param {Array<String>} matches
 * 
 * @returns {Array<String>} 
 */
export function getListVars(rule, matches) {
    var arr = new Array();
    if (rule.vars) {
        rule.vars = String(rule.vars);
        var indexes = rule.vars.split(" ");
        for (var i = 0; i < indexes.length; i++) {
            if (matches[indexes[i]]) {
                arr.push({ 'index': indexes[i], 'match': matches[indexes[i]], 'type': 'vars' });
            }
        }
    }

    return arr;
};

/**
 * Get skip list information from the matches.
 * 
 * @param {Object} $rule
 * @param {Array<String>} matches
 * 
 * @returns {Array<String>} 
 */
export function getListSkips(rule, matches) {
    var arr = new Array();
    if (rule.skip) {
        rule.skip = String(rule.skip);
        var indexes = rule.skip.split(" ");
        for (var i = 0; i < indexes.length; i++) {
            if (matches[indexes[i]]) {
                arr.push({ 'index': indexes[i], 'match': matches[indexes[i]], 'type': 'skip' });
            }
        }
    }

    return arr;
};

/**
 * Get subpart specific information from the matches
 * @param {Object} $rule
 * @param {Array<String>} matches
 * 
 * @returns {Array<String>} 
 */
export function getSubpartIdentifiers(rule, matches) {
    var arr = new Array();

    if (rule.identifiers) {
        rule.identifiers = String(rule.identifiers);
        var indexes = rule.identifiers.split(" ");
        for (var i = 0; i < indexes.length; i++) {
            if (matches[indexes[i]]) {
                arr.push({ 'index': indexes[i], 'match': matches[indexes[i]], 'type': 'identifiers' });
            }
        }
    }
    return arr;
};

/**
 * Get list-item specific information from the matches
 * @param {Object} rule
 * @param {Array<String>} matches
 * 
 * @returns {Array<String>} 
 */
export function getListIdentifiers(rule, matches) {
    var arr = new Array();
    if (rule.shared) {
        rule.shared = String(rule.shared);
        var indexes = rule.shared.split(" ");
        for (var i = 0; i < indexes.length; i++) {
            if (matches[indexes[i]]) {
                arr.push({ 'index': indexes[i], 'match': matches[indexes[i]], 'type': 'shared' });
            }
        }
    }

    if (rule.identifiers) {
        rule.identifiers = String(rule.identifiers);
        var indexes = rule.identifiers.split(" ");
        for (var i = 0; i < indexes.length; i++) {
            if (matches[indexes[i]]) {
                arr.push({ 'index': indexes[i], 'match': matches[indexes[i]], 'type': 'identifiers' });
            }
        }
    }
    return arr;
};