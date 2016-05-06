#!/bin/env node
var express = require("express");
var mongodb = require("mongodb");
var fs = require("fs");
var Promise = require("promise");
//secrets.js contains authorization/login details and is not included in the repository. Check out 'secrets-EXAMPLE.js' for more info
var secrets;
try {
    secrets = require("./secrets.js");
} catch (e) {
    //secrets.js will not exist on the server since files are pushed via git, no problem here
}
var utils = require("./utils.js");
//TODO
var ipaddr = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
var port = process.env.OPENSHIFT_NODEJS_PORT || 80;
var mongodbURL = process.env.OPENSHIFT_MONGODB_DB_URL || secrets.mongoDbUrl;
var apiKey = process.env.RIOT_API_KEY || secrets.riotApiKey;
var db;
var regions = {
    NA: {
        region: "NA",
        platform: "NA1",
        host: "https://na.api.pvp.net"
    },
    BR: {
        region: "BR",
        platform: "BR1",
        host: "https://br.api.pvp.net"
    },
    EUNE: {
        region: "EUNE",
        platform: "EUN1",
        host: "https://eune.api.pvp.net"
    },
    EUW: {
        region: "EUW",
        platform: "EUW1",
        host: "https://euw.api.pvp.net"
    },
    KR: {
        region: "KR",
        platform: "KR",
        host: "https://kr.api.pvp.net"
    },
    LAN: {
        region: "LAN",
        platform: "LA1",
        host: "https://lan.api.pvp.net"
    },
    LAS: {
        region: "LAS",
        platform: "LA2",
        host: "https://las.api.pvp.net"
    },
    OCE: {
        region: "OCE",
        platform: "OC1",
        host: "https://oce.api.pvp.net"
    },
    TR: {
        region: "TR",
        platform: "TR1",
        host: "https://tr.api.pvp.net"
    },
    RU: {
        region: "RU",
        platform: "RU",
        host: "https://ru.api.pvp.net"
    },
    JP: {
        region: "JP",
        platform: "JP1",
        host: "https://jp.api.pvp.net"
    }
};
//rather than store each player's answers to a quiz, their data is mixed in with a group of other players who have similar champion mastery scores
//using an array like this makes it easy to change groupings in the future (a database refactor will still be needed) in order to
//make group sizes more similar (based on player distribution)
//a player fits in the group with the lowest index whos value is greater than than their champion mastery points (default to last group if they don't fit in another)
var scoringGroups = [50000, 100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 550000, 600000, 650000, 700000, 750000, 800000, 850000, 900000, 950000, 1000000];
//list of champions in alphabetical order
var championList = [];
//champion IDs with their names as keys
//var champIds;
var quizData, ddragonUrl;
var app = express();
(function start() {
    mongodb.MongoClient.connect(mongodbURL, function (err, _db) {
        if (!err) {
            db = _db;
            console.log("Connected to MongoDB");
            utils.setup(function (_utils) {
                utils = _utils;
                fs.readFile("./data.json", "utf8", function (err, json) {
                    if (!err) {
                        console.log("Data loaded");
                        var data = JSON.parse(json);
                        quizData = data.quizData;
                        championList = data.championList;
                        //champIds = data.championIds;
                        ddragonUrl = data.ddragonUrl;

                        //setup an index to make getting all questions for a champion faster
                        db.collection("questions").createIndex({
                            champion: 1
                        }, function (err) {
                            if (!err) {
                                //ensure every question has a DB entry
                                var promises = [];
                                utils.forEach(quizData, function (championData, championId) {
                                    Object.keys(championData.quotes).forEach(function (quoteId) {
                                        promises.push(db.collection("questions").updateOne({id: quoteId}, {$setOnInsert: {champion: championId, groups: []}}, {upsert: true}));
                                    });
                                });

                                Promise.all(promises).then(function () {
                                    console.log("Setup questions");
                                    promises = [];
                                    //delete users who haven't completed any quizzes
                                    promises.push(db.collection("users").deleteMany({
                                        quizzesTaken: []
                                    }));
                                    //all uncompleted quizzes are deleted on server restart
                                    promises.push(db.collection("quizzes").deleteMany({}));

                                    Promise.all(promises).then(function () {
                                        console.log("Cleaned database");
                                        app.use("/leagueofquotes", express.static("public/"));
                                        app.use("/leagueofquotes/getRegions", getRegions);
                                        app.use("/leagueofquotes/getChampionInfo", getChampionInfo);
                                        app.all("/leagueofquotes/answerQuiz", answerQuiz);
                                        app.all("/leagueofquotes/startQuiz", startQuiz);
                                        app.all("/leagueofquotes/getChampions", getChampions);
                                        app.all("/leagueofquotes/getStats", getStats);
                                        app.use("/leagueofquotes/getUserInfo", getUserInfo);
                                        app.all("/leagueofquotes/getVerificationCode", getVerificationCode);
                                        app.all("/leagueofquotes/verifyUser", verifyUser);
                                        app.listen(port, ipaddr);
                                        console.log("Server started");
                                    });
                                }, function () {
                                    throw new Error("Failed to setup questions");
                                });
                            } else {
                                throw new Error(err);
                            }
                        });

                    } else {
                        throw new Error(err);
                    }
                });
            });
        } else {
            throw new Error("Error connecting to database");
        }
    });
})();
//returns a list of champion names and icons
function getChampions(req, res) {
    res.status(200).send({
        ddragonUrl: ddragonUrl,
        champions: championList
    });
}

