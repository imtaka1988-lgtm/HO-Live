// Deprecated compatibility shim.
//
// The live callback implementation is centralized in liveCallbackKeyGuard.js.
// Keeping this export avoids duplicate callback logic if older code imports this file.
module.exports = require("./liveCallbackKeyGuard");
