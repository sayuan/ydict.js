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
        "headers": {
            // Suggestion only shown if user-agent set.
            'User-Agent': "Mozilla/5.0",
        },
    };
    request(options, callback);
};

var parseTypes = function ($, cur) {
    var elems = [];
    cur.find(".dictionaryWordCard .compList").eq(1).find("li").each(function (i, elem) {
        elems.push({
            "desc": $(this).children().eq(0).text(),
            "explanation": $(this).children().eq(1).text(),
        });
    });
    return elems;
};

var parseAudio = function (data) {
    var re = /https:\\\/\\\/s\.yimg\.com\\\/bg\\\/dict\\\/dreye\\\/live\\\/f\\\/([a-z]+)\.mp3/;
    var found = data.match(re);
    if (!found) return null;
    return found[0].replace(/\\/g, '');
};

var parse = function (data) {
    var $ = cheerio.load(data);
    var root = $("#web");
    return {
        "word": root.find(".first .dictionaryWordCard .compTitle .title span").first().text(),
        "pronunciation": root.find(".first .dictionaryWordCard .compList").first().text(),
        "explanation": null,
        "audio": parseAudio(data),
        "types": parseTypes($, root),
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
    if (info.explanation) {
        console.log(info.explanation);
    }
    info.types.forEach(function (type) {
        console.log("%s %s", type.desc.red.bold, type.explanation);
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
    fetch(text, function (err, response, data) {
        if (err) {
            callback(err);
        } else if (response.statusCode != 200) {
            callback("Status " + response.statusCode);
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
    exports.lookup(text, function callback (err, info) {
        if (err) {
            console.error("Error:", err);
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
