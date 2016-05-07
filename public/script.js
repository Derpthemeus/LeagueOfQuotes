var quizId, userId, ddragonUrl;
//generates fake data instead of using actual quiz results. Good for previewing the site before a lot of data is collected
var useBullshitData = false;
window.addEventListener("load", function () {

    requestJSON("./getRegions", function (regions) {
        var select = document.getElementById("loginModal-region");
        regions.forEach(function (region) {
            var option = document.createElement("option");
            option.appendChild(document.createTextNode(region));
            option.value = region;
            select.appendChild(option);
        });
    });
    $("#championModal").on("show.bs.modal", function (event) {
        var modal = $(this);
        var championId = event.relatedTarget.dataset.championId;
        var championName = event.relatedTarget.dataset.championName;
        modal.data("championId", championId);
        modal.data("championName", championName);
        modal.find("#championModal-loading").css("display", "block");
        modal.find("#championModal-content").css("display", "none");
        modal.find(".championModal-championName").text(championName);
        requestJSON("./getChampionInfo?champion=" + championId, function (data) {
            document.getElementById("championModal-quizLength").max = data.questionCount;
            document.getElementById("championModal-quizLength").value = data.questionCount;
            modal.find(".championModal-questionCount").text(data.questionCount);
            modal.find("#championModal-loading").css("display", "none");
            modal.find("#championModal-content").css("display", "block");
        }, function (body, code) {
            error(body ? body.error : null, code);
        });
    });
    $("#startQuiz").on("click", function () {
        var championId = $("#championModal").data("championId");
        var championName = $("#championModal").data("championName");
        setupQuestions(championId, document.getElementById("championModal-quizLength").value, championName);
    });
    $("#viewStats").on("click", function () {
        var championId = $("#championModal").data("championId");
        var championName = $("#championModal").data("championName");
        showStats(championId, championName);
    });
    $("#getCode").on("click", function () {
        var name = document.getElementById("loginModal-summoner").value;
        var modal = $("#loginModal");
        if (name.length !== 0) {
            modal.find("#loginModal-loading").css("display", "block");
            modal.find("#loginModal-step1").css("display", "none");
            requestJSON("./getVerificationCode?summoner=" + name + "&region=" + document.getElementById("loginModal-region").value, function (data) {
                modal.find("#loginModal-loading").css("display", "none");
                if (data.verificationCode) {
                    modal.find("#loginModal-verificationCode").text(data.verificationCode);
                    modal.find("#loginModal-step2").css("display", "block");
                } else {
                    modal.find("#loginModal-status1").text(data.status);
                    modal.find("#loginModal-step1").css("display", "block");
                }
            }, function (body, code) {
                error(body ? body.error : null, code);
            });
        } else {
            $("#loginModal-status1").text("Summoner name not specified");
        }
    });
    $("#loginModal-loading").css("display", "none");
    $("#loginModal-step2").css("display", "none");
    $("#verifyCode").on("click", function () {
        $("#loginModal-step2").css("display", "none");
        $("#loginModal-loading").css("display", "block");
        requestJSON("./verifyUser?code=" + $("#loginModal-verificationCode").text(), function (data) {
            $("#loginModal-step2").css("display", "block");
            $("#loginModal-loading").css("display", "none");
            if (data.userId) {
                setUserId(data.userId);
                updateUserInfo();
                document.getElementById("verifyCode").disabled = true;
                $("#loginModal-status2").text("Account confirmed. You may close this dialog");
                $("#loginModal-status2").css("color", "green");
                $("#alert-login").css("display", "none");
                $("#alert-logout").css("display", "block");
            } else {
                $("#loginModal-status2").text(data.status);
                $("#loginModal-status2").css("color", "red");
            }
        });
    });
    userId = loadUserId();
    updateUserInfo();
    $("#alert-logout").css("display", userId ? "block" : "none");
    $("#alert-login").css("display", userId ? "none" : "block");
    $("#alert-bullshit").css("display", useBullshitData ? "block" : "none");
    $("#alert-logout").on("click", function () {
        logout();
        location.reload();
    });
    $("#alert-bullshit").on("click", function () {
        useBullshitData = false;
        $("#alert-bullshit").css("display", "none");
    });
    $("#useBullshitData").on("click", function () {
        useBullshitData = true;
        $("#alert-bullshit").css("display", "block");
    });

    window.addEventListener("click", function () {
        $("#easterEgg").remove();
    });
    setupHome();
});
function updateUserInfo() {
    requestJSON("./getUserInfo?&userId=" + userId, function (data) {
        if (data.userInfo) {
            $(".userInfo").text(data.userInfo);
        } else {
            logout();
            $("#alert-logout").css("display", "none");
            $("#alert-login").css("display", "block");
        }
    });
}



