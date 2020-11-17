// Import LitElement base class and html helper function
const { LitElement } = require('lit-element')
const prefixes = require('../prefixmap')
const cf = require('clownface')
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
      dataGraph: {
        type: Object,
        reflect: false,
        attribute: false
      }
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

  // we don't want shadow dom
  createRenderRoot () {
    return this
  }

  set targetClass (val) {
    // check if the mapping is actually a abbreviation
    // @TODO lets do this with a proper check first on a colon
    const mapping = prefixes.resolve(val)
    let classURI
    if (mapping != null) { classURI = mapping.toString() } else { classURI = val }

    this._class = classURI
  }

  get targetClass () {
    return this._class
  }

  // set the location of the graph, if null it means that the graph needs to be cleaned
  set dataGraph (value) {
    this._dataGraph = value
    if (value == null) { this.cleanGraph() } else { this.loadGraph() }
  }

  get dataGraph () {
    return this._dataGraph
  }

  loadGraph () {
    const graph = this._dataGraph.graph
    const resourceList = graph.match(null, null,
      rdf.namedNode(this.targetClass)).toArray()

    if (resourceList.length > 0) {
      this._resource = resourceList.shift().subject.value
      const resource = this._resource
      // here we should call all our closestDescendent node-tag
      // elements
      this.closestDescendant(this, 'property-shape', true).each(
        function (i) {
          this.dataGraph = { graph: graph, resource: resource }
        })
    }
  }

  // retrieve the contents of the graph again.
  getGraph () {
    //
    const output = cf({ dataset: rdf.dataset() })
    this.closestDescendant(this, 'property-shape', true)
      .each(function (i) {
        output.dataset.addAll(this.getGraph())
      })
    return output.dataset
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

    const resultSet = $()

    $(element).each(function () {
      const $this = $(this)

      // breadth first search for every matched node,
      // go deeper, until a child was found in the current subtree or the leave was reached.
      const queue = []
      queue.push($this)
      while (queue.length > 0) {
        const node = queue.shift()
        const children = node.children()
        for (let i = 0; i < children.length; ++i) {
          const $child = $(children[i])
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
