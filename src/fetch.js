import { fetch } from 'whatwg-fetch';
import { Map, Set } from 'immutable';
import { EMPTY, from, merge, of } from 'rxjs';
import { concatMap, delay, concat, map, reduce, mergeMap, publish } from 'rxjs/operators';

// used to limit per user, but no point if we expect just one window
const TOTAL_RATE_LIMIT = 2E3; // limit the total update loop rate (ms)
const PER_USER_POST_LIMIT = 1000; // limit num posts per user for space
const PAGE_LIMIT = 2; // max # pages to search for catchup
function get_user_favs(user, page) {
	return fetch(`https://www.furaffinity.net/favorites/${user}/${page === null ? '' : `${page}/next/`}`).then(s => s.text())
			.then(t => {
				const dom = new DOMParser().parseFromString(t, 'text/html');
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
					const title_el = fig.querySelector('figcaption a').innerText;
					const title = title_el.innerText;
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
	return browser.storage.local.get(u)
		.then(r => {
			const keys = {};
			const prev_favs = r.hasOwnProperty(u) ? JSON.parse(r[u]) : [];
			const next_favs = Map(favs.concat(prev_favs).map(f => [f.fav_id, f])).valueSeq().toArray(); // dedupe with Map, favor existing entries
			keys[u] = JSON.stringify(next_favs);
			const done = next_favs.length < prev_favs.length + favs.length || !r.hasOwnProperty(u);
			// console.log(next_favs.length < prev_favs.length + favs.length, !r.hasOwnProperty(u));
			return browser.storage.local.set(keys).then(_ => done)
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
				concatMap(x => of(x).pipe(delay(TOTAL_RATE_LIMIT))), // TODO not very sophisticated, e.g. if we had multiple instances running; really we want a global rate limit based on a last_updated in webstorage. might get around to it.
				mergeMap(([u, page]) =>
					get_user_favs(u, page).then(next_favs => favs_append(u, next_favs).then(done => [u, done, next_favs[next_favs.length - 1]]))
				)
			);
	return updater$.pipe(
		publish(updater_multi$ => merge(
				updater_multi$,
				updater_multi$.pipe(
						reduce((acc, [u, done, page]) => (done || iter < PAGE_LIMIT ? acc : acc.concat([u, page])), []),
						mergeMap(next_users => next_users.length > 0 ? get_all_favs(next_users, iter + 1) : EMPTY)
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

export function get_favs(keys = null) {
	return browser.storage.local.get(keys).then(store => Map([['Feve', []]]).withMutations(users => {
			for(const k of Object.keys(store)) {
				if(store.hasOwnProperty(k)) {
					const raw_favs = JSON.parse(store[k]);
					const unique_favs = Map(raw_favs.map(f => [f.fav_id, f])).valueSeq().toArray(); // unique favs per user (not overall, although maybe consolidate... consider it.)
					users.set(k, unique_favs);
				}
			}
		})
	);
}
export function update_favs(users) {
	return get_all_favs(users.map(u => [u, null])); // tack on fake page ids
}