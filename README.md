# FA Favs

FA Favs is an extension for Firefox and Chrome that allows you to subscribe to the favorites of FurAffinity users. This extension opens as a new tab and gently pulls favorites and thumbnails from a subscription list that you build on the extension's UI.

I consistently find many of my eventual favorite artists through the favorites of other users. FA is largely designed to facilitate this kind of exploration, but not being able to subscribe to the favorites by themselves acts against this otherwise excellent way to explore the content on the site.

## Build instructions

This is a standard webpack-Babel project. From the project root:

```
$ npm i
$ npx webpack
```

This will pack two files: `bg/tab.js` which is the background tab spawner process, and `public/js/browse.main.js` which is the main script that serves `browse.html`, the core UI to the extension.

Finally, load [as a temporary extension as usual](https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/). Enter usernames of FA users and press enter to start populating your subscriptions.

## Rate-limiting features

Reading from previous experiences, FA can be stringent on batched requests and mass downloading. This extension works hard to limit data transfer to that of typical browsing or less, to ensure that those limits and your account's connection are respected.

1. This extension forces itself to only have one instance open at a time. When you try to open it multiple times, it closes all others first before opening a new one.
1. All queries for user favorites pages are rate-limited by 2 seconds _per page, per user_. If you have a lot of subscriptions, it'll take a minute or two to pull the latest results down: this is probably for the safest. Just load it up and let it run in the background for a little while.
1. Thumbnail URLs are taken directly from favorites pages &mdash; these are what are displayed on results pages, as opposed to full-scale artwork files, so to the FA servers the load should look just like browsing a favorites page.
1. Further to that point, results are paginated to the same size as FA's default: 48-entries per page. This ensures the traffic for thumbnails is no larger than a regular browsing session. There is no thumbnail pre-loading.
1. Extensions in general don't have direct access to your secure identifying cookies, so they cannot export them from your browser.
1. This extension requests pages using your cookies so that it can process mature/adult artwork, as well as favorites from users that elect to only allow other users to view their pages. I tried to make the code as compact as possible to make it easy to verify the requests that this extension is making on your behalf. The side effects of this code are as follows:

    - Retrieves the URL of your current highlighted FA tab (if you're currently on FA) so you can quickly add the user you're looking at;
    - Queries your subscriptons' favorites pages;
    - Retrieves thumbnails (this is just through `<img />` tags);
    - Persists your subscriptions and settings in your browser's WebStorage.