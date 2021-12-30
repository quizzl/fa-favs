import { h, Component, createRef } from 'preact';
// import Map from 'es6-map';
import { startWith, mergeMap, finalize } from 'rxjs/operators';
import { EMPTY, from, zip } from 'rxjs'
import PostCard from './PostCard';
import { Map, Set } from 'immutable'
import { get_favs, update_favs, flag_visited, remove_user, storage_get, storage_set, storage_remove, add_users } from '../fetch'
import { SETTINGS_KEY_PREFIX, UI_PAGE_SIZE, SORTBY, THEME, ERR_TIMEOUT } from '../consts'

export default class extends Component {
	constructor(props) {
		super(props);
		
		const url = new URL(window.location);
		const search_params = new URLSearchParams(url.search);
		this.state = {
			user_favs: Map(),
			selected: null,
			username: search_params.get('u') || '',
			page: 0,
			store_reloads: 0,
			pulling: 0,
			pulled: 0,
			// updater$: EMPTY,
			sortby: SORTBY.NEW,
			theme: THEME.DARK,
			fails: Map(),
			fails_id: 0
		};
		
		search_params.delete('u');
		url.search = search_params;
		window.history.replaceState({}, document.title, url);
		
		this.username_ref = createRef();
	}
	
	componentDidMount() {
		this.trig_store_reload().then(_ => this.pull_all()).catch(this.fail);
		this.username_ref.current.focus();
		this.load_settings();
	}
	
	fail = err => {
		this.setState(s => {
			const key = s.fails_id;
			setTimeout(_ => this.setState(s_ => ({ fails: s_.fails.remove(key) })), ERR_TIMEOUT);
			return { fails: s.fails.set(key, err), fails_id: key + 1 };
		});
	}
	
	trig_store_reload = (u = null) => get_favs(u).then(favs => this.setState(s => ({
		user_favs: u === null ? favs : s.user_favs.mergeWith((_, next) => next, favs)
	})))
	
	load_settings() {
		storage_get(`${SETTINGS_KEY_PREFIX}_THEME`).then(s => {
			if(s.hasOwnProperty(`${SETTINGS_KEY_PREFIX}_THEME`))
				this.setState({ theme: THEME[s[`${SETTINGS_KEY_PREFIX}_THEME`]] });
		}).catch(this.fail)
	}
	
	pull_all() {
		this.setState(s => ({ pulling: s.pulling + 1 }));
		return get_favs().then(favs => update_favs(favs.keySeq().toArray()).subscribe( // .concat(["Feve", "Kenket"])
			(u_) => u_ === null ? null : this.trig_store_reload(u_[0]), // TODO consider windowing for lower frequency
			e => {
				this.setState(s => ({ pulled: s.pulled + 1 }))
				this.fail(e);
			},
			() => this.setState(s => ({ pulled: s.pulled + 1 }))
		));
	}
	
	get_current_posts() {
		const all_posts = (
				this.state.selected !== null
					? this.state.user_favs.get(this.state.selected, [])
					: this.state.user_favs.toArray()
						.reduce((acc, [u, favs]) => acc.concat(favs.map(f => Object.assign(f, { user: u }))), [])
			)
			// .map(a => Object.assign(a, { visited: !Math.round(Math.random() * 0.52) }))
			.sort((a, b) => {
				switch(this.state.sortby) {
					case SORTBY.NEW:
						return b.fav_id - a.fav_id;
					case SORTBY.UNVIEWED:
						return b.visited === a.visited ? b.fav_id - a.fav_id : (b.visited ? -1 : 1);
				}
			})
		const paged_posts = all_posts.slice(this.state.page * UI_PAGE_SIZE, (this.state.page + 1) * UI_PAGE_SIZE);
		return [all_posts, paged_posts];
	}
	
