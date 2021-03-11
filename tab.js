browser.browserAction.onClicked.addListener(function(e) {
	browser.tabs.query({active: true}).then(ts => {
		const active_url = new URL(ts.filter(t => t.hasOwnProperty('url'))[0].url);
		const user = active_url.pathname.match(/^\/(favorites|user|gallery|scraps|journals)\/([^\/]+)/i);
		return user && user[2];
	})
		.catch(_ => '')
		.then(user => browser.tabs.create({ url: `public/browse.html?u=${user}` }));
	// ;
});