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


getFieldNamesObject = function(fields, obj1, obj2) {
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

Denormalize.getProp = getProp = function(obj, fields, returnObject) {
	if(_.isString(fields)) {
		let field = fields
		if(returnObject) {
			let result = {}
			result[field] = getProp(obj, field)
			return result
		} else {
			return _.reduce(field.split('.'), function(value, key) {
				if (_.isObject(value) && _.isFunction(value[key])) {
					return value[key]()
				} else if (_.isObject(value) && !_.isUndefined(value[key])) {
					return value[key]
				} else {
					return
				}
			}, obj)
		}
	} else if(_.isArray(fields)) {
		if(returnObject) {
			return setProps({}, _.object(fields, getProp(obj, fields)))
		} else {
			return _.map(fields, function(field) {
				return getProp(obj, field)
			})
		}
	}
}

Denormalize.setProps = setProps = function(destination) {
	_.each(_.rest(arguments), function(obj) {
		_.each(obj, function(value, key) {
			let keys = key.split('.')
			let lastKey = keys.pop()
			let context = _.reduce(keys, function(context, key) {
				return context[key] = context[key] || {}
			}, destination)
			context[lastKey] = value
		})
	})
	return destination
}

Denormalize.runHooksNow = function(collection, selector) {
	selector = selector || {}
	if(!collection._denormalize) return

	collection.find(selector).forEach(function(doc) {
		let topLevelFieldNames = _.keys(doc)

		let currentRun = new DenormalizeRun()

		_.each(collection._denormalize.insert.hooks, function(hook) {

			let fieldValues = getFieldNamesObject(hook.watchedFields, doc, {})

			let context = new DenormalizeHookContext({
				fieldValues: fieldValues,
				doc: doc,
			}, currentRun)
			hook.callback.call(context, fieldValues, doc)
		})

		currentRun.commit()
	})
}
