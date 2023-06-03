(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(["./client"], function(CoCreateUsers) {
        	return factory(CoCreateUsers)
        });
    } else if (typeof module === 'object' && module.exports) {
      const CoCreateUsers = require("./server.js")
      module.exports = factory(CoCreateUsers);
    } else {
        root.returnExports = factory(root["./client.js"]);
  }
}(typeof self !== 'undefined' ? self : this, function (CoCreateUsers) {
  return CoCreateUsers;
}));