function getRegions(req, res) {
    res.status(200).send(Object.keys(regions));
}

function getChampionInfo(req, res) {
    if (req.query.champion && quizData[req.query.champion]) {
        res.status(200).send({
            questionCount: Object.keys(quizData[req.query.champion].quotes).length
        });
    } else {
        res.status(400).send({
            error: "Champion not found"
        });
    }
}

function getUserInfo(req, res) {
    if (req.query.userId) {
        db.collection("users").find({
            userId: req.query.userId
        }).limit(1).next(function (err, doc) {
            if (!err) {
                if (doc) {
                    res.status(200).send({
                        userInfo: doc.name + " (" + doc.region + ")"
                    });
                } else {
                    res.status(200).send({
                        userInfo: null
                    });
                }
            } else {
                console.error(err);
                res.status(500).send({
                    error: "Database error"
                });
            }
        });
    } else {
        res.status(400).send({
            error: "userId not specified"
        });
    }
}


function getStats(req, res) {
    if (req.query.championId && quizData[req.query.championId]) {
        db.collection("questions").find({
            champion: req.query.championId
        }).toArray(function (err, docs) {
            if (!err) {
                var quotes = [];
                docs.forEach(function (doc) {
                    var quote = quizData[req.query.championId].quotes[doc.id];
                    quotes.push({
                        quote: quote.text,
                        file: quote.file,
                        groups: doc.groups
                    });
                });
                res.status(200).send({
                    groups: scoringGroups,
                    quotes: quotes
                });
            } else {
                console.error(err);
                res.status(500).send({
                    error: "DB error"
                });
            }
        });
    } else {
        res.status(400).send({
            error: "invalid champion"
        });
    }
}


function startQuiz(req, res) {
    if (req.query.championId && quizData[req.query.championId]) {
        var quotes = quizData[req.query.championId].quotes;
        var questionCount = parseInt(req.query.questionCount);
        if (questionCount && questionCount >= 1 && questionCount <= Object.keys(quotes).length) {
            var triggers = quizData[req.query.championId].triggers;
            var questions = [];
            //get a subarray and shuffle it
            var shuffled = utils.shuffle(Object.keys(quotes).slice(0, questionCount));
            var questionIds = [];
            shuffled.forEach(function (quoteId) {
                var quote = quotes[quoteId];
                questions.push({
                    text: quote.text,
                    file: quote.file
                });
                questionIds.push(quoteId);
            });
            var quizId = utils.randomId();
            db.collection("quizzes").insertOne({
                quizId: quizId,
                questionIds: questionIds,
                //null if anonymous
                userId: req.query.userId,
                champion: req.query.championId,
                latestUsed: new Date()
            }, function (err) {
                if (!err) {
                    res.status(200).send({
                        questions: questions,
                        triggers: triggers,
                        quizId: quizId
                    });
                } else {
                    console.error(err);
                    res.status(500).send({
                        error: "Database error"
                    });
                }
            });
        } else {
            res.status(400).send({
                error: "Invalid questionCount"
            });
        }
    } else {
        res.status(400).send({
            error: "Invalid champion"
        });
    }
}

//callback is only called if the user hadn't completed the quiz before. Callback is given player's mastery points on specified champion as an argument
function completeQuiz(userId, championId, callback) {
    if (userId) {
        db.collection("users").findOneAndUpdate({
            userId: userId
        }, {
            $addToSet: {
                quizzesTaken: championId
            }
        }, function (err, old) {
            if (!err) {
                if (old.value) {
                    var user = old.value;
                    if (user.quizzesTaken.indexOf(championId) === -1) {
                        var region = regions[user.region];
                        utils.requestJSON(region.host + "/championmastery/location/" + region.platform + "/player/" + user.summonerId + "/champion/" + championId + "?api_key=" + apiKey, function (apiResponse) {
                            callback(apiResponse.championPoints);
                        }, {
                            //a 204 indicates the player hasn't played the champion
                            204: function () {
                                callback(0);
                            },
                            0: function (code) {
                                console.error("Error getting champion master points for " + user.summonerId + " [" + user.region + "] (" + code + ")");
                            }
                        });
                    }
                } else {
                    console.error("user not found");
                }
            } else {
                console.error(err);
            }
        });
    }
}

