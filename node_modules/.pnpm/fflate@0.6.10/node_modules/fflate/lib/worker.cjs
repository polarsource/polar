"use strict";
var ch2 = {};
exports["default"] = (function (c, id, msg, transfer, cb) {
    var w = new Worker(ch2[id] || (ch2[id] = URL.createObjectURL(new Blob([c], { type: 'text/javascript' }))));
    w.onerror = function (e) { return cb(e.error, null); };
    w.onmessage = function (e) { return cb(null, e.data); };
    w.postMessage(msg, transfer);
    return w;
});
