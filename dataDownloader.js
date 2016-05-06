//the site depends a lot of external data sources. To cut back on startup times and prevent errors caused by 
//bad (misformatted or incorrect) data, data is cached and can be manually validated before being used

var secrets = require("./secrets.js");
var utils = require("./utils.js");
var cheerio = require("cheerio");
var fs = require("fs");
var Promise = require("Promise");
var _eval = require("eval");

var data = {
    quizData: {},
    //list of champions in alphabetical name
    championList: [],
    //champions by ID
    champions: {}
};


//champion IDs by name
var championIds = {};

function saveData() {
    console.log("Saving file...");
    fs.writeFile("./data.json", JSON.stringify(data, null, "\t"), function (err) {
        if (!err) {
            console.log("File saved (all done)");
        } else {
            console.error(err);
        }
    });
}

function setupAllData() {
    utils.setup(function (_utils) {
        utils = _utils;
        utils.requestJSON(utils.getDDragonURL("data/en_US/champion.json"), function (ddragonResponse) {
            utils.forEach(ddragonResponse.data, function (champion) {
                data.championList.push({
                    name: champion.name,
                    icon: champion.image.full,
                    id: champion.key
                });
                data.champions[champion.key] = {
                    name: champion.name,
                    icon: champion.image.full,
                    id: champion.key
                };
                championIds[champion.name] = champion.key;
            });
            data.championList.sort(function (a, b) {
                var nameA = a.name.toUpperCase();
                var nameB = b.name.toUpperCase();
                return (nameA < nameB) ? -1 : (nameA > nameB) ? 1 : 0;
            });

            utils.forEach(data.champions, function (champion) {
                data.quizData[champion.id] = {};
            });
            data.ddragonUrl = utils.getDDragonURL();

            setupQuotesData().then(function () {
                saveData();
            }, function () {
                throw new Error("promises failed");
            });
        });
    });
}


