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

			debug('\n'+collection1._name+'.cacheCount');
			debug(collection1._name+'.after.insert', doc._id);
			debug('referenceField value:', doc._id);
			debug('-> Update cache field');

			updateCount(collection1, collection2, referenceField, cacheField, doc._id);
		});
	});

	//Unset the count when a referencing doc in target collection is inserted
	collection2.after.insert(function(userId, doc) {
		var self = this;
		Meteor.defer(function() {
			var referenceFieldValue = Denormalize.getProp(doc, referenceField);

			debug('\n'+collection1._name+'.cacheCount');
			debug(collection2._name+'.after.insert', doc._id);
			debug('referenceField value:', referenceFieldValue);

			if(referenceFieldValue !== undefined) {
				debug('-> Update cache field');
				updateCount(collection1, collection2, referenceField, cacheField, referenceFieldValue, validate);
			} else {
				debug('-> Do nothing');
			}
		});
	});

	//Unset the count(s) when a referencing doc in target collection changes foreign key value
	collection2.after.update(function(userId, doc, fieldNames) {
		var self = this;
		Meteor.defer(function() {
			var referenceFieldValue = Denormalize.getProp(doc, referenceField);
			var referenceFieldPreviousValue = Denormalize.getProp(self.previous, referenceField);

			debug('\n'+collection1._name+'.cacheDoc');
			debug(collection2._name+'.after.update', doc._id);
			debug('referenceField value:', referenceFieldValue);
			debug('referenceField previous value:', referenceFieldPreviousValue);

			if(referenceFieldValue !== referenceFieldPreviousValue) {
				debug('-> Update cache field');
				if(referenceFieldPreviousValue) {
					updateCount(collection1, collection2, referenceField, cacheField, referenceFieldPreviousValue);
				}
				if(referenceFieldValue) {
					updateCount(collection1, collection2, referenceField, cacheField, referenceFieldValue, validate);
				}
			} else {
				debug('-> Do nothing');
			}
		});
	});

	//Unset the count when a referencing doc in target collection is removed
	collection2.after.remove(function(userId, doc) {
		var self = this;
		Meteor.defer(function() {
			var referenceFieldValue = Denormalize.getProp(doc, referenceField);

			debug('\n'+collection1._name+'.cacheCount');
			debug(collection2._name+'.after.remove', doc._id);
			debug('referenceField value:', referenceFieldValue);

			if(referenceFieldValue !== undefined) {
				debug('-> Update cache field');
				updateCount(collection1, collection2, referenceField, cacheField, referenceFieldValue, validate);
			} else {
				debug('-> Do nothing');
			}
		});
	});

}
