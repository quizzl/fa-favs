import { h, Component } from 'preact';
// import Map from 'es6-map';
import PostCard from './PostCard';
import Q from 'q';
import { Map, Set } from 'immutable'
import { get_favs, update_favs } from '../fetch'

/*
TODO

- Pagination
- Debug uniqueness
- Store-state source of truth
- CSS
*/

const UI_PAGE_SIZE = 48; // page size for this UI, match FA to curb rate limiting
export default class extends Component {
	constructor(props) {
		super(props);
		
		this.state = {
			user_favs: Map(),
			selected: null,
			next_user: new URLSearchParams(new URL(window.location).search).get('u') || '',
			page: 0,
			store_reloads: 0
		};
	}
	
	componentDidMount() {
		this.setState(
			s => ({ store_reloads: s.store_reloads + 1 }),
			_ => get_favs().then(favs => update_favs(favs.keySeq().toArray()).subscribe(
				_ => this.setState(s => ({ store_reloads: s.store_reloads + 1 }))
			))
		);
	}
	
	componentDidUpdate(prevProps, prevState) {
		if(prevState.store_reloads < this.state.store_reloads) {
			get_favs().then(favs => this.setState({ user_favs: Map(favs) }))
		}
	}
	
	handleUserSelect = u_id => {
		this.setState({ selected: u_id });
	}
	
	render() {
		return <div className="flexroot">
				<nav>
					<ul id="user_select">
						<li key={0} className={`${this.state.selected === null ? 'selected' : ''}`} onClick={_ => this.handleUserSelect(null)}>All</li>
						{this.state.user_favs.toArray().map(([u, posts], i) =>
							<li key={u} className={`${this.state.selected === i ? 'selected' : ''}`} onClick={_ => this.handleUserSelect(u)}>
								<span className="username">{u}</span>
								<span className="new-count">{
									posts.filter(p => !p.viewed).length
								}</span>
							</li>)}
					</ul>
				</nav>
				<section>
					<h1>{this.state.selected === null
						? 'All users'
						: <a href={`//furaffinity.net/favorites/${this.state.selected}`} target="_blank">{this.state.selected}</a>
					}</h1>
					<ul id="post_list">
						{(() => {
							// { id, fetch_date, thumb, name, artist, rating, viewed }
							const posts = (
									this.state.selected !== null
										? this.state.user_favs.get(this.state.selected)
										: this.state.user_favs.toArray()
											.reduce((acc, [u, favs]) => acc.concat(favs.map(f => Object.assign(f, { user: u }))), [])
								)
								.sort((a, b) => b.fav_id - a.fav_id)
								.slice(this.state.page * UI_PAGE_SIZE, (this.state.page + 1) * UI_PAGE_SIZE);
							return posts.map(p => <li key={`${p.id}-${this.state.selected || p.user}`}>
									<PostCard post={p} />
								</li>)
						})()}
					</ul>
				</section>
			</div>;
	}
}