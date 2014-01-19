#!/usr/bin/env node
"use strict";

var request = require("request");
var cheerio = require("cheerio");
var colors = require('colors');

var fetch = function (text, callback) {
    var options = {
        "url": "http://tw.dictionary.yahoo.com/dictionary?p="+text,
    };
    request(options, function(error, response, body) {
        callback(error, body);
    });
};

var parse_explanations = function ($) {
    var rs = [];
    $.find("li").each(function (i, elem) {
        var r = {
            "explanation": this.find(".explanation").text(),
            "sample": this.find(".example_sentence").text(),
            "sampleTrans": this.find(".example_sentence").next().text(),
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
    if (info.kk) {
        console.log('KK: [%s]', info.kk.bold);
    }
    info.types.forEach(function (type) {
        if (type.abbr) {
            console.log('%s %s', type.abbr.red.bold, type.desc.red.bold);
        }
        for (var i=0; i<type.explantions.length; i++) {
            var t = type.explantions[i];
            console.log("  %d. %s", i+1, t.explanation);
            if (t.sample) {
                console.log("     %s", t.sample.cyan.bold);
                console.log("     %s", t.sampleTrans.green);
            }
        }
    });
};

var lookup = function (text) {
    fetch(text, function (err, data) {
        if (err) {
            console.err("Some error happened:", err);
        } else {
            print(parse(data));
        }
    });
};

var args = process.argv.splice(2);
lookup(args.join(" "));
