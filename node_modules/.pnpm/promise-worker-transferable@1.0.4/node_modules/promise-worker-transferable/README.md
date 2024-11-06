promise-worker-transferable [![Build Status](https://travis-ci.org/terikon/promise-worker-transferable.svg?branch=master)](https://travis-ci.org/terikon/promise-worker-transferable)
====

Modified version of [promise-worker](https://github.com/nolanlawson/promise-worker) library that supports object transferring. Possibly works slower than original for not transferable messages.

As mentioned [here](https://github.com/nolanlawson/promise-worker/issues/13), promise-worker library will not get support for blobs and transferables. So here promise-worker-transferable goes.

**Goals:**

 * Tiny footprint (~2.5kB min+gz)
 * Assumes you have a separate `worker.js` file (easier to debug, better browser support)
 * Removed from promise-worker and no longer true: `JSON.stringify`s messages [for performance](http://nolanlawson.com/2016/02/29/high-performance-web-worker-messages/)
 * Instead, it's now possbile to transfer blobs, as well as attach transferList array to transfer objects, which works much faster for larger objects. 

**Live examples:**

* [Web Workers](https://bl.ocks.org/nolanlawson/05e74a8408a099635c9a38f839b5ae9f)
* [Service Workers](https://bl.ocks.org/nolanlawson/91a7f5809f2e17a2e6a753a3cb8d2eec)

Usage
---

Install:

    npm install promise-worker-transferable

Inside your main bundle:

```js
// main.js
var PromiseWorker = require('promise-worker-transferable');
var worker = new Worker('worker.js');
var promiseWorker = new PromiseWorker(worker);

promiseWorker.postMessage('ping').then(function (response) {
  // handle response
}).catch(function (error) {
  // handle error
});

// With transferList
promiseWorker.postMessage(pingImageData, [pingImageData.data.buffer]) // pongImageData transferred from main to worker
.then(function (response) {
  // handle response
}).catch(function (error) {
  // handle error
});
```

Inside your `worker.js` bundle:

```js
// worker.js
var registerPromiseWorker = require('promise-worker-transferable/register');

registerPromiseWorker(function (message) {
  return 'pong';
});

// With transferList
registerPromiseWorker(function (message, withTransferList) {
  return withTransferList(pongImageData, [pongImageData.data.buffer]); // pongImageData transferred from worker to main 
});
```

Note that you `require()` two separate APIs, so the library is split
between the `worker.js` and main file. This keeps the total bundle size smaller.


### Message format

The message you send can be any object, array, string, number, etc.:

```js
// main.js
promiseWorker.postMessage({
  hello: 'world',
  answer: 42,
  "this is fun": true
}).then(/* ... */);
```

```js
// worker.js
registerPromiseWorker(function (message) {
  console.log(message); // { hello: 'world', answer: 42, 'this is fun': true }
});
```

### Promises

Inside of the worker, the registered handler can return either a Promise or a normal value:

```js
// worker.js
registerPromiseWorker(function () {
  return Promise.resolve().then(function () {
    return 'much async, very promise';
  });
});
```

```js
// main.js
promiseWorker.postMessage(null).then(function (message) {
  console.log(message): // 'much async, very promise'
});
```

Promise can return withTransferList as well:

```js
// worker.js
registerPromiseWorker(function (_, withTransferList) {
  return Promise.resolve().then(function () {
    return withTransferList(pongImageData, [pongImageData.data.buffer]); // pongImageData transferred to webworker
  });
});
```

```js
// main.js
promiseWorker.postMessage(null).then(function (message) {
  // message contains pongImageData
});
```

### Error handling

Any thrown errors or asynchronous rejections from the worker will
be propagated to the main thread as a rejected Promise. For instance:

```js
// worker.js
registerPromiseWorker(function (message) {
  throw new Error('naughty!');
});
```

```js
// main.js
promiseWorker.postMessage('whoops').catch(function (err) {
  console.log(err.message); // 'naughty!'
});
```

Note that stacktraces cannot be sent from the worker to the main thread, so you
will have to debug those errors yourself. This library does however, print
messages to `console.error()`, so you should see them there.

### Multi-type messages

If you need to send messages of multiple types to the worker, just add
some type information to the message you send:

```js
// main.js
promiseWorker.postMessage({
  type: 'en'
}).then(/* ... */);

promiseWorker.postMessage({
  type: 'fr'
}).then(/* ... */);
```

```js
// worker.js
registerPromiseWorker(function (message) {
  if (message.type === 'en') {
    return 'Hello!';
  } else if (message.type === 'fr') {
    return 'Bonjour!';
  }
});
```

### Service Workers

Communicating with a Service Worker is the same as with a Web Worker.
However, you have to wait for the Service Worker to install and start controlling the page. Here's an example:

```js
navigator.serviceWorker.register('sw.js', {
  scope: './'
}).then(function () {
  if (navigator.serviceWorker.controller) {
    // already active and controlling this page
    return navigator.serviceWorker;
  }
  // wait for a new service worker to control this page
  return new Promise(function (resolve) {
    function onControllerChange() {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      resolve(navigator.serviceWorker);
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
  });
}).then(function (worker) { // the worker is ready
  var promiseWorker = new PromiseWorker(worker);
  return promiseWorker.postMessage('hello worker!');
}).catch(console.log.bind(console));
```

Then inside your Service Worker:

```js
var registerPromiseWorker = require('../register');

registerPromiseWorker(function (msg) {
  return 'hello main thread!';
});

self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim()); // activate right now
});
```

Browser support
----

* Chrome
* Firefox
* Safari 8+
* IE 10+
* Edge
* iOS 8+
* Android 4.4+

If a browser [doesn't support Web Workers](http://caniuse.com/webworker) but you still want to use this library,
then you can use [pseudo-worker](https://github.com/nolanlawson/pseudo-worker).

For Service Worker support, Chrome 40 and 41 are known to be buggy (see [#9](https://github.com/nolanlawson/promise-worker/pull/9)), but 42+ are supported.

This library is not designed to run in Node.js.

API
---

### Main bundle

#### `new PromiseWorker(worker)`

Create a new `PromiseWorker`, using the given worker.

* `worker` - the `Worker` or [PseudoWorker](https://github.com/nolanlawson/pseudo-worker) to use.

#### `PromiseWorker.postMessage(message, optionalTransferList)`

Send a message to the worker and return a Promise.

* `message` - object - required
  * The message to send.
* `optionalTransferList` - array of objects to transfer, just as in usual Worker.postMessage.
* returns a Promise

### Worker bundle

Register a message handler inside of the worker. Your handler consumes a message
and returns a Promise or value.

#### `registerPromiseWorker(function)`

* `function`
  * Takes a message and withTransferList function, returns a Promise or a value.
  Value can be wrapped with withTransferList. withTransferList gets value and transferList. 


Testing the library
---

First:

    npm install

Then to test in Node (using an XHR/PseudoWorker shim):

    npm test

Or to test manually in your browser of choice:

    npm run test-local

Or to test in a browser using SauceLabs:

    npm run test-browser

Or to test in PhantomJS:

    npm run test-phantom

Or to test with coverage reports:

    npm run coverage