function setupHome() {
    requestJSON("./getChampions", function (champions) {
        ddragonUrl = champions.ddragonUrl;
        var championSelection = document.createElement("div");
        championSelection.id = "championSelect";
        championSelection.className = "row";
        var header = document.createElement("h2");
        header.id = "championSelectText";
        header.className = "text-center";
        header.appendChild(document.createTextNode("Select a champion to take a quiz or views statistics"));
        championSelection.appendChild(header);
        var championList = document.createElement("ul");
        var div = document.createElement("div");
        div.className = "row col-sm-10 col-sm-offset-1";
        div.appendChild(championList);
        championList.id = "championList";
        championList.className = "list-inline";
        champions.champions.forEach(function (champion) {
            var li = document.createElement("li");
            li.className = "clickable championButton";
            li.dataset.toggle = "modal";
            li.dataset.target = "#championModal";
            li.dataset.championId = champion.id;
            li.dataset.championName = champion.name;
            var img = document.createElement("img");
            img.className = "championImg";
            img.width = 70;
            img.height = 70;
            img.src = ddragonUrl + "img/champion/" + champion.icon;
            li.appendChild(img);
            var name = document.createElement("div");
            name.appendChild(document.createTextNode(champion.name));
            name.className = "championName";
            li.appendChild(name);
            championList.appendChild(li);
        });
        championSelection.appendChild(div);
        document.getElementById("content").innerHTML = "";
        document.getElementById("content").appendChild(championSelection);
    }, function (body, code) {
        error(body ? body.error : null, code);
    });
}



function requestJSON(url, success, errors) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState === 4) {
            var data = xmlHttp.responseText ? JSON.parse(xmlHttp.responseText) : null;
            if (xmlHttp.status === 200) {
                success(data);
            } else if (errors) {
                if (typeof (errors) === "function") {
                    errors(data, xmlHttp.status);
                } else {
                    if (errors[xmlHttp.status]) {
                        errors[xmlHttp.status](data, xmlHttp.status);
                    } else if (errors[0]) {
                        errors[0](data, xmlHttp.status);
                    }
                }
            }
        }
    };
    xmlHttp.open("GET", url, true);
    xmlHttp.send(null);
}

function forEach(obj, func) {
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var value = obj[key];
        func(value, key, obj);
    }
}

//returns user's ID or null
function loadUserId() {
    if (document.cookie) {
        var pairs = document.cookie.split(/; /g);
        for (var i = 0; i < pairs.length; i++) {
            var split = pairs[i].split(/=/);
            var key = split[0];
            var value = split[1];
            if (key === "userId") {
                return value;
            }
        }
    }
    return null;
}

function setUserId(id) {
    userId = id;
    document.cookie = "userId=" + id;
}

function logout() {
    userId = null;
    document.cookie = "userId=; expires=" + new Date(0) + ";";
}


