import _ from 'lodash'
/**
 * @method collection.cacheField
 * @public
 * @param {String} cacheField The name of the cached field
 * @param {String[]} fields An array of field names that should be copied from the original document in the target collection
 * @param {Function} value A function that creates the new value. The function is called with two arguments:
 * @param {Object} value.doc The document that will be updated
 * @param {String[]} value.fields The watched fields
 * @returns {undefined}
 *
 * When a document in the collection is inserted/updated this denormalization updates the cached field with a value based on the same document
 */
Mongo.Collection.prototype.cacheField = function(cacheField, fields, callback, options) {
	if(!callback) {
		callback = array => _.compact(array).join(', ')
	}

	check(fields, [String])
	check(cacheField, String)
	check(callback, Function)

	if(!Match.test(options, Object)) {
		options = {}
	}

	_.defaults(options, {
		validate: false,
	})

	check(options, {
		validate: Boolean,
	})

	let validate = options.validate
	let collection1 = this

	Denormalize.addHooks(collection1, fields, {
		//Update the cached field after insert
		insert: function(fieldValues, doc) {

			debug('\n'+collection1._name+'.cacheField')
			debug(collection1._name+'.after.insert', doc._id)

			let val = callback(doc, fields)

			if(val !== undefined) {
				this.set(collection1, doc._id, {[cacheField]:val})
			}
		},
		//Update the cached field if any of the watched fields are changed
		update: function(fieldValues, doc) {

			debug('\n'+collection1._name+'.cacheField')
			debug(collection1._name+'.after.update', doc._id)

			let val = callback(doc, fields)

			if(val !== undefined) {
				this.set(collection1, doc._id, {[cacheField]:val})
			} else {
				this.unset(collection1, doc._id, [cacheField])
			}
		},
	})

	autoUpdate(this, [cacheField, fields, callback, options])
}
