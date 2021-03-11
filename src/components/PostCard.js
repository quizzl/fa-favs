import { Component, h } from 'preact';

export default ({ post }) => <div className={`postcard-${ post.rating } ${ post.visited ? '' : 'unvisited' }`}>
	<a target="_blank" href={`//furaffinity.net/view/${post.id}`}>{post.thumb}</a>{/* <img src={`${}`} /></a> */}
	<h3>{post.name}</h3>
	<h4><a target="_blank" href={`//furaffinity.net/user/${post.artist}`}>{post.artist}</a></h4>
	{ post.user !== undefined
		? <h5>
				<a target="_blank" href={`//furaffinity.net/favorites/${post.user}`}>Faved by {post.user}</a>
			</h5>
		: null }
</div>;