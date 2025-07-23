/**
 * Process Cellar response - format joined cases as CSV with first case being the one with the judgement;
 * Example: 
 *     id: `celex:62011CA0229`
 *     title: `C-229/11,C-230/11`
 * @param {CellarResponse} response 
 * 
 * @return {CellarResponse}
 */
export function parseJoinedCaseResponse(response) {
    response.results.bindings = response.results.bindings.map(result => {
        let parts = result.title.value.split(":");
        let title = parts[0] || '';
        title = title.replaceAll("‑", "-").replace("Affaires jointes ", "").replace(/\s?et\sles\saffaires\sjointes\s?/g, "");
        title = title.replace(/\s?(?:à|et)\s?/g, ",").replace(".", "");
        title = title.split(",").map(item => item.trim().replace("affaire ", "").replace(/\s/, " ")).filter(caseLabel => {
            return caseLabel.indexOf('C-') === 0 || caseLabel.indexOf('T-') === 0;
        }).join(",");
        result.title.value = title;
        return result;
    });

    return response;
}