function answerQuiz(req, res) {
    if (req.query.quizId) {
        db.collection("quizzes").findOneAndDelete({
            quizId: req.query.quizId
        }, function (err, result) {
            var quiz = result.value;
            if (!err) {
                if (quiz) {
                    //answers the user gave    
                    var given;
                    try {
                        given = JSON.parse(req.query.answers);
                    } catch (e) {
                        //given answers are invalid. Ignore the error here, it will be handled below    
                    }
                    if (given) {
                        var quizDataSection = quizData[quiz.champion];
                        //the correct answers
                        var answers = [];
                        quiz.questionIds.forEach(function (questionId) {
                            answers.push(quizDataSection.triggers.indexOf(quizDataSection.quotes[questionId].trigger));
                        });
                        completeQuiz(quiz.userId, quiz.champion, function (points) {
                            var scoringGroup = scoringGroups[scoringGroups.length - 1];
                            for (var i = 0; i < scoringGroups.length; i++) {
                                if (points < scoringGroups[i]) {
                                    scoringGroup = i;
                                    break;
                                }
                            }
                            for (var i = 0; i < answers.length; i++) {
                                //needs to be declared like this to specify a group
                                var update = {
                                    $inc: {}
                                };
                                update.$inc["groups." + scoringGroup + ".answered"] = 1;
                                update.$inc["groups." + scoringGroup + ".correct"] = given[i] === answers[i] ? 1 : 0;

                                db.collection("questions").findOneAndUpdate({
                                    id: quiz.questionIds[i]
                                }, update, function (err) {
                                    if (err) {
                                        console.error(err);
                                    }
                                });
                            }
                        });

                        res.status(200).send({
                            answers: answers
                        });
                    } else {
                        res.status(400).send({
                            error: "Invalid answer format"
                        });
                    }
                } else {
                    res.status(400).send({
                        error: "Quiz not found, it probably expired"
                    });
                }
            } else {
                console.error(err);
                res.status(500).send({
                    error: "Database error"
                });
            }
        });
    } else {
        res.status(400).send({
            error: "quizID not specified"
        });
    }
}

//step 1 for confirming a user's identity. The code must be used as a mastery page name then becomes verified and is used as their ID
//returns a status message if a user error occurs
function getVerificationCode(req, res) {
    if (req.query.region && regions[req.query.region]) {
        if (req.query.summoner) {
            var region = regions[req.query.region];
            utils.requestJSON(region.host + "/api/lol/" + region.region + "/v1.4/summoner/by-name/" + req.query.summoner + "?api_key=" + apiKey, function (apiResponse) {
                var player = apiResponse[Object.keys(apiResponse)[0]];
                db.collection("users").findOneAndUpdate({
                    region: req.query.region,
                    summonerId: player.id
                }, {
                    $setOnInsert: {
                        quizzesTaken: []
                    },
                    $set: {
                        region: req.query.region,
                        summonerId: player.id,
                        name: player.name,
                        verificationCode: utils.randomId()
                    }
                }, {upsert: true, returnOriginal: false}, function (err, result) {
                    if (!err) {
                        res.status(200).send({
                            verificationCode: result.value.verificationCode
                        });
                    } else {
                        console.error(err);
                        res.status(500).send({
                            error: "Database error"
                        });
                    }
                });
            }, {
                404: function () {
                    res.status(200).send({
                        status: "Summoner not found"
                    });
                },
                0: function (code) {
                    console.error("Error checking masteries (" + code + ")");
                    res.status(500).send({
                        error: "Unknown error (" + code + ")"
                    });
                }
            });
        } else {
            res.status(400).send({
                error: "Summoner not specified"
            });
        }
    } else {
        res.status(400).send({
            error: "Invalid request"
        });
    }
}


//step 2 for confirming a user's identity. Checks if their code (that they were given is step 1) has been set as a mastery page name
//returns a code (the user's ID) the client sends to the server when requesting questions. null if verification code not found
function verifyUser(req, res) {
    if (req.query.code) {
        db.collection("users").find({
            verificationCode: req.query.code
        }).limit(1).next(function (err, doc) {
            if (!err) {
                if (doc) {
                    var region = regions[doc.region];
                    utils.requestJSON(region.host + "/api/lol/" + region.region + "/v1.4/summoner/" + doc.summonerId + "/masteries?api_key=" + secrets.riotApiKey, function (apiResponse) {
                        var pages = apiResponse[Object.keys(apiResponse)[0]].pages;
                        for (var i = 0; i < pages.length; i++) {
                            var page = pages[i];
                            if (page.name === doc.verificationCode) {
                                var userId = utils.randomId();
                                doc.userId = userId;
                                db.collection("users").findOneAndUpdate({
                                    _id: doc._id
                                }, doc, function (err) {
                                    if (!err) {
                                        res.status(200).send({
                                            userId: userId
                                        });
                                    } else {
                                        console.error(err);
                                        res.status(500).send({
                                            error: "Database error"
                                        });
                                    }
                                });
                                return;
                            }
                        }
                        //user has not set verification code
                        res.status(200).send({
                            status: "Verification code not found. Make sure you renamed a mastery page and try again. It may take a few moments for your changes to update"
                        });
                    }, function (errorCode) {
                        console.error(err);
                        res.status(500).send({
                            error: "Unknown error (" + errorCode + ")"
                        });
                    });
                } else {
                    res.status(400).send({
                        error: "Code not found (you probably took too long and it expired)"
                    });
                }
            } else {
                console.error(err);
                res.status(500).send({
                    error: "Database error"
                });
            }
        });
    } else {
        res.status(400).send({
            error: "Invalid request"
        });
    }
}
