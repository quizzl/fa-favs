import { fetch } from 'whatwg-fetch'

window.addEventListener('load', e => {
	browser.tabs.create({ url: 'browse.html' })
	
	// browser.storage.local.set({ a: { last: 0, posts: [1, 2, 3] } }).then(_ => browser.storage.local.get(null)).then(store => {
	// 	for(const k of Object.keys(store)) {
	// 		if(store.hasOwnProperty(k))
	// 			console.log(store[k])
	// 	}
	// });
})
