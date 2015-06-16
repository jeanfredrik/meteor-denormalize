_.mixin({
	'getProp': function(obj, fields) {
		if(_.isString(fields)) {
			var field = fields;
			return _.reduce(field.split('.'), function(value, key) {
				if (_.isObject(value) && _.isFunction(value[key])) {
					return value[key]();
				} else if (_.isObject(value) && !_.isUndefined(value[key])) {
					return value[key];
				} else {
					return null;
				}
			}, obj);
		} else if(_.isArray(fields)) {
			return _.map(fields, function(field) {
				return _.get(obj, field);
			});
		}
	},
});
