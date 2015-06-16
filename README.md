# Denormalize

This package helps you denormalize you Mongo collections by providing methods for common denormalizations. For example, you can have the name of an author of a post automatically copied into the post. It updates if the author changed name or is removed. This lets you sort you posts after author name very easily. Simply do `Posts.cacheDoc('author', Authors, ['name'])`.

All this is done using the [collection-hooks package](https://github.com/matb33/meteor-collection-hooks). The updates are currently only done on the server using the `after` hooks and `Meteor.defer()` so they don't block further execution. The client will not see the changes to the cached fields until they're pushed from the server.

[Read the API documentation](https://github.com/jeanfredrik/meteor-denormalize/blob/master/api.md)

## *collection*.cacheDoc

Say we have collection called `Posts` and one called `Comments`. One post looks like this:

```javascript
{
	_id: '9f7d606ac1bd7e5167da2fab',
	title: 'My first post',
	content: 'This is my first post'
}
```

And a comment on that post looks like this:

```javascript
{
	_id: 'e4ed559e813dc82d3fc7fd78',
	post_id: '9f7d606ac1bd7e5167da2fab',
	content: 'Great post!'
}
```

Using `Comments.cacheDoc()` we can have the post title appear and stay updated in the related comment:

```javascript
Comments.cacheDoc('post', Posts, ['title']);
```

This will copy the related post from `Posts`, keep only the `title` field and put the copy in the comment under the `_post` field. Now the comment will look like this:

```javascript
{
	_id: 'e4ed559e813dc82d3fc7fd78',
	post_id: '9f7d606ac1bd7e5167da2fab',
	content: 'Great post!',
	_post: {
		title: 'My first post'
	}
}
```

If the title of the post changes the `_post.title` property of the comment changes too, and if the post is removed, so is the `_post` field on the comment.

### Options

In the example, `_post` is the "cache field" and `post_id` is the "reference field". Their names are based on the third argument in the call to `cacheDoc`. If you want to set your own field names you can provide an `options` object:

```javascript
Comments.cacheDoc('post', Posts, ['title'], {
	referenceField: 'postId',
	cacheField: 'cachedPost'
});
```

### Collection helper

If you have the [collection-helpers package](https://github.com/dburles/meteor-collection-helpers/) installed a helper will be created automatically. In the previous example this means that you can call `post()` on a comment to get the related post.

To use another name for the helper, set the `helper` option to a string. If you don't want a helper, set `helper` to `false`:

```javascript
Comments.cacheDoc('post', Posts, ['title'], {
	helper: false //No helper will be created
});
```

## *collection*.cacheCount

Continuing the previous example we can use `Posts.cacheCount()` to store the comment count on each post:

```javascript
Posts.cacheCount('commentsCount', Comments, 'post_id');
```

All posts will now have the `commentsCount` field and the value will update whenever a related comment is inserted/updated/removed. The first argument is the cache field, the second is the target collection and the third is the reference field on the target collection

## *collection*.cacheField

Coming soon!
