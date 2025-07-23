import { R2L } from './lib/index.js';
import { converters } from './lib/utils/converters.js';
import { letters } from './lib/utils/letters.js';
import { bindRules } from './lib/rules/index.js';
import { bindJquery } from './lib/jquery/index.js';
import { bindFormatters } from './lib/formatters/index.js';
import { bindFilters } from './lib/filters/index.js';
import { delimiter2RegExp, getNonCapturingPattern, simpleParse } from './lib/utils/functions.js';
import { bindTooltips, getTriggers } from './lib/ux/index.js';
import { settings, viewOptions, LD_MODE_ALL } from './lib/settings/index.js';
import { LinkedDataManager } from './lib/manager/index.js';
import { AliasManager } from './lib/alias/index.js';

/**
 * Will bootstrap the Ref2Link library in the environment it's been loaded (server-side or client-side).
 */
let isBrowser = new Function("try { return this === window; } catch(e){ return false; }").call();

/**
 * Prevent double inclusion - CONFLUENCE
 */
if (isBrowser) {
    let isAlreadyIncluded = false;
    try {
        isAlreadyIncluded = window.R2L && window.R2L.version === R2L.getConstant("R2L_VERSION");
    }
    catch (e) { }
    if (isAlreadyIncluded) {
        throw new Error("Already included R2L library");
    }
}

console.debug("Initializing R2L");

R2L.$el = null;
R2L.version = R2L.getConstant("R2L_VERSION");
R2L.build = R2L.getConstant("R2L_BUILD_INFO");
R2L.info = `<p>Ref2link version: ${R2L.version}</p>`;

R2L.errors = [];
R2L.delimiter2RegExp = delimiter2RegExp;
R2L.getNonCapturingPattern = getNonCapturingPattern;
R2L.letters = letters;
R2L.filters = R2L.defaultFilters = { environments: ['*'] };

R2L.settings = settings;

R2L.dataRef2linkInitialAttribute = settings.dataInitialAttribute;
R2L.dataRef2linkContextAttribute = settings.dataContextAttribute;
R2L.ref2linkDataAttribute = settings.dataAttribute;
R2L.maxReferenceLength = settings.maxReferenceLength;
R2L.maxTitleLength = settings.maxTitleLength;

R2L.editOptions = viewOptions; //DEPRECATED
R2L.viewOptions = viewOptions;
R2L.converters = converters;

R2L.notooltipOptions = { tooltipTrigger: 'notooltip' };

R2L.options = {  //defaults
    worker: false,  // use the WebWorker when supported in the Browser
    aliases: false, // Boolean to turn the aliases on/off
    ai: false, // Boolean to enable AI feature and detect orphan subdivisions
    metadata: false, // equivalent with `linkeddata`
    /**
     * Possible values: [ 
     *     LD_MODE_ALL,             # Enables LD_MODE_* options below
     *     LD_MODE_METADATA,        # Load metadata (titles, OJ, dates) from Cellar
     *     LD_MODE_SEQ_NUMBER,      # Resolve ambiguos references
     *     LD_MODE_CHECK_EXISTS,    # Check existing CELEX ids and remove non-existent ones
     *     LD_ADVANCED_MODE_SHORT_TITLES,  # Advanced mode, needs to be explicitly enabled. Will parse the long titles extracted from Cellar to generate shorter references. 
     *     LD_ADVANCED_MODE_CORRECTIONS,   # Will query each act's corrections
     *     LD_ADVANCED_MODE_KM_HANDOC # Will query ULM's API for ARES data; Requires a valid ECAS ticket.
     * ]
     */
    linkedDataMode: [LD_MODE_ALL],  // does not include the LD_ADVANCED_MODE_* features
    enableSpecialRules: true,
    language: false,   // TARGET language iso3; 
    multiLanguage: false, // iso3 language list (separated by dash) for the EUR-Lex side-by-side. Example: 'ENG-FRA-SPA'
    pointInTime: null, // an optional YYYY-MM-DD date to append to ELI urls (instead of the default `/oj`)
    strictRules: {} // a map with rule types as keys which applies the `strict-pattern`. Example value: `{ "eurlex.act": true }`
};

R2L.alias = new AliasManager();
R2L.ldm = new LinkedDataManager();
R2L.hooks = {};

R2L.globalMatches = R2L.globalViews = {};

bindFilters(R2L);
bindFormatters(R2L);
bindRules(R2L);
bindJquery(R2L);

R2L.triggers = getTriggers(R2L);

/** expose linked data methods on top level API */
R2L.getCelexData = R2L.ldm.getCelexData.bind(R2L.ldm);
R2L.getEliData = R2L.ldm.getEliData.bind(R2L.ldm);
R2L.getAresData = R2L.ldm.getAresData.bind(R2L.ldm);
R2L.getActsCitedByAct = R2L.ldm.getActsCitedByAct.bind(R2L.ldm);
R2L.getActsCitingAct = R2L.ldm.getActsCitingAct.bind(R2L.ldm);
R2L.getBasisActsByAct = R2L.ldm.getBasisActsByAct.bind(R2L.ldm);
R2L.getActsByBasisAct = R2L.ldm.getActsByBasisAct.bind(R2L.ldm);

R2L.getClassifications = R2L.ldm.getClassifications.bind(R2L.ldm);
R2L.getEurlexContent = R2L.ldm.getEurlexContent.bind(R2L.ldm);

if (isBrowser) {
    /** For client env only */
    window.R2L = R2L;

    if (window.$ && window.$.fn) {
        window.$.fn.ref2link = R2L;
    }

    if (R2L.options.worker && window.Worker) {
        R2L.registerWorker();
    }

    // only bind tooltips when the library is integrated in a Browser. Server-side it does not make any sense, even if we have a virtual DOM set up.
    bindTooltips(R2L);
}
else {
    /** Server-side bindings */
    module.exports = R2L;
    global.btoa = function (str) { return new Buffer(str).toString('base64') };
    global.R2L = R2L;
}
