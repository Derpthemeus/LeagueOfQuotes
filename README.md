
# About

League of Quotes let's you test your knowledge of champions' quotes through quizzes. For each quiz you will be presented with a number of quotes the champion says and you need to determine what triggers the quote. Once you submit the quiz you can see which questions you got wrong and their correct answers. 
You can also see how well other players know champions based on their champion mastery points. If you connect your League of Legends account before starting a quiz, your results will be added to this data


# Credits


All code by Derpthemeus (NA)

Project concept, front-end design, and logo by Skye3 (NA)

Quote transcriptions from [the unofficial League of Legends Wiki](http://leagueoflegends.wikia.com/wiki/League_of_Legends_Wiki), licensed under [CC-BY-SA](http://creativecommons.org/licenses/by-sa/3.0/)

Quote audio from [the unofficial League of Legends Wiki](http://leagueoflegends.wikia.com/wiki/League_of_Legends_Wiki), owned by Riot Games and used following [Riot Games' guidelines](http://www.riotgames.com/legal-jibber-jabber)

# Setup
If you just want to use the website, it is live at [projects.derpthemeus.com/leagueofquotes](http://projects.derpthemeus.com/leagueofquotes). If you want to run your own version, you will need to clone the repository and have [Node.js](https://nodejs.org/) installed

The steps below assume you have cloned the project and are in its root directory

Before you can do anything else you will need to setup dependencies with `npm install` and create a secrets.js file. Info on how to do this can be found in the file secret-EXAMPLE.js

The project contains static data from the Wiki and Riot API, but you may need to update it. To do this you will need to run the data downloader with `node run downloadData`. You may also need to update dataDownloader.js to update champion info if their pages have been changed since the file was last updated.

When you're ready to start the server, run `node run start`


# Quote parsing

All quotes come from [the unofficial League of Legends Wiki](http://leagueoflegends.wikia.com/wiki/League_of_Legends_Wiki). Parsing the pages was slightly more difficult than I had originally hoped because some pages follow different formats and had to be parsed differently. The main formats are:

* [at championName/Background#Quotes](http://leagueoflegends.wikia.com/wiki/Thresh/Background#Quotes)
* [at championName/Quotes with large underlined trigger info](http://leagueoflegends.wikia.com/wiki/Aurelion_Sol/Quotes)
* [at championName/Quotes with smaller trigger info](http://leagueoflegends.wikia.com/wiki/Brand/Quotes)

Each of these formats can also [tab menu to choose between multiple skins/versions](http://leagueoflegends.wikia.com/wiki/Trundle/Background#Quotes) and the pages are constantly being updated so the formats can change.
There are also a few "extra special" pages:

* [Vi's quote header has a space at the end of it](http://leagueoflegends.wikia.com/wiki/Vi/Background)
* [Brand and a few others seem to have HTML \<p> elements in strange places](http://leagueoflegends.wikia.com/wiki/Brand/Quotes)

I had originally hoped I wouldn't have to do anything specific for each champion, but I ended up deciding to manually check what format each champion used to make parsing easier.



# Data Grouping

Results for each question are grouped together by mastery score range. Each question has 20 groups containing players who have mastery points within a 50k range.

I want to change the sizes so there is an equal amount of players in each group, but I could not determine the distribution of players' scores without any data. The groups are designed to be easily changeable in the future so I can create a more even player distribution between the groups


# Hypothetically Asked Questions

(like an FAQ but made before questions were even asked)
## Why quotes?

The data is easily accessible (through the Wiki) so we don't have to come up with questions for champions, most champions have a fair amount of quotes so quizzes can be a decent length, and it doesn't change much with each game update
