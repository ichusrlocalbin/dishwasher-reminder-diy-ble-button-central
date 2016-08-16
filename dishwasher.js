#!/usr/bin/env node
var Noble = require('noble/lib/noble');
var Bindings = require('noble/lib/resolve-bindings');
var request = require('request');
var Milight = require("milight");

var dishwasher_service_uuid = "435400003ac64f1eb7dc7599c89b4945";

var host_url = process.env.URL || 'http://localhost:4730';

var milight_broadcast_ip = "10.0.1.255";

var dishwasher_url = host_url+ '/status/dishwasher';
var light_url = host_url+ '/status/light';

var last_dishwash_time = 0;
var period_is_past = function() {
  var threshold = 10 * 1000; // 10 sec
  return (Date.now() - last_dishwash_time > threshold);
};

var interval_milight_request = 1 * 1000; // sec
var interval_cache_milight_color = 3 * 1000; // sec

var noble  = new Noble(new Bindings());

// reference: noble/examples/enter-exit.js

console.log('noble');

var EXIT_GRACE_PERIOD = 5000; // milliseconds

var inRange = [];

noble.on('discover', function(peripheral) {
  var id = peripheral.id;
  var entered = !inRange[id];

  // console.log(new Date());

  if (entered) {
    inRange[id] = { peripheral: peripheral };

    console.log('"' + peripheral.advertisement.localName + '" entered (RSSI ' + peripheral.rssi + ') ' + new Date());

    if (period_is_past()) {
      last_dishwash_time = Date.now();
      post_start_time();
      console.log('dishwasher start:' + new Date());
    }
  }

  inRange[id].lastSeen = Date.now();
});


var manage_in_range_ble = function() {
  for (var id in inRange) {
    if (inRange[id].lastSeen < (Date.now() - EXIT_GRACE_PERIOD)) {
      var peripheral = inRange[id].peripheral;

      console.log('"' + peripheral.advertisement.localName + '" exited (RSSI ' + peripheral.rssi + ') ' + new Date());

      delete inRange[id];
    }
  }
};

setInterval(manage_in_range_ble, EXIT_GRACE_PERIOD / 2);

noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    noble.startScanning([dishwasher_service_uuid], true);
  } else {
    noble.stopScanning();
  }
});

var post_start_time = function() {
  var options = {
    url: dishwasher_url,
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    json: true,
    form: { start_time: Date.now() }
  };

  request(options, function (error, response, body) {
    if (error) {
      console.log(error);
    }
    if (!error && response.statusCode == 200) {
      console.log(body);
    }
  });
};

var milight = new Milight({
    host: milight_broadcast_ip,
    broadcast: true
});

var cache_light = function(callback) {
    var cache_count_threshold = interval_cache_milight_color / interval_milight_request;
    var count = 0;
    var cached_light = null;
    return function() {
	if (cached_light != null && count < cache_count_threshold) {
            console.log('cached light:'+cached_light);
	    count++;
	    callback(cached_light);
        } else {
            count = 0;
            get_light_color(function(color) {
		cached_light = color;
                console.log('get new light:'+cached_light);
		callback(color);
	    });
	}
    };
};

var get_light_color = function(callback) {
  request(light_url, function (error, response, body) {
    if (error) {
      console.log(error);
    }
    if (!error && response.statusCode == 200) {
      console.log(body);
      var light = JSON.parse(body);
      callback(light.color);
    }
  });
};

var milight_request = function(color) {
   if (color == 'warning') {
     // milight.zone(1).white(50, function(error) { });
     // var buffer = [ 0x4D, 0x00, 0x55 ]; // DISCO MODE
     // milight._send(buffer, function(error) { });
     // milight._send(buffer, function(error) { });
     milight.zone(1).rgb('#0000FF');
   } else {
     milight.zone(1).white(50, function(error) { });
   }
};

setInterval(cache_light(milight_request), interval_milight_request);

// reference: noble/test.js
