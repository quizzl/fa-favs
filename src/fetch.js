import { fetch } from 'whatwg-fetch';
import { Map, Set } from 'immutable';
import { EMPTY, from, merge, of } from 'rxjs';
import Promise from 'promise-polyfill';
import { concatMap, delay, concat, map, reduce, filter, mergeMap, publish } from 'rxjs/operators';
import { TOTAL_RATE_LIMIT, PER_USER_POST_LIMIT, PAGE_LIMIT, SETTINGS_KEY_PREFIX } from './consts'

function promisify(f, k) {
	return new Promise((resolve, reject) => f(k, x => { if(chrome.runtime.lastError) reject(chrome.runtime.lastError); else resolve(x); }));
}

export function storage_get(k) {
	return promisify(chrome.storage.local.get.bind(chrome.storage.local), k);
}
export function storage_set(k) {
	return promisify(chrome.storage.local.set.bind(chrome.storage.local), k);
}
export function storage_remove(k) {
	return promisify(chrome.storage.local.remove.bind(chrome.storage.local), k);
}

// used to limit per user, but no point if we expect just one window
function get_user_favs(user, page) {
	return fetch(`https://www.furaffinity.net/favorites/${user}/${page === null ? '' : `${page}/next/`}`).then(s => s.text())
			.then(t => {
				const dom = new DOMParser().parseFromString(t, 'text/html');
				const baseEl = dom.createElement('base');
				baseEl.setAttribute('href', 'https://furaffinity.net');
				dom.head.append(baseEl); // thanks Christos Lytras @https://stackoverflow.com/a/55606029/3925507
				
				const section_body = dom.querySelector('.section-body');
				console.log(section_body, dom.querySelector('#gallery-favorites'), section_body.innerText.match(/User\s+.*?was\s+not\s+found\s+in\s+our\s+database\./i));
				if(dom.querySelector('#gallery-favorites') === null && section_body && section_body.innerText.match(/User\s+.*?was\s+not\s+found\s+in\s+our\s+database\./i))
					return null; // user probably not found
				
				return Array.from(dom.querySelectorAll('#gallery-favorites > figure')).map(fig => {
					const id = parseInt(fig.id.match(/^sid\-(\d+)$/i)[1]);
					const fav_id = parseInt(fig.getAttribute('data-fav-id'));
					const artist = fig.getAttribute('data-user').match(/^u-(.+)$/i)[1]
					const rating = fig.className.match(/r\-(adult|mature|general)/i)[1];
					const thumb = (() => {
						const thumb = fig.querySelector('img').src;
						if(thumb.indexOf('furaffinity.net') === -1)
							return `https://furaffinity.net/${thumb}`;
						else
							return thumb;
					})();
					const title = fig.querySelector('figcaption a').innerText;
					return {
						id, fav_id, rating, thumb, title, artist,
						fetch_date: Date.now(),
						visited: false
					};
					// return console.log(ret) || ret;
				});
				// console.log(Array.from(dom.getElementById('gallery-favorites').childNodes).filter(e => e.tagName && e.tagName.toLowerCase() === 'figure'));
			}); // .then(e => console.log(e) || e, e => console.log(e) || e);
}
function favs_append(u, favs) {
	return storage_get(u)
		.then(r => {
			const keys = {};
			const prev_favs = r.hasOwnProperty(u) ? JSON.parse(r[u]) : [];
			const next_favs = Map(favs.concat(prev_favs).map(f => [f.fav_id, f])).valueSeq().toArray(); // dedupe with Map, favor existing entries
			keys[u] = JSON.stringify(next_favs);
			const done = next_favs.length < prev_favs.length + favs.length || !r.hasOwnProperty(u);
			// console.log(next_favs.length < prev_favs.length + favs.length, !r.hasOwnProperty(u));
			return storage_set(keys).then(_ => done)
		})
}
function get_all_favs(users, iter = 0) {
	
	// const initial = get_favs(.map(([u, page]) => u))
	// 	.then(m => m.mergeWith(
	// 			(favs, [_, page]) => [favs, page],
	// 			users.map(([u, page]) => [u, [page, []]])
	// 		).toArray());
	const updater$ = from(users)
		.pipe(
				concatMap((x, i) => i > 0 ? of(x).pipe(delay(TOTAL_RATE_LIMIT)) : of(x)), // TODO not very sophisticated, e.g. if we had multiple instances running; really we want a global rate limit based on a last_updated in webstorage. might get around to it.
				mergeMap(([u, page]) =>
					get_user_favs(u, page).then(next_favs =>
						next_favs && // pass through nulls
						favs_append(u, next_favs)
							.then(done => [
								u,
								done,
								next_favs.length > 0
									? next_favs[next_favs.length - 1].fav_id
									: null
							])
					)
				),
				filter(x => x !== null)
			);
	return updater$.pipe(
		// need to publish and make hot: updater$ is cold so pulling on both repeated the whole chain and sent two requests
		publish(updater_multi$ => merge(
				updater_multi$,
				updater_multi$.pipe(
						reduce((acc, [u, done, page]) => (done || iter >= (PAGE_LIMIT - 1) ? acc : acc.concat([[u, page]])), []),
						mergeMap(next_users => (next_users.length > 0 ? get_all_favs(next_users, iter + 1) : EMPTY))
					)
			))
		);
		
	// let P = [Q(Map())];
	// for(const [u, [last_fetch, favs]] of users.toArray()) {
	// 	if(Date.now() > last_fetch + PER_USER_POST_LIMIT) {
	// 		const P_next = P[P.length - 1].then(acc =>
	// 						get_user_favs(u, page).then(next => {
	// 							const acc_ = acc.update(u, next, prev => prev.concat(next))
								
	// 								.then(_ => acc_)
	// 						}) 
	// 		P.push(P_next);
	// 	}
	// }
	// return P.then(acc => {
	// 	const next_users = acc.toArray()
	// 	                      .filter(([k, v]) =>
	// 	                      		(page < PAGE_LIMIT && users.get(k).length > 0) // keep advancing pages so long as we're under the page limit and the user isn't brand new
	// 	                      		&& Set(users.get(k).map(f => f.id)).intersect(v.map(f => f.id)).size === 0) // ... and there are no intersects with the existing users
	// 	                      .map(([k, _v]) => users[k]);
	// 	return get_all_favs(next_users, page + 1).then(acc_ => acc_.mergeWith((a, b) => a.concat(b), acc));
	// });
}

