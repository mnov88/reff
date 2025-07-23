
/**
 * Converter pipes to be used in rules.
 * Usage: 
 * {{ $3|replace:'str1':'str2' }}  // will call R2L.converters.replace(backref3, 'str1', 'str2')
 */
let converters = {
    // Outputs the target language ISO3 eg: `/eng`. Defaults to empty string if target lang is configured by the user.
    lang: function () {
        if (R2L.options && R2L.options.language && typeof R2L.options.language === "string") {
            return '/' + R2L.options.language;
        }
        else {
            return '';
        }
    },

    wrap: function wrap(str, startStr, endStr) {
        if (!str) {
            return '';
        }

        return startStr + String(str) + endStr;
    },

    multiLangIso2OrLangIso2: function multiLangIso2OrLangIso2(str) {
        return R2L.converters.multiLangIso2() || R2L.converters.langIso2() || 'EN';
    },

    // Outputs the target language ISO2 eg: `FR`.
    langIso2: function langIso2(str, defaultLang) {
        let lang = R2L.getLanguage();
        if (typeof lang === "string") {
            if (R2L.getConstant("R2L_EULANG").has(lang.toUpperCase())) {
                return R2L.getConstant("R2L_EULANG").get(lang.toUpperCase());
            }
            return defaultLang || 'EN';
        } else {
            return defaultLang || 'EN';
        }
    },

    // Outputs the source language ISO2 eg: `FR`.
    multiLangIso2: function multiLangIso2(str) {
        let lang = R2L.getMultiLanguage();
        if (typeof lang === "string") {
            let parts = lang.split("-");
            parts = parts.map(part => {
                if (R2L.getConstant("R2L_EULANG").has(part.toUpperCase())) {
                    return R2L.getConstant("R2L_EULANG").get(part.toUpperCase());
                }
                return null;
            });
            parts = parts.filter(part => !!part);
            if (parts.length === 0) {
                return '';
            }
            else {
                return parts.join("-");
            }
        } else {
            return '';
        }
    },

    // returns `/` prefixed language ISO2 eg: /DE
    langIsoA2: function langIsoA2() {
        let lang = R2L.getLanguage();
        if (typeof lang === "string") {
            if (R2L.getConstant("R2L_EULANG").has(lang.toUpperCase())) {
                return '/' + R2L.getConstant("R2L_EULANG").get(lang.toUpperCase());
            }
            return '';
        } else {
            return '';
        }
    },
    // returns raw language ISO3
    langIso3: function langIso3(str, defaultLang) {
        let lang = R2L.getLanguage();
        if (typeof lang === "string") {
            if (R2L.getConstant("R2L_EULANG").has(lang.toUpperCase())) {
                return lang;
            }
            return defaultLang || 'ENG';
        } else {
            return defaultLang || 'ENG';
        }
    },
    // returns language ISO3 prefixed by `/` eg: /FRA 
    langIsoA3: function langIsoA3() {
        let lang = R2L.getLanguage();
        if (typeof lang === "string") {
            if (R2L.getConstant("R2L_EULANG").has(lang.toUpperCase())) {
                return '/' + lang;
            }
            return '';
        } else {
            return '';
        }
    },
    // returns the pre-configured date to use as an ELI point in time. Format: `/YYYY-MM-DD`. Defaults to `/oj`.
    eliPointInTime: function pointInTime(reference, defaultDate) {
        let pointInTime = R2L.options.pointInTime || null;
        let d = new Date(String(pointInTime));
        if (!pointInTime || d.toString() === "Invalid Date") {
            return defaultDate !== undefined ? ("/" + defaultDate) : "/oj";
        }

        // ELI date should have format: `YYYY-MM-DD`
        let dateStr = d.toISOString().split('T')[0];
        return "/" + dateStr;
    },
    // maps a month label to a number. Example: `November`|month returns `11`
    month: function (str) {
        if (str && !isNaN(str)) {
            return str;
        }

        let converterRule = R2L.getConverterRules().filter(r => r.type === 'label_month')[0];
        if (!converterRule) {
            return '';
        }
        str = str ? String(str) : "";

        let matches = str.match(new RegExp(converterRule.pattern.source, "im"));
        if (matches && matches.length > 0) {
            for (let i = 1; i <= 12; i++) {
                if (matches[i]) {
                    return String(i);
                }
            }
        }

        return '';
    },
    // maps a numeration label to a number. Example: `second`|numeration returns `2`. Only works until 5.
    numeration: function (str) {
        if (String(str).length > 0 && !isNaN(str)) {
            return str;
        }

        let converterRule = R2L.getConverterRules().filter(r => r.type === 'label_numeration')[0];
        if (!converterRule) {
            return '';
        }
        str = str ? String(str) : "";

        let matches = str.match(new RegExp(converterRule.pattern.source, "im"));
        if (matches && matches.length > 0) {
            for (let i = 1; i <= 5; i++) {
                if (matches[i]) {
                    return String(i);
                }
            }
        }

        return '';
    },
    // pad a string. 
    pad: function (str, pad, len, position, strict) {
        str = str || '';
        if (strict && !str) {
            return '';
        }

        len = len || 0;
        pad = (pad === 0 ? '0' : pad) || '';
        var chars = len - ('' + str).length;
        if (chars > 0) {
            switch (position) {
                case 'right':
                    return str + ('' + pad).repeat(chars);
                case 'left':
                default:
                    return ('' + pad).repeat(chars) + str;
            }
        }

        return str;
    },
    // convert a 2-digit year into a 4-digit year; Works between 1958 - 2057;
    year: function (str) {
        str = str || '';
        if (('' + str).length === 4 && !isNaN(str)) {
            return Number(str);
        }
        if (('' + str).length == 2) {
            var y = parseInt(str, 10);
            if (y <= 57) {
                return Number('20' + str);
            } else {
                return Number('19' + str);
            }
        }
        if (!str) {
            return Number((new Date()).getFullYear());
        }
    },

    // convert a 4-digit year into a 2-digit year; Works between 1958 - 2057;
    shortYear: function (str) {
        str = str || '';
        if (('' + str).length === 2) {
            return Number(str);
        }
        if (('' + str).length === 4) {
            return Number(str.substr(2, 3));
        }
    },

    // trims a string (optional list of chars to trim)
    trim: function (str, chars) {

        let regExpEscape = function (pattern) {
            return pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
        str = str || '';
        chars = chars || '';
        if (chars.trim()) {
            var re = new RegExp("^[" + regExpEscape(chars) + "]+|[" + regExpEscape(chars) + "]+$", "g");

            return str.replace(re, '');
        }
        else {
            return (str.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim());
        }
    },
    // Replace string in string; The `what` parameter can be a regular expression string (eg. /1[23]/) or a normal string;
    replace: function (str, what, replacement, isRegexp) {
        return (String(str) || '').replace(R2L.delimiter2RegExp(what), (replacement === undefined ? '' : replacement));
    },
    // Returns length of Array
    length: function (obj) {
        return obj && obj.hasOwnProperty('length') ? obj.length : 0;
    },
    // Splits a string using a delimiter; Accepts both a regex string eg. `/1[23]/` or a regular string eg. `12`. 
    split: function (str, delimiter) {
        return (str || '').split(R2L.delimiter2RegExp(delimiter));
    },
    // 
    // @deprecated
    _default: function (str, defaultValue) {
        return (str === 0 ? '0' : str) || (defaultValue ? encodeURIComponent(defaultValue) : '') || ''
    },
    // logical OR operator. Usage: {{ $1|any:($2):($3):($4) }} # will return the first non-empty string among the 4 backreferences;
    any: function () {
        for (var i = 0; i < arguments.length; i++) {
            if (typeof arguments[i] === "number") {
                return String(arguments[i]);
            }

            if (typeof arguments[i] !== "string") {
                continue;
            }

            if (arguments[i].length > 0) {
                return arguments[i];
            }
        }
        return '';
    },
    // Logical operator: returns empty string if any of the args is not false(y); Usage: 
    // {{ $1|emptyIf:($2):($3):($4) }} === $1    # IF $2 AND $3 AND $4 are not empty return $1;
    emptyIf: function () {
        for (var i = 1; i < arguments.length; i++) {
            if (arguments[i]) {
                return "";
            }
        }

        return arguments[0];
    },
    // parse a number which contains a suffix;
    numberExt: function (input) {
        // support numeral labels like 'first', 'second' etc.
        if (/^[^0-9]/.test(input)) {
            return R2L.converters.numeration(input) || 1;
        }

        // can handle subpart suffixes like '23 bis', '23a', '23.a', '23b' (REFTOLINK-1115)
        if (/^\d+$/.test(input)) {
            return parseInt(input, 10);
        }

        // we clear out suffixes like 'nd', 'rd', 'st', 'er': 
        if (/^\d+(st|nd|rd|er)$/i.test(input)) {
            let parsedInput = input.replace(/(st|nd|rd|er)$/i, '');
            return parseInt(parsedInput, 10);
        }

        let cleanedInput = input.replace(/[аα]/gi, 'a');
        // we accept all other letters as a suffix and we keep it
        if (/^(\d+)[a-z][a-z]?$/i.test(String(cleanedInput))) {
            return cleanedInput;
        }

        if (!R2L.settings.constants.R2L_DEFAULT_LANG_ISO3 || R2L.settings.constants.R2L_DEFAULT_LANG_ISO3 === 'POR') {

            // handling of PT style suffixes (using a dot): artigo 12.o-F do Regulamento de Execução (UE) n.o 725/2011 
            if (/^(\d+)(\.[o°])?-[a-z][a-z]?$/i.test(String(cleanedInput))) {
                let parts = cleanedInput.split("-");
                let digits = parts[0].split(".");
                return digits[0] + String(parts[1]).toLowerCase();
            }

            // handling of PT style suffixes (using a dot): artigo 12.o
            if (/^(\d+)(\.[o°])$/i.test(String(cleanedInput))) {
                let parts = cleanedInput.split(".");
                return parts[0];
            }
        }

        // handling of LV style suffixes (using a dot): Komisijas Īstenošanas regulas (ES) Nr. 725/2011 12.t pantam
        if (/^(\d+)\.[a-z][a-z]?$/i.test(String(cleanedInput))) {
            let parts = cleanedInput.split(".");
            return parts[0] + String(parts[1]).toLowerCase();
        }

        // every other suffix will be turned into an "a"
        return String(input).replace(/^(\d+).+/i, "\$1a");
    },
    // Parse a roman number into arabic. {{ 'IV'|number }} === '4'
    number: function (input) {
        var romans = {
            ι: 1,
            i: 1,
            v: 5,
            χ: 10,
            x: 10,
            l: 50,
            c: 100,
            d: 500,
            m: 1000
        }, pos = 0, char, nextchar, thisSum, result = 0;

        input = (input || '').toLowerCase();
        if (/^\d+$/.test(input)) {
            return parseInt(input, 10);
        }
        while (pos < input.length) {
            char = input[pos];
            // are we NOT at the end?
            if (pos != input.length) {
                // check next character - if bigger, replace with a sub
                nextchar = input[pos + 1];
                if (romans[char] < romans[nextchar]) {
                    thisSum = romans[nextchar] - romans[char];
                    result += thisSum;
                    pos += 2;
                } else {
                    result += romans[char];
                    pos++;
                }
            } else {
                result += romans[char];
                pos++;
            }
        }

        return result ? result : '';
    },
    asciiRoman: function (input) {
        if (!input) {
            return input;
        }

        input = input.replace(/ι/gi, 'I');
        input = input.replace(/χ/gi, 'X');
        input = input.replace(/Ι/gi, 'I');

        return input.toUpperCase();
    },

    castToNumber(num) {
        return Number(num);
    },

    toRoman(num) {
        if (!num || !/^\d+$/.test(String(num)) || Number(num) === 0) {
            return num;
        }

        num = Number(num);

        let roman = {
            M: 1000,
            CM: 900,
            D: 500,
            CD: 400,
            C: 100,
            XC: 90,
            L: 50,
            XL: 40,
            X: 10,
            IX: 9,
            V: 5,
            IV: 4,
            I: 1
        };
        let str = '';

        for (var i of Object.keys(roman)) {
            var q = Math.floor(num / roman[i]);
            num -= q * roman[i];
            str += i.repeat(q);
        }

        return str;
    },

    roman: function (input) {
        var romans = {
            ι: 1,
            i: 1,
            v: 5,
            χ: 10,
            x: 10,
            l: 50,
            c: 100,
            d: 500,
            m: 1000
        }, pos = 0, char, nextchar, thisSum, result = 0;

        // Can be used as connector words (and, or)
        if (input === 'i' || input === 'v') {
            return '';
        }

        input = (input || '').toLowerCase();
        if (/^\d+$/.test(input)) {
            return parseInt(input, 10);
        }
        while (pos < input.length) {
            char = input[pos];
            // are we NOT at the end?
            if (pos != input.length) {
                // check next character - if bigger, replace with a sub
                nextchar = input[pos + 1];
                if (romans[char] < romans[nextchar]) {
                    thisSum = romans[nextchar] - romans[char];
                    result += thisSum;
                    pos += 2;
                } else {
                    result += romans[char];
                    pos++;
                }
            } else {
                result += romans[char];
                pos++;
            }
        }
        return result ? result : '';
    },
    // Turns cyrilic/greek letters into latin equivalents. Example: 
    // {{ 'в'|letterToLatin }} === 'b'
    letterToLatin: function (characters) {
        let letters = R2L.letters;
        let ReCyrillic = new RegExp("[" + letters.cyrillic + "]");
        let ReGreek = new RegExp("[" + letters.greek + "]");
        let latinCodes = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"];
        let latinTranslation = "";
        characters = characters.toLowerCase();
        if (ReCyrillic.test(characters)) {
            let cyrilicCodes = ["а", "б", "в", "г", "д", "е", "ж", "з", "и", "й", "к", "л", "м", "н", "о", "п", "р", "с", "т", "у", "ф", "х", "ц", "ч", "ш", "щ"];
            let i = characters.length;
            let index = 0;
            while (i--) {
                index = cyrilicCodes.indexOf(characters.charAt(i));
                latinTranslation = latinCodes[index] + latinTranslation;
            }
            return latinTranslation;
        }
        else if (ReGreek.test(characters)) {
            let greekSingleCodes = ["α", "β", "γ", "δ", "ε", "στ", "ζ", "η", "θ"];
            let greekTensCodes = ["", "ι", "κ", "λ", "μ"];
            let i = characters.length;
            let index = 0;

            while (i--) {
                let letter = characters.charAt(i);
                if (characters.charAt(i) == "τ") {
                    i--;
                    letter = characters.charAt(i) + letter;
                };
                if (greekSingleCodes.indexOf(letter) > 0) {
                    index = index + greekSingleCodes.indexOf(letter);
                };
                if (greekTensCodes.indexOf(letter) >= 0) {
                    index = index + (greekTensCodes.indexOf(letter) * (greekSingleCodes.length + 1));
                };
            }

            let firstLetter = parseInt(index / (latinCodes.length)) - 1;
            let secondLetter = (index % (latinCodes.length));
            if (firstLetter >= 0) {
                return latinCodes[firstLetter] + latinCodes[secondLetter];
            } else {
                return latinCodes[secondLetter];
            }
        };
        return characters;
    },
    // Replace string with replacement value if the input passes the regex test. Example:
    // {{ 'er123'|testReplace:'/r\d+/':'444' }} === '444'    # passes the test
    // {{ 'er123'|testReplace:'/x\d+/':'444' }} === 'er123'  # fails the test
    testReplace: function (str, what, replacement) {
        var reg = R2L.delimiter2RegExp(what);
        str = (String(str) || '');
        if (reg.test(str)) {
            return replacement === undefined ? '' : replacement;
        }
        return str;
    },
    // Replace string with replacement value if the input does NOT the regex test. Example:
    // {{ 'er123'|testNotReplace:'/r\d+/':'444' }} === 'er123'    # passes the test
    // {{ 'er123'|testNotReplace:'/x\d+/':'444' }} === '444'      # fails the test
    testNotReplace: function (str, what, replacement) {
        var reg = R2L.delimiter2RegExp(what);
        str = (String(str) || '');
        if (!reg.test(str)) {
            return replacement === undefined ? '' : replacement;
        }
        return str;
    },

    replaceIf: function (str, what, replacement) {
        str = (String(str) || '');
        if (what) {
            return replacement;
        }
        return str;
    },

    // Decrement number by 1;
    dec: function (n) {
        if (!isNaN(n)) {
            return --n;
        }

        return NaN;
    },
    // Uppercase string
    upper: function (t) {
        return (t || '').toUpperCase();
    },
    // Lowercase string
    lower: function (t) {
        return (t || '').toLowerCase();
    },
    // Slice string. Usage: {{ 'mike'|slice:1:3 }} === 'ik'
    slice: function (t, start, end) {
        return t.slice(start, end);
    },
    // URL encode string
    urlencode: function (url) {
        return encodeURIComponent(url || '');
    },
    // Uppercase first letter only
    ucfirst: function (str) {
        return ((str || '')[0] || '').toUpperCase() + ((str || '').substring(1) || '');
    },
    // Checks if string is part of a comma-separated list;
    is: function (str, list) {
        return list.split(',').indexOf(str) >= 0;
    },
    // Checks if a string matches a regex; returns a boolean. 
    // Example: {{ '123a|match:'/[a-h]$/i' }} === true
    match: function (str, expr) {
        var e = R2L.delimiter2RegExp(expr);
        if (e) {
            return e.test(str);
        }
    },
    // Check if string is valid year: Works between 1958 - 2057
    isYear: function (str) {
        var no = R2L.converters.number(str),
            year = (new Date()).getFullYear()
            ;
        if (
            ('' + no).length === 2
            || (('' + no).length === 1 && '0' + no === str)
        ) {
            return no >= 58 || (no >= 0 && no <= (year % 2000));
        }
        if (('' + no).length === 4) {
            return no >= 1958 && no <= year;
        }

        return false;
    },
    // Negate 
    not: function (bool) {
        return !bool;
    },
    // Remap function; takes an Array of regexes and an Array of output strings as params. 
    // Example: {{ $1|remap:['/M/','/SA/']:['_M','_SA'] }}}}
    remap: function (val, map, dest) {
        if (!Array.isArray(map)) {
            map = [map];
        }
        if (!Array.isArray(dest)) {
            dest = [dest];
        }
        if (map.length !== dest.length) {
            throw '"remap" map.length !== dest.length';
        }

        for (var i = 0; i < map.length; i++) {
            var e = R2L.delimiter2RegExp(map[i]);
            if (e && e.test(val)) {
                return dest[i];
            }
        }

        return val;
    },
    // Compare 2 values. Returns true if they are equal;
    equals: function (strFirst, strSecond) {
        return strFirst === strSecond;
    },
    // Compare 2 values; Returns false if they are equal;
    nequals: function (strFirst, strSecond) {
        return strFirst !== strSecond;
    },
    // Encode string as base64
    base64: function (str) {
        return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
                return String.fromCharCode('0x' + p1);
            }).replace('%20', ' ')
        );
    },
    // Concatenate 2 strings. Example: {{ $1|concat:($2) }} === $1 + $2
    concat: function (strFirst, strSecond) {
        strFirst = strFirst || '';
        strSecond = strSecond || '';
        return strFirst.concat(strSecond);
    },
    debug: function (val) {
        debugger;
        return val;
    },
    // Sums 2 numbers;
    sum: function (intFirst, intSecond) {
        let result = Number(intFirst) + Number(intSecond);
        return isNaN(result) ? 0 : result;
    },
    // Returns true if a string is a numeric value
    isNumeric: function (n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    },
    /**
     * 5th EP
     * 20 July 1999 – 5 May 2004
     * 
     * 6th EP
     * 20 July 2004 – 7 May 2009
     * 
     * 7th EP
     * 14 July 2009 – 17 April 2014
     * 
     * 8th EP
     * 1 July 2014 – 18 April 2019
     * 
     * 9th EP
     * 2 July 2019 – 15 July 2024
     * 
     * 10th EP
     * 16 July 2024 – TBD
     * 
     * @param {String} str 
     * @param {String} year 
     * @param {String} month 
     * @param {String} day 
     */
    parliamentTerm: function (str, year, month, day) {
        let ymd = R2L.converters.year(year) + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');

        let intervals = [
            ['1999-07-20', '2004-05-05'],  // 5th term
            ['2004-07-20', '2009-05-07'],
            ['2009-07-14', '2014-04-17'],
            ['2014-07-01', '2019-04-18'],
            ['2019-07-02', '2024-07-15'],
            ['2024-07-16', '2029-06-01'],
        ];

        for (let i = 0; i < intervals.length; i++) {
            let interval = intervals[i];
            if (ymd < interval[0]) {
                return i + 4;
            }
            else if (ymd < interval[1]) {
                return i + 5;
            }
        }

        // current term if none matches
        return 10;
    }
};

export {
    converters
};
