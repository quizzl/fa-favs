import { h, Component } from 'preact';
// import Map from 'es6-map';
import PostCard from './PostCard';
import Q from 'q';
import { Map, Set } from 'immutable'
import { get_favs, update_favs, flag_visited } from '../fetch'

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
			username: new URLSearchParams(new URL(window.location).search).get('u') || '',
			page: 0,
			store_reloads: 0
		};
	}
	
	trig_store_reload = f => this.setState(s => ({ store_reloads: s.store_reloads + 1 }), f)
	
	componentDidMount() {
		this.trig_store_reload(
			_ => get_favs().then(favs => update_favs(favs.keySeq().toArray()).subscribe( // .concat(["Feve", "Kenket"])
				_ => this.trig_store_reload()
			))
		);
	}
	
	componentDidUpdate(prevProps, prevState) {
		if(prevState.store_reloads < this.state.store_reloads) {
			get_favs().then(favs => this.setState({ user_favs: Map(favs) }))
		}
		if(prevState.selected !== this.state.selected) {
			flag_visited(this.state.selected);
		}
	}
	
	handleUserSubmit = e => {
		const next_user = this.state.username;
		update_favs().then(_ => {
			this.setState(s => ({ username: next_user === s.username ? '' : next_user }));
			this.handleUserSelect(user);
			this.trig_store_reload(); // the end state is all that matters, so all these set_state races are fine
		});
	}
	
	handleUserSelect = user => this.setState({ selected: user, page: 0 });
	
	handleUsernameChange = e => this.setState({ username: e.target.value })
	
	render() {
		const all_posts = (
				this.state.selected !== null
					? this.state.user_favs.get(this.state.selected)
					: this.state.user_favs.toArray()
						.reduce((acc, [u, favs]) => acc.concat(favs.map(f => Object.assign(f, { user: u }))), [])
			)
			.sort((a, b) => b.visited === a.visited ? b.fav_id - a.fav_id : (b.visited ? -1 : 1))
		const paged_posts = all_posts.slice(this.state.page * UI_PAGE_SIZE, (this.state.page + 1) * UI_PAGE_SIZE);
		return <div id="main_root">
				<header>
					<h1 id="main_logotext"><span id="main_logo"></span>FA Favs</h1>
					<span id="head_status"></span>
				</header>
				<div id="flexroot">
					<nav id="user_select_pane">
						<ul id="user_select">
							<li key={-1} id="user_add_item">
								<form action="#" onSubmit={this.handleUserSubmit}>
									<input type="text" name="username" id="user_add_input" placeholder="Username to add" value={this.state.username} onChange={this.handleUsernameChange} />
									<button id="user_add_button"></button>
								</form>
							</li>
							<li key={0} className={`${this.state.selected === null ? 'selected' : ''}`} onClick={_ => this.handleUserSelect(null)}>All</li>
							{this.state.user_favs.toArray().map(([u, posts], i) =>
								<li key={u} className={`${this.state.selected === u ? 'selected' : ''}`} onClick={_ => this.handleUserSelect(u)}>
									<span className="username">{u}</span>
									<span className="new-count">{
										posts.filter(p => !p.visited).length
									}</span>
								</li>)}
						</ul>
					</nav>
					<section id="post_pane">
						<header>
							<h2 id="user_head">{this.state.selected === null
								? 'All users'
								: <a href={`//furaffinity.net/favorites/${this.state.selected}`} target="_blank">{this.state.selected}</a>
							}</h2>
							<span className="pagination-container">
								<ul className="flatlist pagination-list">
									<li className={`page-arrow ${this.state.page === 0 ? 'disabled' : ''}`}>&#8606;</li>
									<li className={`page-arrow ${this.state.page === 0 ? 'disabled' : ''}`}>&larr;</li>
									<li>{this.state.page} ({this.state.page * UI_PAGE_SIZE + 1} &ndash; {Math.min(all_posts.length, (this.state.page + 1) * UI_PAGE_SIZE)} of {all_posts.length})</li>
									<li className={`page-arrow ${this.state.page >= parseInt(all_posts.length / UI_PAGE_SIZE) ? 'disabled' : ''}`}>&rarr;</li>
									<li className={`page-arrow ${this.state.page >= parseInt(all_posts.length / UI_PAGE_SIZE) ? 'disabled' : ''}`}>&#8608;</li>
								</ul>
							</span>
						</header>
						<div id="post_list_wrapper">
							<ul id="post_list" className="flatlist">
								{paged_posts.map(p => <li key={`${p.id}-${this.state.selected || p.user}`} className="postcard-wrapper">
									<PostCard post={p} />
								</li>)}
							</ul>
						</div>
					</section>
				</div>
			</div>;
	}
}