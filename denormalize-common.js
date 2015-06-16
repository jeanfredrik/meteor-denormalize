Denormalize = {};

/**
 * @method Denormalize.fieldsJoiner
 * @private
 * @param {String[]} fields An array of the fields that should be concatenated
 * @param {String} glue A string that will be used as glue in the concatenation. Defaults to `', '`
 * @returns {Function} A callback that can be used in `collection.cacheField()`
 *
 * Generates a callback that can be used in `collection.cacheField()`. The value will be a concatenation of the fields using `glue`.
 */
Denormalize.fieldsJoiner = function(fields, glue) {
	if(!Match.test(glue, String)) {
		glue = ', ';
	}
	return function(doc, watchedFields) {
		if(fields === undefined) fields = watchedFields;
		return _.compact(_.map(fields, function(field) {
			return getProp(doc, field);
		})).join(glue);
	}
}

Denormalize.getProp = getProp = function(obj, fields, returnObject) {
	if(_.isString(fields)) {
		var field = fields;
		if(returnObject) {
			var result = {};
			result[field] = getProp(obj, field);
			return result;
		} else {
			return _.reduce(field.split('.'), function(value, key) {
				if (_.isObject(value) && _.isFunction(value[key])) {
					return value[key]();
				} else if (_.isObject(value) && !_.isUndefined(value[key])) {
					return value[key];
				} else {
					return;
				}
			}, obj);
		}
	} else if(_.isArray(fields)) {
		if(returnObject) {
			return setProps({}, _.object(fields, getProp(obj, fields)));
		} else {
			return _.map(fields, function(field) {
				return getProp(obj, field);
			});
		}
	}
};

Denormalize.setProps = setProps = function(destination) {
	_.each(_.rest(arguments), function(obj) {
		_.each(obj, function(value, key) {
			var keys = key.split('.');
			var lastKey = keys.pop();
			var context = _.reduce(keys, function(context, key) {
				return context[key] = context[key] || {};
			}, destination);
			context[lastKey] = value;
		});
	});
	return destination;
};

Denormalize.haveDiffFieldValues = haveDiffFieldValues = function(fields, doc1, doc2) {
	return !!_.find(fields, function(field) {
		return Denormalize.getProp(doc1, field) !== Denormalize.getProp(doc2, field);
	});
}
