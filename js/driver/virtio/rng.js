// Copyright 2014-2015 runtime.js project authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';
var VirtioDevice = require('./device');
var runtime = require('../../core');

function initializeRNGDevice(pciDevice) {
  var ioSpace = pciDevice.getBAR(0).resource;
  var irq = pciDevice.getIRQ();
  var allocator = runtime.allocator;

  var features = {};

  var dev = new VirtioDevice('rng', ioSpace, allocator);
  dev.setDriverAck();

  var driverFeatures = {};

  var deviceFeatures = dev.readDeviceFeatures(driverFeatures);

  if (!dev.writeGuestFeatures(features, driverFeatures, deviceFeatures)) {
    debug('[virtio] driver is unable to start');
    return;
  }

  var QUEUE_ID_REQ = 0;

  var reqQueue = dev.queueSetup(QUEUE_ID_REQ);

  function fillRequestQueue(length) {
    if (reqQueue.descriptorTable.descriptorsAvailable) {
      if (!reqQueue.placeBuffers([new Uint8Array(length || 1)], true)) {
        debug('[virtio rng] error placing descriptor buffers');
      }
    }

    if (reqQueue.isNotificationNeeded()) {
      dev.queueNotify(QUEUE_ID_REQ);
    }
  }

  runtime.driver.rng = {
    getRand: function(cb) {
      if (!cb) {
        cb = function() {};
      }

      fillRequestQueue(1);
      dev.hasPendingIRQ();
      reqQueue.fetchBuffers(cb);
    },
    getRandLength: function(length, cb) {
      if (typeof length === 'function') {
        cb = length;
        length = 1;
      }

      if (!cb) {
        cb = function() {};
      }

      fillRequestQueue(length);
      dev.hasPendingIRQ();
      reqQueue.fetchBuffers(cb);
    }
  };

  dev.setDriverReady();
}

module.exports = initializeRNGDevice;
