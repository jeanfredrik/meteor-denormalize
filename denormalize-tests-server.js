var speed = 200;

Posts = new Mongo.Collection('posts');
Posts.remove({});

Comments = new Mongo.Collection('comments');
Comments.remove({});

Tinytest.add("Comments.cacheDoc('post', Posts, ['title'])", function(test) {
	Comments.cacheDoc('post', Posts, ['title']);
});

Tinytest.addAsync("Insert comment", function(test, next) {
	Comments.insert({
		_id: 'comment1',
		post_id: 'post1',
		content: 'Great post!',
	});
	Meteor.setTimeout(function() {
		test.equal(Comments.findOne('comment1')._post, undefined);
		next();
	}, speed);
});

Tinytest.addAsync("Insert post", function(test, next) {
	Posts.insert({
		_id: 'post1',
		title: 'My first post',
		content: 'This is my first post'
	});
	Meteor.setTimeout(function() {
		test.notEqual(Comments.findOne('comment1')._post, undefined);
		test.equal(Comments.findOne('comment1')._post.title, Posts.findOne('post1').title);
		next();
	}, speed);
});

Tinytest.add("Collection helper", function(test) {
	test.equal(Comments.findOne('comment1').post().title, Posts.findOne('post1').title);
});

Tinytest.addAsync("Update post title", function(test, next) {
	Posts.update('post1', {$set: {
		title: 'Not my first post',
	}});
	Meteor.setTimeout(function() {
		test.notEqual(Comments.findOne('comment1')._post, undefined);
		test.equal(Comments.findOne('comment1')._post.title, Posts.findOne('post1').title);
		next();
	}, speed);
});

Tinytest.addAsync("Update comment post_id", function(test, next) {
	Comments.update('comment1', {$set: {
		post_id: 'post2',
	}});
	Meteor.setTimeout(function() {
		test.equal(Comments.findOne('comment1')._post, undefined);
		//reset:
		Comments.update('comment1', {$set: {
			post_id: 'post1',
		}});
		Meteor.setTimeout(function() {
			test.notEqual(Comments.findOne('comment1')._post, undefined);
			test.equal(Comments.findOne('comment1')._post.title, Posts.findOne('post1').title);
			next();
		}, speed);
	}, speed);
});

Tinytest.addAsync("Remove post", function(test, next) {
	Posts.remove('post1');
	Meteor.setTimeout(function() {
		test.equal(Comments.findOne('comment1')._post, undefined);
		next();
	}, speed);
});

