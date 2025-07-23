const ANY_CHAR = "[a-zа-яα-ωÄäÅåáàâĂăĄąĀāĊċĆćČčçĎďĐđĘęĖėëéèêĒēĚěĢģĠġĦħïÎîÌìÍíĪīĮΊίįĶķŁłĹĺĽľĻļŃńŇňÑñŅņöÔôÓóŐőÒòÕõØøŔŕŘřŚśŠšȘșẞßȚțŤťüŮůùÚúŰűûŪūŲųŸÿŻżŹźŽžŒœÆæΐ]";

/**
 * We should NOT indicate the jurisdiction when querying titles in Cellar. We apply a regex to remove it in all languages.
 * 
 * Cellar: Judgment of the Court (Fifth Chamber) of 14 December 2000. # Italian Republic v Commission of the European
 * Correct format: Judgment of 14 December 2000. # Italian Republic v Commission of the European
 * 
 * @param {String} title
 * @param {String} langISO2
 * 
 * @return {String} title 
 */
export function fixCaseLawCitation(title, langISO2) {
    title = String(title);
    langISO2 = langISO2 || 'EN';

    let regex;
    // EN
    switch (langISO2) {
        case 'EN':
            regex = new RegExp("^(?:Judgment)\\s(?:of)(.*?)\\s\\d{1,2}\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            // Judgment of the General Court (Fourth Chamber), 11 December 2013
            break;
        case 'FR':
            regex = new RegExp("^(?:Arrêt)(.*?)\\s(?:du)\\s\\d{1,2}\\s" + ANY_CHAR + "+\\s\\d{4}", 'gi');
            // Arrêt du Tribunal (quatrième chambre) du 11 décembre 2013
            break;
        case 'DE':
            // Urteil des Gerichts (Vierte Kammer) vom 11. Dezember 2013
            regex = new RegExp("^(?:Urteil)(.*?)\\s(?:vom)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'ES':
            // Sentencia del Tribunal General (Sala Cuarta) de 11 de diciembre de 2013.
            regex = new RegExp("^(?:Sentencia)(.*?)\\s(?:de)\\s\\d{1,2}\\s(?:de)\\s" + ANY_CHAR + "+\\s(?:de)\\s\\d{4}", "gi");
            break;
        case 'PT':
            // Acórdão do Tribunal de Justiça (Primeira Secção) de 29 de outubro de 2015
            regex = new RegExp("^(?:Acórdão)(.*?)\\s(?:de)\\s\\d{1,2}\\s(?:de)\\s" + ANY_CHAR + "+\\s(?:de)\\s\\d{4}", "gi");
            break;
        case 'NL':
            // Arrest van het Gerecht (Vierde kamer) van 11 december 2013  
            regex = new RegExp("^(?:Arrest)(.*?)\\s(?:van)\\s\\d{1,2}\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'IT':
            // Sentenza del Tribunale (Quarta Sezione) dell’11 dicembre 2013. (del 14 dicembre)
            regex = new RegExp("^(?:Sentenza)(.*?)\\s(?:del(?:l’|\\s))\\d{1,2}\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'DA':
            // Domstolens dom (Første Afdeling) af 29. oktober 2015. => Dom af 29. oktober 2015.
            regex = new RegExp("^(.*?)\\s(?:dom(?=\\s))(.*?)\\s(?:af)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'CS':
            // Rozsudek Soudního dvora (prvního senátu) ze dne 29. října 2015.
            regex = new RegExp("^(?:Rozsudek)(.*?)\\s(?:ze\\sdne)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'HR':
            // Presuda Suda (prvo vijeće) od 29. listopada 2015.
            regex = new RegExp("^(?:Presuda)(.*?)\\s(?:od)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'SL':
            // Sodba Sodišča (prvi senat) z dne 29. oktobra 2015.
            regex = new RegExp("^(?:Sodba)(.*?)\\s(?:z\\sdne)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'SK':
            // Rozsudok Súdneho dvora (prvá komora) z 29. októbra 2015
            regex = new RegExp("^(?:Rozsudok)(.*?)\\s(?:zo?)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'ET':
            // Kohtuotsus, Euroopa Kohus, 12. juuli 2005... => Kohtuotsus 12. juuli 2005...
            // Euroopa Kohtu otsus (esimene koda), 29.10.2015... => Otsus, 29.10.2015.
            regex = new RegExp("^(?:(.*?)\\s)?(?:(?:Kohtu)?otsus)(.*?),\\s\\d{1,2}\\.(?:\\d{1,2}\\.|\\s" + ANY_CHAR + "+\\s)\\d{4}", "gi");
            break;
        case 'FI':
            // Unionin tuomioistuimen tuomio (ensimmäinen jaosto) 29.10.2015. => Tuomio 29.10.2015.
            regex = new RegExp("^(.*?)(?:tuomio)(.*?)\\s\\d{1,2}(?:\\.\\d{1,2}\\.|\\s(?:päivänä)\\s" + ANY_CHAR + "+\\s)\\d{4}", "gi");
            break;
        case 'SV':
            // Domstolens dom (första avdelningen) av den 29 oktober 2015. => Dom av den 29 oktober 2015.
            // Personaldomstolens dom av den 30 januari 2013, Wahlström/Frontex => Dom av den 30 januari 2013, Wahlström/Frontex
            regex = new RegExp("^(.*?)\\s(?:dom(?=\\s))(.*?)\\s(?:(?:av\\s)?den)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'LV':
            // Tiesas spriedums (pirmā palāta) 2015. gada 29. oktobrī. => Spriedums 2015. gada 29. oktobrī.
            // Vispārējās tiesas 2013. gada 15. janvāra spriedums Spānija/Komisija T-54/11, ECLI:EU:T:2013:10, 29. punkts. => 2013. gada 15. janvāra spriedums Spānija/Komisija T-54/11, ECLI:EU:T:2013:10, 29. punkts.
            regex = new RegExp("^(.*?)(?:(?:(?:spriedums)(.*?)\\s\\d{4}\\.\\s(?:gada)\\s\\d{1,2}\\.\\s?" + ANY_CHAR + "+\\.)|(?:\\d{4}\\.\\s(?:gada)\\s\\d{1,2}\\.\\s?" + ANY_CHAR + "+\\.?\\s(?:spriedums)))", "gi");
            break;
        case 'LT':
            // 2015 m. spalio 29 d. Teisingumo Teismo (pirmoji kolegija) sprendimas.
            regex = new RegExp("^\\d{4}\\sm\\.\\s" + ANY_CHAR + "+\\s(?:\\d{1,2})\\s(?:d\\.)(.*?)\\s(?:sprendimas)", "gi");
            break;
        case 'MT':
            // Sentenza tal-Qorti tal-Ġustizzja (L-Ewwel Awla) tad-29 ta’ Ottubru 2015.
            regex = new RegExp("^(?:Sentenza)(.*?)\\s(?:ta[dlst]-)\\d{1,2}\\s(?:ta[’'])\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'PL':
            // Wyrok Trybunału (pierwsza izba) z dnia 29 października 2015 
            regex = new RegExp("^(?:Wyrok)(.*?)\\s(?:z\\sdnia)\\s\\d{1,2}\\.?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'RO':
            // Hotărârea Tribunalului (Camera a patra) din 11 decembrie 2013
            regex = new RegExp("^(?:Hotărârea)(.*?)\\s(?:din(?:\\sdata\\sde)?)\\s\\d{1,2}\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'BG':
            // Решение на Съда (първи състав) от 29 октомври 2015 г
            regex = new RegExp("^(?:Решение)(.*?)\\s(?:от)\\s\\d{1,2}\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'EL':
            // Απόφαση του Δικαστηρίου (τμήμα μείζονος συνθέσεως) της 19ης Ιανουαρίου 2010.
            regex = new RegExp("^(?:Απόφαση)(.*?)\\s(?:της)\\s\\d{1,2}(?:" + ANY_CHAR + "{1,7})?\\s" + ANY_CHAR + "+\\s\\d{4}", "gi");
            break;
        case 'HU':
            // A Törvényszék 2013. január 15-i ítélete, Spanyolország kontra Bizottság, => 2013. január 15-i ítélete, Spanyolország kontra Bizottság, .
            regex = new RegExp("^(.*?)(?:(?:\\d{4}\\.\\s" + ANY_CHAR + "+\\s\\d{1,2}-i\\s(?:ítélete?)))", "gi");

            // custom treatment for HU: #REFTOLINK-2132
            let regexCustom1 = /(A\s(?:Bíróság|Törvényszék)\s(.+?\s\d+)\.-i\sítélete?:\s(\d{4})\.?)/gi;
            let parts1 = regexCustom1.exec(title);
            if (parts1) {
                title = title.replace(parts1[1], parts1[3] + '. ' + parts1[2] + '-i ítélet');
            }

            let regexCustom2 = /(A\s(?:Bíróság|Törvényszék)\sítélete?,?\s(?:\(.+?\),\s)?(\d{4}\.?\s.+?\s\d+\.?))/gi;
            let parts2 = regexCustom2.exec(title);
            if (parts2) {
                title = title.replace(parts2[1], parts2[2] + '-i ítélet');
            }

            // no ending 'e'
            title = title.replace(/\sítélete,/gi, ' ítélet,');
            break;
        default:
            return title;
    }

    let parts = regex.exec(title);
    if (parts) {
        if (parts[1]) {
            title = title.replace(parts[1], "");
        }
        if (parts[2]) {
            title = title.replace(parts[2], "");
        }
    }

    title = title.trim();
    return title.charAt(0).toUpperCase() + title.slice(1);
}

// Remove unwanted text: (recast | text with EEA relevance)
export const FOOTNOTE_BLACKLIST = [
    { match: /(?:\(преработен текст\)|\(?Текст от значение за ЕИП\.?\s?\)?)/g, replace: '', applyForAll: false }, // BG
    { match: /(?:\(versión refundida\)|\(?Texto pertinente a efectos del EEE\.?\s?\)?)/g, replace: '', applyForAll: false }, // ES
    { match: /(?:\(přepracované znění\)|\(?Text s významem pro EHP\.?\s?\)?)/g, replace: '', applyForAll: false }, // CS
    { match: /(?:\(omarbejdning\)|\(?EØS-relevant tekst\.?\s?\)?)/g, replace: '', applyForAll: false }, // DA
    { match: /(?:\(Neufassung\)|\(?Text von Bedeutung für den EWR\.?\s?\)?)/g, replace: '', applyForAll: false }, // DE
    { match: /(?:\(uuesti sõnastatud\)|\(?EMPs kohaldatav tekst\.?\s?\)?)/g, replace: '', applyForAll: false }, // ET
    { match: /(?:\(αναδιατύπωση\)|\(?Κείμενο που παρουσιάζει ενδιαφέρον για τον ΕΟΧ\.?\s?\)?)/g, replace: '', applyForAll: false }, // EL
    { match: /(?:\(recast\)|\(?Text with EEA relevance\.?\s?\)?)/g, replace: '', applyForAll: false }, // EN
    { match: /(?:\(refonte\)|\(?Texte présentant de l'intérêt pour l'EEE\.?\s?\)?)/g, replace: '', applyForAll: false }, // FR
    { match: /(?:\(preinaka\)|\(?Tekst značajan za EGP\.?\s?\)?)/g, replace: '', applyForAll: false }, // HR
    { match: /(?:\(rifusione\)|\(?Testo rilevante ai fini del SEE\.?\s?\)?)/g, replace: '', applyForAll: false }, // IT
    { match: /(?:\(pārstrādāta redakcija\)|\(?Dokuments attiecas uz EEZ\.?\s?\)?)/g, replace: '', applyForAll: false }, // LV
    { match: /(?:\(nauja redakcija\)|\(?Tekstas svarbus EEE\.?\s?\)?)/g, replace: '', applyForAll: false }, // LT
    { match: /(?:\(átdolgozás\)|\(?EGT-vonatkozású szöveg\.?\s?\)?)/g, replace: '', applyForAll: false }, // HU
    { match: /(?:\(riformulazzjoni\)|\(?Test b'rilevanza għaż-ŻEE\.?\s?\)?)/g, replace: '', applyForAll: false }, // MT
    { match: /(?:\(herschikking\)|\(?Voor de EER relevante tekst\.?\s?\)?)/g, replace: '', applyForAll: false }, // NL
    { match: /(?:\(przekształcenie\)|\(?Tekst mający znaczenie dla EOG\.?\s?\)?)/g, replace: '', applyForAll: false }, // PL
    { match: /(?:\(reformulação\)|\(?Texto relevante para efeitos do EEE\.?\s?\)?)/g, replace: '', applyForAll: false }, // PT
    { match: /(?:\(reformare\)|\(?Text cu relevanță pentru SEE\.?\s?\)?)/g, replace: '', applyForAll: false }, // RO
    { match: /(?:\(prepracované znenie\)|\(?Text s významom pre EHP\.?\s?\)?)/g, replace: '', applyForAll: false }, // SK
    { match: /(?:\(prenovitev\)|\(?Besedilo velja za EGP\.?\s?\)?)/g, replace: '', applyForAll: false }, // SL
    { match: /(?:\(uudelleenlaadittu\)|\(?ETA:n kannalta merkityksellinen teksti\.?\s?\)?)/g, replace: '', applyForAll: false }, // FI
    { match: /(?:\(omarbetning\)|\(?Text av betydelse för EES\.?\)?)/g, replace: '', applyForAll: false }, // SV
    { match: '<i></i>,', replace: ',', applyForAll: true },
    { match: '. )', replace: ')', applyForAll: true },
    { match: '.).', replace: ')', applyForAll: true },
    { match: ', ,', replace: ',', applyForAll: true },
    { match: '  .', replace: '.', applyForAll: true },
    { match: ' .', replace: '.', applyForAll: true },
    { match: ' , ', replace: ', ', applyForAll: true },
    { match: '. (', replace: ' (', applyForAll: true },
    { match: '( ', replace: '(', applyForAll: true },
    { match: ' )', replace: ')', applyForAll: true },
    { match: / n\. o /g, replace: ' n.º ', applyForAll: true },
    { match: /[\u00a0\u202F ][\u00a0\u202F ]+/g, replace: ' ', applyForAll: true } // multiple spaces
];

export function cleanFootnote(footnote, onlyApplyForAll) {
    for (let i = 0; i < FOOTNOTE_BLACKLIST.length; i++) {
        if (onlyApplyForAll) {
            if (FOOTNOTE_BLACKLIST[i].applyForAll) {
                footnote = footnote.replace(FOOTNOTE_BLACKLIST[i].match, FOOTNOTE_BLACKLIST[i].replace);
            }
        }
        else {
            footnote = footnote.replace(FOOTNOTE_BLACKLIST[i].match, FOOTNOTE_BLACKLIST[i].replace);
        }
    }
    return footnote;
}

export function getJoinedCasesTranslation(caseLabels, langISO2) {
    let andOperator = ', ';
    switch (langISO2.toUpperCase()) {
        case 'BG':
            andOperator = ' и ';
            break;
        case 'CS':
            andOperator = ' a ';
            break;
        case 'DA':
            andOperator = ' og ';
            break;
        case 'EL':
            andOperator = ' και ';
            break;
        case 'EN':
            andOperator = ' and ';
            break;
        case 'ES':
            andOperator = ' y ';
            break;
        case 'DE':
            andOperator = ' und ';
            break;
        case 'ET':
            andOperator = ' ja ';
            break;
        case 'FR':
            andOperator = ' et ';
            break;
        case 'GA':
            andOperator = ' agus ';
            break;
        case 'HR':
            andOperator = ' i ';
            break;
        case 'HU':
            andOperator = ' és ';
            break;
        case 'IT':
            andOperator = ' e ';
            break;
        case 'MT':
            andOperator = ' u ';
            break;
        case 'NL':
            andOperator = ' en ';
            break;
        case 'PL':
            andOperator = ' i ';
            break;
        case 'PT':
            andOperator = ' e ';
            break;
        case 'RO':
            andOperator = ' și ';
            break;
        case 'SK':
            andOperator = ' a ';
            break;
        case 'SL':
            andOperator = ' in ';
            break;
        case 'FI':
            andOperator = ' ja ';
            break;
        case 'SV':
            andOperator = ' och ';
            break;
    }

    let str = '';
    caseLabels.forEach((label, index) => {
        if (index < caseLabels.length - 2) {
            str += (label + ', ');
        }
        else if (index < caseLabels.length - 1) {
            str += (label + andOperator);
        }
        else {
            str += label;
        }
    });

    return str;
}