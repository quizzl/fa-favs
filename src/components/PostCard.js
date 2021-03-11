import { Component, h } from 'preact';

export default ({ post }) => <div>
	<a target="_blank" href={`//furaffinity.net/view/${post.id}`}>{post.thumb}</a>{/* <img src={`${}`} /></a> */}
	<h2>{post.name}</h2>
	<h3><a target="_blank" href={`//furaffinity.net/user/${post.artist}`}>{post.artist}</a></h3>
	{ post.user !== undefined
		? <h4>
				<a target="_blank" href={`//furaffinity.net/favorites/${post.user}`}>Faved by {post.user}</a>
			</h4>
		: null }
</div>;