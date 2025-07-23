/**
 * Pattern optimizers!
 */
const PATTERN_OPTIMIZERS = {
    /** 
     * Checks if other char codes than '32' have been used for space within the text.
     * If not, we can reduce the {{ non_breaking_space }} pattern to just `(?: )`
     * 
     * NOTE: The `searchSubpattern` must match the defined {{ non_breaking_space }} pattern. 
     * 
     * IMPORTANT! Do not modify the {{ non_breaking_space }} pattern definition without modifying the optimizer. If done so the optimizers will never be used. 
     */
    space: [
        {
            guardRegExp: /(?:[\u00a0\u202F]|(?:\x26(?:amp;)?nbsp;))/,
            searchSubpattern: `(?:[\\u00a0\\u202F ]|(?:(?:\\x26(?:amp;)?)nbsp;))`,
            replaceSubpattern: `(?: )`
        },
        {
            guardRegExp: /(?:[\u00a0\u202F]|(?:(?:\x26)amp;nbsp;))/,
            searchSubpattern: `(?:[\\u00a0\\u202F ]|(?:(?:\\x26(?:amp;)?)nbsp;))`,
            replaceSubpattern: `(?: |(?:\\x26nbsp;))`
        }
    ],
    quote: [
        {
            guardRegExp: /[\u02b9\u02bb\u02bf\u02c8\u02ca\u02cb\u02f4\u0384\u0374\u2018\u2019\u201b\u2032\u2035]/,
            searchSubpattern: `\\u02b9\\u02bb\\u02bf\\u02c8\\u02ca\\u02cb\\u02f4\\u0384\\u0374\\u2018\\u2019\\u201b\\u2032\\u2035`,
            replaceSubpattern: ``
        }
    ]
};

/**
 * Ref2Link settings are stored in this variable, also accessible via the API at `R2L.settings`;
 */
export const settings = {
    /**
     * The constants are parameters loaded from a compiled rules JSON file. They contain the rule patterns, language and view options.
     */
    constants: {
        'R2L_RULE_MAP': '{{R2L_RULE_MAP}}',
        'R2L_VIEW_MAP': '{{R2L_VIEW_MAP}}',
        'R2L_VERSION': '{{R2L_VERSION}}',
        'R2L_BUILD_INFO': '{{R2L_BUILD_INFO}}',
        'R2L_CSS_MAP': '{{R2L_CSS_MAP}}',
        'R2L_VIEW_OPTIONS': '{{R2L_VIEW_OPTIONS}}',
        'R2L_NAMED_PATTERNS': '{{R2L_NAMED_PATTERNS}}',
        'R2L_TYPED_RULES': '{{R2L_TYPED_RULES}}',
        'R2L_DEFAULT_LANG_ISO3': '{{R2L_DEFAULT_LANG_ISO3}}',
        'R2L_AI_ENDPOINT': 'https://webgate.ec.testa.eu/ref2link-api/openai',
        'R2L_FINLEX_ENDPOINT': 'https://webgate.ec.testa.eu/ref2link-api/sparql',//'https://ldf.fi/finlex/sparql',
        'R2L_PUBLICATIONS_ENDPOINT': 'https://webgate.ec.testa.eu/ref2link-api/sparql',//'http://publications.europa.eu/webapi/rdf/sparql',
        'R2L_CONTENT_ENDPOINT': 'https://webgate.ec.testa.eu/ref2link-api/eurlex',
        'R2L_ALIAS_MAP': {},
        'R2L_EULANG': new Map([['GLE', 'GA'], ['HRV', 'HR'], ['HUN', 'HU'], ['ITA', 'IT'], ['LAV', 'LV'], ['LIT', 'LT'], ['CES', 'CS'], ['POL', 'PL'], ['SLK', 'SK'], ['BUL', 'BG'], ['MLT', 'MT'], ['NLD', 'NL'], ['SLV', 'SL'], ['SPA', 'ES'], ['SWE', 'SV'], ['POR', 'PT'], ['RON', 'RO'], ['DAN', 'DA'], ['DEU', 'DE'], ['ELL', 'EL'], ['ENG', 'EN'], ['EST', 'ET'], ['FIN', 'FI'], ['FRA', 'FR']])
    },
    dataInitialAttribute: 'data-ref2link-initial',
    dataContextAttribute: 'data-ref2link-context',
    parsedAttribute: 'ref2link-parsed',
    dataAttribute: 'data-ref2link',
    class: 'a.ref2link-generated, [role-link].ref2link-generated',
    classSimple: 'a, [role-link]',
    generatedClassName: 'ref2link-generated',
    multipleGeneratedClassName: 'ref2link-multiple',
    tooltipContainerSelector: 'body',
    maxReferenceLength: 255,
    maxTitleLength: 255,
    views: true,
    viewAttributes: {},
    sort: "position.asc",
    // by default Ref2Link operates in HTML mode. For raw text mode set the `R2L.settings.htmlMode=false`
    htmlMode: true,
    patternOptimizers: PATTERN_OPTIMIZERS,
    getConstant: function (name) {
        return this.constants[name];
    },

    setConstant: function (name, value) {
        this.constants[name] = value
    }
}