function setupQuestions(championId, questionCount, championName) {
    requestJSON("./startQuiz?championId=" + championId + "&questionCount=" + questionCount + (userId ? "&userId=" + userId : ""), function (quizData) {
        var triggers = quizData.triggers;
        quizId = quizData.quizId;
        var quiz = document.createElement("div");
        quiz.className = "col-sm-12";
        if (championId === 33) {
            var easterEgg = document.createElement("div");
            easterEgg.id = "easterEgg";
            var img = document.createElement("img");
            img.src = "http://i.imgur.com/WclrpxA.png";
            easterEgg.appendChild(img);
            quiz.appendChild(easterEgg);
        }

        var title = document.createElement("div");
        title.id = "pageTitle";
        title.appendChild(document.createTextNode(championName));
        quiz.appendChild(title);


        quizData.questions.forEach(function (quote) {
            var questionDiv = document.createElement("div");
            questionDiv.className = "col-sm-12 well well-sm";
            var audio = document.createElement("audio");
            audio.src = quote.file;
            audio.addEventListener("ended", function () {
                icon.className = "glyphicon glyphicon-play";
            });
            questionDiv.appendChild(audio);
            var play = document.createElement("button");
            play.className = "col-sm-1 btn btn-sm";
            var icon = document.createElement("span");
            icon.className = "glyphicon glyphicon-play";
            play.onclick = function () {
                if (audio.paused) {
                    audio.currentTime = 0;
                    audio.play();
                    icon.className = "glyphicon glyphicon-pause";
                } else {
                    audio.pause();
                    icon.className = "glyphicon glyphicon-play";
                }
            };
            play.appendChild(icon);
            questionDiv.appendChild(play);
            var text = document.createElement("div");
            text.className = "quote col-sm-6";
            var split = quote.text.split("\n");
            split.forEach(function (line, index) {
                text.appendChild(document.createTextNode(line));
                if (index !== split.length - 1) {
                    text.appendChild(document.createElement("br"));
                }
            });
            questionDiv.appendChild(text);
            var selectDiv = document.createElement("div");
            selectDiv.className = "col-sm-5 quoteAnswer";
            var select = document.createElement("select");
            var defaultOption = document.createElement("option");
            defaultOption.value = -1;
            select.appendChild(defaultOption);
            quizData.triggers.forEach(function (trigger, index) {
                var option = document.createElement("option");
                option.value = index;
                option.appendChild(document.createTextNode(trigger));
                select.appendChild(option);
            });
            selectDiv.appendChild(select);
            questionDiv.appendChild(selectDiv);
            quiz.appendChild(questionDiv);
        });
        var submit = document.createElement("button");
        submit.className = "btn col-sm-12";
        submit.appendChild(document.createTextNode("Submit"));
        submit.onclick = function () {
            quiz.removeChild(submit);
            var given = [];
            $(".quoteAnswer select").each(function () {
                given.push(parseInt(this.value));
            });
            requestJSON("./answerQuiz?quizId=" + quizId + "&answers=" + encodeURIComponent(JSON.stringify(given)), function (response) {
                if (!response.error) {
                    var answers = response.answers;
                    var correct = 0;
                    $(".quoteAnswer").each(function (index) {
                        var answerDiv = document.createElement("div");
                        var isCorrect = given[index] === answers[index];
                        if (isCorrect) {
                            correct++;
                        }
                        answerDiv.className = "col-sm-5 " + (isCorrect ? "correct" : "incorrect");
                        answerDiv.appendChild(document.createTextNode("You said: " + (triggers[given[index]] || "")));
                        answerDiv.appendChild(document.createElement("br"));
                        answerDiv.appendChild(document.createTextNode("Correct answer: " + triggers[answers[index]]));
                        $(this).replaceWith(answerDiv);
                    });
                    var resultsDiv = document.createElement("div");
                    resultsDiv.className = "resultsDiv col-sm-12 clickable well well-md center-block";
                    resultsDiv.appendChild(document.createTextNode("You got " + correct + "/" + answers.length + " questions correct. Click here to see how others did"));
                    resultsDiv.onclick = function () {
                        showStats(championId);
                    };
                    quiz.appendChild(resultsDiv);
                } else {
                    alert("Error submitting quiz/getting answers: " + response.error);
                }
            }, function (body, code) {
                error(body ? body.error : null, code);
            });
        };
        quiz.appendChild(submit);
        document.getElementById("content").innerHTML = "";
        document.getElementById("content").appendChild(quiz);
    }, function (body, code) {
        error(body ? body.error : null, code);
    });
    window.scrollTo(0, 0);
}

