import _ from 'lodash'
/**
 * @method collection.cacheCount
 * @public
 * @param {String} cacheField The name of the cached field in the main collection.
 * @param {Mongo.Collection} collection The target collection
 * @param {String} referenceField The name of the reference field in the target collection.
 * @returns {undefined}
 *
 * When a document in the target collection is inserted/updated/removed this denormalization updates the count on the references document in the main collection. The reference field is on the target collection.
 */
Mongo.Collection.prototype.cacheCount = function(cacheField, childCollection, referenceField, options) {
	check(cacheField, String)
	check(childCollection, Mongo.Collection)
	check(referenceField, String)

	if(!Match.test(options, Object)) {
		options = {}
	}

	_.defaults(options, {
		validate: false,
		selector: {}
	})

	check(options, {
		validate: Boolean,
		selector: Object
	})

	let parentCollection = this
	let validate = options.validate
	let selector = options.selector
	let watchedFields = _.union([referenceField], _.keys(selector))

	Denormalize.addHooks(parentCollection, ['_id'], {
		//Update the count on the main collection after insert
		insert: function(fieldValues, doc) {

			debug('\n'+parentCollection._name+'.cacheCount')
			debug(parentCollection._name+'.after.insert', doc._id)
			let select = {[referenceField]:doc._id}
			if(selector){
				_.extend(select, selector)
			}
			this.set(parentCollection, {_id: doc._id}, {[cacheField]:childCollection.find(select).count()})
		},
	})

	Denormalize.addHooks(childCollection, watchedFields, {
		//Unset the count when a referencing doc in target collection is inserted
		insert: function(fieldValues, doc) {
			let referenceFieldValue = fieldValues[referenceField]

			debug('\n'+parentCollection._name+'.cacheCount')
			debug(childCollection._name+'.after.insert', doc._id)
			debug('referenceField value:', referenceFieldValue)

			let select = {[referenceField]:referenceFieldValue}
			if(selector){
				_.extend(select, selector)
			}
			this.set(parentCollection, {_id: referenceFieldValue}, {[cacheField]:childCollection.find(select).count()})
		},

		//Unset the count(s) when a referencing doc in target collection changes
		update: function(fieldValues, doc, oldFieldValues, oldDoc) {
			let referenceFieldValue = fieldValues[referenceField]
			let oldReferenceFieldValue = oldFieldValues[referenceField]

			debug('\n'+parentCollection._name+'.cacheDoc')
			debug(childCollection._name+'.after.update', doc._id)
			debug('referenceField value:', referenceFieldValue)
			debug('referenceField previous value:', oldReferenceFieldValue)

			if(_.intersection(_.keys(fieldValues), _.keys(selector))){
				referenceFieldValue = doc[referenceField]
			}
			let select = {[referenceField]:referenceFieldValue}
			if(selector){
				_.extend(select, selector)
			}
			if(referenceFieldValue) {
				this.set(parentCollection, {_id: referenceFieldValue}, {[cacheField]:childCollection.find(select).count()})
			}
			if(oldReferenceFieldValue) {
				this.set(parentCollection, {_id: oldReferenceFieldValue}, {[cacheField]:childCollection.find(select).count()})
			}
		},

		//Unset the count when a referencing doc in target collection is removed
		remove: function(fieldValues, doc) {
			let referenceFieldValue = fieldValues[referenceField]

			debug('\n'+parentCollection._name+'.cacheCount')
			debug(childCollection._name+'.after.remove', doc._id)
			debug('referenceField value:', referenceFieldValue)

			let select = {[referenceField]:referenceFieldValue}
			if(selector){
				_.extend(select, selector)
			}

			if(referenceFieldValue) {
				this.set(parentCollection, {_id: referenceFieldValue}, {[cacheField]:childCollection.find(select).count()})
			}
		},
	})
	autoUpdate(this, [cacheField, childCollection._name, referenceField, options])
}
