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
			return _.getProp(doc, field);
		})).join(glue);
	}
}
