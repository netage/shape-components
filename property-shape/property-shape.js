import rdfFetch from '@rdfjs/fetch'
const { LitElement } = require('lit-element')
const rdf = require('rdf-ext')
// const rdfFetch = require('@rdfjs/fetch')
const prefixMap = require('../prefixmap/prefixmap.js')
const cf = require('clownface')

function uniqID () {
  return 'ld-' + Math.random().toString(36).substr(2, 16)
};

export class PropertyShape extends LitElement {
  static get properties () {
    return {
      path: { type: String },
      targetClass: { type: String, attribute: 'target-class' },
      sort: { type: String },
      inbox: { type: String },
      ldnenabled: { type: Boolean },
      sortdirection: { type: String },
      sortpath: { type: String },
      refresh: { type: Number },
      hideempty: { type: Boolean },
      singleton: { type: Boolean },
      ldnstyle: { type: String, attribute: 'ldn-style' },
      bindto: { type: String, attribute: 'bind-to' },
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
    // this.renderRoot = this;

    this._sortdir = 1
    if (this.children.length > 1) {
      console.log('multiple children not supported ( tip put multiple elements in a DIV )')
      return
    }
    this._bind = null
    this._singleton = false
    this._workNode = this
    this._loadedIDs = []
    this._sort = false
    this._dataGraph = null
  }

  createRenderRoot () {
    return this
  }

  /**
   * getters and setters
   */
  set path (val) {
    // store full URI
    const mapping = prefixMap.resolve(val)
    if (mapping != null) { this._pred = mapping.toString() } else { this._pred = val }
  }

  get path () {
    return this._pred
  }

  set targetClass (val) {
    // check if the mapping is actually a abbreviation
    // @TODO lets do this with a proper check first on a colon
    const mapping = prefixMap.resolve(val)
    let classURI
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

  set sort (val) {
    this._sort = val
  }

  get sort () {
    return this._sort
  }

  set singleton (val) {
    this._singleton = val
  }

  get singleton () {
    return this._singleton
  }

  set sortdirection (val) {
    if (val.toUpperCase() === 'DESC') { this._sortdir = -1 } else { this._sortdir = 1 }
  }

  get sortdirection () {
    return this._sortdir
  }

  set sortpath (val) {
    // store full URI
    const mapping = prefixMap.resolve(val)
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
      this._workNode = this.parentElement
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
    if (this._bind) {
      const x = this._workNode.querySelectorAll(this._bind)
      if (x.length > 0) {
        this._original = x[0].cloneNode(true)
      }
    } else {
      if (this._workNode.children.length > 0) {
        this._original = this._workNode.children[0].cloneNode(true)
      } else {
        this._original = this._workNode.cloneNode(true)
      }
    }

    if (this.__hideempty) {
      this._workNode.style.display = 'none'
    }
    if (this.__refresh) {
      setTimeout(this.refreshGraph.bind(this), this.__refresh * 1000)
    }

    if (this.__inbox && this.ldnenabled) {
      setTimeout(this.processInbox.bind(this), 5000)
      // setTimeout(this.cleanGraph.bind(this),20000)
      setTimeout(this.processInbox.bind(this), 10000)
    }
  }

  processInbox () {
    console.log(' need to work on inbox:' + this.__inbox)
    rdfFetch(this.__inbox,
      { factory: rdf }).then((res) => {
      return res.dataset()
    }).then((dataset) => {
      console.log('fetched inbox')
      if (this.__ldnstyle) {
        this.children.forEach(function (el, i) {
          el.classList.remove(this.__ldnstyle)
        })
      }
      const inboxItems = dataset.match(rdf.namedNode(this.__inbox), rdf.namedNode('http://www.w3.org/ns/ldp#contains'))
      const self = this
      inboxItems.forEach(function (item) {
        const targetID = uniqID()
        const targetNode = self.addNode(targetID, 0)
        if (self.__ldnstyle) {
          targetNode.addClass(self.__ldnstyle)
        }

        // now load the item URI and propagate it to the new node
        rdfFetch(item.object.value,
          { factory: rdf }).then((res) => {
          return res.dataset()
        }).then((dataset) => {
          // now lets see if we can load it.
          console.log('loaded inbox item')
          self.closestDescendant(self, 'property-shape#' + targetID + ', #' + targetID + ' property-shape', true)
            .forEach(function (el, i) {
              el.dataGraph = { graph: dataset, resource: item.object.value } // just put item
            })
        }).catch((err) => {
          console.error(err.message)
        })
      }, this)
    }).catch((err) => {
      console.error(err.message)
    })
  }

  // reload the graph
  // this ugly now!
  /*
    if we go the into the LDN inbox way we should keep track of what is new
    and insert that at the right spot, so no more reloading, just add the inbox element
    either at the end or at the top
    we could even do a css class for new, which we reset on a new notification
    this would need some sort of standard inbox worker inside the node shapes which you can call

    Thought line, would flux make sense here ?

  */
  refreshGraph () {
    if (!this._singleton) {
      this.cleanGraph()
    }
    this.loadGraph()
    setTimeout(this.refreshGraph.bind(this), this.__refresh * 1000)
  }

  /**
   * Graph Functions
   */

  /**
    * this adds a node to the element
    */
  addNode (nodeID, index) {
    let targetNode
    if (this._singleton) {
      const tmpNode = this._workNode.firstElementChild
      tmpNode.setAttribute('data-ld', 'true')
      tmpNode.setAttribute('data-ldid', nodeID)
    }
    if (index === 0) {
      let tmpNode
      if (this._bind) {
        tmpNode = this._workNode.querySelectorAll(this._bind)[0]
      } else if (this._workNode.children.length > 0) {
        tmpNode = this._workNode.firstElementChild
      }
      if (tmpNode) {
        tmpNode.setAttribute('data-ld', 'true')
        tmpNode.setAttribute('data-ldid', nodeID)
      }
    } else {
      targetNode = this._original.cloneNode(true)
      targetNode.setAttribute('data-ld', 'true')
      targetNode.setAttribute('data-ldid', nodeID)
      if (this._sortdir === -1) {
        this._workNode.insertBefore(targetNode, this._workNode.firstChild)
      } else {
        this._workNode.appendChild(targetNode)
      }
    }
    this._loadedIDs.push(nodeID)
    return targetNode
  }

  loadGraph () {
    let graph = this._dataGraph.graph
    const uri = this._dataGraph.resource
    const tripleList = graph.match(rdf.namedNode(uri), rdf.namedNode(this.path)).toArray()

    const workList = []
    // var targetNode;
    if (tripleList.length > 0) {
      // Itterate over elements and fill the promise array.
      tripleList.forEach(function (element, index) {
        const object = element.object
        const targetID = uniqID()

        switch (object.termType) {
          case 'NamedNode': {
            // check if we have the data in the store if not load it
            const resourceList = graph.match(rdf.namedNode(object.value))
              .toArray()
            if ((resourceList.length === 0 || this.__refresh) && object.value.indexOf('#') === -1) {
              workList.push(rdfFetch(object.value,
                { factory: rdf }).then((res) => {
                if (res.status >= 200 && res.status < 300) {
                  return res.dataset()
                }
                return ({ type: 'node', targetID: targetID, dataset: null, resource: object.value })
              }, function () { console.log('failed fetch of: ' + object.value) }).then((dataset) => {
                if (dataset == null) { return ({ type: 'node', targetID: targetID, dataset: null, resource: object.value }) }
                // check for sort property and
                // extract value
                let value = null
                if (Object.prototype.hasOwnProperty.call(this, '_sortpath')) {
                  value = dataset.match(rdf.namedNode(object.value), rdf.namedNode(this._sortpath))
                    .toArray().shift().object.value
                  this._sort = true
                }
                // this should have a check on dataset @todo
                graph = graph.merge(dataset)

                return ({ type: 'node', targetID: targetID, dataset: graph, resource: object.value, value: value })
              }))
            } else {
              let value = null
              if (Object.prototype.hasOwnProperty.call(hasOwnProperty, '_sortpath')) {
                value = graph.match(rdf.namedNode(object.value), rdf.namedNode(this._sortpath))
                  .toArray().shift().object.value
                this._sort = true
              }
              workList.push(Promise.resolve({ type: 'node', targetID: targetID, dataset: graph, resource: object.value, value: value }))
            }
            break
          }
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
          if (typeof values[vcount] === 'undefined') { values.splice(vcount, 1) } else if (typeof values[vcount].dataset !== 'undefined' & values[vcount].dataset != null) {
            // is the resource available in the dataset at all?
            const list = values[vcount].dataset.match(rdf.namedNode(values[vcount].resource))
            if (list.length === 0) {
              values.splice(vcount, 1)
            }
          }
          vcount -= 1
        }

        if (this._sort) {
          values.sort(function (a, b) { return (a.value > b.value) ? 1 : ((b.value > a.value) ? -1 : 0) })
        }

        values.forEach(function (item, index) {
          if (Object.prototype.hasOwnProperty.call(item, 'dataset') && item.dataset == null) { return }

          switch (item.type) {
            case 'node':
              if (this.__hideempty) {
                this._workNode.style.display = ''
              }
              if (item.dataset != null) {
                // check if we have a target class, then match it on the resource, if the classlist is empty return
                if (Object.prototype.hasOwnProperty.call(this, '_class')) {
                  let classList = []
                  classList = graph.match(rdf.namedNode(item.resource), rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), rdf.namedNode(this._class))
                  // if no match target class is missing, so returnl
                  if (classList.length === 0) {
                    if (this.__hideempty) {
                      this._workNode.style.display = 'none'
                    }
                    return
                  }
                }
                this.addNode(item.targetID, index)
                this.closestDescendant(this, 'property-shape[data-ldid="' + item.targetID + '"], [data-ldid="' + item.targetID + '"] property-shape', true)
                  .forEach(function (el, i) {
                    el.dataGraph = { graph: item.dataset, resource: item.resource } // just put item
                  })
              }
              break
            case 'literal':
              if (this.__hideempty & item.value === '') {
                this._workNode.style.display = 'none'
              } else {
                this.addNode(item.targetID, index)
                if (this.__hideempty) {
                  this._workNode.style.display = ''
                }
                if (Object.prototype.hasOwnProperty.call(this, '_bind') && this._bind != null) {
                  let itemNodes
                  if (this._bind.indexOf('.') !== 0) {
                    itemNodes = this._workNode.querySelectorAll(this._bind + '[data-ldid="' + item.targetID + '"], [data-ldid="' + item.targetID + '"] ' + this._bind)
                  } else {
                    itemNodes = this._workNode.querySelectorAll('[data-ldid="' + item.targetID + this._bind + '"], [data-ldid="' + item.targetID + '"] ' + this._bind)
                  }

                  if (Object.prototype.hasOwnProperty.call(this, '_attr')) {
                    itemNodes.forEach(function (el, i) {
                      el.setAttribute(this._attr, item.value)
                    }.bind(this))
                  } else {
                    itemNodes.forEach(function (el, i) {
                      el.textContent = item.value
                    })
                  }
                } else {
                  this.insertAdjacentHTML('afterbegin', '<span data-ldid="' + item.targetID + '">' + item.value + '</span>')
                }
              }
              break
          }
        }, this)
      })
    }
  }

  getGraph () {
    const output = cf({ dataset: rdf.dataset() })
    if (this._dataGraph) {
      const newNode = output.node(output.namedNode(this._dataGraph.resource))
      // use temp value
      this._loadedIDs.forEach(element => {
        let val
        if (this._attr && this._attr === 'value') {
          val = document.querySelector('[data-ldid="' + element + '"]').value
        } else if (this._attr) {
          val = document.querySelector('[data-ldid="' + element + '"]').getAttribute(this._attr)
        } else {
          val = document.querySelector('[data-ldid="' + element + '"]').innerHTML
        }

        newNode.addOut(output.namedNode(this.path), val)
      })
    } else {
      const newNode = output.node(rdf.namedNode(''))
      let val
      let workNode
      if (this.children.length === 0) {
        workNode = this
      } else {
        workNode = this.firstElementChild
      }
      if (this._attr && this._attr === 'value') {
        val = workNode.value
      } else if (this._attr) {
        val = workNode.getAttribute(this._attr)
      } else {
        val = workNode.innerHTML
      }

      newNode.addOut(output.namedNode(this.path), val)
    }

    return output.dataset
  }

  cleanGraph (e) {
    if (this._singleton) {
      return
    }
    this._loadedIDs.forEach(function (element) {
      const workNode = document.querySelector('[data-ldid="' + element + '"]')
      if (workNode !== null) {
        workNode.parentNode.removeChild(workNode)
      }
    })

    // cleanup the left overs
    this.closestDescendant(this, 'property-shape', true)
      .forEach(function (item, i) {
        item.cleanGraph()
      })
    // why is this working ...
    if (this._loadedIDs.length > 0) {
      this._workNode.appendChild(this._original.cloneNode(true))
    }
    if (this.__hideempty) {
      this._workNode.style.display = 'none'
    }
  }

  /**
   * Support functions
   */
  closestDescendant (element, selector, findAll) {
    if (!selector || selector === '') {
      return []
    }

    findAll = !!findAll

    const resultSet = []

    // breadth first search for every matched node,
    // go deeper, until a child was found in the current subtree or the
    // leave was reached.
    const queue = []
    queue.push(element)
    while (queue.length > 0) {
      const node = queue.shift()
      for (let i = 0; i < node.children.length; ++i) {
        const child = node.children[i]
        if (child.matches(selector)) {
          resultSet.push(child) // well, we found one
          if (!findAll) {
            return false // stop processing
          }
        } else {
          queue.push(child) // go deeper
        }
      }
    }
    return resultSet
  }
}

// Register the element with the browser
window.customElements.define('property-shape', PropertyShape)
