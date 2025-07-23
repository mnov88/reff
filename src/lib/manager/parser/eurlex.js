import { $ } from '../../jquery.js';

const ERROR_PARAGRAPH_NOT_FOUND = 'paragraph.not.found';
const ERROR_ARTICLE_NOT_FOUND = 'article.not.found';
const ERROR_POINT_NOT_FOUND = 'point.not.found';
const ERROR_SUBDIVISION_NOT_FOUND = 'subdivision.not.found';

const ARTICLE_LABEL_REGEX = 'Член|Artículo|Článek|Artikel|Artikel|Artikkel|Άρθρο|Article|Airteagal|Članak|Articolo|pants|straipsnis|cikk|Artikolu|Artykuł|Artigo|Articolul|Článok|Člen|artikla';

const ANNEX_LABEL_REGEX = 'ПРИЛОЖЕНИЕ|ANEXO|PŘÍLOHA|BILAG|ANHANG|LISA|ΠΑΡΑΡΤΗΜΑ|ANNEXE|ANNEX|IARSCRÍBHINN|PRILOG|ALLEGATO|PIELIKUMS|PRIEDAS|MELLÉKLET|ANNESS|BIJLAGE|ZAŁĄCZNIK|ANEXA|PRÍLOHA|PRILOG|LIITE|BILAGA';
const ROMAN_LABEL_REGEX = '(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})(\\.?)';

const ANNEX_NUMBER_REGEX = '(?:(' + ROMAN_LABEL_REGEX + ')|\\d+)';
const UNIQUE_ANNEX_REGEX = new RegExp("^(" + ANNEX_LABEL_REGEX + ")$", "gi");

function isEUTreaty(node) {
    return String(node.data[0].celex).substr(0, 1) === '1';
}

/**
 * Extract Eurlex subdivision up to point level. Only works on the new XHTML generation of acts.
 * @param {String} response 
 * @param {R2LNode} node 
 * 
 * @return String
 */
