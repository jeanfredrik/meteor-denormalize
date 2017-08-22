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
	Match.test(fields, Match.OneOf([String], Object))
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

	_.defaults(options, {
		validate: false,
	});

	check(options, {
		cacheField: String,
		referenceField: String,
		helper: Match.Optional(String),
		validate: Boolean,
	});

	var fieldsToCopy = typeof fields == 'array' ? fields : flattenFields(fields);
	var cacheField = options.cacheField;
	var referenceField = options.referenceField;
	var collection1 = this;
	var collection2 = collection;
	var helper = options.helper;
	var validate = options.validate;

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

	Denormalize.addHooks(collection1, [referenceField], {
		//Update the cached field on the main collection after insert
		insert: function(fieldValues, doc) {
			var referenceFieldValue = fieldValues[referenceField];

			debug('\n'+collection1._name+'.cacheDoc');
			debug(collection1._name+'.after.insert', doc._id);
			debug('referenceField value:', referenceFieldValue);

			var doc2 = referenceFieldValue && collection2.findOne(referenceFieldValue, {transform: null, fields: fieldsInFind});
			if(doc2) {
				debug('$set');
				this.set(getRealCollection(collection1, validate), doc._id, object(cacheField, doc2));
			} else {
				debug('$unset');
				// No unset needed
			}
		},

		//Update the cached field on the main collection if the referenceField field is changed
		update: function(fieldValues, doc) {
			var referenceFieldValue = fieldValues[referenceField];

			debug('\n'+collection1._name+'.cacheDoc');
			debug(collection1._name+'.after.update', doc._id);
			debug('referenceField value:', referenceFieldValue);

			var doc2 = referenceFieldValue && collection2.findOne(referenceFieldValue, {transform: null, fields: fieldsInFind});
			if(doc2) {
				debug('$set');
				this.set(getRealCollection(collection1, validate), doc._id, object(cacheField, doc2));
			} else {
				debug('$unset');
				this.unset(getRealCollection(collection1, validate), doc._id, [cacheField]);
			}
		},
	});

	Denormalize.addHooks(collection2, fieldsToCopy, {
		//Update the cached field on the main collection if a matching doc on the target collection is inserted
		insert: function(fieldValues, doc) {
			debug('\n'+collection1._name+'.cacheDoc');
			debug(collection2._name+'.after.insert', doc._id);
			debug('fields to copy:', fieldsToCopy);
			debug('changed fields:', fieldValues);

			this.set(getRealCollection(collection1, validate), object(referenceField, doc._id), object(cacheField, fieldValues));
		},

		//Update the cached field on the main collection if the matching doc on the target collection is updated
		update: function(fieldValues, doc) {
			debug('\n'+collection1._name+'.cacheDoc');
			debug(collection2._name+'.after.update', doc._id);
			debug('fields to copy:', fieldsToCopy);
			debug('changed fields:', fieldValues);

			this.set(getRealCollection(collection1, validate), object(referenceField, doc._id), object(cacheField, fieldValues));
		},

		//Unset the cached field on the main collection if the matching doc on the target collection is removed
		remove: function(fieldValues, doc) {
			debug('\n'+collection1._name+'.cacheDoc');
			debug(collection2._name+'.after.remove', doc._id);

			this.unset(getRealCollection(collection1, validate), object(referenceField, doc._id), [cacheField]);
		},
	});

}
