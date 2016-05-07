
# About

League of Quotes let's you test your knowledge of champions' quotes through quizzes. For each quiz you will be presented with a number of quotes the champion says and you need to determine what triggers the quote. Once you submit the quiz you can see which questions you got wrong and their correct answers. 
You can also see how well other players know champions based on their champion mastery points. If you connect your League of Legends account before starting a quiz, your results will be added to this data

It is an entry for the [2016 Riot Games API Challenge](https://developer.riotgames.com/discussion/announcements/show/eoq3tZd1)

# Credits


All code by Derpthemeus (NA)

Project concept, front-end design, and logo by Skye3 (NA)

Quote transcriptions from [the unofficial League of Legends Wiki](http://leagueoflegends.wikia.com/wiki/League_of_Legends_Wiki), licensed under [CC-BY-SA](http://creativecommons.org/licenses/by-sa/3.0/)

Quote audio from [the unofficial League of Legends Wiki](http://leagueoflegends.wikia.com/wiki/League_of_Legends_Wiki), owned by Riot Games and used following [Riot Games' guidelines](http://www.riotgames.com/legal-jibber-jabber)

# Setup
If you just want to use the website, it is live at [projects.derpthemeus.com/leagueofquotes](http://projects.derpthemeus.com/leagueofquotes). If you want to run your own version, you will need to clone the repository and have [Node.js](https://nodejs.org/) installed. The steps below assume you have cloned the project and are in its root directory

The server uses a MongoDB database to store data, and both the server and data downloader use the Riot API. Both of these services require authorization that you will need to setup through environment variables or the secrets<i></i>.js file. If using the secrets<i></i>.js file, rename the [secrets-EXAMPLE.js](https://github.com/Derpthemeus/LeagueOfQuotes/blob/master/secrets-EXAMPLE.js) file and replace the example values with yours

Description | Name in secrets<i></i>.js | Environment variable
--- | --- | ---
[MongoDB server connection string](https://docs.mongodb.com/manual/reference/connection-string/) | mongoDbUrl | OPENSHIFT_MONGODB_DB_URL
[Riot Games API key](https://developer.riotgames.com/) | riotApiKey | RIOT_API_KEY

Before running the server or data downloader you will need to setup dependencies with `npm install`.

The project contains static data from the Wiki and Riot API (stored in [data.json](https://github.com/Derpthemeus/LeagueOfQuotes/blob/master/data.json), but you may need to update it. To do this you will need to run the data downloader with `node run downloadData`. You may also need to update [dataDownloader.js](https://github.com/Derpthemeus/LeagueOfQuotes/blob/master/dataDownloader.js) to change champion info if their pages have been changed since the file was last updated.

When you're ready to start the server, run `node run start`

# Quote parsing

All quotes come from [the unofficial League of Legends Wiki](http://leagueoflegends.wikia.com/wiki/League_of_Legends_Wiki) and are downloaded and parsed by [dataDownloader.js](https://github.com/Derpthemeus/LeagueOfQuotes/blob/master/dataDownloader.js). Parsing the pages was slightly more difficult than I had originally hoped because pages follow different formats and had to be parsed differently. The main formats are:

* [at championName/Background#Quotes](http://leagueoflegends.wikia.com/wiki/Thresh/Background#Quotes)
* [at championName/Quotes with large underlined trigger info](http://leagueoflegends.wikia.com/wiki/Aurelion_Sol/Quotes)
* [at championName/Quotes with smaller trigger info](http://leagueoflegends.wikia.com/wiki/Brand/Quotes)

Each of these formats can also have [a tab menu to choose between multiple skins/versions](http://leagueoflegends.wikia.com/wiki/Trundle/Background#Quotes) and the pages are constantly being updated so the formats can change. There are also a few "extra special" pages including:

* [Vi's quote header has a space at the end of it](http://leagueoflegends.wikia.com/wiki/Vi/Background)
* [Brand seems to have HTML \<p> elements in strange places](http://leagueoflegends.wikia.com/wiki/Brand/Quotes)
* [Elise has quotes in 2 tabs](http://leagueoflegends.wikia.com/wiki/Elise/Background#Quotes)

I had to modify the parsers to handle these pages while still working for other pages. The fixes are all commented in the source code.

I had originally hoped I wouldn't have to do anything specific for each champion, but I ended up deciding to manually list which format each champion used to make parsing easier.



# Data Grouping

Results for each question are grouped together by mastery score range. Each question has 20 groups containing players who have mastery points within a 50k range.

I want to change the group sizes so there are an equal amount of players in each group, but I could not determine the distribution of players' scores without any data. The groups are designed to be easily changeable in the future so I can create a more even player distribution between the groups


# Frequently Asked Questions

## Why quotes?

The data is easily accessible (through the Wiki) so we didn't have to come up with unique questions for each champion, most champions have a fair amount of quotes so quizzes can be a decent length, and it doesn't change much with each game update

## I found an error with a quote or a quote thats missing, what should I do?

First, make sure the quote is correct on [the wiki](http://leagueoflegends.wikia.com/wiki/). If its wrong there, you can create an account and fix it there. If it is correct on the wiki but not on the site, feel free to [create an issue on GitHub](https://github.com/Derpthemeus/LeagueOfQuotes/issues) or [message me on Reddit ](https://www.reddit.com/message/compose/?to=Derpthemeus&subject=League%20of%20Quotes)
A few quote are intentionally omitted because they are easy (just champion laughs) or they are specific to a certain map or gamemode that many people don't play. If you think a quote should be excluded, feel free to report it as well.