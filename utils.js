//various utility functionsvar http = require("http");

var http = require("http");
var https = require("https");
var secrets;
try {
    secrets = require("./secrets.js");
} catch (e) {

}

var riotApiKey = process.env.RIOT_API_KEY || secrets.riotApiKey;
var ddragonVersion;

module.exports = {
    setup: function (callback) {
        module.exports = {
            requestJSON: function (url, success, errors) {
                (url.toLowerCase().indexOf("https://") === 0 ? https : http).get(url, function (response) {
                    if (response.statusCode === 200) {
                        var body = "";
                        response.on("data", function (segment) {
                            body += segment;
                        });
                        response.on("end", function () {
                            var data = JSON.parse(body);
                            success(data);
                        });
                    } else if (errors) {
                        if (typeof (errors) === "function") {
                            errors(response.statusCode);
                        } else {
                            if (errors[response.statusCode]) {
                                errors[response.statusCode]();
                            } else if (errors[0]) {
                                errors[0](response.statusCode);
                            }
                        }
                    }
                });
            },
            randomId: function () {
                var id = "";
                for (var i = 0; i < 10; i++) {
                    id += Math.floor(Math.random() * 36).toString(36);
                }
                return id;
            },
            forEach: function (obj, func) {
                var keys = Object.keys(obj);
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    var value = obj[key];
                    func(value, key, obj);
                }
            },
            //https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
            shuffle: function (arr) {
                for (var i = arr.length - 1; i > 0; i--) {
                    var r = Math.floor(Math.random() * (i + 1));
                    var temp = arr[r];
                    arr[r] = arr[i];
                    arr[i] = temp;
                }
                return arr;
            },
            getDDragonURL: function (path) {
                return "http://ddragon.leagueoflegends.com/cdn/" + ddragonVersion + "/" + (path || "");
            }
        };
        module.exports.requestJSON("https://global.api.pvp.net/api/lol/static-data/na/v1.2/versions?api_key=" + riotApiKey, function (versions) {
            ddragonVersion = versions[0];
            console.log("Setup DDragon");
            callback(module.exports);
        }, function (code) {
            throw new Error("Error getting version info (" + code + ")");
        });
    }
};


