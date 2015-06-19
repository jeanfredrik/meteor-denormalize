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
Mongo.Collection.prototype.cacheField = function(cacheField, fields, value, options) {
	if(value === undefined) {
		value = Denormalize.fieldsJoiner();
	}

	check(fields, [String]);
	check(cacheField, String);
	check(value, Function);

	if(!Match.test(options, Object)) {
		options = {};
	}

	_.defaults(options, {
		validate: false,
	});

	check(options, {
		validate: Boolean,
	});

	var validate = options.validate;
	var collection = this;

	//Update the cached field after insert
	collection.after.insert(function(userId, doc) {
		var self = this;
		Meteor.defer(function() {
			var val = value(doc, fields);

			if(val !== undefined) {
				var $set = {};
				$set[cacheField] = val;
				getRealCollection(collection, validate).update({_id: doc._id}, {$set: $set});
			}
		});
	});

	//Update the cached field if any of the watched fields are changed
	collection.after.update(function(userId, doc) {
		var self = this;
		Meteor.defer(function() {
			if(haveDiffFieldValues(fields, doc, self.previous)) {
				var val = value(doc, fields);

				if(val !== undefined) {
					var $set = {};
					$set[cacheField] = val;
					getRealCollection(collection, validate).update({_id: doc._id}, {$set: $set});
				} else {
					var $unset = {};
					$unset[cacheField] = 1;
					getRealCollection(collection, validate).update({_id: doc._id}, {$unset: $unset});
				}
			}
		});
	});

}
