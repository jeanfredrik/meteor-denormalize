function updateCount(collection1, collection2, referenceField, cacheField, value, validate) {
	var selector = {};
	selector[referenceField] = value;
	var $set = {};
	$set[cacheField] = collection2.find(selector).count();
	getRealCollection(collection1, validate).update({_id: value}, {$set: $set});
}

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
Mongo.Collection.prototype.cacheCount = function(cacheField, collection, referenceField, options) {
	check(cacheField, String);
	check(collection, Mongo.Collection);
	check(referenceField, String);

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
	var collection1 = this;
	var collection2 = collection;

	//Update the count on the main collection after insert
	collection1.after.insert(function(userId, doc) {
		var self = this;
		Meteor.defer(function() {
			updateCount(collection1, collection2, referenceField, cacheField, doc._id)
		});
	});

	//Unset the count when a referencing doc in target collection is inserted
	collection2.after.insert(function(userId, doc) {
		var self = this;
		var fieldNames = _.keys(doc);
		Meteor.defer(function() {
			var referenceFieldValue = Denormalize.getProp(doc, referenceField);
			if(referenceFieldValue !== undefined) {
				updateCount(collection1, collection2, referenceField, cacheField, doc[referenceField], validate);
			}
		});
	});

	//Unset the count(s) when a referencing doc in target collection changes foreign key value
	collection2.after.update(function(userId, doc, fieldNames) {
		var self = this;
		Meteor.defer(function() {
			var referenceFieldValue = Denormalize.getProp(doc, referenceField);
			if(referenceFieldValue !== undefined) {
				if(self.previous[referenceField]) {
					updateCount(collection1, collection2, referenceField, cacheField, self.previous[referenceField]);
				}
				if(doc[referenceField]) {
					updateCount(collection1, collection2, referenceField, cacheField, doc[referenceField], validate);
				}
			}
		});
	});

	//Unset the count when a referencing doc in target collection is removed
	collection2.after.remove(function(userId, doc) {
		var self = this;
		Meteor.defer(function() {
			var referenceFieldValue = Denormalize.getProp(doc, referenceField);
			if(referenceFieldValue !== undefined) {
				updateCount(collection1, collection2, referenceField, cacheField, doc[referenceField], validate);
			}
		});
	});

}
