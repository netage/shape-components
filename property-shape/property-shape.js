const { LitElement } = require('lit-element')
const $ = require('zepto')
const rdf = require('rdf-ext')
const rdfFetch = require('rdf-fetch')
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
      targetClass: { type: String, attribute: 'target-class' },
      sort: { type: String },
      inbox: { type: String },
      ldnenabled: { type: Boolean },
      sortdirection: { type: String },
      sortpath: { type: String },
      refresh: { type: Number },
      hideempty: { type: Boolean },
      ldnstyle: { type: String,attribute: 'ldn-style'},
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
    this._sort = false
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

  set targetClass (val) {
    // check if the mapping is actually a abbreviation
    // @TODO lets do this with a proper check first on a colon
    let mapping = prefixMap.resolve(val)
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

    if(this.__inbox && this.ldnenabled)
    {
        setTimeout(this.processInbox.bind(this), 5000);
        //setTimeout(this.cleanGraph.bind(this),20000)
        setTimeout(this.processInbox.bind(this), 10000);

    }
  }

  processInbox(){
    let formats = {
      parsers: new rdf.Parsers({
        'application/ld+json': JsonLdParser,
        'text/turtle': N3Parser
      })
    }
    console.log(' need to work on inbox:' + this.__inbox)
    rdfFetch(this.__inbox,
    { formats: formats }).then((res) => {
      return res.dataset()
  }).then((dataset) => {
    console.log("fetched inbox");
    if(this.__ldnstyle)
      $(this).children().removeClass(this.__ldnstyle)
    let inboxItems = dataset.match(rdf.namedNode(this.__inbox), rdf.namedNode('http://www.w3.org/ns/ldp#contains'))
    var self = this
    inboxItems.forEach(function(item){
      let targetID = uniqID()
     let targetNode = self.addNode(targetID,0)
     if(self.__ldnstyle)
      targetNode.addClass(self.__ldnstyle)

      // now load the item URI and propagate it to the new node
      rdfFetch(item.object.value,
        { formats: formats }).then((res) => {
          return res.dataset()
        }).then((dataset) => {
          // now lets see if we can load it.
          console.log('loaded inbox item')
          self.closestDescendant(self, 'property-shape#' + targetID + ', #' + targetID + ' property-shape', true)
                  .each(function (i) {
                    this.dataGraph = { graph: dataset, resource: item.object.value } // just put item
                  })
        }).catch((err) => {
          console.error(err.message)
        })
    },this)
    

    
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
    //console.log('in graph refresh')
    this.cleanGraph()
    this.loadGraph()
    setTimeout(this.refreshGraph.bind(this), this.__refresh * 1000)
  }

  /**
   * Graph Functions
   */

   /**
    * this adds a node to the element
    */
  addNode (nodeID,index){
    let targetNode
    if (index === 0) { 
      $(this._workNode).children(this._bind).first().attr('data-ld', 'true').attr('id', nodeID)
     } else {
      targetNode = this._original.clone().attr('data-ld', 'true').attr('id', nodeID)
      if(this._sortdir == -1)
        $(this._workNode).prepend(targetNode)
      else
        $(this._workNode).append(targetNode)
    }
    this._loadedIDs.push(nodeID)
    return targetNode
  }


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
                if (dataset.hasOwnProperty('_datasetFactory')) {
                  graph = graph.merge(dataset)
                }
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
          else if( typeof values[vcount].dataset !== 'undefined' & values[vcount].dataset !=null)
          {
            // is the resource available in the dataset at all?
            let list = values[vcount].dataset.match(rdf.namedNode(values[vcount].resource))
            if(list.length==0)
              values.splice(vcount, 1)
          }
          vcount -= 1
        }

        if(this._sort)
          values.sort(function (a, b) { return (a.value > b.value) ? 1 : ((b.value > a.value) ? -1 : 0) })

        values.forEach(function (item, index) {
          if (item.hasOwnProperty('dataset') && item.dataset == null) { return }

          switch (item.type) {
            case 'node':
              if (item.dataset != null) {
                // check if we have a target class, then match it on the resource, if the classlist is empty return
                if(this.hasOwnProperty('_class')){
                  let classList = []
                  classList = graph.match(rdf.namedNode(item.resource),rdf.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"),rdf.namedNode(this._class))
                  // if no match target class is missing, so returnl
                  if(classList.length == 0) { 
                    if (this.__hideempty) {
                      $(this._workNode).hide()
                    }
                    return  
                  }
                }
                this.addNode(item.targetID,index)
                this.closestDescendant(this, 'property-shape#' + item.targetID + ', #' + item.targetID + ' property-shape', true)
                  .each(function (i) {
                    this.dataGraph = { graph: item.dataset, resource: item.resource } // just put item
                  })
              }
              break
            case 'literal':
              if (this.__hideempty & item.value=='') {
                $(this._workNode).hide()
              }
              else {
                this.addNode(item.targetID,index)
                if(this.__hideempty)
                  $(this._workNode).show()
                if (this.hasOwnProperty('_bind') && this._bind != null) {
                  let itemNode
                  if (this._bind.indexOf('.') !== 0) {
                    itemNode = $(this._workNode).children(this._bind + '#' + item.targetID + ', #' + item.targetID + ' ' + this._bind)
                  } else {
                    itemNode = $(this._workNode).children('#' + item.targetID + this._bind + ', #' + item.targetID + ' ' + this._bind)
                  }

                  if (this.hasOwnProperty('_attr')) { $(itemNode).attr(this._attr, item.value) } else { $(itemNode).text(item.value) }
                } else {
                  let newNode = $('<span>').attr('id', item.targetID).text(item.value)
                  $(this).append(newNode)
                }
              }
              break
          }
        }, this)
      })
    }
  }

  cleanGraph (e) {
    this._loadedIDs.forEach(function (element) {
      $('#' + element).remove()
    })

    // cleanup the left overs
    this.closestDescendant(this, 'property-shape', true)
      .each(function (i) {
        this.cleanGraph()
      })
    // why is this working ... 
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
