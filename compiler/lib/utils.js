import { XmlEntities as Entities } from 'html-entities';
const entities = new Entities();

export const replaceList = function replaceList(target, searchesStr, replacementsStr) {
    let searches = searchesStr.split(",").filter(s => !!s);
    let replacements = replacementsStr.split(",").filter(s => !!s);
    for (let i = 0; i < searches.length; i++) {
        target = replaceAll(target, searches[i], replacements[i]);
    }

    return target;
}

export const replaceAll = function replaceAll(target, search, replacement) {
    return target.replace(new RegExp(escapeRegExp(search), 'g'), replacement);
}

export const normalizePattern = function normalizePattern(pattern) {
    pattern = pattern.replace(new RegExp("#[^\\r\\n]*[\\r\\n]+\\s*", "g"), " ");
    pattern = pattern.replace(new RegExp("\\s{2,}", "g"), "");
    return pattern;
}

export const getNonCapturingPattern = function getNonCapturingPattern(pattern) {
    return pattern.replace(new RegExp("(?<!\\\\)\\((?!\\?[<!=:])", "g"), "(?:");
}

export const escapeRegExp = function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

function entitiesDecode(html) {
    return entities.decode(html);
}

//CDATA or text extraction from node
export const getNodeData = function getNodeData(node) {

    if (!node.data) {
        let dataNode = null;
        for (let i = 0; i < node.childNodes.length; i++) {
            if (node.childNodes[i].nodeType === 4) { // CDATASection
                dataNode = node.childNodes[i];
            }
        }

        if (dataNode) {
            if (dataNode.parentNode.tagName === "view") {
                dataNode.data = dataNode.data.replace(new RegExp("}}[\\s\\r\\n\\t]+{{", 'gi'), "}}{{"); // replace newlines
                dataNode.data = dataNode.data.replace(new RegExp(`{{\\s?["'] ["']\\s?}}`, 'gi'), " ");  // replace space placeholders
            }
            return dataNode.data;
        }
        else {
            return '';
        }
    }
    else {
        return String(node.data);
    }
}

export const getNodesChildOrAttribute = function getNodesChildOrAttribute(root, childName, type, includeItself) {

    for (let i = 0; i < root.childNodes.length; i++) {
        if (root.childNodes[i].nodeName === childName) {

            let tagType = root.childNodes[i].getAttribute("type") || "";

            if (tagType.toLowerCase() === type.toLowerCase()) {
                return entitiesDecode(getNodeData(root.childNodes[i]));
            }
        }
    }

    if (root.getAttribute(childName)) {
        return entitiesDecode(String(root.getAttribute(childName)));
    }

    if (includeItself) {
        return entitiesDecode(getNodeData(root));
    }
    else {
        return '';
    }
}

export const Base64 = {
    _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    encode: function (r) { var t, e, o, a, h, n, c, d = "", C = 0; for (r = Base64._utf8_encode(r); C < r.length;)t = r.charCodeAt(C++), e = r.charCodeAt(C++), o = r.charCodeAt(C++), a = t >> 2, h = (3 & t) << 4 | e >> 4, n = (15 & e) << 2 | o >> 6, c = 63 & o, isNaN(e) ? n = c = 64 : isNaN(o) && (c = 64), d = d + this._keyStr.charAt(a) + this._keyStr.charAt(h) + this._keyStr.charAt(n) + this._keyStr.charAt(c); return d },
    decode: function (r) { var t, e, o, a, h, n, c, d = "", C = 0; for (r = r.replace(/[^A-Za-z0-9\+\/\=]/g, ""); C < r.length;)a = this._keyStr.indexOf(r.charAt(C++)), h = this._keyStr.indexOf(r.charAt(C++)), n = this._keyStr.indexOf(r.charAt(C++)), c = this._keyStr.indexOf(r.charAt(C++)), t = a << 2 | h >> 4, e = (15 & h) << 4 | n >> 2, o = (3 & n) << 6 | c, d += String.fromCharCode(t), 64 != n && (d += String.fromCharCode(e)), 64 != c && (d += String.fromCharCode(o)); return d = Base64._utf8_decode(d) },
    _utf8_encode: function (r) { r = r.replace(/\r\n/g, "\n"); for (var t = "", e = 0; e < r.length; e++) { var o = r.charCodeAt(e); 128 > o ? t += String.fromCharCode(o) : o > 127 && 2048 > o ? (t += String.fromCharCode(o >> 6 | 192), t += String.fromCharCode(63 & o | 128)) : (t += String.fromCharCode(o >> 12 | 224), t += String.fromCharCode(o >> 6 & 63 | 128), t += String.fromCharCode(63 & o | 128)) } return t },
    _utf8_decode: function (r) { let c1, c2, c3; for (var t = "", e = 0, o = c1 = c2 = 0; e < r.length;)o = r.charCodeAt(e), 128 > o ? (t += String.fromCharCode(o), e++) : o > 191 && 224 > o ? (c2 = r.charCodeAt(e + 1), t += String.fromCharCode((31 & o) << 6 | 63 & c2), e += 2) : (c2 = r.charCodeAt(e + 1), c3 = r.charCodeAt(e + 2), t += String.fromCharCode((15 & o) << 12 | (63 & c2) << 6 | 63 & c3), e += 3); return t; }
}