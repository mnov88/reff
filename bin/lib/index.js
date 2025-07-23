
import fs from 'fs';
import path from "path";
import R2L_EULANG from '../../config/languages.js';
import { fileURLToPath } from 'url'
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const setArgs = function (argv, R2L) {
    //language filters
    if (argv.langsource && R2L_EULANG.get(argv.langsource)) {
        console.debug("Setting source lang", argv.langsource);
        let item = R2L_EULANG.get(argv.langsource);
        let data = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../data/${item.rules}`), 'utf8'));
        R2L.importRules(data);
    }

    if (argv.langtarget && R2L_EULANG.get(argv.langtarget)) {
        // ISO2 code, we need to get the ISO3
        console.debug("Setting target lang", R2L_EULANG.get(argv.langtarget).iso3);
        R2L.setLanguage(R2L_EULANG.get(argv.langtarget).iso3);
    }

    if (argv.environment) {
        let environments = String(argv.environment).split(",").filter(arg => !!arg);
        R2L.setFilter("environments", environments);
    }

    if (argv.ruletype) {
        let types = String(argv.ruletype).split(",").filter(arg => !!arg);
        R2L.setFilter("types", types);
    }

    if (argv.target) {
        let targets = String(argv.target).split(",").filter(arg => !!arg);
        R2L.setFilter("targets", targets);
    }

    if (argv.excludetarget) {
        let excludeTargets = String(argv.excludetarget).split(",").filter(arg => !!arg);
        R2L.setFilter("excludetargets", excludeTargets);
    }

    if (argv.htmlmode && argv.htmlmode !== "false" && argv.htmlmode !== "0") {
        let htmlMode = (argv.htmlmode === true || argv.htmlmode === 1 || argv.htmlmode === "1" || argv.htmlmode === "true") ? true : false;
        R2L.settings.htmlMode = htmlMode;
    }
    else {
        R2L.settings.htmlMode = false;
    }

    if (argv.linkeddata && argv.linkeddata !== "false" && argv.linkeddata !== "0") {
        R2L.setOptions({ metadata: true });
    }

    if (argv.pointintime) {
        R2L.setOptions({ pointInTime: String(argv.pointintime) });
    }
    else {
        R2L.setOptions({ pointInTime: null });
    }

    // linkeddatamode - Example: check-exist,seq-number,metadata,all 
    // Default: all 
    if (argv.linkeddatamode) {
        R2L.setOptions({ linkedDataMode: String(argv.linkeddatamode).split(",").filter(l => !!l) });
    }
    else {
        R2L.setOptions({ linkedDataMode: ["all"] });
    }

    // strictrules - comma separated rules for which to use strict mode - Example: eurlex.act,eurlex.treaty
    if (argv.strictrules) {
        R2L.setOptions({
            strictRules: String(argv.strictrules).split(",").filter(l => !!l).reduce(function (acc, cur, i) {
                acc[cur] = true;
                return acc;
            }, {})
        });
    }
    else {
        R2L.setOptions({ strictRules: {} });
    }
};