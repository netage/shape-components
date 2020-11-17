const rdf = require('rdf-ext')

const prefixes = rdf.prefixMap()

const loadedPref = require('assets/prefixmap.json')

prefixes.addAll(loadedPref)

module.exports = prefixes