	componentDidUpdate(prevProps, prevState) {
		// all actions that result in reading posts
		if(
			this.state.pulling === this.state.pulled && (
					(this.state.page !== prevState.page)
					|| (prevState.selected !== this.state.selected)
					|| (prevState.sortby !== this.state.sortby)
					// || (this.state.user_favs !== prevState.user_favs)
				)
			) {
			// log the current page of posts as read
			const [_, paged_posts] = this.get_current_posts();
			flag_visited(this.state.selected, paged_posts);
		}
		if(prevState.selected !== this.state.selected) {
			// flush the changes to the UI only when we switch users, so that posts for a user are frozen while you page through them so they come in a consistent order
			this.trig_store_reload(prevState.selected);
		}
		
		if(prevState.theme !== this.state.theme) {
			document.getElementById('theme_style').href = `css/browse/${this.state.theme.stylesheet}`;
			
			const keys = {};
			keys[`${SETTINGS_KEY_PREFIX}_THEME`] = this.state.theme.value;
			storage_set(keys);
		}
	}
	
	handleUserSubmit = e => {
		e.preventDefault();
		e.stopPropagation();
		const raw_username = this.state.username;
		const next_users = Array.from(this.state.username.matchAll(/[\w_\-]+/g), a => a[0]) // split(/[ ,]/).map(u => u.trim()).filter(s => s !== '');
		this.setState(s => ({ username: s.username === raw_username ? '' : s.username, pulling: s.pulling + 1 }));
		
		const updater$ = zip(from(next_users), add_users(next_users));
		updater$.pipe(
			mergeMap(([next_user, d]) => {
					// console.log([next_user, d]);
					if(d === null) {
						this.fail(new Error(`User ${next_user} does not exist.`));
						return EMPTY;
					}
					else {
						const next_user_cleaned = d[0];
						return this.trig_store_reload(next_user_cleaned).then(_ => {
							this.handleUserSelect(next_user_cleaned);
						});
					}
				}),
			finalize(_ => this.setState(s => ({ pulled: s.pulled + 1 }))),
		).subscribe(null, e => console.log(e) || this.fail(e), null);
		// this.setState(s => ({
		// 	updater$: s.pipe()
		// }))
		return false;
	}
	
	handleUserSelect = user => this.setState({ selected: user, page: 0 });
	
	handleUsernameChange = e => this.setState({ username: e.target.value })
	
	handleUserRemove = (e, user) => {
		e.preventDefault();
		e.stopPropagation();
		if(confirm(`Unsubscribe from ${user}?`)) {
			remove_user(user).then(_ => this.setState(s => ({
				selected: s.selected === user ? null : s.selected,
				page: 0,
				user_favs: s.user_favs.remove(user) // debating between this hack and making a more general diff thing for trig_store_reload
			}))).catch(this.fail)
		}
		return false;
	}
	
	handleSortByChange = e => this.setState({ sortby: SORTBY[e.target.value], page: 0 });
	
	handlePageTurn = d => this.setState(s => {
		const page_ = s.page + d;
		const num_posts = this.get_current_posts()[0].length;
		return { page: Math.max(0, Math.min(parseInt((num_posts - 1) / UI_PAGE_SIZE), page_)) };
	});
	
	handleFlagAllViewed = _e => {
		const selected = this.state.selected
		flag_visited(selected).then(_ => this.trig_store_reload(selected)).catch(this.fail)
	}
	
	handleThemeChange = _e => this.setState({ theme: THEME[this.state.theme.next] })
	
