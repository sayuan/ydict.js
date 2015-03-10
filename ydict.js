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
        "url": "http://tw.dictionary.yahoo.com/dictionary?p="+encoded,
    };
    request(options, function(error, response, body) {
        callback(error, body);
    });
};

var parseKeywords = function ($) {
    var rs = [];
    $.find("b").each(function (i, elem) {
        rs.push(this.text());
    });
    return rs;
};

var parseExamples = function ($) {
    var rs = [];
    $.find(".sample").each(function (i, elem) {
        var node = this.find(".example_sentence");
        var r = {
            "english": node.text(),
            "chinese": node.next().text(),
            "keywords": parseKeywords(node),
        };
        rs.push(r);
    });
    return rs;
};

var parseExplanations = function ($) {
    var rs = [];
    $.find("li").each(function (i, elem) {
        var r = {
            "explanation": this.find(".explanation").text(),
            "examples": parseExamples(this),
        };
        rs.push(r);
    });
    return rs;
};

var parseTypes = function ($) {
    var rs = [];
    $.find(".result_cluster_first").find(".explanation_pos_wrapper")
            .each(function (i, elem) {
        var r = {
            "abbr": this.find(".pos_abbr").text(),
            "desc": this.find(".pos_desc").text(),
            "explantions": parseExplanations(this),
        };
        rs.push(r);
    });
    return rs;
};

var parse = function (data) {
    var $ = cheerio.load(data)("#main");

    var info = {
        "word": $.find(".title_term").children().first().text(),
        "kk": $.find(".proun_value").eq(0).text().slice(1, -1),
        "audio": $.find(".source").eq(0).attr("data-src"),
        "types": parseTypes($),
        "suggesstion": $.find("h2").find("i").text(),
    };

    return info;
};

var highlighter = function (pre, cur) {
    var re = new RegExp('\\b'+cur+'\\b')
    return pre.replace(re, cur.bold);
};

var display = function (text, info) {
    if (text !== info.word) {
        console.log(info.word.cyan.bold.underline);
    }
    if (info.kk) {
        console.log("KK: [%s]", info.kk.bold);
    }
    info.types.forEach(function (type) {
        if (type.abbr) {
            console.log("%s %s", type.abbr.red.bold, type.desc.red.bold);
        }
        for (var i=0; i<type.explantions.length; i++) {
            var exp = type.explantions[i];
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
