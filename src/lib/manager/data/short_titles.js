export function appendShortTitlesData(response, langISO3) {
    return new Promise(function (resolve, reject) {

        if (!response || !response.results || !response.results.bindings) {
            resolve(response);
            return;
        }

        let fullTitlesMap = {};
        response.results.bindings.forEach(binding => {
            let id = binding && binding.id ? binding.id.value : "";
            id = id.replace("celex:", "");
            if (binding.title && binding.title.value) {
                fullTitlesMap[id] = binding.title.value;
            }
        });

        if (Object.keys(fullTitlesMap).length === 0) {
            resolve(response);
            return;
        }

        let treatyShortTitlesMap = R2L.alias.extractTreatyShortTitlesMap(Object.keys(fullTitlesMap), langISO3);

        R2L.alias.extractShortTitlesMap(fullTitlesMap).then(shortTitlesMap => {
            // append results to response
            shortTitlesMap = { ...shortTitlesMap, ...treatyShortTitlesMap };
            try {
                response.results.bindings = response.results.bindings.map(binding => {
                    let id = (binding && binding.id ? binding.id.value : "").replace("celex:", "");
                    if (shortTitlesMap[id]) {
                        binding.shortTitle = {
                            datatype: "http://www.w3.org/2001/XMLSchema#string",
                            type: "typed-literal",
                            value: shortTitlesMap[id]
                        }
                    }

                    return binding;
                });
            }
            catch (e) {
                console.error(e);
            }
            resolve(response);
        }).catch(err => {
            console.error(err);
            resolve(response);
        });
    });
}