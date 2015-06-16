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
Mongo.Collection.prototype.cacheDoc = function(name, collection, fields, options) {

	check(name, String);
	check(collection, Mongo.Collection);
	check(fields, [String]);

	if(!Match.test(options, Object)) {
		options = {};
	}

	if(Match.test(name, String)) {
		_.defaults(options, {
			cacheField: '_'+name,
			referenceField: name+'_id',
			helper: name,
		});
	}

	if(Match.test(options, Match.ObjectIncluding({helper: Boolean})) && !options.helper) {
		delete options.helper;
	}

	check(options, {
		cacheField: String,
		referenceField: String,
		helper: Match.Optional(String),
	});

	var fieldsToCopy = fields;
	var cacheField = options.cacheField;
	var referenceField = options.referenceField;
	var collection1 = this;
	var collection2 = collection;
	var helper = options.helper;

	//Fields specifier for Mongo.Collection.find
	var fieldsInFind = {_id: 0};
	_.each(fieldsToCopy, function(field) {
		fieldsInFind[field] = 1;
	});

	//Collection helper
	if(helper && Match.test(collection1.helpers, Function)) {
		var helpers = {};
		helpers[helper] = function() {
			var fieldValue = Denormalize.getProp(this, referenceField);
			return fieldValue && collection2.findOne(fieldValue);
		};
		collection1.helpers(helpers);
	}

	//Update the cached field on the main collection after insert
	collection1.after.insert(function(userId, doc) {
		var self = this;
		var fieldNames = _.keys(doc);
		Meteor.defer(function() {
			var referenceFieldValue = Denormalize.getProp(doc, referenceField);
			if(referenceFieldValue !== undefined) {
				var doc2 = collection2.findOne(referenceFieldValue, {transform: null, fields: fieldsInFind});
				if(doc2) {
					var $set = {};
					$set[cacheField] = doc2;
					collection1.update(doc._id, {$set: $set});
				}
			}
		});
	});

	//Update the cached field on the main collection if a matching doc on the target collection is inserted
	collection2.after.insert(function(userId, doc) {
		var self = this;
		Meteor.defer(function() {
			if(haveDiffFieldValues(fieldsToCopy, doc, self.previous)) {
				var selector = {};
				selector[referenceField] = doc._id;
				var $set = {};
				$set[cacheField] = Denormalize.getProp(doc, fieldsToCopy, true);
				collection1.update(selector, {$set: $set});
			}
		});
	});

	//Update the cached field on the main collection if the referenceField field is changed
	collection1.after.update(function(userId, doc, fieldNames) {
		var self = this;
		Meteor.defer(function() {
			var referenceFieldValue = Denormalize.getProp(doc, referenceField);
			if(referenceFieldValue !== undefined) {
				var doc2 = collection2.findOne(referenceFieldValue, {transform: null, fields: fieldsInFind});
				if(doc2) {
					var $set = {};
					$set[cacheField] = doc2;
					collection1.update(doc._id, {$set: $set});
				} else {
					var $unset = {};
					$unset[cacheField] = 1;
					collection1.update(doc._id, {$unset: $unset});
				}
			}
		});
	});

	//Update the cached field on the main collection if the matching doc on the target collection is updated
	collection2.after.update(function(userId, doc, fieldNames) {
		var self = this;
		Meteor.defer(function() {
			if(haveDiffFieldValues(fieldsToCopy, doc, self.previous)) {
				var selector = {};
				selector[referenceField] = doc._id;
				var $set = {};
				$set[cacheField] = _.pick(doc, fieldsToCopy);
				collection1.update(selector, {$set: $set});
			}
		});
	});

	//Unset the cached field on the main collection if the matching doc on the target collection is removed
	collection2.after.remove(function(userId, doc) {
		var self = this;
		Meteor.defer(function() {
			var selector = {};
			selector[referenceField] = doc._id;
			var $unset = {};
			$unset[cacheField] = 1;
			collection1.update(selector, {$unset: $unset});
		});
	});

}
