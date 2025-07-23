import { $ } from '../jquery.js';
export function getRequestPromise(endpoint, method, data, headers) {
    /**
     * Ref2Link library consumers can hook a function to the handling of SPARQL requests in order to override default behavior. 
     * This is useful in the context of the Webservice, which integrates the library and where there is no need for the library to call the WS back for linked data (circular-dependency).
     */

    if (!headers) {
        headers = {};
    }

    let allheaders = { ...headers, ...R2L.ldm.getCustomHeaders() };
    if (R2L.hooks.handleLinkedDataReq) {
        return R2L.hooks.handleLinkedDataReq(data, headers, false, R2L.ldm.user);
    }

    return new Promise((resolve, reject) => {
        $.ajax({
            url: endpoint,
            method: method,
            data: data,
            headers: allheaders,
            success: (response) => {
                resolve(response);
            },
            error: function (error) {
                reject(error);
            }
        });
    });
}

export function getEurlexRequestPromise(endpoint, method, data, headers) {

    if (!headers) {
        headers = {};
    }

    let allheaders = { ...headers, ...R2L.ldm.getCustomHeaders() };
    if (R2L.hooks.handleEurlexReq) {
        return R2L.hooks.handleEurlexReq(endpoint, method, data, headers);
    }

    return new Promise((resolve, reject) => {
        $.ajax({
            url: endpoint,
            method: method,
            data: data,
            headers: allheaders,
            success: (response) => {
                resolve(response);
            },
            error: function (error) {
                reject(error);
            }
        });
    });
}