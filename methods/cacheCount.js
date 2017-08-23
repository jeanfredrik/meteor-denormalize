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
		selector: {}
	});

	check(options, {
		validate: Boolean,
		selector: Object
	});

	var validate = options.validate;
	var collection1 = this;
	var collection2 = collection;
	var selector = options.selector;
	var watchedFields = _.union([referenceField], _.keys(selector))

	Denormalize.addHooks(collection1, ['_id'], {
		//Update the count on the main collection after insert
		insert: function(fieldValues, doc) {

			debug('\n'+collection1._name+'.cacheCount');
			debug(collection1._name+'.after.insert', doc._id);
			var select = object(referenceField, doc._id)
			if(selector){
				_.extend(select, selector)
			}
			this.set(getRealCollection(collection1, validate), {_id: doc._id}, object(
				cacheField,
				collection2.find(select).count()
			));
		},
	});

	Denormalize.addHooks(collection2, watchedFields, {
		//Unset the count when a referencing doc in target collection is inserted
		insert: function(fieldValues, doc) {
			var referenceFieldValue = fieldValues[referenceField];

			debug('\n'+collection1._name+'.cacheCount');
			debug(collection2._name+'.after.insert', doc._id);
			debug('referenceField value:', referenceFieldValue);

			var select = object(referenceField, referenceFieldValue)
			if(selector){
				_.extend(select, selector)
			}
			this.set(getRealCollection(collection1, validate), {_id: referenceFieldValue}, object(
				cacheField,
				collection2.find(select).count()
			));
		},

		//Unset the count(s) when a referencing doc in target collection changes
		update: function(fieldValues, doc, oldFieldValues, oldDoc) {
			var referenceFieldValue = fieldValues[referenceField];
			var oldReferenceFieldValue = oldFieldValues[referenceField];

			debug('\n'+collection1._name+'.cacheDoc');
			debug(collection2._name+'.after.update', doc._id);
			debug('referenceField value:', referenceFieldValue);
			debug('referenceField previous value:', oldReferenceFieldValue);

			if(_.intersection(_.keys(fieldValues), _.keys(selector))){
				referenceFieldValue = doc[referenceField]
			}
			var select = object(referenceField, referenceFieldValue)
			if(selector){
				_.extend(select, selector)
			}
			if(referenceFieldValue) {
				this.set(getRealCollection(collection1, validate), {_id: referenceFieldValue}, object(
					cacheField,
					collection2.find(select).count()
				));
			}
			if(oldReferenceFieldValue) {
				this.set(getRealCollection(collection1, validate), {_id: oldReferenceFieldValue}, object(
					cacheField,
					collection2.find(select).count()
				));
			}
		},

		//Unset the count when a referencing doc in target collection is removed
		remove: function(fieldValues, doc) {
			var referenceFieldValue = fieldValues[referenceField];

			debug('\n'+collection1._name+'.cacheCount');
			debug(collection2._name+'.after.remove', doc._id);
			debug('referenceField value:', referenceFieldValue);

			var select = object(referenceField, referenceFieldValue)
			if(selector){
				_.extend(select, selector)
			}

			if(referenceFieldValue) {
				this.set(getRealCollection(collection1, validate), {_id: referenceFieldValue}, object(
					cacheField,
					collection2.find(select).count()
				));
			}
		},
	});

	autoUpdate(collection, [this._name, cacheField, collection._name, referenceField, options])
}
