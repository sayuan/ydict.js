#!/usr/bin/env node
"use strict";

var request = require("request");
var cheerio = require("cheerio");
var colors = require("colors");
var path = require("path");
var fs = require("fs");
var childProcess = require('child_process');

var fetch = function (text, callback) {
    var encoded = encodeURIComponent(text)
    var options = {
        "url": "http://tw.dictionary.search.yahoo.com/search?p="+encoded,
    };
    request(options, function(error, response, body) {
        callback(error, body);
    });
};

var parseKeywords = function ($, cur) {
    return cur.find("b b").map(function (i, elem) {
        return $(this).text();
    }).get();
};

var parseExamples = function ($, cur) {
    return cur.find(".example_translation")
    .filter(function (i, elem) {
        return $(this).text().length > 0;
    })
    .map(function (i, elem) {
        var parent = $(this).parent();
        $(this).remove();
        return {
            "english": parent.text(),
            "chinese": $(this).text(),
            "keywords": parseKeywords($, parent),
        }
    }).get();
};

var parseExplanations = function ($, cur) {
    return cur.find("li").map(function (i, elem) {
        return {
            "explanation": $(this).find("h4").text().replace(/\d+\. /, ""),
            "examples": parseExamples($, $(this)),
        };
    }).get();
};

var parseTypes = function ($, cur) {
    return cur.find(".lst").first().find(".compArticleList").map(function (i, elem) {
        return {
            "desc": $(this).prev().find(".title").text(),
            "explanations": parseExplanations($, $(this)),
        };
    }).get();
};

var parseAudio = function ($, cur) {
    var obj = JSON.parse(cur.find("#iconStyle").text());
    if (obj["sound_url_1"].length === 0) return null;
    return obj["sound_url_1"].filter(function (elem) {
        return ('mp3' in elem);
    })[0]['mp3'];
};

var parse = function (data) {
    var $ = cheerio.load(data);
    var root = $("#main");
    return {
        "word": root.find("#term").first().text(),
        "pronunciation": root.find("#pronunciation_pos").text(),
        "audio": parseAudio($, root),
        "types": parseTypes($, root),
        "suggesstion": root.find("h2").find("i").text(),
    };
};

var highlighter = function (pre, cur) {
    var re = new RegExp('\\b'+cur+'\\b')
    return pre.replace(re, cur.bold);
};

var display = function (text, info) {
    if (text !== info.word) {
        console.log(info.word.cyan.bold.underline);
    }
    if (info.pronunciation) {
        console.log(info.pronunciation.replace(/\[([^\]]+)\]/g, ": ["+"$1".bold+"]"));
    }
    info.types.forEach(function (type) {
        console.log("%s", type.desc.red.bold);
        for (var i=0; i<type.explanations.length; i++) {
            var exp = type.explanations[i];
            console.log("  %d. %s", i+1, exp.explanation);
            for (var j=0; j<exp.examples.length; j++) {
                var ex = exp.examples[j];
                console.log("     %s",
                        ex.keywords.reduce(highlighter, ex.english).cyan);
                console.log("     %s", ex.chinese.green);
            }
        }
    });
    return 0;
};

var play = function (config, info) {
    if (config.playerCmd) {
        childProcess.exec(config.playerCmd + " " + info.audio);
    }
};

var loadConfig = function () {
    var name = (process.platform=="win32") ? "USERPROFILE" : "HOME";
    var file = path.join(process.env[name], ".ydict.json");
    if (!fs.existsSync(file)) return {};
    return require(file);
}

exports.lookup = function (text, callback) {
    fetch(text, function (err, data) {
        if (err) {
            callback(err);
        } else {
            callback(null, parse(data));
        }
    });
};

var main = function () {
    var args = process.argv.splice(2);
    if (args.length === 0) {
        console.error("Error: Word or phrase needed.");
        process.exit(1);
    }
    var config = loadConfig();
    var text = args.join(" ");
    exports.lookup(text, function callback(err, info) {
        if (err) {
            console.error("Some error happened:", err);
            process.exit(2);
        } else {
            if (info.word) {
                play(config, info);
                display(text, info);
            } else if (info.suggesstion) {
                console.warn("拼字檢查: %s -> %s".red.bold,
                        text, info.suggesstion);
                exports.lookup(info.suggesstion, callback);
            } else {
                console.log("查無此字".red.bold);
                process.exit(3);
            }
        }
    });
};

if (require.main === module) {
    main();
}
