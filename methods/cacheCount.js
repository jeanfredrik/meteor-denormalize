function updateCount(collection1, collection2, referenceField, cacheField, value) {
	var selector = {};
	selector[referenceField] = value;
	var $set = {};
	$set[cacheField] = collection2.find(selector).count();
	collection1.update(value, {$set: $set});
}

/**
 * @method collection.cacheDoc
 * @public
 * @param {String} cacheField The name of the cached field in the main collection.
 * @param {Mongo.Collection} collection The target collection
 * @param {String} referenceField The name of the reference field in the target collection.
 * @returns {undefined}
 *
 * When a document in the target collection is inserted/updated/removed this denormalization updates the count on the references document in the main collection. The reference field is on the target collection.
 */
Mongo.Collection.prototype.cacheCount = function(cacheField, collection, referenceField) {
	check(options, {
		cacheField: String,
		collection: Mongo.Collection,
		referenceField: String,
	});

	var cacheField = options.cacheField;
	var referenceField = options.referenceField;
	var collection1 = this;
	var collection2 = options.collection;

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
			if(_.contains(fieldNames, referenceField)) {
				updateCount(collection1, collection2, referenceField, cacheField, doc[referenceField]);
			}
		});
	});

	//Unset the count(s) when a referencing doc in target collection changes foreign key value
	collection2.after.update(function(userId, doc, fieldNames) {
		var self = this;
		Meteor.defer(function() {
			if(_.contains(fieldNames, referenceField)) {
				if(self.previous[referenceField]) {
					updateCount(collection1, collection2, referenceField, cacheField, self.previous[referenceField]);
				}
				if(doc[referenceField]) {
					updateCount(collection1, collection2, referenceField, cacheField, doc[referenceField]);
				}
			}
		});
	});

	//Unset the count when a referencing doc in target collection is removed
	collection2.after.remove(function(userId, doc) {
		var self = this;
		Meteor.defer(function() {
			if(doc[referenceField]) {
				updateCount(collection1, collection2, referenceField, cacheField, doc[referenceField]);
			}
		});
	});

}