export function parseEurlexResponse(response, node) {

    let celex = node.data[0]['celex'] || null;
    let sector = celex ? celex.substr(0, 1) : null;

    // annexes, recitals and articles are top-level subdivisions for sectors 1,2,3,4,5
    let annex = node.data[0]['offset-annex'] || null;
    let recital = node.data[0]['offset-rct'] || null;
    let article = node.data[0]['offset-art'] || null;

    // case law (ECLI) has paragraphs as top-level subidvisions
    let paragraph = node.data[0]['offset-p'] || null;
    let point = node.data[0]['offset-pt'] || null;

    response = cleanHtmlContent(response || '');

    if (!article && !annex && !recital) {
        // no top-level subdivision found, can only be and ECLI with paragraphs
        if (node.type === 'ecli') {
            return parseEcliResponse(response, node);
        }
        else {
            return {
                id: null,
                header: null,
                subheader: null,
                content: null,
                subdivisions: [],
                error: ERROR_SUBDIVISION_NOT_FOUND
            }
        }
    }

    if (paragraph) {
        paragraph = String(paragraph).padStart(3, '0');
    }

    if (point) {
        point = point.toLowerCase();
    }

    let doc = document.implementation.createHTMLDocument('virtual');
    let $el = $("<div>" + response + "</div>", doc);

    // ELI urls return the full page
    if ($el.find("#textTabContent").length > 0) {
        $el = $("<div>" + $el.find("#textTabContent").html() + "</div>", doc);
    }

    let resultString;
    let articleResultString;
    let selector;


    let id; // article or annex HTML attribute to extract, will be used as anchor for direct links
    let header; // article title/header
    let subheader; // article subheader

    let isPoint = false;
    let isParagraph = false;
    let error = null;

    let articleIdentifier = getArticleIdentifier($el, article);
    let isNewTemplate = articleIdentifier ? true : false;

    // annex finder
    if (annex) {
        // ELI lookup first
        let annexSelectorEli = "#anx_" + annex;
        let $foundEl = $el.find(annexSelectorEli);
        if ($foundEl.length > 0) {
            resultString = $foundEl[0].innerHTML;
        }
        else {
            // legacy content
            // selector for 'Annex X' titles
            let annexSelector = ".oj-doc-ti, .doc-ti";

            let annexRegex = new RegExp("^(?:((" + ANNEX_LABEL_REGEX + ")\\s" + ANNEX_NUMBER_REGEX + ")|(" + ANNEX_NUMBER_REGEX + "\\s(" + ANNEX_LABEL_REGEX + ")))$", "gi");

            let res = $el.find(annexSelector);
            let castAnnexNumber = R2L.converters.roman(annex);
            res.each((index, elem) => {
                let txt = elem.textContent.trim().replace(/&nbsp;/g, " ");
                if (txt.match(annexRegex)) {
                    // get content
                    let annexRomanNumber = txt.replace(new RegExp("/^" + ANNEX_LABEL_REGEX, "gi"), '').replace('.', '').trim();
                    let annexNumber = R2L.converters.roman(annexRomanNumber);
                    // should work for both roman and arabic numbers
                    if (String(annexNumber) === String(castAnnexNumber)) {
                        id = elem.getAttribute("id");
                        let $parent = $el.find('#' + id).parent();
                        if ($parent.length) {
                            resultString = $parent[0].outerHTML;
                        }
                        // break
                        return false;
                    }
                }

                // could be an unique annex
                if (String(castAnnexNumber) === '1' && txt.match(UNIQUE_ANNEX_REGEX)) {
                    // unique annex will have no number in the table of contents but Ref2Link considers it as Annex 1
                    id = elem.getAttribute("id");
                    let $parent = $el.find('#' + id).parent();
                    if ($parent.length) {
                        resultString = $parent[0].outerHTML;
                    }
                    return false;

                }
            });
        }
    }
    // recital finder
    else if (recital) {
        // ELI lookup first
        let recitalSelectorEli = "#rct_" + recital;
        let $foundEl = $el.find(recitalSelectorEli);
        if ($foundEl.length > 0) {
            resultString = $foundEl[0].innerHTML;
        }
        else {
            // legacy content 
            $el.find("table").each((index, elem) => {
                let $cols = $(elem).find("col[width='4%'], col[width='96%']");
                let $recitalElem = $(elem).find("td:first-child p");
                let recitalNumber = $recitalElem.text().replace('(', '').replace(')', '');
                if ($cols.length === 2 && String(recitalNumber) === String(recital)) {
                    let $recitalVal = $(elem).find("td:last-child p");
                    resultString = '<p>' + $recitalVal.text() + '</p>';
                    // break
                    return false;
                }
            });
        }
    } else if (isNewTemplate) {
        // article finder
        let articleSelector = articleIdentifier ? ("#" + articleIdentifier) : null;

        let artPaddedNo = String(article).padStart(3, '0');

        let fallbackSelector;
        if (article && paragraph && point) {
            selector = "#" + artPaddedNo + "\\." + paragraph + " table";
            fallbackSelector = "#" + artPaddedNo + "\\." + paragraph;
            isParagraph = true;
            isPoint = true;
        }
        else if (article && paragraph) {
            selector = "#" + artPaddedNo + "\\." + paragraph;
            fallbackSelector = "#" + articleIdentifier
            isParagraph = true;
        }
        else if (article && point) {
            selector = "#" + articleIdentifier + " table";
            fallbackSelector = "#" + articleIdentifier;
            isPoint = true;
        }
        else if (article) {
            selector = "#" + articleIdentifier;
        }

        // we need the article selector just to get the title and id for the anchor;
        let res = selector ? $el.find(selector) : null;
        let articleRes = null;

        if (articleSelector) {
            articleRes = $el.find(articleSelector);
        }

        if (res && res.length > 0) {
            // remove header/subheader from content
            resultString = isPoint ? '' : res[0].outerHTML;
            // get the point using the index (each <table> should be a point)
            let pointMap = {};
            if (isPoint) {
                // create a map eg. { 'a': [p0], 'b': [p1, p2], 'c': [p3], ...}
                res.each((index, currentNode) => {
                    let matchPoint = currentNode.textContent.trim().match(/^\(([a-z])+\)/)[1];
                    if (matchPoint) {
                        pointMap[matchPoint] = pointMap[String(matchPoint).toLowerCase()] || [];
                        pointMap[matchPoint].push(currentNode);
                    }
                });

                if (pointMap[point]) {
                    resultString = '';
                    pointMap[point].forEach(node => {
                        resultString += node.outerHTML;
                    })
                }
                else {
                    // fallback to parent
                    resultString = $el.find(fallbackSelector).html();
                    error = ERROR_POINT_NOT_FOUND;
                }
            }
        }
        else {
            resultString = '';
            if (isParagraph) {
                // try to get the paragraph using the legacy method
                let resultParagraphString = extractParagraphString($el.find(fallbackSelector).html(), paragraph);

                if (resultParagraphString) {
                    resultString = resultParagraphString;
                }
                else {
                    error = ERROR_PARAGRAPH_NOT_FOUND;
                }
            }


            if (isPoint) {
                error = ERROR_POINT_NOT_FOUND;
                if (isParagraph) {
                    resultString = $el.find(fallbackSelector).html(); // try to get fallback content
                }
            }
        }

        if (articleRes && articleRes.length > 0) {
            articleResultString = articleRes[0].outerHTML;
        }

        if (articleResultString) {
            // extract header and id
            header = $(articleResultString).find(".oj-ti-art").text().trim();
            if (!header) {
                header = $(articleResultString).find(".ti-art").text().trim();
            }
            if (header) {
                header = String(header).replace(/&nbsp;/g, " ");
            }

            id = $(articleResultString).find(".oj-ti-art").attr("id");
            if (!id) {
                id = $(articleResultString).find(".ti-art").attr("id");
            }

            subheader = $(articleResultString).find(".oj-sti-art").text().trim();
            if (!subheader) {
                subheader = $(articleResultString).find(".sti-art").text().trim();
            }
            if (!subheader) {
                subheader = $(articleResultString).find(".eli-title").text().trim();
            }
        }
        else {
            error = ERROR_ARTICLE_NOT_FOUND;
        }

        if (!resultString && articleResultString) {
            //return article contents instead
            resultString = articleResultString;
        }
    }

    /** old style acts, no indexed ids */
    else {
        let customHeaderSelector = null;
        // Old treaties use this structure: #TexteOnly
        if ($el.find('#TexteOnly').length > 0) {
            if (isEUTreaty(node)) {
                resultString = $el.find('#TexteOnly')[0] ? $el.find('#TexteOnly')[0].innerHTML : '';
            }
            else {
                if (article) {
                    let articleNumber = parseInt(article);
                    let nextArticleNumber = (articleNumber + 1);
                    let articleRegex = new RegExp("^(?:((" + ARTICLE_LABEL_REGEX + ")\\s" + articleNumber + " ?\\.?o?°?)|(" + articleNumber + "\\.?\\s(" + ARTICLE_LABEL_REGEX + ")))$", "gi");
                    let nextArticleRegex = new RegExp("^(?:((" + ARTICLE_LABEL_REGEX + ")\\s" + nextArticleNumber + " ?\\.?o?°?)|(" + nextArticleNumber + "\\.?\\s?(" + ARTICLE_LABEL_REGEX + ")))$", "gi");

                    // get All p
                    let pElements = $el.find("#TexteOnly p");
                    let res = '';
                    let startRecording = false;

                    pElements.each((index, elem) => {
                        if (elem.innerHTML.trim().replace(/&nbsp;/g, " ").match(articleRegex) && !startRecording) {
                            startRecording = true;
                        } else if (elem.innerHTML.trim().replace(/&nbsp;/g, " ").match(nextArticleRegex)) {
                            startRecording = false;
                            return false;
                        }
                        if (startRecording) {
                            res += elem.outerHTML;
                        }
                    });

                    resultString = res;
                } else {
                    resultString = '';
                }
            }
            customHeaderSelector = 'p > strong';
        } else {
            selector = '.ti-art';

            try {
                let articleElements = $el.find(selector);
                let startElem;
                let stopElem;
                let articleNumber = node.data[0]['offset-art'];
                let articleRegex = new RegExp("^(?:((" + ARTICLE_LABEL_REGEX + ")\\s" + articleNumber + " ?\\.?o?°?)|(" + articleNumber + "\\.?\\s(" + ARTICLE_LABEL_REGEX + ")))$", "gi");

                if (articleElements.length === 0) {
                    articleElements = $el.find(".oj-ti-art"); // try second selector
                }

                if (articleElements.length === 0) {
                    articleElements = $el.find(".title-article-norm"); // try the revision selector
                }


                articleElements.each(function (index, elem) {
                    let txt = elem.innerHTML.trim().replace(/&nbsp;/g, " ");

                    if (txt.match(articleRegex)) {
                        startElem = elem;
                    } else if (startElem && !stopElem) {
                        stopElem = elem;
                    }
                });

                if (!stopElem) {
                    stopElem = $el.find('hr');
                }

                if (startElem) {
                    resultString = startElem.outerHTML;
                    let ongoing = true;
                    $el.find(startElem).nextUntil(stopElem).each(function (index, elem) {
                        if ($(elem).prop("tagName") !== 'P' && $(elem).prop("tagName") !== 'DIV' && $(elem).prop("tagName") !== 'TABLE' && !$(elem).hasClass('norm') && !$(elem).hasClass('modref')) {
                            ongoing = false;
                        } else {
                            if ($(elem).attr('id')) {
                                ongoing = false;
                            }
                        }
                        if (ongoing) {
                            resultString += elem.outerHTML;
                        }
                    });
                }
            } catch (e) {
                console.error('Error extracting article', e);
            }
        }

        // can't move forward without the article
        if (!resultString) {
            return {
                id: id || null,
                header: null,
                subheader: null,
                content: null,
                subdivisions: [],
                error: ERROR_ARTICLE_NOT_FOUND
            }
        }

        let $article = $("<div>" + resultString + "</div>", doc);


        // go deeper to paragraph level
        if (paragraph && resultString) {
            let resultParagraphString = extractParagraphString(resultString, paragraph);

            if (resultParagraphString) {
                resultString = resultParagraphString;
            }
            else {
                error = ERROR_PARAGRAPH_NOT_FOUND;
            }

            // we can have points without paragraphs (not supported for legacy HTML structure)
            if (point && paragraph) {

                let $paragraph = $("<div>" + resultParagraphString + "</div>");
                // try to find paragraph
                try {
                    let pointMap = {};
                    // create a map eg. { 'a': [p0], 'b': [p1, p2], 'c': [p3], ...}
                    $paragraph.find("table").each((index, currentNode) => {
                        let matchPoint = currentNode.textContent.trim().match(/^\(?([a-z])+\)/)[1];
                        if (matchPoint) {
                            pointMap[matchPoint] = pointMap[String(matchPoint).toLowerCase()] || [];
                            pointMap[matchPoint].push(currentNode);
                        }
                    });
                    if (pointMap[point]) {
                        resultString = '';
                        pointMap[point].forEach(node => {
                            resultString += node.outerHTML;
                        })
                    }
                    else {
                        // try to get <P> starting with eg: (a) or a) eg: Framework Decision 2002/584/JHA – Article 27 par 3 pt g
                        resultString = '';
                        let nextPoint = String.fromCharCode(point.charCodeAt(0) + 1);
                        $paragraph.children().each(function (index, currentNode) {
                            let textPoint = $(currentNode).text().substring(0, 3);
                            let regexPoint = new RegExp("^\\(?" + point + "\\)", "g");
                            let regexNextPoint = new RegExp("^\\(?" + nextPoint + "\\)", "g");
                            let regexAllPoint = new RegExp("^\\(?[a-z]\\)", "g");

                            if ($(currentNode).prop("tagName") === 'P' && textPoint.match(regexPoint)) {
                                startRecording = true;
                            }
                            // find next point
                            else if ($(currentNode).prop("tagName") === 'P' && textPoint.match(regexNextPoint)) {
                                startRecording = false;
                            }
                            // if last point then stop
                            else if ($(currentNode).prop("tagName") === 'P' && !textPoint.match(regexAllPoint)) {
                                startRecording = false;
                            }
                            if (startRecording) {
                                resultString += currentNode.outerHTML;
                            }
                        });
                    }
                    if (!resultString || resultString.length < 1) {
                        error = ERROR_POINT_NOT_FOUND;
                    }
                } catch (e) {
                    console.error('Error extracting point', e);
                }
            }
        }

        if ($article.html()) {
            if (customHeaderSelector) {
                header = $el.find(customHeaderSelector).first().text().trim();
            }
            else {
                // extract header
                header = $article.find(".ti-art").text().trim();
            }

            if (!header) {
                header = $article.find(".oj-ti-art").text().trim();
            }

            if (header) {
                header = String(header).replace(/&nbsp;/g, " ");
            }

            // extract id
            id = $article.find(".ti-art").attr("id");
            if (!id) {
                id = $article.find(".oj-ti-art").attr("id");
            }

            if (!customHeaderSelector) {
                subheader = $article.find(".sti-art").text().trim();
                if (!subheader) {
                    subheader = $article.find(".oj-sti-art").text().trim();
                }
                if (!subheader) {
                    subheader = $article.find('.stitle-article-norm').text().trim();
                }
            }
        }
    }

    let $result = $("<div>" + resultString + "</div>", doc);

    // remove header/subheader from content
    $result.find(".ti-art,.sti-art,.oj-ti-art,.oj-sti-art,.eli-title").remove();

    let parsedHtml = $result.html();
    let subdivisions = sector === "3" ? extractSubdivisions($el) : []; // we only extract subdivisions for sector 3

    let eurlexData = {
        id: id,
        header: header,
        subheader: subheader,
        content: parsedHtml,
        subdivisions: subdivisions,
        error: error
    };

    console.debug("Eurlex data", eurlexData);

    return eurlexData;
}

