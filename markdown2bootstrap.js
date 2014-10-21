#!/usr/bin/env node
/*jshint node:true, es5:true */
var argv = require('optimist').
        usage('Usage: $0 [options] <doc.md ...>').
        demand(1).
        boolean('n').
        describe('n', 'Turn off numbered sections').
        boolean('h').
        describe('h', 'Turn on bootstrap page header.').
        describe('outputdir', 'Directory to put the converted files in.').
        default('outputdir', '.').
        argv,
    pagedown = require('pagedown'),
    converter = new pagedown.Converter(),
    path = require('path'),
    fs = require('fs'),
    top_part = fs.readFileSync(__dirname + "/parts/top.html").toString(),
    bottom_part = fs.readFileSync(__dirname + "/parts/bottom.html").toString(),
    levels, toc, nextId;

function findTag(md, tag, obj) {
    var re = new RegExp("^<!-- " + tag + ": (.+) -->", "m"), match = md.match(re);

    if (!obj) { return; }

    if (match) {
        obj[tag] = match[1];
    }
}

// Configure section and toc generation
converter.hooks.set("postConversion", function(text) {
    var isFirst = true;
    return text.replace(/<(h(\d))>/g, function(match, p1, p2, offset, str) {
        var i, levelStr = "";

        var box = isFirst
                ? '<div class="bs-docs-section">'
                : (p2 == 1 ? '</div><div class="bs-docs-section">' : '');

        isFirst = false;

        levels[p1] = levels[p1] || 0;
        
        // Figure out section number
        // if (!argv.n) {
            // reset lower levels
            for (i = Number(p2) + 1; levels["h"+i]; i++) {
                levels["h"+i] = 0;
            }
	
            // grab higher levels
            for (i = Number(p2) - 1; levels["h"+i]; i--) {
                levelStr = levels["h"+i] + "." + levelStr;
            }
        
            levels[p1] = levels[p1] + 1;
            levelStr = levelStr + levels[p1] + ". ";
        // }

        // Add toc entry
        toc.push({
            levelStr: levelStr,
            id: ++nextId,
            title: str.slice(offset+4, str.slice(offset).indexOf("</h")+offset)
        });

        return box + "<h" + p2 + ' id="' + nextId + '">' + (!argv.n ? levelStr : '');
    }).
    replace(/<pre>/g, '<pre class="prettyprint linenums">').
    // replace(/<\/pre>/g, '</pre></div>').
    // replace(/<code>/g, '<code>').
    replace(/".*mailto%3a(.*)"/, function(match, p1) {
        return "\"mailto:" + p1  + "\"";
    }) + '</div>';
});

// Create output directory
argv.outputdir = path.resolve(process.cwd(), argv.outputdir);
if (!fs.existsSync(argv.outputdir)) {
    fs.mkdirSync(argv.outputdir);
}

argv._.forEach(function(md_path) {
    var tags = { title: "TITLE HERE", subtitle: "SUBTITLE HERE" },
        md, output, tocHtml = "",
        output_path = path.join(argv.outputdir, path.basename(md_path));

    // Determine output filename
    if (/\.md$/.test(output_path)) {
        output_path = output_path.slice(0, -3);
    }
    output_path += '.html';

    // Read markdown in
    md = fs.readFileSync(md_path).toString();

    // Find title and subtitle tags in document
    findTag(md, "title", tags);
    findTag(md, "subtitle", tags);

    levels = {}; nextId = 0; toc = [];
    output = converter.makeHtml(md);

    // Add table of contents
    tocHtml += [
        '<div class="col-md-3">',
            '<div class="bs-docs-sidebar hidden-print hidden-xs hidden-sm" data-spy="affix" data-offset-top="80" data-offset-bottom="125" role="complementary">',
            '<ul class="nav bs-docs-sidenav">'
    ].join('');

    var lastIsHead1 = true;
    toc.forEach(function(entry) {
        var isFirst = entry.id == 1;
        var level = entry.levelStr.split('.').length - 1;
        var isHead1 = level === 1;
        var str;
        if (level > 2) {
            return;
        }
        if (lastIsHead1 === isHead1) {
            str = (isFirst ? '' : '</li>')
                + '<li' + (isFirst ? ' class="active"' : '') + '><a href="#' + entry.id + '">'
                // + entry.levelStr
                + entry.title + '</a>';
        }
        else {
            if (lastIsHead1) {
                str = '<ul class="nav">'
                    + '<li><a href="#' + entry.id + '">'
                    // + entry.levelStr
                    + entry.title + '</a>';
            }
            else {
                str = '</ul>'
                    + '</li>'
                    + '<li><a href="#' + entry.id + '">'
                    // + entry.levelStr
                    + entry.title + '</a>';
            }
            lastIsHead1 = isHead1;
        }

        tocHtml += str;

        // tocHtml += '<li><a href="#' + entry.id + '">' + entry.levelStr + entry.title + '</a>'
                // + '</li>';
    });
    tocHtml += '</ul>'
            + '<a class="back-to-top" href="#top">返回顶部</a>'
            + '</div></div>';

    // Bootstrap-fy
    output =
        top_part.replace(/\{\{header\}\}/, function() {
            if (argv.h) {
                // return '<header class="jumbotron subhead" id="overview">' +
                //        '<div class="container">' +
                //        '<h1>' + tags.title  + '</h1>' +
                //        '<p class="lead">' + tags.subtitle + '</p>' +
                //        '</div></header>';
                return [
                    '<div class="bs-docs-header" id="content">',
                        '<div class="container">',
                            '<h1>' + tags.title  + '</h1>',
                            '<p>' + tags.subtitle + '</p>',
                        '</div>',
                    '</div>',
                ].join('');
            } else {
                return "";
            }
        }).replace(/\{\{title\}\}/, tags.title === "TITLE HERE" ? "" : tags.title) +
        '<div class="col-md-9">' +
        output +
        '</div>' +
        tocHtml +
        bottom_part;

    fs.writeFileSync(output_path, output);
    console.log("Converted " + md_path + " to " + path.relative(process.cwd(), output_path));
});
