import _ from 'lodash'
let collections = {}

let lastCollectionId = 0

DenormalizeRun = function() {
	this._set = {}
}
DenormalizeRun.prototype.set = function(collection, selector, fieldValues) {
	if(!collection._denormalizeId) {
		collection._denormalizeId = String(++lastCollectionId)
		collections[collection._denormalizeId] = collection
	}
	if(_.isString(selector)) {
		selector = {_id: selector}
	}
	selector = EJSON.stringify(selector)
	if(!this._set[collection._denormalizeId]) {
		this._set[collection._denormalizeId] = {}
	}
	if(this._set[collection._denormalizeId][selector]) {
		_.extend(this._set[collection._denormalizeId][selector], fieldValues)
	} else {
		this._set[collection._denormalizeId][selector] = fieldValues
	}
}
DenormalizeRun.prototype.unset = function(collection, selector, fields) {
	let self = this
	if(!collection._denormalizeId) {
		collection._denormalizeId = String(++lastCollectionId)
		collections[collection._denormalizeId] = collection
	}
	if(_.isString(selector)) {
		selector = {_id: selector}
	}
	selector = EJSON.stringify(selector)
	if(!self._set[collection._denormalizeId]) {
		self._set[collection._denormalizeId] = {}
	}
	if(!self._set[collection._denormalizeId][selector]) {
		self._set[collection._denormalizeId][selector] = {}
	}
	_.each(fields, function(field) {
		self._set[collection._denormalizeId][selector][field] = undefined
	})
}

DenormalizeRun.prototype.commit = function() {
	if(this.isCommitted) return
	_.each(this._set, function(docs, collectionId) {
		collection = collections[collectionId]
		_.each(docs, function(fieldValues, selector) {
			selector = EJSON.parse(selector)
			let modifier = {}
			let $set = {}
			let $unset = {}
			_.each(fieldValues, function(value, field) {
				if(typeof value == 'object'){
					_.each(value, (val, key) => {
						_.set($set, field + '.' + key, val)
					})
				} else if(value === undefined) {
					$unset[field] = 1
				} else {
					$set[field] = value
				}
			})
			if(_.size($set)) {
				modifier.$set = $set
			}
			if(_.size($unset)) {
				modifier.$unset = $unset
			}
			if(_.size(modifier)) {
				debug('UPDATE ' + collection._name.toUpperCase())
				debug('selector:', selector)
				debug('modifier:', modifier)
				collection.update(selector, modifier, {multi: true})
			}
		})
	})
	this.isCommitted = true
}

DenormalizeHookContext = function(data, currentRun) {
	_.extend(this, data)
	this._currentRun = currentRun
}

DenormalizeHookContext.prototype.set = function(collection, selector, fieldValues) {
	this._currentRun.set(collection, selector, fieldValues)
}
DenormalizeHookContext.prototype.unset = function(collection, selector, fields) {
	if(_.isString(fields)) {
		fields = [fields]
	} else if(_.isObject(fields) && !_.isArray(fields)) {
		fields = _.keys(fields)
	}
	this._currentRun.unset(collection, selector, fields)
}

ensureDenormalize = function(collection) {
	if(collection._denormalize) return
	collection._denormalize = {
		insert: {
			watchedTopLevelFields: [],
			watchedFields: [],
			hooks: {}
		},
		update: {
			watchedTopLevelFields: [],
			watchedFields: [],
			hooks: {}
		},
		remove: {
			watchedTopLevelFields: [],
			watchedFields: [],
			hooks: {}
		},
	}
	collection.after.insert(function(userId, doc) {
		let topLevelFieldNames = _.keys(doc)

		let currentRun = new DenormalizeRun()

		Meteor.defer(function() {
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
	})
	collection.after.update(function(userId, doc, topLevelFieldNames) {
		let oldDoc = this.previous

		// Drop out if none of topLevelFieldNames are in watchedTopLevelFields
		if(_.intersection(collection._denormalize.update.watchedTopLevelFields, topLevelFieldNames).length == 0) return

		let currentRun = new DenormalizeRun()

		Meteor.defer(function() {
			_.each(collection._denormalize.update.hooks, function(hook) {
				// Drop out if none of topLevelFieldNames are in watchedTopLevelFields of this hook
				if(_.intersection(hook.watchedTopLevelFields, topLevelFieldNames).length == 0) return

				let fieldValues = getDiff(hook.watchedFields, doc, oldDoc)

				// Drop out if none of fieldValues are in watchedFields of this hook
				if(_.size(fieldValues) == 0) return

				let oldFieldValues = _.pick(oldDoc, _.keys(fieldValues))

				let context = new DenormalizeHookContext({
					fieldValues: fieldValues,
					doc: doc,
					oldFieldValues: oldFieldValues,
					oldDoc: oldDoc,
				}, currentRun)
				hook.callback.call(context, fieldValues, doc, oldFieldValues, oldDoc)
			})
			currentRun.commit()
		})
	})
	collection.after.remove(function(userId, doc) {
		let topLevelFieldNames = _.keys(doc)

		// Drop out if none of topLevelFieldNames are in watchedTopLevelFields
		if(_.intersection(collection._denormalize.remove.watchedTopLevelFields, topLevelFieldNames).length == 0) return

		let currentRun = new DenormalizeRun()

		Meteor.defer(function() {
			_.each(collection._denormalize.remove.hooks, function(hook) {
				// Drop out if none of topLevelFieldNames are in watchedTopLevelFields of this hook
				if(_.intersection(hook.watchedTopLevelFields, topLevelFieldNames).length == 0) return

				let fieldValues = getDiff(hook.watchedFields, doc, {})

				// Drop out if none of fieldValues are in watchedFields of this hook
				if(_.size(fieldValues) == 0) return

				let context = new DenormalizeHookContext({
					fieldValues: fieldValues,
					doc: doc,
				}, currentRun)
				hook.callback.call(context, fieldValues, doc)
			})
			currentRun.commit()
		})
	})
}

topLevelFields = function(fields) {
	return _.uniq(_.map(fields, function(field) {
		return field.replace(/\..*$/, '')
	}))
}

let lastHookId = 0
makeHookId = function() {
	return String(++lastHookId)
}

Denormalize.addHooks = function(collection, watchedFields, hooks) {
	//collection must be a Mongo.Collection
	check(collection, Mongo.Collection)

	//watchedFields must be a nonempty array of strings
	check(watchedFields, [String])
	if(watchedFields.length == 0) return

	//hooks must be a nonempty object with insert, update and/or remove.
	check(hooks, {
		insert: Match.Optional(Function),
		update: Match.Optional(Function),
		remove: Match.Optional(Function),
	})
	if(_.size(hooks) == 0) return

	ensureDenormalize(collection)

	let watchedTopLevelFields = topLevelFields(watchedFields)

	let hookId = makeHookId()

	_.each(hooks, function(callback, hookName) {
		let store = collection._denormalize[hookName]
		store.watchedTopLevelFields = _.union(store.watchedTopLevelFields, watchedTopLevelFields)
		store.watchedFields = _.union(store.watchedFields, watchedFields)
		store.hooks[hookId] = {
			callback: callback,
			_id: hookId,
			watchedFields: watchedFields,
			watchedTopLevelFields: watchedTopLevelFields,
		}
	})

}