var xtag = require('x-tag');
var $ = require('zepto');
var rdf = require('rdf-ext');
var prefixMap = require('../prefixmap');

module.exports = xtag.register('node-shape', {
	// content : require('./template.html'),
	lifecycle : {
		inserted : function() {
		},
	},
	accessors : {
		targetClass : {
			attribute : {},
			set : function(val) {
				// Store full classname URI
				let mapping = prefixMap.resolve(val)
				var classURI;
				if (mapping != null)
					classURI = mapping.toString();
				else
					classURI = val;

				this._class = classURI;
			},
			get : function() {
				return this._class
			}
		},
	},
	methods: {
		cleanGraph : function(e) {
			// remove all child elemtent with the 'data-ld-created' attribute
			closestDescendant(this,'property-shape', true).each(
					function(i) {
						this.cleanGraph();
					});
		},
		loadGraph: function(graph,uri){
			let resourceList = graph.match(null, null,
					rdf.namedNode(this.targetClass)).toArray();

			if (resourceList.length > 0) {

				let resource = resourceList.shift().subject.value

				// here we should call all our closestDescendent node-tag
				// elements
				closestDescendant(this,'property-shape', true).each(
						function(i) {
							this.loadGraph(graph, resource);
								
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