function extractSubdivisions($el) {
    let selector = '.ti-art';
    let subdivisions = [];
    let articleElements = $el.find(selector);
    if (articleElements.length === 0) {
        articleElements = $el.find(".title-article-norm"); // try the revision selector
    }

    articleElements.each(function (index, elem) {
        if (elem.textContent.trim().match(new RegExp(ARTICLE_LABEL_REGEX, 'gi'))) {
            let txt = elem.innerHTML.trim().replace(/&nbsp;/g, " ");
            let currentArticleNumber = txt.replace(new RegExp(ARTICLE_LABEL_REGEX, 'gi'), '').replace('.', '').replace('°', '').trim();
            // collect all article/id pairs
            subdivisions.push({ type: 'article', offset: String(currentArticleNumber), id: $(elem).attr('id') });
        }
    });

    let annexSelector = ".oj-doc-ti, .doc-ti";
    let annexRegex = new RegExp("^(?:((" + ANNEX_LABEL_REGEX + ")\\s" + ANNEX_NUMBER_REGEX + ")|(" + ANNEX_NUMBER_REGEX + "\\s(" + ANNEX_LABEL_REGEX + ")))$", "gi");

    let res = $el.find(annexSelector);
    res.each((index, elem) => {
        if (elem.textContent.trim().match(annexRegex) || elem.textContent.trim().match(UNIQUE_ANNEX_REGEX)) {
            // get content
            // get content
            let annexRomanNumber = elem.textContent.trim().replace(new RegExp("/^" + ANNEX_LABEL_REGEX, "gi"), '').replace('.', '').trim();
            if (!annexRomanNumber) {
                annexRomanNumber = 'I'; // default to 1
            }

            let annexNumber = R2L.converters.roman(annexRomanNumber);

            // collect all article/id pairs
            subdivisions.push({ type: 'annex', offset: String(annexNumber), id: $(elem).attr('id') });
        }
    });

    return subdivisions;
}


