var xtag = require('x-tag');
var $ = require('zepto');
var rdf = require('rdf-ext');
const rdfFetch = require('rdf-fetch-lite')
const N3Parser = require('rdf-parser-n3')
const JsonLdParser = require('rdf-parser-jsonld')
var prefixMap = require('../prefixmap');

function uniqID()
{
	return 'ld-' + Math.random().toString(36).substr(2, 16);
};

module.exports = xtag.register('property-shape', {
	lifecycle : {
		inserted : function() {
		},
		created : function() {
			this._original = $(this).children().clone(true,true);
			if($(this).children().length > 1)
			{
				console.log("multiple children not supported ( tip put multiple elements in a DIV )");
				return; 
			}
			this._loadedIDs = new Array();
		}
	},
	accessors : {
		path: {
			attribute:{},
			set: function(val) {
				// store full URI
				let mapping  = prefixMap.resolve(val)
				if(mapping != null)
					this._pred = mapping.toString();
				else
					this._pred = val
			},
			get: function()
			{
				return this._pred
			}
		},
		sort: {
			attribute:{},
			set: function(val) {
				this._sort = val
			},
			get: function()
			{
				return this._sort
			}
		},
		sortpath: {
			attribute:{},
			set: function(val) {
				// store full URI
				let mapping  = prefixMap.resolve(val)
				if(mapping != null)
					this._sortpath = mapping.toString();
				else
					this._sortpath = val
			},
			get: function()
			{
				return this._sortpath
			}
		},
		transform: {
			attribute:{},
			set: function(val) {
				this._trans = val;
			},
			get: function()
			{
				return this._trans
			}
		},
		bindTo : {
			attribute: {},
			set: function(val){
				// check for last attribute selector, if set use it as attribute selector
				var l,r;
				if((l = val.lastIndexOf('[')) != -1)
					{
						r= val.lastIndexOf(']');
						this._attr = val.substring(l+1,r);
					// extract attribute selector
						this._bind = val.substring(0,l); 
					}
				else
					this._bind = val;
			},
			get: function(){
				return this._bind;
			}
		}
	},
	methods : {
		cleanGraph: function(e) {
			closestDescendant(this,'property-shape', true).each(
					function(i) {
						this.cleanGraph();
					});
			this._loadedIDs.forEach(function(element){
				$('#'+element).remove();
			});
			if(this._loadedIDs.length >0 )
				{
				let targetNode = this._original.clone();
				$(this).append(targetNode);

				}
		},
		loadGraph: function(graph,uri)
		{
			let tripleList = graph
		    .match(rdf.namedNode(uri), rdf.namedNode(this.path))
		    .toArray();
		var object;
		var workList = []
		//var targetNode;
		if(tripleList.length > 0)
		{
			if(tripleList.length > 1)
				console.log("Found multiple entries for "+ this.path);
			
			// Itterate over elements and fill the promise array.
			tripleList.forEach(function(element,index){
				let object = element.object
				let targetID = uniqID();
			
				switch(object.termType)
				{
					case "NamedNode":
						// check if we have the data in the store if not load it
						let resourceList = graph.match(rdf.namedNode(object.value))
					    .toArray();
						if(resourceList.length == 0 && object.value.indexOf('#') === -1)
							{
								let formats = {
									parsers: new rdf.Parsers({
										 'application/ld+json': JsonLdParser,
									  })
								}
								workList.push(rdfFetch(object.value,
											{formats: formats}).then((res) => {
												if(res.status >= 200 && res.status < 300)
													return res.dataset()
												else
													return null;
										}).then((dataset) => {
											if(dataset == null)
												return ({ type:"node",targetID: targetID, dataset:null,resource:object.value});
											// check for sort property and extract value
											var value=null;
											if(this.hasOwnProperty('_sortpath'))
											{
												value = dataset.match(rdf.namedNode(object.value), rdf.namedNode(this._sortpath))
											    .toArray().shift().object.value;
												this._sort = true;
											}
											graph = graph.merge(dataset);
											return ({ type:"node",targetID: targetID, dataset:graph,resource:object.value,value:value});
								}).catch((err) => {
										  console.log(err.message)
										  return null
								}));
							}
						else
							{
							var value=null;
							if(this.hasOwnProperty('_sortpath'))
							{
								value = graph.match(rdf.namedNode(object.value), rdf.namedNode(this._sortpath))
							    .toArray().shift().object.value;
								this._sort = true;
							}
							workList.push(Promise.resolve({type:"node",targetID: targetID,dataset: graph, resource: object.value,value:value}))
							}
						break;
					case "Literal":
					default:
						workList.push(Promise.resolve({type: "literal",targetID: targetID,value:object.value}))
				}
			},this);
			
			Promise.all(workList).then(values => {
				
				if(this.hasOwnProperty('_sort'))
					values.sort(function(a,b) {return (a.value > b.value) ? 1 : ((b.value > a.value) ? -1 : 0);})
				// still need to only add none null datasets.
				values.forEach(function(item,index){
				if(item.hasOwnProperty('dataset') && item.dataset == null)
					return;
				if(index ==0)
					{
						$(this).children().first().attr("data-ld","true").attr("id",item.targetID);
					}
					else
					{
						let targetNode = this._original.clone().attr("data-ld","true").attr("id",item.targetID);
						$(this).append(targetNode);
					}
				this._loadedIDs.push(item.targetID);	
					switch(item.type)
					{
					case 'node':
						if(item.dataset != null)
						closestDescendant(this,'property-shape#'+item.targetID+', #'+item.targetID+' property-shape',true).each(function(i){
							this.loadGraph(item.dataset,item.resource);
						});   
						break;
					case 'literal':
						if (this.hasOwnProperty('_bind')) {
							// build CSS query
							var cssPath;
							// check if bind starts with . or is a element nam
							if(this._bind.indexOf('.') != 0 )
								cssPath = this.bindTo+'#'+item.targetID+', #'+item.targetID+' '+this.bindTo;
							else
								cssPath = '#'+item.targetID+this.bindTo+', #'+item.targetID+' '+this.bindTo
							if (this.hasOwnProperty('_attr')) 
								$(this).children(cssPath).attr(this._attr,
										item.value);
							else
								$(this).children(cssPath).text(item.value);
						}
						else
							{
							let x =$("<span>").attr("id",item.targetID).text(item.value);
							$(this).append(x);
							}
						break;
					}
				},this)
			});
		}
		}
	}
});

function closestDescendant(element,selector, findAll) {

    if (!selector || selector === '') {
        return $();
    }

    findAll = findAll ? true : false;

    var resultSet = $();
    
    $(element).each(function() {

        var $this = $(this);

        // breadth first search for every matched node,
        // go deeper, until a child was found in the current subtree or the leave was reached.
        var queue = [];
        queue.push($this);
        while (queue.length > 0) {
            var node = queue.shift();
            var children = node.children();
            for (var i = 0; i < children.length; ++i) {
                var $child = $(children[i]);
                if ($child.is(selector)) {
                    resultSet.push($child[0]); //well, we found one
                    if (!findAll) {
                        return false; //stop processing
                    }
                } else {
                    queue.push($child); //go deeper
                }
            }
        }
    });

    return resultSet;
}

