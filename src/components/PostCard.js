import { Component, h } from 'preact';

export default ({ post }) => <div className={`postcard postcard-${ post.rating } ${ post.visited ? '' : 'unvisited' }`}>
	<figure><a target="_blank" href={`https://furaffinity.net/view/${post.id}`}><img src={post.thumb} className="postcard-thumb" /></a>{/* <img src={`${}`} /></a> */}</figure>
	<figcaption>
		<h3><a target="_blank" href={`https://furaffinity.net/view/${post.id}`}>{post.title}</a></h3>
		<h4>By: <a target="_blank" href={`https://furaffinity.net/user/${post.artist}`}>{post.artist}</a></h4>
		{ post.user !== undefined
			? <h5>
					Faved by <a target="_blank" href={`https://furaffinity.net/favorites/${post.user}`}>{post.user}</a>
				</h5>
			: null }
	</figcaption>
</div>;