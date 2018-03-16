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

var parseKeywords = function ($, cur) {
    return cur.find("b").map(function (i, elem) {
        return $(this).text();
    }).get();
};

var parseExamples = function ($, cur) {
    return cur.find("p").map(function (i, elem) {
        var english = $(this).text().replace(/[^\x00-\x7F]/g, "").trim()

        return {
            "english": english,
            "chinese": $(this).text().replace(english, "").trim(),
            "keywords": parseKeywords($, $(this)),
        }
    }).get();
};

var parseExplanations = function ($, cur) {
    return cur.map(function (elem) {
        return {
            "explanation": $(elem).find("span").first().text().replace(/\d+\. /, ""),
            "examples": parseExamples($, $(elem)),
        };
    });
};

var parseTypes = function ($, cur) {
    var elems = [];
    cur.find(".tab-content-explanation .compList li").each(function (i, elem) {
        if ($(this).find(".tabs-pos_type").length) {
            elems.push({
                "desc": $(this).text(),
                "explanations": [],
            });
        } else {
            elems[elems.length - 1].explanations.push(this);
        }
    });
    return elems.map(function (desc) {
        return {
            "desc": desc.desc,
            "explanations": parseExplanations($, desc.explanations),
        };
    });
};

var parseAudio = function ($, cur) {
    try {
        var obj = JSON.parse(cur.find("#iconStyle").first().text());
        if (obj["sound_url_1"].length === 0) return null;
        return obj["sound_url_1"].filter(function (elem) {
            return ('mp3' in elem);
        })[0]['mp3'];
    } catch(e) {
        return null;
    }
};

var parse = function (data) {
    var $ = cheerio.load(data);
    var root = $("#web");
    return {
        "word": root.find(".first .dictionaryWordCard .compTitle .title span").first().text(),
        "pronunciation": root.find(".first .dictionaryWordCard .compList").first().text(),
        "explanation": root.find(".first .dictionaryWordCard .compList .dictionaryExplanation").first().text(),
        // "audio": parseAudio($, root),
        "types": parseTypes($, root),
        "suggesstion": root.find(".VertQuerySuggestion").find("a").first().text(),
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