	render() {
		const [all_posts, paged_posts] = this.get_current_posts();
		const new_posts = all_posts.filter(p => !p.visited);
		return <div id="main_root">
				<ul id="fails_list">
					{ this.state.fails.toArray().map(([k, v]) => <li key={k}>{v.toString()}</li>) }
				</ul>
				<div id="flexroot">
					<nav id="user_select_pane">
						<header>
							<h1 id="main_logotext"><span id="main_logo"></span></h1>
						</header>
						<div id="user_add_item">
							<form action="#" onSubmit={this.handleUserSubmit} id="user_add_form">
								<span id="user_add_button_wrapper"><button id="user_add_button"></button></span>
								<input type="text" name="username" id="user_add_input" placeholder="Enter username[s]" value={this.state.username} onInput={this.handleUsernameChange} ref={this.username_ref} />
							</form>
						</div>
						<ul id="user_select">
							<li key={0} className={`user-item ${this.state.selected === null ? 'selected' : ''}`} onClick={_ => this.handleUserSelect(null)}>All users</li>
							{this.state.user_favs.entrySeq().sortBy(([k, _v]) => k).toArray().map(([u, posts], i) => [
									<li className="list-separator"></li>,
									<li key={u} className={`user-item ${this.state.selected === u ? 'selected' : ''}`} onClick={_ => this.handleUserSelect(u)}>
										<span className="username">{u}</span>
										<a href="#" className="remove-user" onClick={e => this.handleUserRemove(e, u)}>&times;</a>
										{
											posts.filter(p => !p.visited).length > 0 && <span className="new-count">{posts.filter(p => !p.visited).length}</span>
										}
									</li>
								])}
						</ul>
						<div id="theme_toggle" onClick={this.handleThemeChange}>
							<div>Click to toggle from:</div>
							<h2>{this.state.theme.pretty}</h2>
						</div>
					</nav>
					<section id="post_pane">
						<header>
							<h2 id="user_head">{this.state.selected === null
								? 'All users'
								: <span><a href={`https://furaffinity.net/favorites/${this.state.selected}`} target="_blank">{this.state.selected}</a>'s favorites</span>
							} {
								new_posts.length > 0 && <span className="new-count">{`${new_posts.length} unviewed`}</span>
							}</h2>
							<span className="pseudobutton" onClick={this.handleFlagAllViewed}>Mark all as viewed</span>
							<span id="sortby_wrapper">
								<label for="sortby_select">Sort by:</label>
								<select id="sortby_select" value={this.state.sortby.value} onChange={this.handleSortByChange}>
									{Object.values(SORTBY).map(v => <option value={v.value}>{v.pretty}</option>)}
								</select>
							</span>
							<span id="head_status" className={this.state.pulling > this.state.pulled ? '' : 'alpha_hidden'}><div class="lds-hourglass"></div> Pulling updates...</span>
						</header>
						<div id="post_list_wrapper">
							{ all_posts.length === 0
								? <div id="no_favs_pane_filler"><div>No favorites</div></div>
								: <ul id="post_list" className="flatlist">
										{paged_posts.map(p => <li key={`${p.id}-${this.state.selected || p.user}`} className="postcard-wrapper">
											<PostCard post={p} />
										</li>)}
									</ul>
							}
						</div>
						<div className="pagination-container">
							<ul className="flatlist pagination-list">
								<li className={`page-arrow ${this.state.page === 0 ? 'disabled' : ''}`} onClick={e => this.handlePageTurn(-Infinity)}>&#8606;</li>
								<li className={`page-arrow ${this.state.page === 0 ? 'disabled' : ''}`} onClick={e => this.handlePageTurn(-1)}>&larr;</li>
								<li>{
									all_posts.length === 0
										? null
										: <span>
											<div className="pagination-page-count">Page {this.state.page + 1} / {parseInt((all_posts.length - 1) / UI_PAGE_SIZE) + 1}</div>
											<div className="pagination-post-count">({this.state.page * UI_PAGE_SIZE + 1} &ndash; {Math.min(all_posts.length, (this.state.page + 1) * UI_PAGE_SIZE)} of {all_posts.length})</div>
										</span>
								}</li>
								<li className={`page-arrow ${this.state.page >= parseInt((all_posts.length - 1) / UI_PAGE_SIZE) ? 'disabled' : ''}`} onClick={e => this.handlePageTurn(1)}>&rarr;</li>
								<li className={`page-arrow ${this.state.page >= parseInt((all_posts.length - 1) / UI_PAGE_SIZE) ? 'disabled' : ''}`} onClick={e => this.handlePageTurn(Infinity)}>&#8608;</li>
							</ul>
							<span id="help_link_container">
								<a target="_blank" href="https://www.youtube.com/watch?v=n3c9-XpAo4E" id="help_link">
									<span>Help</span>
								</a>
							</span>
						</div>
					</section>
				</div>
			</div>;
	}
}