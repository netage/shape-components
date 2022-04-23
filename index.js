require('./prefixmap/prefixmap.js')
require('./property-shape/property-shape.js')
require('./node-shape/node-shape.js')

const rdfFetch = require('@rdfjs/fetch')
const rdf = require('rdf-ext')

const ShapeComponent = function (id, options) {
  this.loadFromUrl = function (url) {
    if (this.rootElement) {
      rdfFetch(url, { factory: rdf }).then((res) => {
        return res.dataset()
      }).then((dataset) => {
        this.rootElement.dataGraph = { graph: dataset, resource: url }
      })
    }
  }

  this.loadFromJson = function (data) {

  }

  this.getGraph = function (resource) {
    const graph = this.rootElement.getGraph(resource)
    // console.log(turtle`${graph}`.toString())
    return graph
  }

  this.url = options.url || null
  this.rootElement = document.querySelector(id)
  // only allow node-shape as start element
  if (this.rootElement.localName !== 'node-shape') {
    this.rootElement = null
  }

  if (this.url && this.rootElement) {
    this.loadFromUrl(this.url)
  }

  return this
}

global.ShapeComponent = ShapeComponent
