var rdf = require('rdf-ext');

const prefixes = rdf.prefixMap();

var loadedPref = require('assets/prefixmap.json');

prefixes.addAll(loadedPref);

module.exports = prefixes;