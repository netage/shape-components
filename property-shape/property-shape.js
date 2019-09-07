const { LitElement } = require('lit-element')
const $ = require('zepto')
const rdf = require('rdf-ext')
const rdfFetch = require('rdf-fetch-lite')
const N3Parser = require('rdf-parser-n3')
const JsonLdParser = require('rdf-parser-jsonld')
const prefixMap = require('../prefixmap')

function uniqID () {
  return 'ld-' + Math.random().toString(36).substr(2, 16)
};

export class PropertyShape extends LitElement {
  static get properties () {
    return {
      path: { type: String },
      sort: { type: String },
      sortdirection: { type: String },
      sortpath: { type: String },
      refresh: { type: Number },
      hideempty: { type: Boolean },
      bindto: { type: String, attribute: 'bind-to' },
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
    // this.renderRoot = this;

    this._sortdir = 1
    if ($(this).children().length > 1) {
      console.log('multiple children not supported ( tip put multiple elements in a DIV )')
      return
    }
    this._bind = null
    this._workNode = $(this)
    this._loadedIDs = []
  }

  createRenderRoot () {
    return this
  }

  /**
   * getters and setters
   */
  set path (val) {
    // store full URI
    let mapping = prefixMap.resolve(val)
    if (mapping != null) { this._pred = mapping.toString() } else { this._pred = val }
  }

  get path () {
    return this._pred
  }

  set dataGraph (value) {
    this._dataGraph = value
    if (value == null) { this.cleanGraph() } else { this.loadGraph() }
  }

  get dataGraph () {
    return this._dataGraph
  }

  set sort (val) {
    this._sort = val
  }

  get sort () {
    return this._sort
  }

  set sortdirection (val) {
    if (val.toUpperCase() === 'DESC') { this._sortdir = -1 } else { this._sortdir = 1 }
  }

  get sortdirection () {
    return this._sortdir
  }

  set sortpath (val) {
    // store full URI
    let mapping = prefixMap.resolve(val)
    if (mapping != null) { this._sortpath = mapping.toString() } else { this._sortpath = val }
  }
  get sortpath () {
    return this._sortpath
  }

  set bindto (val) {
    // check for last attribute selector, if set use it as attribute
    // selector

    // @TODO we should look at ID binding
    // ID's don't dom tree so could be everywhere
    // has a side effect of not having the properties near the element.

    let workBind = val
    if (val.substring(0, 3) === '../') {
      workBind = val.replace('../', '')
      this._workNode = $(this).parent()
    }

    let l, r
    if ((l = workBind.lastIndexOf('[')) !== -1) {
      r = workBind.lastIndexOf(']')
      this._attr = workBind.substring(l + 1, r)
      // extract attribute selector
      this._bind = workBind.substring(0, l)
    } else { this._bind = workBind }
  }

  get bindto () {
    return this._bind
  }

  firstUpdated () {
    this._original = $(this._workNode).children(this._bind).clone(true, true)
    if (this.__hideempty) {
      $(this._workNode).hide()
    }
    if (this.__refresh) {
      setTimeout(this.refreshGraph.bind(this), this.__refresh * 1000)
    }
  }

  refreshGraph () {
    console.log('in graph refresh')
    this.cleanGraph()
    this.loadGraph()
    setTimeout(this.refreshGraph.bind(this), this.__refresh * 1000)
  }

  /**
   * Graph Functions
   */

  loadGraph () {
    let graph = this._dataGraph.graph
    let uri = this._dataGraph.resource
    let tripleList = graph.match(rdf.namedNode(uri), rdf.namedNode(this.path)).toArray()

    var workList = []
    // var targetNode;
    if (tripleList.length > 0) {
      if (this.__hideempty) {
        $(this._workNode).show()
      }
      if (tripleList.length > 1) { console.log('Found multiple entries for ' + this.path) }

      // Itterate over elements and fill the promise array.
      tripleList.forEach(function (element, index) {
        let object = element.object
        let targetID = uniqID()

        switch (object.termType) {
          case 'NamedNode':
            // check if we have the data in the store if not load it
            let resourceList = graph.match(rdf.namedNode(object.value))
              .toArray()
            if ((resourceList.length === 0 || this.__refresh) && object.value.indexOf('#') === -1) {
              let formats = {
                parsers: new rdf.Parsers({
                  'application/ld+json': JsonLdParser,
                  'text/turtle': N3Parser
                })
              }
              workList.push(rdfFetch(object.value,
                { formats: formats }).then((res) => {
                if (res.status >= 200 && res.status < 300) { return res.dataset() }
                return ({ type: 'node', targetID: targetID, dataset: null, resource: object.value })
              }, function () { console.log('failed fetch of: ' + object.value) }).then((dataset) => {
                if (dataset == null) { return ({ type: 'node', targetID: targetID, dataset: null, resource: object.value }) }
                // check for sort property and
                // extract value
                var value = null
                if (this.hasOwnProperty('_sortpath')) {
                  value = dataset.match(rdf.namedNode(object.value), rdf.namedNode(this._sortpath))
                    .toArray().shift().object.value
                  this._sort = true
                }
                graph = graph.merge(dataset)
                return ({ type: 'node', targetID: targetID, dataset: graph, resource: object.value, value: value })
              }))
            } else {
              var value = null
              if (this.hasOwnProperty('_sortpath')) {
                value = graph.match(rdf.namedNode(object.value), rdf.namedNode(this._sortpath))
                  .toArray().shift().object.value
                this._sort = true
              }
              workList.push(Promise.resolve({ type: 'node', targetID: targetID, dataset: graph, resource: object.value, value: value }))
            }
            break
          case 'Literal':
          default:
            workList.push(Promise.resolve({ type: 'literal', targetID: targetID, value: object.value }))
        }
      }, this)

      Promise.all(workList).then(values => {
        // cleanup values undefined happens when there are errors
        // retrieving the resource
        // @todo how do we handle these ?
        let vcount = values.length - 1
        while (vcount >= 0) {
          if (typeof values[vcount] === 'undefined') { values.splice(vcount, 1) }
          vcount -= 1
        }
        if (this.hasOwnProperty('_sort')) {
          if (this._sortdir === -1) { values.sort(function (a, b) { return (a.value < b.value) ? 1 : ((b.value < a.value) ? -1 : 0) }) } else { values.sort(function (a, b) { return (a.value > b.value) ? 1 : ((b.value > a.value) ? -1 : 0) }) }
        }
        // still need to only add none null datasets.

        values.forEach(function (item, index) {
          if (item.hasOwnProperty('dataset') && item.dataset == null) { return }

          if (index === 0) { $(this._workNode).children(this._bind).first().attr('data-ld', 'true').attr('id', item.targetID) } else {
            let targetNode = this._original.clone().attr('data-ld', 'true').attr('id', item.targetID)
            $(this._workNode).append(targetNode)
          }
          this._loadedIDs.push(item.targetID)
          switch (item.type) {
            case 'node':
              if (item.dataset != null) {
                this.closestDescendant(this, 'property-shape#' + item.targetID + ', #' + item.targetID + ' property-shape', true)
                  .each(function (i) {
                    this.dataGraph = { graph: item.dataset, resource: item.resource } // just put item
                  })
              }
              break
            case 'literal':
              if (this.hasOwnProperty('_bind') && this._bind != null) {
                let itemNode
                if (this._bind.indexOf('.') !== 0) {
                  itemNode = $(this._workNode).children(this._bind + '#' + item.targetID + ', #' + item.targetID + ' ' + this._bind)
                } else {
                  itemNode = $(this._workNode).children('#' + item.targetID + this._bind + ', #' + item.targetID + ' ' + this._bind)
                }

                if (this.hasOwnProperty('_attr')) { $(itemNode).attr(this._attr, item.value) } else { $(itemNode).text(item.value) }
              } else {
                let x = $('<span>').attr('id', item.targetID).text(item.value)
                $(this).append(x)
              }
              break
          }
        }, this)
      })
    }
  }

  cleanGraph (e) {
    this.closestDescendant(this, 'property-shape', true)
      .each(function (i) {
        this.cleanGraph()
      })
    this._loadedIDs.forEach(function (element) {
      $('#' + element).remove()
    })
    if (this._loadedIDs.length > 0) {
      let targetNode = this._original.clone()
      $(this._workNode).append(targetNode)
    }
    if (this.__hideempty) {
      $(this._workNode).hide()
    }
  }

  /**
   * Support functions
   */
  closestDescendant (element, selector, findAll) {
    if (!selector || selector === '') {
      return $()
    }

    findAll = !!findAll

    var resultSet = $()

    $(element).each(function () {
      var $this = $(this)

      // breadth first search for every matched node,
      // go deeper, until a child was found in the current subtree or the
      // leave was reached.
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
window.customElements.define('property-shape', PropertyShape)
