var async = require('async'),
	parse = require('parse-duration');

var sinceOptions = {
	create: 'createdAt',
	update: 'updatedAt'
};

module.exports = function ttl(sails) {

	function setTTL(model, ttl, since, callback) {
		sails.log.verbose('setting ttl on ' + model + ' collection to ' + ttl);

		since = since || 'updatedAt';

		//throw an error if the model does not exist
		if (!sails.models[model]) {
			return callback(new Error('Unknown model name: ' + model));
		}

		sails.models[model].native(function (err, collection) {
			if (err) { return callback(err); }
			var index = {};
			index[since] = 1;
			collection.dropIndex({ createdAt: 1 })
			.catch(function () {/* ignore index removal errors */})
			.then(function () {
				return collection.dropIndex({ updatedAt: 1 });
			})
			.catch(function () {/* ignore index removal errors */})
			.then(function () {
				return collection.createIndex(index, { expireAfterSeconds: ttl });
			})
			.then(function () {
				callback();
			})
			.catch(callback);
		});
	}

	return {

		initialize: function (callback) {
			sails.log.verbose('initializing model ttl');
			sails.after('hook:orm:loaded', function () {
				async.each(Object.keys(sails.models), function (key, cb) {
					var value = sails.models[key].ttl,
						since = 'update',
						ttl;
					if (!value) {
						return cb();
					} else if (typeof value === 'number' || typeof value === 'string') {
						ttl = value;
					} else if (typeof value === 'object' && value.ttl) {
						ttl = value.ttl
						since = value.since || 'update';
					}
					if (typeof ttl === 'string') {
						ttl = parse(ttl) / 1000;
					}
					if (typeof ttl !== 'number' || isNaN(ttl)) {
						cb(new Error('Invalid ttl value for model ' + key));
					}
					setTTL(key, ttl, sinceOptions[since], cb);
				}, function (err) {
					sails.log.verbose('finished setting model ttl');
					callback(err);
				});
			});
		}

	};

}
