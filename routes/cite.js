/*
 * Citation redirecter, main code
 */

var request = require('request');
var Dom = require('xmldom').DOMParser;

/**
 * Get a parsed citation for the given text, and call the callback with it
 */
function getCitation(citation, callback) {
    request({
        // Thank you Brown University
        url: 'http://freecite.library.brown.edu/citations/create',
        form: {citation: citation},
        headers: {'Accept': 'application/xml'},
        method: 'POST'},
            function (e, r, body) {
                if (e || r.statusCode != 200) {
                    callback(null);
                    return;
                }

                console.log(body);

                // no errors
                var doc = new Dom().parseFromString(body);
                var cit = doc.getElementsByTagName('citation')[0];

                if (cit.getAttribute('valid') != 'true') {
                    callback(null);
                    return;
                }
                
                var ctx = doc.getElementsByTagNameNS('info:ofi/fmt:xml:xsd:ctx', 'context-object')[0];
                

                // The parsed citation is in OpenURL format
                var parsedCitation = "url_ver=" + encodeURIComponent(ctx.getAttribute('version')) +
                    "&ctx_format=" + encodeURIComponent(doc.getElementsByTagNameNS('info:ofi/fmt:xml:xsd:ctx', 'format')[0].firstChild.nodeValue);

                console.log(parsedCitation);

                var journal = doc.getElementsByTagNameNS('info:ofi/fmt:xml:xsd:ctx', 'metadata')[0].childNodes[0];

                console.log(journal);

                var chlen = journal.childNodes.length;
                for (var i = 0; i < chlen; i++) {
                    var node = journal.childNodes[i];

                    parsedCitation += '&' + node.nodeName.toLowerCase().replace(':', '.') +
                        '=' + encodeURIComponent(node.firstChild.nodeValue);
                }

                callback(parsedCitation);
            });
}
 
/**
 * Get a URL for UC eLinks
 */
function getUrlUcELinks (openurl, callback) {
    console.log(openurl);
    callback('http://ucelinks.cdlib.org:8888/sfx_local?' + openurl);
}
   
/**
 * Delegate to the proper service-specific URL constructor
 */       
function getUrlForService (service, openurl, callback) {
    if (openurl == null) callback(null);
    else if (service == 'ucelinks') getUrlUcELinks(openurl, callback);
}

exports.cite = function (req, res) {
    var citation = req.param('citation');
    var service = req.param('service');

    if (citation == undefined || citation == null || citation == '' ||
        service == undefined || service == null || service == '') {
        res.writeHead(400, {'Content-Type': 'text/plain'});
        res.write('Bad request; please include service and citation');
        res.end();
        return;
    }

    getCitation(citation, function (parsed) {
        if (parsed == null) {
            res.writeHead(500, {'Content-Type': 'text/plain'});
            res.write("Internal server error; unable to parse citation");
            res.end();
            return
        }

        // OK, this probably doesn't require a callback, but for
        // extensibility we're doing it anyhow
        var url = getUrlForService(service, parsed, function (url) {
            // TODO: 301? How does the search string affect caching?
            // 303? We want UCeLinks to have GET, but some might be picky?
            // 307?
            res.writeHead(302, {'Content-Type': 'text/plain',
                                'Location': url});

            res.write('<html><head><title>Redirect</title></head><body>' +
                      'You should have been redirected to <a href="' +
                      url + '">' + url + '</a>.' +
                      '</body></html>');

            res.end();
                
        });
    });
}