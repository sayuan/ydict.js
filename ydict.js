#!/usr/bin/env node
"use strict";

var request = require("request");
var cheerio = require("cheerio");
var colors = require("colors");

var fetch = function (text, callback) {
    var options = {
        "url": "http://tw.dictionary.yahoo.com/dictionary?p="+text,
    };
    request(options, function(error, response, body) {
        callback(error, body);
    });
};

var parse_examples = function ($) {
    var rs = [];
    $.find(".sample").each(function (i, elem) {
        var r = {
            "english": this.find(".example_sentence").text(),
            "chinese": this.find(".example_sentence").next().text(),
        };
        rs.push(r);
    });
    return rs;
};

var parse_explanations = function ($) {
    var rs = [];
    $.find("li").each(function (i, elem) {
        var r = {
            "explanation": this.find(".explanation").text(),
            "examples": parse_examples(this),
        };
        rs.push(r);
    });
    return rs;
};

var parse_types = function ($) {
    var rs = [];
    $.find(".result_cluster_first").find(".explanation_pos_wrapper")
            .each(function (i, elem) {
        var r = {
            "abbr": this.find(".pos_abbr").text(),
            "desc": this.find(".pos_desc").text(),
            "explantions": parse_explanations(this),
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
        "types": parse_types($),
    };

    return info;
};

var print = function (info) {
    if (!info.word) {
        console.log("查無此字".red.bold);
        return 3;
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
                console.log("     %s", ex.english.cyan.bold);
                console.log("     %s", ex.chinese.green);
            }
        }
    });
    return 0;
};

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
    exports.lookup(args.join(" "), function (err, info) {
        if (err) {
            console.error("Some error happened:", err);
            process.exit(2);
        } else {
            process.exit(print(info));
        }
    });
};

if (require.main === module) {
    main();
}