function parseEcliResponse(response, node) {
    let paragraph = node.data[0]['offset-p'] || null;
    if (!paragraph) {
        return {
            id: null,
            header: null,
            subheader: null,
            content: null,
            subdivisions: [],
            error: ERROR_SUBDIVISION_NOT_FOUND
        }
    }

    let doc = document.implementation.createHTMLDocument('virtual');
    let $el = $("<div>" + response + "</div>", doc);
    let resultString;

    let $anchor = $el.find("a[name=point" + paragraph + "], p[id=point" + paragraph + "]");
    if ($anchor.length > 0) {

        if ($anchor[0].nodeName === 'P') {
            let $parent = $anchor.closest("table");
            if ($parent.length) {
                resultString = $parent[0].outerHTML;
            }
        }
        else if ($anchor[0].nodeName === 'A') {
            let $parent = $anchor.closest("p");
            if ($parent.length > 0) {
                resultString = $parent[0].outerHTML;

                let $nextAnchor = $el.find("a[name=point" + (parseInt(paragraph) + 1) + "]");
                let $stopElement = $nextAnchor ? $nextAnchor.closest("p") : $el.find(".C41DispositifIntroduction");

                let ongoing = true;
                $el.find($parent).nextUntil($stopElement).each((index, elem) => {
                    if (!$(elem).hasClass("C09Marge0avecretrait") && !$(elem).hasClass("C01PointnumeroteAltN") &&
                        !$(elem).hasClass("C02AlineaAltA")) {
                        ongoing = false;
                    }

                    if (ongoing) {
                        resultString += elem.outerHTML;
                    }
                });
            }
        }
    }
    else {
        // legacy ECLI acts, we need to extract paragraphs
        let $elements = $el.find("#TexteOnly").children();
        let paragraphs = [];
        let isNext = false;
        let stop = false;
        $elements.each((index, elem) => {
            let $el = $(elem);
            if (elem.nodeName === 'P' && $el.find("a[name=MO]").length > 0) {
                isNext = true;
                // next '<em>' contains the paragraphs
            }
            if (isNext && elem.nodeName === 'EM' && !stop) {
                let ps = $(elem).children("P");
                ps.each((index, para) => {
                    paragraphs.push(para);
                })
            }
            if (elem.nodeName === 'P' && $el.find("a[name=DI]").length > 0) {
                stop = true;
            }
        });

        console.debug("We have extracted paragraphs", paragraphs);
        let numberedParagraphs = [];
        let matches;
        let currentNumber = 0;
        paragraphs.forEach(para => {
            let txt = para.textContent;
            if (matches = txt.match(/^(\d+)\.?\s/)) {
                // next paragraph coming, increment index
                if (parseInt(matches[1]) === currentNumber + 2) {
                    currentNumber++;
                }

                if (parseInt(matches[1]) === currentNumber + 1) {
                    numberedParagraphs[currentNumber] = [];
                    numberedParagraphs[currentNumber].push(para);
                }

            }
            else {
                // multiple paragraphs for this number, we push to the arr
                if (numberedParagraphs[currentNumber]) {
                    numberedParagraphs[currentNumber].push(para);
                }
            }
        });

        resultString = '';
        if (numberedParagraphs[paragraph - 1]) {
            numberedParagraphs[paragraph - 1].forEach((p) => {
                resultString += p.outerHTML;
            })
        }
    }

    return {
        id: "point" + paragraph,
        header: null,
        subheader: null,
        content: resultString,
        subdivisions: [],
        error: null
    }
}