function error(msg, code) {
    console.error(msg + "(" + code + ")");
    alert("Error occured: " + msg + " (" + code + ")");
}

function showStats(championId, championName) {
    getStats(championId, function (data) {
        var statsDiv = document.createElement("div");
        statsDiv.className = "col-sm-12";

        var title = document.createElement("div");
        title.id = "pageTitle";
        title.appendChild(document.createTextNode(championName));
        statsDiv.appendChild(title);


        var chartDiv = document.createElement("div");
        chartDiv.id = "chart";
        chartDiv.className = "row center-block";
        statsDiv.appendChild(chartDiv);
        var options = {
            title: {
                text: "% Correct by Mastery Points"
            },
            credits: {
                enabled: false
            },
            xAxis: {
                labels: {
                },
                title: {
                    text: "Champion Mastery Points"
                },
                categories: []
            },
            yAxis: {
                min: 0,
                max: 100,
                title: {
                    text: "% Correct"
                },
                plotLines: [
                    {
                        value: 0,
                        width: 1
                    }
                ]
            },
            legend: {
                enabled: false
            },
            tooltip: {
                formatter: function () {
                    var range = abbrNumber(data.groups[this.point.x - 1] || 0) + (this.point.x === data.groups.length - 1 ? "+" : " - " + this.x);
                    return "<b>" + this.series.name + "</b><br>Mastery points:" + range + "<br>Correct: " + roundPercentage(this.y) + "<br>Answered: " + this.series.options.answered[this.point.x] + "<br>Correct: " + this.series.options.correct[this.point.x];
                }
            },
            series: []
        };
        data.groups.forEach(function (group) {
            options.xAxis.categories.push(abbrNumber(group));
        });

        var row = document.createElement("div");
        row.className = "row col-sm-12";
        var showAll = document.createElement("button");
        showAll.className = "col-sm-2 btn btn-md";
        showAll.onclick = function () {
            $('.showHide').html("hide");
            var chart = $("#chart").highcharts();
            //http://stackoverflow.com/a/25374387
            chart.series.forEach(function (series) {
                series.setVisible(true, false);
            });
            chart.redraw();
        };
        showAll.appendChild(document.createTextNode("Show all"));
        row.appendChild(showAll);

        var hideAll = document.createElement("button");
        hideAll.className = "col-sm-2 col-sm-offset-1 btn btn-md";
        hideAll.onclick = function () {
            $('.showHide').html("show");
            var chart = $("#chart").highcharts();
            //http://stackoverflow.com/a/25374387
            chart.series.forEach(function (series) {
                series.setVisible(false, false);
            });
            chart.redraw();
        };
        hideAll.appendChild(document.createTextNode("Hide all"));
        row.appendChild(hideAll);
        statsDiv.appendChild(row);
        statsDiv.appendChild(document.createElement("br"));
        statsDiv.appendChild(document.createElement("hr"));
        data.quotes.forEach(function (quote, index) {
            var quoteDiv = document.createElement("div");
            quoteDiv.className = "col-sm-12 well well-sm";
            var showHide = document.createElement("button");
            showHide.className = "showHide col-sm-1 btn btn-sm";
            showHide.onclick = function () {
                toggleSeries(index);
            };
            showHide.appendChild(document.createTextNode("hide"));
            quoteDiv.appendChild(showHide);
            var seriesIcon = document.createElement("div");
            seriesIcon.className = "seriesIcon col-sm-1";
            quoteDiv.appendChild(seriesIcon);
            var audio = document.createElement("audio");
            audio.src = quote.file;
            audio.addEventListener("ended", function () {
                playIcon.className = "glyphicon glyphicon-play";
            });
            quoteDiv.appendChild(audio);
            var play = document.createElement("button");
            play.className = "col-sm-1 btn btn-sm";
            var playIcon = document.createElement("span");
            playIcon.className = "glyphicon glyphicon-play";
            play.onclick = function () {
                if (audio.paused) {
                    audio.currentTime = 0;
                    audio.play();
                    playIcon.className = "glyphicon glyphicon-pause";
                } else {
                    audio.pause();
                    playIcon.className = "glyphicon glyphicon-play";
                }
            };
            play.appendChild(playIcon);
            quoteDiv.appendChild(play);
            var text = document.createElement("div");
            text.className = "col-sm-8 quote";
            var split = quote.quote.split("\n");
            split.forEach(function (line, index) {
                text.appendChild(document.createTextNode(line));
                if (index !== split.length - 1) {
                    text.appendChild(document.createElement("br"));
                }
            });




            quoteDiv.appendChild(text);
            var series = {
                name: quote.quote,
                data: [],
                totalAnswered: 0,
                totalCorrect: 0,
                answered: [],
                correct: []
            };
            for (var i = 0; i < data.groups.length; i++) {
                //groups without data will be undefined
                var group = quote.groups[i] || {correct: 0, answered: 0};
                series.data.push(group.correct / group.answered * 100);
                series.totalAnswered += group.answered;
                series.totalCorrect += group.correct;
                series.answered.push(group.answered);
                series.correct.push(group.correct);
            }
            options.series.push(series);

            var percent = document.createElement("div");
            percent.appendChild(document.createTextNode(roundPercentage(series.totalCorrect / series.totalAnswered * 100)));
            quoteDiv.appendChild(percent);

            statsDiv.appendChild(quoteDiv);
        });
        $(chartDiv).highcharts(options);
        var chart = $(chartDiv).highcharts();

        var shapes = {
            "circle": "&#x25CF",
            "diamond": "&#x25C6",
            "square": "&#x25A0",
            "triangle": "&#x25B2",
            "triangle-down": "&#x25BC"
        };
        var series = chart.series;
        $(".seriesIcon", statsDiv).each(function (index) {
            this.innerHTML = shapes[series[index].symbol];
            $(this).css("color", series[index].color);
        });
        document.getElementById("content").innerHTML = "";
        document.getElementById("content").appendChild(statsDiv);

        chart.reflow();
    });
    window.scrollTo(0, 0);
}

function toggleSeries(index) {
    $("#chart").highcharts().series[index].visible ? hideSeries(index) : showSeries(index);
}

function hideSeries(index) {
    $($(".showHide").get(index)).html("show");
    $("#chart").highcharts().series[index].hide();
}
function showSeries(index) {
    $($(".showHide").get(index)).html("hide");
    $("#chart").highcharts().series[index].show();
}


//callback is called with data as an argument
function getStats(championId, callback) {
    requestJSON("./getStats?championId=" + championId, function (data) {
        if (useBullshitData) {
            data.quotes.forEach(function (quote) {

                for (var i = 0; i < data.groups.length; i++) {
                    var answered = Math.floor(Math.random() * 180 + 20);
                    quote.groups[i] = {
                        answered: answered,
                        correct: Math.floor(answered * (Math.random() * 0.8 + 0.1))
                    };
                }
            });
        }
        callback(data);
    }, function (body, code) {
        error(body ? body.error : null, code);
    });
}

function abbrNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000) + "m";
    } else if (num >= 1000) {
        return (num / 1000) + "k";
    } else {
        return num;
    }
}

function roundPercentage(num) {
    //use 0% rather than NaN%
    return ((Math.round(num * 100) / 100) || 0) + "%";
}