/**
 * Ref2Link tooltip template and configuration. Accessible via the API using `R2L.viewOptions`.
 * 
 * Uses moustache templates for variable injection eg. `{{ $title }}`
 */
export const viewOptions = {
    useTargetGrouping: true,
    tooltipTrigger: 'mouseenter',
    tooltip: `<div role="tooltip" class="ref2link-tooltip" title="">
                <div class="clearfix"><div class="table-responsive"><table class="table table-condensed table-hover"></table></div></div>
            </div>`,
    bottomSpacing: 75,
    enhancedHeading: `<thead class="row table-header hidden-xs">
                        <tr class="big r2l-celex">
                            <td colspan="2">
                                <div class="r2l-title">{{ $title }}</div>
                                <div class="r2l-oj">{{ $oj }}</div>
                                <div class="r2l-force" data-status="{{ $forceStatus }}"><span class="bullet"></span> <span class="label">{{ $forceLabel }}</span></div>
                                <div class="r2l-eli">{{ $eli }}</div>
                            </td>
                        </tr>
                    </thead>`,
    ruleHeading: '',
    groupRule: `<tr class="row active-indicator" style="margin: 5px 0" data-action="toggle">
            <td class="col-xs-2 r2l-toggle-icon-container"></td>
            <td class="col-xs-10">{{ $title }}</td>
        </tr>`,
    rule: `
        <tr class="row active-indicator" style="margin:5px 0" data-group="{{$group}}">
            <td class="col-xs-2"></td>
            <td class="col-xs-10" data-action="preview" title="Open link">
                <a href="{{$href}}">{{$title}}</a>
            </td>
        </tr>`,
    alert: '<div class="alert alert-dismissable alert-{{ $alertType }}" role="role"><button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
        '<span aria-hidden="true">&times;</span>' +
        '</button>' +
        '{{ $msg }}' +
        '</div>',
    mode: 'view'
};

/** DEPRECATED SPARQL query modes */
export const SPARQL_OPTIMAL_MODE = 1;
export const SPARQL_FAST_MODE = 2;
export const SPARQL_SLOW_MODE = 3;
export const SPARQL_EXPERT_MODE = 4;

/**
 * The user can granularly configure the linked-data mode option by combining the below modes:
 *   R2L.setOptions({ linkedDataMode: ['metadata', 'check-exist', 'seq-number']});
 * By default all options are enabled
 *   R2L.setOptions({ linkedDataMode: 'all' });
 */

// only fetch linked data (metadata) information
export const LD_MODE_METADATA = 'metadata';
// filter non-existing targets (CELEX/OJ)
export const LD_MODE_CHECK_EXISTS = 'check-exist';
// fill placeholders for ambiguos references 
export const LD_MODE_SEQ_NUMBER = 'seq-number';
// all of the above
export const LD_MODE_ALL = 'all';

// fetch corrections along metadata (not enabled by default)
export const LD_ADVANCED_MODE_CORRECTIONS = 'corrections';
// Re-parses Cellar titles to extract a shorter form of the legal reference. Example: 
// Title: `Directive 2013/34/EU of the European Parliament and of the Council of 26 June 2013 on the annual financial statements, consolidated financial statements and related reports of certain types of undertakings, amending Directive 2006/43/EC of the European Parliament and of the Council and repealing Council Directives 78/660/EEC and 83/349/EEC`
// Short title: `Directive 2013/34/EU`
export const LD_ADVANCED_MODE_SHORT_TITLES = 'short-titles';

// advanced mode - fetches ECAS protected data from ULM's KM API 
export const LD_ADVANCED_MODE_KM_HANDOC = 'km-handoc';

export const LD_ADVANCED_MODE_KM_CIS = 'km-cis';

// advanced mode - load judgements for joined cases
export const LD_ADVANCED_MODE_EUCASE_JOINED_JUDGEMENT = 'eucase-joined-judgement';