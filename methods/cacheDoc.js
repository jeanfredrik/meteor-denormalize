import _ from 'lodash'
/**
 * @method collection.cacheDoc
 * @public
 * @param {String} name The name of the denormalization
 * @param {Mongo.Collection} collection The target collection
 * @param {String[]} fields An array of field names that should be copied from the original document in the target collection
 * @param {Object} [options] Defines the behavior of this denormalization
 * @param {String} [options.cacheField] The name of the cached field in the main collection. Defaults to `name+'_id'`
 * @param {String} [options.referenceField] The name of the reference field in the target collection. Defaults to `'_'+name`
 * @param {String|false} [options.helper] If the Collection Helpers package is installed a helper is created with this name. Defaults to `name`. Set to false if you don't want to create a helper.
 * @returns {undefined}
 *
 * When a document in the target collection is inserted/updated/removed this denormalization saves a copy of the document in the main collection. The reference field is on the main collection.
 */

Mongo.Collection.prototype.cacheDoc = function(name, childCollection, fields, options) {

	check(name, String)
	check(childCollection, Mongo.Collection)

	Match.test(fields, Match.OneOf([String], Object))
	if(!Match.test(options, Object)) {
		options = {}
	}

	if(Match.test(name, String)) {
		_.defaults(options, {
			cacheField: '_'+name,
			referenceField: name+'_id'
		})
	}

	if(Match.test(options, Match.ObjectIncluding({helper: Boolean})) && !options.helper) {
		delete options.helper
	}

	_.defaults(options, {
		validate: false,
		inverse: false
	})

	check(options, {
		cacheField: String,
		referenceField: String,
		validate: Boolean,
		inverse: Boolean
	})

	let fieldsToCopy = _.isArray(fields) ? fields : flattenFields(fields)
	let cacheField = options.cacheField
	let parentField = options.inverse ? '_id' : options.referenceField
	let childField = options.inverse ? options.referenceField : '_id'
	let parentCollection = this
	let validate = options.validate

	if(!_.includes(fieldsTopCopy, childField)){
		fieldsToCopy.push(childField)
	}

	//Fields specifier for Mongo.Collection.find
	let fieldsInFind = {}
	_.each(fieldsToCopy, function(field) {
		fieldsInFind[field] = 1
	})

	Denormalize.addHooks(parentCollection, [parentField], {
		//Update the cached field on the main collection after insert
		insert: function(fieldValues, parent) {
			let parentFieldValue = fieldValues[parentField]

			debug('\n'+parentCollection._name+'.cacheDoc')
			debug(parentCollection._name+'.after.insert', parent._id)
			debug('parentField value:', parentFieldValue)

			let cache
			if(_.isArray(parentFieldValue)){
				cache = childCollection.find({[childField]:{$in:parentFieldValue}}, {transform: null, fields: fieldsInFind}).fetch()
			} else {
				cache = childCollection.findOne(parentFieldValue, {transform: null, fields: fieldsInFind})
			}
			if(cache) {
				this.set(parentCollection, parent._id, {[cacheField]:cache})
			}
		},

		//Update the cached field on the main collection if the parentField field is changed
		update: function(fieldValues, parent) {
			let parentFieldValue = fieldValues[parentField]

			debug('\n'+parentCollection._name+'.cacheDoc')
			debug(parentCollection._name+'.after.update', parent._id)
			debug('parentField value:', parentFieldValue)

			let cache
			if(_.isArray(parentFieldValue)){
				cache = childCollection.find({[childField]:{$in:parentFieldValue}}, {transform: null, fields: fieldsInFind}).fetch()
			} else {
				cache = childCollection.findOne(parentFieldValue, {transform: null, fields: fieldsInFind})
			}
			if(cache) {
				this.set(parentCollection, parent._id, {[cacheField]:cache})
			} else {
				this.unset(parentCollection, parent._id, [cacheField])
			}
		},
	})

	Denormalize.addHooks(childCollection, fieldsToCopy, {
		//Update the cached field on the main collection if a matching doc on the target collection is inserted
		insert: function(fieldValues, child) {
			debug('\n'+parentCollection._name+'.cacheDoc')
			debug(childCollection._name+'.after.insert', child._id)
			debug('fields to copy:', fieldsToCopy)
			debug('changed fields:', fieldValues)

			parentCollection.find({[parentField]:child[childField]}).forEach(parent => {
				if(_.isArray(parent[parentField])){
					let index = parent[cacheField].length
					this.set(parentCollection, parent._id, {[cacheField + '.' + index]:fieldValues})
				} else {
					this.set(parentCollection, parent._id, {[cacheField]:fieldValues})
				}
			})
		},

		//Update the cached field on the main collection if the matching doc on the target collection is updated
		update: function(fieldValues, child) {
			debug('\n'+parentCollection._name+'.cacheDoc')
			debug(childCollection._name+'.after.update', child._id)
			debug('fields to copy:', fieldsToCopy)
			debug('changed fields:', fieldValues)

			parentCollection.find({[parentField]:child[childField]}).forEach(parent => {
				if(_.isArray(parent[parentField])){
					let index = _.findIndex(parent[cacheField], {_id:child._id})
					if(index == -1){
						index = parent[cacheField].length
					}
					this.set(parentCollection, parent._id, {[cacheField + '.' + index]:fieldValues})
				} else {
					this.set(parentCollection, parent._id, {[cacheField]:fieldValues})
				}
			})
		},

		//Unset the cached field on the main collection if the matching doc on the target collection is removed
		remove: function(fieldValues, child) {
			debug('\n'+parentCollection._name+'.cacheDoc')
			debug(childCollection._name+'.after.remove', child._id)

			parentCollection.find({[parentField]:child[childField]}).forEach(parent => {
				if(_.isArray(parent[parentField])){
					let index = _.findIndex(parent[cacheField], {_id:child._id})
					if(index !== -1){
						this.unset(parentCollection, parent._id, {[cacheField + '.' + index]:1})
					}
				} else {
					this.unset(parentCollection, parent._id, {[cacheField]:1})
				}
			})
		},
	})
	autoUpdate(this, [name, childCollection._name, fields, options])
}
