const tab_idxs = [];
let tabs_fired = 0, tabs_finished = 0;
chrome.browserAction.onClicked.addListener(e => {
	chrome.tabs.query({}, ts => { // active: true
		const active_tabs = ts.filter(t => t.hasOwnProperty('url'));
		const existing_tabs = active_tabs.filter(t => tab_idxs.indexOf(t.id) !== -1);
		if(tabs_fired === tabs_finished) {
			const tab_user = (() => {
				try {
					const active_fa = active_tabs.map(t => new URL(t.url)).filter(u => u.hostname.match(/furaffinity.net$/i))[0];
					const user = active_fa.pathname.match(/^\/(favorites|user|gallery|scraps|journals)\/([^\/]+)/i);
					return user && user[2];
				}
				catch {
					return '';
				}
			})();
			
			console.log(active_tabs);
			
			chrome.tabs.remove(existing_tabs.map(t => t.id)); // remove an existing tab to avoid annoying race conditions and rate-limiting risks
			
			tabs_fired++;
			chrome.tabs.create({ url: `public/browse.html?u=${tab_user}` }, t => {
				tab_idxs.push(t.id);
				tabs_finished++;
			});
		}
	});
});