/**
 * Will extract specific paragraph content from an article content
 * 
 * @param {String} resultString 
 * @param {String} paragraph 
 */
function extractParagraphString(resultString, paragraph) {
    let startRecording = false;
    let resultParagraphString = '';
    let $article = $("<div>" + resultString + "</div>");

    try {
        $article.children().each(function (index, currentNode) {
            // paragraph needs to start with one of the following formats: 
            //  - 2. lorem ipsum...
            //  - (2) lorem ipsum...
            if (($(currentNode).prop("tagName") === 'P' || $(currentNode).prop("tagName") !== 'TABLE') && ($(currentNode).text().trim().startsWith(parseInt(paragraph) + '.') || $(currentNode).text().trim().startsWith('(' + parseInt(paragraph) + ')'))) {
                startRecording = true;
            }

            // find next paragraph 
            else if (($(currentNode).prop("tagName") === 'P' || $(currentNode).prop("tagName") !== 'TABLE') && (($(currentNode).text().trim().startsWith((parseInt(paragraph) + 1) + '.')) || $(currentNode).text().trim().startsWith('(' + (parseInt(paragraph) + 1) + ')'))) {
                startRecording = false;
            }

            // if last paragraph then stop
            else if (($(currentNode).prop("tagName") === 'P') && $(currentNode).attr('id')) {
                startRecording = false;
            }
            else if ($(currentNode).prop("tagName") !== 'P' && $(currentNode).prop("tagName") !== 'TABLE') {
                startRecording = false;
            }

            if (startRecording) {
                resultParagraphString += $(currentNode).get(-1).outerHTML;
            }
        });
    } catch (e) {
        console.error('Error extracting paragraph', e);
    }

    return resultParagraphString;
}

