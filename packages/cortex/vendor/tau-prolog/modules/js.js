export default function( pl ) {

	var predicates = function() {
		
		return {
			
			// global/1
			"global/1": function( thread, point, atom ) {
				thread.prepend( [new pl.type.State( point.goal.replace( new pl.type.Term( "=", [atom.args[0], pl.fromJavaScript.apply(pl.__env)] ) ), point.substitution, point )] );
			},
			
			// apply/3:
			"apply/3": [
				new pl.type.Rule(new pl.type.Term("apply", [new pl.type.Var("X"),new pl.type.Var("Y"),new pl.type.Var("Z")]), new pl.type.Term(",", [new pl.type.Term("global", [new pl.type.Var("G")]),new pl.type.Term("apply", [new pl.type.Var("G"),new pl.type.Var("X"),new pl.type.Var("Y"),new pl.type.Var("Z")])]))
			],
			
			// apply/4
			"apply/4": function( thread, point, atom ) {
				var context = atom.args[0], name = atom.args[1], args = atom.args[2], result = atom.args[3];
				if( pl.type.is_variable( context ) || pl.type.is_variable( name ) || pl.type.is_variable( args ) ) {
					thread.throw_error( pl.error.instantiation( atom.indicator ) );
				} else if( !pl.type.is_atom( name ) && (!pl.type.is_js_object( name ) || typeof name.value !== "function") ) {
					thread.throw_error( pl.error.type( "atom_or_JSValueFUNCTION", name, atom.indicator ) );
				} else if( !pl.type.is_list( args ) ) {
					thread.throw_error( pl.error.type( "list", args, atom.indicator ) );
				}
				var ctx = context.toJavaScript();
				var fn = pl.type.is_atom( name ) ? ctx[name.id] : name.toJavaScript();
				if( typeof fn === "function" ) {
					var pointer = args;
					var pltojs;
					var arr = [];
					while( pointer.indicator === "./2" ) {
						pltojs = pointer.args[0].toJavaScript();
						if( pltojs === undefined ) {
							thread.throw_error( pl.error.domain( "javascript_object", pointer.args[0], atom.indicator ) );
							return undefined;
						}
						arr.push( pltojs );
						pointer = pointer.args[1];
					}
					if( pl.type.is_variable( pointer ) ) {
						thread.throw_error( pl.error.instantiation( atom.indicator ) );
						return;
					} else if( pointer.indicator !== "[]/0" ) {
						thread.throw_error( pl.error.type( "list", args, atom.indicator ) );
						return
					}
					var value;
					try {
						value = fn.apply( ctx, arr );
					} catch( e ) {
						thread.throw_error( pl.error.javascript( e.toString(), atom.indicator ) );
						return;
					}

					const done = () => {
						value = pl.fromJavaScript.apply( value );
						thread.prepend( [new pl.type.State( point.goal.replace( new pl.type.Term( "=", [value, result] ) ), point.substitution, point )] );
					};

					if (value && value.then) {
						value.then(x => {
							value = x;
							done();
							thread.again();
						}, e => {
							thread.throw_error( pl.error.javascript( e.toString(), atom.indicator ) );
						});
						return true;
					}
					else {
						done();
					}
				}
			},
			
			// prop/2:
			"prop/2": [
				new pl.type.Rule(new pl.type.Term("prop", [new pl.type.Var("X"),new pl.type.Var("Y")]), new pl.type.Term(",", [new pl.type.Term("global", [new pl.type.Var("G")]),new pl.type.Term("prop", [new pl.type.Var("G"),new pl.type.Var("X"),new pl.type.Var("Y")])]))
			],
			
			// prop/3
			"prop/3": function( thread, point, atom ) {
				var context = atom.args[0], name = atom.args[1], result = atom.args[2];
				if( pl.type.is_variable( context ) ) {
					thread.throw_error( pl.error.instantiation( atom.indicator ) );
				} else if( !pl.type.is_variable( name ) && !pl.type.is_atom( name ) ) {
					thread.throw_error( pl.error.type( "atom", name, atom.indicator ) );
				} else {
					if( pl.type.is_atom( name ) ) {
						var contextJs = context.toJavaScript()
						if( contextJs && contextJs.hasOwnProperty(name.id) ) {
							var fn = contextJs[name.id];
							fn = pl.fromJavaScript.apply( fn );
							thread.prepend( [new pl.type.State( point.goal.replace( new pl.type.Term( "=", [fn, result] ) ), point.substitution, point )] );
						}
					} else {
						var fn = context.toJavaScript();
						var states = [];
						for( var x in fn ) {
							if( fn.hasOwnProperty( x ) ) {
								var fn_ = pl.fromJavaScript.apply( fn[x] );
								states.push( new pl.type.State( point.goal.replace( new pl.type.Term( ",", [
									new pl.type.Term( "=", [fn_, result] ),
									new pl.type.Term( "=", [new pl.type.Term(x, []), name] )
								]) ), point.substitution, point ) );
							}
						}
						thread.prepend( states );
					}
				}
			},

			// json_prolog/2
			"json_prolog/2": function( thread, point, atom ) {
				var json = atom.args[0], prolog = atom.args[1];
				if( pl.type.is_variable(json) && pl.type.is_variable(prolog) ) {
					thread.throw_error( pl.error.instantiation( atom.indicator ) );
				} else if( !pl.type.is_variable(json) && (!pl.type.is_js_object(json) || typeof(json.value) !== "object")) {
					thread.throw_error( pl.error.type( "JsValueOBJECT", json, atom.indicator ) );
				} else if( !pl.type.is_variable(prolog) && !pl.type.is_list(prolog) ) {
					thread.throw_error( pl.error.type( "list", prolog, atom.indicator ) );
				} else {
					if(pl.type.is_variable(prolog)) {
						var list = pl.fromJavaScript.apply(json.value, true);
						thread.prepend([new pl.type.State(
							point.goal.replace(new pl.type.Term("=", [prolog, list])),
							point.substitution,
							point
						)]);
					} else {
						var obj = new pl.type.JSValue(prolog.toJavaScript());
						thread.prepend([new pl.type.State(
							point.goal.replace(new pl.type.Term("=", [json, obj])),
							point.substitution,
							point
						)]);
					}
				}
			},

			// json_atom/2
			"json_atom/2": function( thread, point, atom ) {
				var json = atom.args[0], prolog = atom.args[1];
				if( pl.type.is_variable(json) && pl.type.is_variable(prolog) ) {
					thread.throw_error( pl.error.instantiation( atom.indicator ) );
				} else if( !pl.type.is_variable(json) && (!pl.type.is_js_object(json) || typeof(json.value) !== "object")) {
					thread.throw_error( pl.error.type( "JsValueOBJECT", json, atom.indicator ) );
				} else if( !pl.type.is_variable(prolog) && !pl.type.is_atom(prolog) ) {
					thread.throw_error( pl.error.type( "atom", prolog, atom.indicator ) );
				} else {
					if(pl.type.is_variable(prolog)) {
						try {
							var jatom = new pl.type.Term(JSON.stringify(json.value), []);
							thread.prepend([new pl.type.State(
								point.goal.replace(new pl.type.Term("=", [prolog, jatom])),
								point.substitution,
								point
							)]);
						} catch(ex) {}
					} else {
						try {
							console.log(JSON.parse(prolog.id));
							var obj = pl.fromJavaScript.apply(JSON.parse(prolog.id));
							thread.prepend([new pl.type.State(
								point.goal.replace(new pl.type.Term("=", [json, obj])),
								point.substitution,
								point
							)]);
						} catch(ex) {}
					}
				}
			},

		};
	};
	
	var exports = ["global/1", "apply/3", "apply/4", "prop/2", "prop/3", "json_prolog/2", "json_atom/2"];



	/*function prolog_to_json(prolog) {
		var pointer = prolog;
		var obj = {};
		while(pl.type.is_term(pointer) && pointer.indicator === "./2") {
			var pair = pointer.args[0];
			if(pl.type.is_variable(pair)) {
				return pl.error.instantiation( atom.indicator );
			} else if(!pl.type.is_term(pair) || pair.indicator !== "-/2" || !pl.type.is_atom(pair.args[0])) {
				return pl.error.domain( "pair", pair, atom.indicator );
			}
			if()
			obj[pair.args[0].id] = pair.args[1].toJavaScript();
			pointer = pointer.args[1];
		}
	}*/

	// JS OBJECTS
	function define_properties() {
		// Is a JS object
		pl.type.is_js_object = function( obj ) {
			return obj instanceof pl.type.JSValue;
		};

		// Ordering relation
		pl.type.order.push( pl.type.JSValue );

		// JSValue Prolog object
		pl.type.JSValue = function( value ) {
			this.value = value;
		}

		// toString
		pl.type.JSValue.prototype.toString = function() {
			return typeof this.value === 'object'
			? `<javascript>(${JSON.stringify(this.value)})`
			: "<javascript>(" + (typeof this.value).toLowerCase() + ")";
		};

		// clone
		pl.type.JSValue.prototype.clone = function() {
			return new pl.type.JSValue( this.value );
		};

		// equals
		pl.type.JSValue.prototype.equals = function( obj ) {
			return pl.type.is_js_object( obj ) && this.value === obj.value;
		};

		// rename
		pl.type.JSValue.prototype.rename = function( _ ) {
			return this;
		};

		// get variables
		pl.type.JSValue.prototype.variables = function() {
			return [];
		};

		// apply substitutions
		pl.type.JSValue.prototype.apply = function( _ ) {
			return this;
		};

		// unify
		pl.type.JSValue.prototype.unify = function( obj, occurs_check ) {
			if( pl.type.is_js_object( obj ) && this.value === obj.value ) {
				return new pl.type.State( obj, new pl.type.Substitution() );
			}
			else if (obj.id === '{}') {
				// Extract matches from comma list
				// Done separately here to simplify substitution logic
				var terms = []
				var current = obj.args[0]
				while(current.id === ',') {
					var head = current.args[0]
					var tail = current.args[1]
					terms.push(head)
					current = tail
				}
				terms.push(current)

				// Make substitutions
				var subs = new pl.type.Substitution();

				for( var i = 0; i < terms.length; i++ ) {
					var term = terms[i];
					if (term.indicator === ':/2') {
						var prop = term.args[0]
						var value = term.args[1]

						if (!pl.type.is_atom(prop) || !pl.type.is_ground(this.value[prop])) {
							console.warn("Only ground atom props are currently supported:", prop);
							return null;
						}

						// Property must exist in object
						if (!(prop.id in this.value)) {
							return null;
						}

						// var val = pl.fromJavaScript.apply(this.value[prop]);
						var mgu = pl.unify(
							value.apply( subs ),
							pl.fromJavaScript.apply(this.value[prop]).apply( subs ),
							occurs_check
						);
						if (mgu === null) {
							return null;
						}
						for (var x in mgu.links) {
							subs.links[x] = mgu.links[x];
						}
						subs = subs.apply( mgu );
					}
					else {
						console.warn("Unrecognized term in object match syntax:", term)
						return null;
					}
				}
				return subs;
			}
			return null;
		};

		// interpret
		pl.type.JSValue.prototype.interpret = function( indicator ) {
			return pl.error.instantiation( indicator );
		};

		// compare
		pl.type.JSValue.prototype.compare = function( obj ) {
			if( this.value === obj.value ) {
				return 0;
			} else if( this.value < obj.value ) {
				return -1;
			} else if( this.value > obj.value ) {
				return 1;
			}
		};

		// to javascript
		pl.type.JSValue.prototype.toJavaScript = function() {
			return this.value;
		};

		// from javascript
		pl.fromJavaScript.conversion.any = function( obj ) {
			return new pl.type.JSValue( obj );
		};



		// JavaScript error
		pl.error.javascript = function( error, indicator ) {
			return new pl.type.Term( "error", [new pl.type.Term( "javascript_error", [new pl.type.Term( error )] ), pl.utils.str_indicator( indicator )] );
		};
	}
	

	define_properties();
	new pl.type.Module( "js", predicates(), exports );
}