function flag_visited_(user, prev_favs, viewed_favs) {
	const keys = {};
	const viewed_fav_ids = Set((viewed_favs || []).map(f => f.fav_id));
	keys[user] = JSON.stringify(prev_favs.map(f => Object.assign(f, { visited: f.visited || viewed_favs === undefined || viewed_fav_ids.has(f.fav_id) })));
	return storage_set(keys);
}

export function flag_visited(user, viewed_favs) {
	return storage_get(user)
		.then(r => {
			if(user !== null) {
				if(r.hasOwnProperty(user))
					flag_visited_(user, JSON.parse(r[user]), viewed_favs)
			}
			else {
				const P_users = [];
				for(const k of Object.keys(r)) {
					if(r.hasOwnProperty(k) && k.indexOf(SETTINGS_KEY_PREFIX) === -1) {
						P_users.push(flag_visited_(k, JSON.parse(r[k]), viewed_favs));
					}
				}
				return Promise.all(P_users);
			}
		});
}

export function remove_user(user) {
	return storage_remove(user);
}

export function get_favs(keys = null) {
	return storage_get(keys).then(store => Map().withMutations(users => {
			for(const k of Object.keys(store)) {
				if(store.hasOwnProperty(k) && k.indexOf(SETTINGS_KEY_PREFIX) === -1) {
					const raw_favs = JSON.parse(store[k]);
					const unique_favs = Map(raw_favs.map(f => [f.fav_id, f])).valueSeq().toArray(); // unique favs per user (not overall, although maybe consolidate... consider it.)
					users.set(k, unique_favs);
				}
			}
		})
	);
}
export function update_favs(users) {
	return get_all_favs(users.map(u => [u.trim(), null])); // tack on fake page ids
}