/**
 * Parse subdivision fragment from Cellar
 * Example: A02P1 => article 2 paragraph 1
 *           N 32 => paragraph 32
 *   Lists:  N 02 05 07 => paragraphs 2, 5, 7
 * @param {String} fragment
 * @param {String} celex
 * 
 * @return {String} 
 */
export function parseFragment(fragment, celex) {
    let parsed = fragment;

    // N 03 or P3 04 05-07 08 ...  (only digits, dashes and spaces)
    let paragraphRegex = /^(?:N|P)\s?([0-9-\s\.]+)$/g;
    let matches = paragraphRegex.exec(fragment);
    if (Array.isArray(matches) && matches[1]) {
        let ref = matches[1];
        ref = ref.replace(/\s?-\s?/gi, "-").trim();
        let nums = ref.split(" ");
        nums = nums.map(num => {
            if (num.substr(0, 1) === '0') {
                num = num.substr(1);
            }
            return (num);
        })

        let labels = ["par. ", "par. "];
        // secondary law (directives/regulations use N for annex)
        if (fragment.substr(0, 1) === "N" && celex && ["1", "2", "3"].indexOf(celex.substr(0, 1)) !== -1) {
            labels = ["anx. ", "anx. "];
        }
        parsed = (nums.length < 2 ? labels[0] : labels[1]) + (nums.join(", "));
        return parsed;
    }

    // P1L3
    let paragraph2Regex = /^P(\d+)(?:L(\d+))?$/g;
    let matchesP2 = paragraph2Regex.exec(fragment);
    if (Array.isArray(matchesP2) && matchesP2[1]) {
        parsed = "par. " + ((matchesP2[1]));
        if (matchesP2[2]) {
            parsed += " al. " + (parseInt(matchesP2[2]));
        }
        return parsed;
    }

    // N6PT1; N1A09; N
    let paragraph3Regex = /^N(\d+|)(?:A(\d+))?(?:P(\d+))?(?:L(\d+))?(?:PT(\d+))?$/g;
    let matchesP3 = paragraph3Regex.exec(fragment);
    if (Array.isArray(matchesP3) && (matchesP3[1] || matchesP3[1] === '')) {

        parsed = (celex && ["1", "2", "3"].indexOf(celex.substr(0, 1)) !== -1 ? "anx. " : "par. ") + (matchesP3[1] || '1');
        if (matchesP3[2]) {
            parsed += " art. " + (parseInt(matchesP3[2]));
        }
        if (matchesP3[3]) {
            parsed += " par. " + (parseInt(matchesP3[3]));
        }
        if (matchesP3[4]) {
            parsed += " al. " + (parseInt(matchesP3[4]));
        }
        if (matchesP3[5]) {
            parsed += " pnt. " + (parseInt(matchesP3[5]));
        }
        return parsed;
    }

    // C1
    let recitalRegex = /^(?:C)((?:\s?\d{1,6}(?:\s-\s\d{1,6})?){1,4})$/g;
    let matchesRecital = recitalRegex.exec(fragment);
    if (Array.isArray(matchesRecital) && matchesRecital[1]) {
        let refR = matchesRecital[1];
        refR = refR.replace(/\s-\s/gi, "-").trim();
        let numsR = refR.split(" ");
        numsR = numsR.map(num => {
            if (num.substr(0, 1) === '0') {
                num = num.substr(1);
            }
            return (num);
        })

        parsed = (numsR.length < 2 ? "rct. " : "rct. ") + (numsR.join(", "));
        return parsed;
    }

    // A02P1; A02P1LB; 
    let artRegex = /^A(\d+(?:BIS)?)(?:(?:P|\.)(\d+))?(?:L(\d+|[A-Z]))?/g;
    let matchesArt = artRegex.exec(fragment);
    if (Array.isArray(matchesArt) && matchesArt[1]) {
        if (matchesArt[1].substr(0, 1) === '0') {
            matchesArt[1] = matchesArt[1].substr(1);
        }
        parsed = "art. " + ((matchesArt[1]));
        if (matchesArt[2]) {
            parsed += " par. " + (parseInt(matchesArt[2]));
        }
        if (matchesArt[3]) {
            // we use Pt. for letters and Al. for numeric values
            if (!isNaN(matchesArt[3])) {
                parsed += " al. " + ((matchesArt[3]));
            }
            else {
                parsed += " pnt. " + (String(matchesArt[3]).toLowerCase());
            }
        }
        return parsed;
    }

    let lineRegex = /^L(\d+)$/g;
    let matchesLine = lineRegex.exec(fragment);
    if (Array.isArray(matchesLine) && matchesLine[1]) {
        parsed = "al. " + matchesLine[1];
        return parsed;
    }

    let titRegex = /^TIT(\d+)$/g;
    let matchesTit = titRegex.exec(fragment);
    if (Array.isArray(matchesTit) && matchesTit[1]) {
        parsed = "tit. " + matchesTit[1];
        return parsed;
    }

    return parsed;
}

