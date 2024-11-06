/*global global*/

/**
 * This is a forked version of the MIT-licensed jsdom-worker polyfill, taken from
 * https://github.com/developit/jsdom-worker/commit/4a400f72ec901fc926f0301ab4680f9f2c318439
 *
 * We keep a local forked copy because:
 * 1) That repo appears to be unmaintained and some of its commits have not made it to npm
 * 2) We need to patch in some extra support for things like importScripts.
 *
 * All edits are marked with [TROIKA EDIT] below.
 */

import mitt from 'mitt';
import uuid from 'uuid-v4';
import fetch, { Response } from 'node-fetch';

if (!global.URL) global.URL = {};
if (!global.URL.$$objects) {
  global.URL.$$objects = new Map();
  global.URL.createObjectURL = blob => {
    let id = uuid();
    global.URL.$$objects[id] = blob;
    return `blob:http://localhost/${id}`;
  };

  // [TROIKA EDIT]: add revokeObjectURL as no-op:
  global.URL.revokeObjectURL = function() {}
}

// [TROIKA EDIT]: `fetch` is overwritten with jsdom's version on each suite run, but
// URL.$$objects hangs around between runs, so it wouldn't be re-patched. We move it
// to its own conditional.
if (!global.fetch || !global.fetch._patched) {
  let oldFetch = global.fetch || fetch;
  global.fetch = function(url, opts) {
    if (url.match(/^blob:/)) {
      return new Promise( (resolve, reject) => {
        let fr = new FileReader();
        fr.onload = () => {
          let Res = global.Response || Response;
          resolve(new Res(fr.result, { status: 200, statusText: 'OK' }));
        };
        fr.onerror = () => {
          reject(fr.error);
        };
        let id = url.match(/[^/]+$/)[0];
        fr.readAsText(global.URL.$$objects[id]);
      });
    }
    return oldFetch.call(this, url, opts);
  };
  global.fetch._patched = true
}

// [TROIKA EDIT]: To enable a synchronous Blob read without jsdom support for FileReaderSync,
// we override the Blob constructor to save a reference to its original text input.
const blobContents = new WeakMap()
const _Blob = global.Blob;
global.Blob = function(...args) {
  let b = new _Blob(...args)
  blobContents.set(b, args[0])
  return b
}


if (!global.document) {
  global.document = {};
}

function Event(type) { this.type = type; }
Event.prototype.initEvent = Object;
if (!global.document.createEvent) {
  global.document.createEvent = function(type) {
    let Ctor = global[type] || Event;
    return new Ctor(type);
  };
}


global.Worker = function Worker(url) {
  let messageQueue = [],
    inside = mitt(),
    outside = mitt(),
    scope = {
      onmessage: null,
      dispatchEvent: inside.emit,
      addEventListener: inside.on,
      removeEventListener: inside.off,
      postMessage(data) {
        outside.emit('message', { data });
      },
      fetch: global.fetch,
      importScripts(...urls) {
        // [TROIKA EDIT]: Implement importScripts, for text-based blob urls only for now:
        urls.forEach(url => {
          if (url.match(/^blob:/)) {
            let id = url.match(/[^/]+$/)[0];
            let code = blobContents.get(global.URL.$$objects[id]).join('');
            let vars = 'var self=this,global=self';
            for (let k in scope) vars += `,${k}=self.${k}`;
            new Function(vars+';\n'+code).call(scope);
          } else {
            throw Error('importScripts only supports blob urls for now.')
          }
        })
      }
    },
    getScopeVar;
  inside.on('message', e => { let f = getScopeVar('onmessage'); if (f) f.call(scope, e); });
  this.addEventListener = outside.on;
  this.removeEventListener = outside.off;
  this.dispatchEvent = outside.emit;
  outside.on('message', e => { this.onmessage && this.onmessage(e); });
  this.postMessage = data => {
    if (messageQueue!=null) messageQueue.push(data);
    else inside.emit('message', { data });
  };
  this.terminate = () => {
    // [TROIKA EDIT]: don't throw.
    // throw Error('Not Supported');
  };
  global.fetch(url)
    .then( r => r.text() )
    .then( code => {
      let vars = 'var self=this,global=self';
      for (let k in scope) vars += `,${k}=self.${k}`;
      getScopeVar = eval('(function() {'+vars+';\n'+code+'\nreturn function(__){return eval(__)}})').call(scope);
      let q = messageQueue;
      messageQueue = null;
      q.forEach(this.postMessage);
    })
    .catch( e => { outside.emit('error', e); console.error(e); });
};

