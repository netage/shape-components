// Import LitElement base class and html helper function
const { LitElement } = require('lit-element')
const prefixes = require('../prefixmap')
const rdf = require('rdf-ext')
const $ = require('zepto')

export class NodeShape extends LitElement {
  /**
   * Define properties. Properties defined here will be automatically
   * observed.
   */
  static get properties () {
    return {
      targetClass: { type: String, attribute: 'target-class' },
      dataGraph: { type: Object,
        reflect: false,
        attribute: false }
    }
  }

  /**
   * In the element constructor, assign default property values.
   */
  constructor () {
    // Must call superconstructor first.
    super()

    // Initialize properties
    this.loadComplete = false
    // this.targetClass = null;
    // this.dataGraph = null;
  }
  // we don't want
  createRenderRoot () {
    return this
  }

  set targetClass (val) {
    let mapping = prefixes.resolve(val)
    var classURI
    if (mapping != null) { classURI = mapping.toString() } else { classURI = val }

    this._class = classURI
  }

  get targetClass () {
    return this._class
  }

  set dataGraph (value) {
    this._dataGraph = value
    if (value == null) { this.cleanGraph() } else { this.loadGraph() }
  }

  get dataGraph () {
    return this._dataGraph
  }

  loadGraph () {
    let graph = this._dataGraph.graph
    let resourceList = graph.match(null, null,
      rdf.namedNode(this.targetClass)).toArray()

    if (resourceList.length > 0) {
      let resource = resourceList.shift().subject.value

      // here we should call all our closestDescendent node-tag
      // elements
      this.closestDescendant(this, 'property-shape', true).each(
        function (i) {
          this.dataGraph = { graph: graph, resource: resource }
        })
    }
  }

  cleanGraph (e) {
    this.closestDescendant(this, 'property-shape', true)
      .each(function (i) {
        this.cleanGraph()
      })
  }

  closestDescendant (element, selector, findAll) {
    if (!selector || selector === '') {
      return $()
    }

    findAll = !!findAll

    var resultSet = $()

    $(element).each(function () {
      var $this = $(this)

      // breadth first search for every matched node,
      // go deeper, until a child was found in the current subtree or the leave was reached.
      var queue = []
      queue.push($this)
      while (queue.length > 0) {
        var node = queue.shift()
        var children = node.children()
        for (var i = 0; i < children.length; ++i) {
          var $child = $(children[i])
          if ($child.is(selector)) {
            resultSet.push($child[0]) // well, we found one
            if (!findAll) {
              return false // stop processing
            }
          } else {
            queue.push($child) // go deeper
          }
        }
      }
    })

    return resultSet
  }
}

// Register the element with the browser
window.customElements.define('node-shape', NodeShape)
