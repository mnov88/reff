
/**
 * Fetch ECAS ticket for a target url
 * @param {String} targetUrl 
 * @param {String} forcedProxyTicket 
 * 
 * @return {Promise<String>} ECAS proxy ticket
 */
export function getEcasTicket(targetUrl, forcedProxyTicket) {
    return new Promise((resolve, reject) => {
        if (forcedProxyTicket) {
            resolve(forcedProxyTicket);
            return;
        }

        if (typeof OpenIdConnect === 'object' && typeof OpenIdConnect.getAuthorizationHeaders === 'function') {
            OpenIdConnect.getAuthorizationHeaders(targetUrl, function (res) {
                let ticket = res ? (res.Authorization || "").replace("cas_ticket ", "") : "";
                if (!ticket) {
                    reject(new Error("No ticket retrieved"));
                }
                else {
                    resolve(ticket);
                }
            }, function (err) {
                console.error(err);
                reject(err);
            })
        }
        else {
            reject(new Error("Failed to retrieve ECAS ticket"));
        }
    })
}