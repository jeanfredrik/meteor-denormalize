import _ from 'lodash'

Denormalize = {}

/**
 * @property Denormalize.debug
 * @public
 *
 * Set to `true` to show debug messages.
 */
Denormalize.debug = false

if(Meteor.isServer){
	_DenormalizeCache = new Mongo.Collection('_denormalizeCache')
}


debug = function() {
	if(Denormalize.debug) console.log.apply(this, arguments)
}


getDiff = function(fields, obj1, obj2) {
	let result = {}
	_.each(fields, function(field) {
		let newValue = _.get(obj1, field)
		if(newValue !== _.get(obj2, field)) {
			result[field] = newValue
		}
	})
	return result
}
let updated = []

autoUpdate = function(collection, args){
	args = JSON.stringify(args)
	Meteor.setTimeout(function(){
		if(!_DenormalizeCache.findOne({args})){
			if(updated.indexOf(collection._name) == -1){
				updated.push(collection._name)
				console.log('Updating cache:', collection._name)
				Denormalize.runHooksNow(collection, {})
			}
			_DenormalizeCache.insert({args})
		} else {
			Denormalize.runHooksNow(collection, {})
		}
	}, 1000)
}
	

flattenFields = function(object, prefix){
	prefix = prefix || ''
	let fields = []
	_.each(object, (val, key) => {
		if(typeof val == 'object'){
			fields = _.union(fields, flattenFields(val, prefix + key + '.'))
		} else {
			fields.push(prefix + key)
		}
	})
	return fields
}

Denormalize.runHooksNow = function(collection, selector) {
	selector = selector || {}
	if(!collection._denormalize) return

	collection.find(selector).forEach(function(doc) {
		let topLevelFieldNames = _.keys(doc)

		let currentRun = new DenormalizeRun()

		_.each(collection._denormalize.insert.hooks, function(hook) {

			let fieldValues = getDiff(hook.watchedFields, doc, {})

			let context = new DenormalizeHookContext({
				fieldValues: fieldValues,
				doc: doc,
			}, currentRun)
			hook.callback.call(context, fieldValues, doc)
		})

		currentRun.commit()
	})
}