function getArticleIdentifier($el, artNo) {
    let articleIdentifier = null;

    // We check the ELI identifier if nothing found above
    // Note: article numbers can have suffixes eg. '21a'; 
    let testNewTemplate = $el.find("#art_" + (artNo));
    if (testNewTemplate.length > 0) {
        articleIdentifier = "art_" + (artNo);
    }
    else {
        let artPaddedNo = String(artNo).padStart(3, '0');
        testNewTemplate = $el.find("#" + artPaddedNo);
        if (testNewTemplate.length > 0) {
            // id is the art number
            articleIdentifier = artPaddedNo;
        }
    }

    return articleIdentifier;
}

/**
 * EUR-Lex HTML content cleaner
 * @param {String} content 
 */
export function cleanHtmlContent(content) {
    content = content.replaceAll('<span class="super">o</span>', '°');

    let doc = document.implementation.createHTMLDocument('virtual');
    let $el = $("<div>" + content + "</div>", doc);
    $el.find('a').each((index, anchor) => {
        // we only keep hrefs to legal-content, where we replace the root with the eurlex domain

        let href = anchor.href;

        if (/\.\/(?:\.\.\/)+legal-content\//gi.test(href)) {
            href = 'https://eur-lex.europa.eu/legal-content/' + href.split('/legal-content/')[1];
            anchor.href = href;
        }
        else {
            anchor.removeAttribute("href");
        }
    });

    // remove all images, scripts
    $el.find('script,img,meta').each((index, elem) => {
        elem.parentNode.removeChild(elem);
    });

    // remove all "src"'s
    $el.find('[src]').each((index, elem) => {
        elem.removeAttribute("src");
    });

    return $el.html();
}