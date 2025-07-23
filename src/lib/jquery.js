// Confluence binding
let _jQuery = (typeof AJS !== "undefined" && AJS.$) ? AJS.$ : (typeof jQuery !== "undefined" ? jQuery : null);
if (!_jQuery && typeof $ !== "undefined") {
    _jQuery = $;
}

export const $ = _jQuery;