function setupQuotesData() {
    //values can be an array containing champion names to block only for certain champs. An non-object value is global
    var blacklistedTriggers = {
        "Upon selection": true, //These are in different positions depending on if the champion has tabbed quotes, making them a pain to get
        "Upon Selection": true,
        "Laugh": true, //These are usually (if not always) "[championName] laughs"
        "Laugh as Hyena Warwick": ["Warwick"], //Laugh
        "Laugh While using Guqin Sona": ["Sona"], //Not technically laughing, but every other laugh is blocked
        "Laugh While using Arcade Sona": ["Sona"],
        "Taunt": ["Rammus"], //doesn't actually have any audio
        "Upon consuming a Health Potion": ["Poppy"], //none of the quotes have audio
        "Co-op vs. AI Responses": true,
        "Uncategorized": true, //Kalista has these, there may be others
        "Unknown champion taunts": true, //Poppy has these, there may be others
        "West Altar": true, //Some champions (mosty from the Sahdow Isles) have special quotes when capturing altars on TT. Lots of players don't play this mode, so they can be skipped
        "East Altar": true,
        "Upon buying Devourer": true //rip ghost dog
    };

    function getTriggerName($) {
        //Aurelion Sol (possibly others) have references to other skins marked with "[S|L]" (which usually provide mouse-over previews of the skin)
        //2 different types of spaces are used in triggers, the regexes switch them all to normal spaces (0x20 UTF-8) and remove any double (or more) spaces
        return $.text().replace("[S|L]", "").trim().replace(/\xa0/g, " ").replace(/ {2,}/g, " ");


    }
    //different wiki pages are formatted differently and need to be parsed differently.
    //a parser is passed a cheerio object representing the page containing quotes and a string that is the champion's name
    var wikiParsers = {
        background: {
            parser: function ($, championName, isTabbed) {
                var quoteData = {
                    quotes: {},
                    triggers: []
                };

                var list;
                if (isTabbed) {
                    list = $("#Quotes").parent().nextAll(".tabber").children(".tabbertab").first().children();
                    if (championName === "Shyvana" || championName === "Elise") {
                        //include the second tab (dragon form/ spider form)
                        list = list.add($($("#Quotes").parent().nextAll(".tabber").first().children(".tabbertab")[1]).children());
                    }
                } else {
                    list = $("#Quotes").parent().nextAll();
                }

                //Vi's page is improperly setup and the ID doesn't seem to be working. Hopefully this won't be needed for long
                if (championName === "Vi") {
                    list = $($(".mw-headline")[3]).parent().nextAll();
                }

                var parentTrigger, childTrigger;
                list.each(function () {
                    var element = $(this);
                    if (element.is("dl")) {
                        //Bard doesn't have a dt in his dd
                        if (element.find("dt").length === 0) {
                            childTrigger = getTriggerName(element);
                        } else if (element.children("dt").length !== 0) {
                            parentTrigger = getTriggerName(element.children("dt").first());
                            childTrigger = null;
                        } else {
                            //the dl is a child trigger that just modifies the parent. Its nested in a dd then another dt
                            childTrigger = getTriggerName(element.find("dt").first());
                        }
                    } else if (element.is("ul")) {
                        var trigger = childTrigger ? parentTrigger + " " + childTrigger : parentTrigger;
                        if (parentTrigger && !(blacklistedTriggers[trigger] && (typeof (blacklistedTriggers[trigger]) !== "object" || blacklistedTriggers[trigger].indexOf(championName) !== -1))) {
                            //this check is needed for Kindred (possibly others)
                            if (quoteData.triggers.indexOf(trigger) === -1) {
                                quoteData.triggers.push(trigger);
                            }
                            var lis = element.children("li");
                            lis.each(function () {
                                var li = $(this);
                                var button = li.find("button").first();
                                var file = getFile(button);
                                //make sure theres actually an audio file (not missing)
                                if (file) {
                                    var text = li.text().trim();
                                    var quote = {
                                        file: file,
                                        text: text,
                                        trigger: trigger
                                    };
                                    quoteData.quotes[getQuoteId(quote)] = quote;
                                }
                            });
                        }
                    }
                });
                return quoteData;
            },
            //appended to the end of the champion's name to determine the page name (ex: Thresh/Background)
            pageName: "/Background"
        },
        quotesH2: {
            parser: function ($, championName, isTabbed) {
                var quoteData = {
                    quotes: {},
                    triggers: []
                };

                var list;
                if (isTabbed) {
                    list = $(".tabber").children(".tabbertab").first().children();
                } else {
                    list = $.root().children();
                }

                var parentTrigger, childTrigger;
                list.each(function () {
                    var element = $(this);
                    if (element.is("h2")) {
                        parentTrigger = getTriggerName(element.find(".mw-headline"));
                        childTrigger = null;
                    } else if (element.is("ul")) {
                        var trigger = childTrigger ? parentTrigger + " " + childTrigger : parentTrigger;
                        if (parentTrigger && !(blacklistedTriggers[trigger] && (typeof (blacklistedTriggers[trigger]) !== "object" || blacklistedTriggers[trigger].indexOf(championName) !== -1))) {
                            //this check is needed for Kindred (possibly others)
                            if (quoteData.triggers.indexOf(trigger) === -1) {
                                quoteData.triggers.push(trigger);
                            }
                            var lis = element.children("li");
                            lis.each(function () {
                                var li = $(this);
                                var button = li.find("button").first();
                                var file = getFile(button);
                                //make sure theres actually an audio file (not missing)
                                if (file) {
                                    var text = li.text().trim();
                                    var quote = {
                                        file: file,
                                        text: text,
                                        trigger: trigger
                                    };
                                    quoteData.quotes[getQuoteId(quote)] = quote;
                                }
                            });
                        }
                    } else if (element.is("h3")) {
                        childTrigger = getTriggerName(element.find(".mw-headline").first());
                    }
                });
                return quoteData;
            },
            //appended to the end of the champion's name to determine the page name (ex: Thresh/Background)
            pageName: "/Quotes"
        },
        quotesDL: {
            parser: function ($, championName, isTabbed) {
                var quoteData = {
                    quotes: {},
                    triggers: []
                };
                var list;
                if (isTabbed) {
                    list = $(".tabber").children(".tabbertab").first().children();
                } else {
                    list = $("*");
                }
                var parentTrigger, childTrigger;
                list.each(function () {
                    var element = $(this);
                    if (element.is("dl")) {
                        if (element.children("dt").length !== 0) {
                            parentTrigger = getTriggerName(element.children("dt").first());
                            childTrigger = null;
                        } else {
                            //the dl is a child trigger that just modifies the parent. Its nested in a dd then another dt
                            childTrigger = getTriggerName(element.find("dt").first());
                        }
                    } else if (element.is("ul")) {
                        var trigger = childTrigger ? parentTrigger + " " + childTrigger : parentTrigger;
                        if (parentTrigger && !(blacklistedTriggers[trigger] && (typeof (blacklistedTriggers[trigger]) !== "object" || blacklistedTriggers[trigger].indexOf(championName) !== -1))) {
                            //this check is needed for Kindred (possibly others)
                            if (quoteData.triggers.indexOf(trigger) === -1) {
                                quoteData.triggers.push(trigger);
                            }
                            var lis = element.children("li");
                            lis.each(function () {
                                var li = $(this);
                                var button = li.find("button").first();
                                var file = getFile(button);
                                //make sure theres actually an audio file (not missing)
                                if (file) {
                                    var text = li.text().trim();
                                    var quote = {
                                        file: file,
                                        text: text,
                                        trigger: trigger
                                    };
                                    quoteData.quotes[getQuoteId(quote)] = quote;
                                }
                            });
                        }
                    }
                });
                return quoteData;
            },
            //appended to the end of the champion's name to determine the page name (ex: Thresh/Background)
            pageName: "/Quotes"
        }
    };
    //returns the file a button links to
    function getFile(button) {
        if (!button.is(".no-audio")) {
            var onclick = button.attr("onclick");
            if (onclick) {
                var file;
                //this IS vulnerable to malicious code injection, but users can NOT define custom code when adding a playback button on the wiki (it uses a template)
                _eval(onclick, {
                    file: file,
                    wgOggPlayer: {
                        init: function (player, params) {
                            file = params.videoUrl;
                        }
                    }
                });
                return file.split("/revision/latest?")[0];
            }
        }
        return null;

    }

    //contains info for which parser will handle each champion's page
    var parserInfo = {
        "Aatrox": {parser: wikiParsers.quotesH2, isTabbed: true},
        "Ahri": {parser: wikiParsers.quotesH2, isTabbed: false},
        "Akali": {parser: wikiParsers.quotesH2, isTabbed: false},
        "Alistar": {parser: wikiParsers.quotesH2, isTabbed: false},
        "Amumu": {parser: wikiParsers.quotesH2, isTabbed: true},
        "Anivia": {parser: wikiParsers.quotesH2, isTabbed: true},
        "Annie": {parser: wikiParsers.quotesH2, isTabbed: false},
        "Ashe": {parser: wikiParsers.quotesH2, isTabbed: false},
        "Aurelion Sol": {parser: wikiParsers.quotesH2, isTabbed: false},
        "Azir": {parser: wikiParsers.background, isTabbed: true},
        "Bard": {parser: wikiParsers.background, isTabbed: false},
        "Blitzcrank": {parser: wikiParsers.background, isTabbed: false},
        "Brand": {parser: wikiParsers.quotesDL, isTabbed: true},
        "Braum": {parser: wikiParsers.background, isTabbed: false},
        "Caitlyn": {parser: wikiParsers.background, isTabbed: false},
        "Cassiopeia": {parser: wikiParsers.quotesDL, isTabbed: true},
        "Cho'Gath": {parser: wikiParsers.background, isTabbed: true},
        "Corki": {parser: wikiParsers.background, isTabbed: false},
        "Darius": {parser: wikiParsers.background, isTabbed: true},
        "Diana": {parser: wikiParsers.background, isTabbed: false},
        "Dr. Mundo": {parser: wikiParsers.background, isTabbed: true},
        "Draven": {parser: wikiParsers.background, isTabbed: true},
        "Ekko": {parser: wikiParsers.background, isTabbed: false},
        "Elise": {parser: wikiParsers.background, isTabbed: true},
        "Evelynn": {parser: wikiParsers.background, isTabbed: false},
        "Fiora": {parser: wikiParsers.background, isTabbed: true},
        "Ezreal": {parser: wikiParsers.background, isTabbed: true},
        "Fizz": {parser: wikiParsers.background, isTabbed: true},
        "Fiddlesticks": {parser: wikiParsers.background, isTabbed: false},
        "Galio": {parser: wikiParsers.background, isTabbed: true},
        "Gangplank": {parser: wikiParsers.background, isTabbed: true},
        "Graves": {parser: wikiParsers.background, isTabbed: false},
        "Garen": {parser: wikiParsers.background, isTabbed: false},
        "Gnar": {parser: wikiParsers.background, isTabbed: false},
        "Gragas": {parser: wikiParsers.background, isTabbed: false},
        "Hecarim": {parser: wikiParsers.background, isTabbed: true},
        "Heimerdinger": {parser: wikiParsers.background, isTabbed: true},
        "Illaoi": {parser: wikiParsers.quotesH2, isTabbed: true},
        "Irelia": {parser: wikiParsers.background, isTabbed: false},
        "Janna": {parser: wikiParsers.quotesH2, isTabbed: true},
        "Jarvan IV": {parser: wikiParsers.background, isTabbed: false},
        "Jax": {parser: wikiParsers.background, isTabbed: false},
        "Jayce": {parser: wikiParsers.background, isTabbed: true},
        "Jhin": {parser: wikiParsers.quotesH2, isTabbed: true},
        "Jinx": {parser: wikiParsers.background, isTabbed: false},
        "Kalista": {parser: wikiParsers.background, isTabbed: false},
        "Karma": {parser: wikiParsers.background, isTabbed: true},
        "Karthus": {parser: wikiParsers.background, isTabbed: true},
        "Kassadin": {parser: wikiParsers.background, isTabbed: false},
        "Katarina": {parser: wikiParsers.background, isTabbed: false},
        "Kayle": {parser: wikiParsers.background, isTabbed: true},
        "Kennen": {parser: wikiParsers.background, isTabbed: false},
        "Kha'Zix": {parser: wikiParsers.background, isTabbed: true},
        "Kindred": {parser: wikiParsers.background, isTabbed: false},
        "Kog'Maw": {parser: wikiParsers.background, isTabbed: true},
        "LeBlanc": {parser: wikiParsers.background, isTabbed: false},
        "Lee Sin": {parser: wikiParsers.background, isTabbed: false},
        "Leona": {parser: wikiParsers.background, isTabbed: true},
        "Lissandra": {parser: wikiParsers.background, isTabbed: true},
        "Lucian": {parser: wikiParsers.background, isTabbed: true},
        "Lulu": {parser: wikiParsers.background, isTabbed: false},
        "Lux": {parser: wikiParsers.background, isTabbed: false},
        "Malphite": {parser: wikiParsers.background, isTabbed: true},
        "Malzahar": {parser: wikiParsers.quotesDL, isTabbed: false},
        "Maokai": {parser: wikiParsers.background, isTabbed: false},
        "Master Yi": {parser: wikiParsers.background, isTabbed: true},
        "Miss Fortune": {parser: wikiParsers.background, isTabbed: false},
        "Mordekaiser": {parser: wikiParsers.background, isTabbed: false},
        "Morgana": {parser: wikiParsers.background, isTabbed: false},
        "Nami": {parser: wikiParsers.quotesH2, isTabbed: false},
        "Nasus": {parser: wikiParsers.background, isTabbed: true},
        "Nautilus": {parser: wikiParsers.background, isTabbed: false},
        "Nidalee": {parser: wikiParsers.background, isTabbed: false},
        "Nocturne": {parser: wikiParsers.background, isTabbed: true},
        "Nunu": {parser: wikiParsers.background, isTabbed: true},
        "Olaf": {parser: wikiParsers.background, isTabbed: true},
        "Orianna": {parser: wikiParsers.background, isTabbed: false},
        "Pantheon": {parser: wikiParsers.background, isTabbed: false},
        //Jokes only have partial audio (since they're split into multiple audio files)
        "Poppy": {parser: wikiParsers.background, isTabbed: true},
        "Quinn": {parser: wikiParsers.background, isTabbed: false},
        "Rammus": {parser: wikiParsers.background, isTabbed: false},
        "Rek'Sai": {parser: wikiParsers.background, isTabbed: true},
        "Renekton": {parser: wikiParsers.background, isTabbed: true},
        "Rengar": {parser: wikiParsers.background, isTabbed: false},
        "Riven": {parser: wikiParsers.background, isTabbed: false},
        "Rumble": {parser: wikiParsers.background, isTabbed: true},
        "Ryze": {parser: wikiParsers.background, isTabbed: false},
        "Sejuani": {parser: wikiParsers.background, isTabbed: true},
        "Shaco": {parser: wikiParsers.background, isTabbed: false},
        "Shen": {parser: wikiParsers.quotesDL, isTabbed: false},
        "Shyvana": {parser: wikiParsers.background, isTabbed: true},
        "Singed": {parser: wikiParsers.background, isTabbed: false},
        "Sion": {parser: wikiParsers.background, isTabbed: true},
        "Sivir": {parser: wikiParsers.background, isTabbed: true},
        "Skarner": {parser: wikiParsers.background, isTabbed: true},
        "Sona": {parser: wikiParsers.quotesH2, isTabbed: true},
        "Soraka": {parser: wikiParsers.background, isTabbed: true},
        "Swain": {parser: wikiParsers.background, isTabbed: false},
        "Syndra": {parser: wikiParsers.background, isTabbed: false},
        "Tahm Kench": {parser: wikiParsers.background, isTabbed: false},
        "Talon": {parser: wikiParsers.background, isTabbed: false},
        "Taric": {parser: wikiParsers.quotesDL, isTabbed: true},
        "Teemo": {parser: wikiParsers.background, isTabbed: true},
        "Thresh": {parser: wikiParsers.background, isTabbed: false},
        "Tristana": {parser: wikiParsers.background, isTabbed: true},
        "Trundle": {parser: wikiParsers.background, isTabbed: true},
        "Tryndamere": {parser: wikiParsers.background, isTabbed: true},
        "Twisted Fate": {parser: wikiParsers.background, isTabbed: true},
        "Twitch": {parser: wikiParsers.background, isTabbed: true},
        "Udyr": {parser: wikiParsers.background, isTabbed: true},
        "Urgot": {parser: wikiParsers.background, isTabbed: false},
        "Varus": {parser: wikiParsers.background, isTabbed: true},
        "Vayne": {parser: wikiParsers.background, isTabbed: false},
        "Veigar": {parser: wikiParsers.background, isTabbed: true},
        "Vel'Koz": {parser: wikiParsers.background, isTabbed: true},
        "Vi": {parser: wikiParsers.background, isTabbed: false},
        "Viktor": {parser: wikiParsers.background, isTabbed: false},
        "Vladimir": {parser: wikiParsers.background, isTabbed: true},
        "Volibear": {parser: wikiParsers.background, isTabbed: false},
        "Warwick": {parser: wikiParsers.background, isTabbed: false},
        "Wukong": {parser: wikiParsers.background, isTabbed: true},
        "Xerath": {parser: wikiParsers.background, isTabbed: true},
        "Xin Zhao": {parser: wikiParsers.background, isTabbed: false},
        "Yasuo": {parser: wikiParsers.background, isTabbed: true},
        "Yorick": {parser: wikiParsers.background, isTabbed: false},
        "Zac": {parser: wikiParsers.background, isTabbed: false},
        "Zed": {parser: wikiParsers.background, isTabbed: true},
        "Ziggs": {parser: wikiParsers.background, isTabbed: false},
        "Zilean": {parser: wikiParsers.background, isTabbed: false},
        "Zyra": {parser: wikiParsers.background, isTabbed: false}
    };

    //takes a query string containing a group of champion page names (up to 50 due to wiki limits) to be passed to the wiki API and returns a promise that resolves when all the champions in the group have been setup
    function setupQuotesGroup(query) {
        return new Promise(function (resolve, reject) {
            utils.requestJSON("http://leagueoflegends.wikia.com/api.php?action=query&prop=revisions&rvprop=content&rvparse&format=json&titles=" + query, function (wikiResponse) {
                utils.forEach(wikiResponse.query.pages, function (page) {
                    var championName = page.title.split("/")[0];
                    var html = page.revisions[0]["*"];

                    //Brand's and Sion's pages are not not working properly (there are probably others, these were just the first discovered) because the p tags are either unbalanced or improperly used at a certain point
                    html = html.replace(/<(\/)?p>/g, "");

                    setupChampionQuotes(html, championName);
                });
                resolve();
            }, function () {
                reject();
            });
        });
    }


    function setupChampionQuotes(html, championName) {
        var $ = cheerio.load(html);
        var parser = parserInfo[championName].parser.parser;
        console.log("Setting up quotes for " + championName + "...");
        var quoteData = parser($, championName, parserInfo[championName].isTabbed);
        data.quizData[championIds[championName]] = quoteData;
        console.log("Setup quotes for " + championName);
    }

    /*
     //used for testing
     var championNames = [];
     var query = "";
     championNames.forEach(function (championName, index) {
     query += championName + parserInfo[championName].parser.pageName;
     if (index < championNames.length - 1) {
     query += "|";
     }
     });
     return setupQuotesGroup(query);
     */



    //cannot be higher than 50 due to API limits
    var batchSize = 15;
    var query = "";
    var promises = [];
    for (var i = 0; i < data.championList.length; i++) {
        var championName = data.championList[i].name;
        query += championName + parserInfo[championName].parser.pageName;
        var done = i + 1;
        if (done % batchSize === 0 || done === data.championList.length) {
            promises.push(setupQuotesGroup(query));
            query = "";
        } else {
            query += "|";
        }
    }
    return Promise.all(promises);




}



function getQuoteId(quote) {
    var split = quote.file.split("/");
    var file = split[split.length - 1];
    //take off file extension before returning
    return file.substring(0, file.lastIndexOf("."));
}


console.log("starting downloader...");
setupAllData();