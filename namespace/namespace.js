const namespace = require('@rdfjs/namespace')
var loadedPref = require('assets/prefixmap.json')
var list = {}
for(var index in loadedPref) {
    list[index] = namespace(loadedPref[index]);
}
const ns = list

module.exports = ns