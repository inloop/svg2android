/* Helper methods */
String.prototype.f = function () {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};

Array.prototype.pushUnique = function (item){
    if(this.indexOf(item) == -1) {
        this.push(item);
        return true;
    }
    return false;
};

if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function (suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function (str){
        return this.indexOf(str) == 0;
    };
}

/* ------ */
var lastFileName = "";

var fileReaderOpts = {
    dragClass: "drag", readAsDefault: "Text", on: {
        load: function (e, file) {
            loadFile(e, file)
        }
    }
};

if (typeof FileReader === "undefined") {
    $('#dropzone, #dropzone-dialog').hide();
    $('#compat-error').show();
} else {
    $('#dropzone, #dropzone-dialog').fileReaderJS(fileReaderOpts);
}
/* ------ */

var DRAW_LINE = "l"; //used as default parameter when no found in path
var START_PATH = "M";
var END_PATH = "Z";

function loadFile(e, file) {
    lastFileName = extractFileNameWithoutExt(file.name) || "";
    $(".alert").hide();
    parseFile(e.target.result);
}

function extractFileNameWithoutExt(filename) {
    var dotIndex = filename.lastIndexOf(".");
    if (dotIndex > -1) {
        return filename.substr(0, dotIndex);
    } else {
        return filename;
    }
}

function parseFile(inputXml) {
    var xml;
    try {
        xml = $($.parseXML(inputXml));
    } catch (e) {
        setMessage("<b>Error:</b> not valid SVG file.", "alert-danger");
        $("#output-box").hide();
        return;
    }
	
    var warnings = [];
    var svg = xml.find("svg");

    var dimensions = getDimensions(svg, warnings);
    var width = dimensions.width;
    var height = dimensions.height;
    var paths = xml.find("path");

    if (paths.length == 0) {
        setMessage("No path found, you must convert all your objects into path.", "alert-danger");
        $("#output-box").hide();
    } else {
        var stylesJson = [];
        var groupTransform = null;
        var transformSet = false;

        for (var i = 0; i < paths.length; i++) {
            var path = $(paths[i]).attr("d");
            var parentTag = $(paths[i]).parent().get(0);

            if (typeof path === "undefined") {
                paths[i] = null;
                warnings.pushUnique("found path(s) without data (empty parameter <i>d</i>)");
                continue;
            }

            path = path.replace(/\s{2,}/g, " "); //replace extra spaces

            if (path.match(/-?\d*\.?\d+e[+-]?\d+/g)) {
                warnings.pushUnique("found some numbers with scientific E notation in pathData which Android probably does not support. " +
                "Please fix It manually by editing your editor precision or manually by editing pathData");
            }

            //Check If parent is group, apply transform
            if (parentTag.tagName == "g" && !transformSet) {
                var transform = $(parentTag).attr("transform");
                if (typeof transform !== "undefined") {
                    groupTransform = {transformX:0,transformY:0,scaleX:1, scaleY:1};
                    var regex = /((\w|\s)+)\(([^)]+)/mg;
                    var result = null;
                    while (result = regex.exec(transform)) {
                        var split = result[3].split(/[,\s]+/);
                        var transformName = result[1].trim();
                        if (transformName == "translate") {
                            groupTransform.transformX = split[0];
                            groupTransform.transformY = split[1] || 0;
                        } else if (transformName == "scale") {
                            groupTransform.scaleX = split[0];
                            groupTransform.scaleY = split[1] || 0;
                        }
                    }
                }
                transformSet = true;
            }

            //Check path If contains draw otherwise use default l
            var pathStart = false, bigM = false, skipMove = false, stop = false;
            var pathRebuild = "";
            path.split(" ").forEach(function (t) {
                if (stop) { pathRebuild += t + " "; return;}

                if (t.toUpperCase() == START_PATH) {
                    pathStart = true;
                    bigM = t ==START_PATH ;
                } else if (skipMove && pathStart) {
                    if (!(t.indexOf(",") == -1 && isNaN(t))) {
                        t = (bigM ? DRAW_LINE.toUpperCase() : DRAW_LINE) + " " + t;
                    }
                    stop = true;
                } else if (pathStart) {
                    skipMove = true;
                }

                pathRebuild += t + " ";
            });

            path = fixPathPositioning(pathRebuild);
            path = fixNumberFormatting(path);

            //Convert attributes to style
            var attributes = $(paths[i])[0].attributes;
            stylesJson[i] = {};

            for (var n = 0; n < attributes.length; n++) {
                var name = attributes[n].name;
                var value = attributes[n].value;
                if (name == "style") {
                    //Fix CSSJSON bug
                    if (!value.endsWith(";")) {
                        value += ";"
                    }
                    var cssAttributes = CSSJSON.toJSON(value).attributes;
                    for (var key in cssAttributes) {
                        if (cssAttributes.hasOwnProperty(key)) {
                            stylesJson[i][key] = cssAttributes[key];

                            if ((key == "fill" || key == "stroke") && cssAttributes[key].startsWith("url")) {
                                warnings.pushUnique("found fill(s) or stroke(s) which uses <i>url()</i> (gradients and patterns are not supported in Android)");
                            }
                        }
                    }
                } else {
                    stylesJson[i][name] = value;
                }
            }

            if (!path.endsWith(" ")) {
                path += " ";
            }
            paths[i] = wordwrap(path.trim(), 80, "\n");
        }

        $("#output-code").text(
            generateVectorDrawable(width, height, width, height, paths, stylesJson, groupTransform));
        $("#output-box").fadeIn();
        $(".nouploadinfo").hide();
        $("#dropzone").animate({ height: 50}, 500);
        $("#success-box").show();

        //Show warnings If set
        if (warnings.length == 1) {
            setMessage("<b>Warning:</b> " + warnings[0], "alert-warning")
        } else if (warnings.length > 1) {
            var warnText = "";
            warnings.forEach(function (w, i) {
                warnText += "<tr><td><b>Warning #" + (i+1) + ":</b></td><td>" + w + "</td></tr>";
            });
            setMessage("<table class='info-items'>" + warnText + "</table>", "alert-warning")
        }
    }
}

function fixPathPositioning(path) {
    return path.replace(/^\s*m/, START_PATH).replace(/^\s*z/, END_PATH);
}

function fixNumberFormatting(path) {
    return path.replace(/(\.\d+)(\.\d+)\s?/g, "\$1 \$2 ");
}

function getDimensions(svg, warnings) {
    var widthAttr = svg.attr("width");
    var heightAttr = svg.attr("height");
    var viewBoxAttr = svg.attr("viewBox");
	
    if (typeof widthAttr === "undefined" || typeof heightAttr === "undefined") {
        if (typeof viewBoxAttr === "undefined") {
            warnings.pushUnique("no width or height set for svg (set -1)");
            return { width:-1, height:-1 };
        } else {
            var viewBoxAttrParts = viewBoxAttr.split(/[,\s]+/);
            if (viewBoxAttrParts[0] > 0 || viewBoxAttrParts[1] > 0) {
                warnings.pushUnique("viewbox minx/miny is other than 0 (not supported)");
            }
            return { width:viewBoxAttrParts[2], height:viewBoxAttrParts[3] };
        }
    } else {
        return { width:removeNonNumeric(widthAttr), height:removeNonNumeric(heightAttr) };
    }
}

function removeNonNumeric(input) {
    if (typeof input === "undefined") return input;
    return input.replace(/[^0-9.]/g,"");
}

function generateVectorDrawable(vW, vH, w, h, paths, attributes, groupTransform) {
    var isGroup = (paths.length > 1) || groupTransform != null;
    var s = isGroup ? '        ' : '    ';

    var output = '<?xml version="1.0" encoding="utf-8"?>\n';
    output += '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n';
    output += '    android:width="{0}dp"\n'.f(w);
    output += '    android:height="{0}dp"\n'.f(h);
    output += '    android:viewportWidth="{0}"\n'.f(vW);
    output += '    android:viewportHeight="{0}">\n\n'.f(vH);

    if (isGroup) {
        if (groupTransform != null) {
            output += isGroup ? '    <group\n' : '';
            output += generateAttr("translateX", groupTransform.transformX, isGroup, 0);
            output += generateAttr("translateY", groupTransform.transformY, isGroup, 0);
            output += generateAttr("scaleX", groupTransform.scaleX, isGroup, 1);
            output += generateAttr("scaleY", groupTransform.scaleY, isGroup, 1);
            if (output.endsWith("\n")) {
                output = output.substr(0, output.length - 1);
            }
            output += ">\n";
        } else {
            output += isGroup ? '    <group>\n' : '';
        }
    }

    for (var i = 0; i < paths.length; i++) {
        if (paths[i] === null) continue;

        var attribute = attributes[i];

        //Parent opacity setting - multiply fill-opacity and stroke-opacity
        var opacity = attribute["opacity"];
        if (typeof opacity !== "undefined") {
            if (typeof attribute["fill-opacity"] !== "undefined") {
                attribute["fill-opacity"] *= opacity;
            } else {
                attribute["fill-opacity"] = opacity;
            }
            if (typeof attribute["stroke-opacity"] !== "undefined") {
                attribute["stroke-opacity"] *= opacity;
            } else {
                attribute["stroke-opacity"] = opacity;
            }
        }

        //If fill is omitted use default black
        if (typeof attribute["fill"] === "undefined") {
            attribute["fill"] = "#000000";
        }

        output += s + '<path\n';
        output += generateAttr('fillColor', parseColorToHex(attribute["fill"]) , isGroup, "none");
        output += generateAttr('fillAlpha', attribute["fill-opacity"], isGroup, "1");
        output += generateAttr('strokeColor', parseColorToHex(attribute["stroke"]), isGroup, "none");
        output += generateAttr('strokeAlpha', attribute["stroke-opacity"], isGroup, "1");
        output += generateAttr('strokeWidth', removeNonNumeric(attribute["stroke-width"]), isGroup, "0");
        output += generateAttr('strokeLineJoin', attribute["stroke-linejoin"], isGroup, "miter");
        output += generateAttr('strokeMiterLimit', attribute["stroke-miterlimit"], isGroup, "4");
        output += generateAttr('strokeLineCap', attribute["stroke-linecap"], isGroup, "butt");
        output += generateAttr('pathData', paths[i], isGroup, null, true);
    }

    output += isGroup ? '    </group>\n' : '';
    output += '</vector>';

    return output;
}

function generateAttr(name, val, group, def, end) {
    if (typeof val === "undefined" || val == def) return "";
    var s = group ? '            ' : '        ';
    return s + 'android:{0}="{1}"{2}\n'.f(name, val, end ? ' />' : '');
}

function selectAll() {
    var el = $("#output-code")[0];
    if (typeof window.getSelection != "undefined" && typeof document.createRange != "undefined") {
        var range = document.createRange();
        range.selectNodeContents(el);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
    } else if (typeof document.selection != "undefined" && typeof document.body.createTextRange != "undefined") {
        var textRange = document.body.createTextRange();
        textRange.moveToElementText(el);
        textRange.select();
    }
}

function download() {
    var blob = new Blob([$("#output-code").text()], {type: "text/xml;charset=utf-8"});
    saveAs(blob, lastFileName.length > 0 ? (lastFileName + ".xml") : "vector.xml");
}

function dropzoneClick() {
    $("#dropzone-dialog").click();
}

function setMessage(text, type) {
    var info = $("." + type + ".box");
    info.html(text);
    info.removeClass();
    info.addClass("alert");
    info.addClass("box");
    info.addClass(type);
    info.show();
}

function wordwrap( str, width, brk, cut ) {
    brk = brk || '\n';
    width = width || 75;
    cut = cut || false;

    if (!str) { return str; }

    var regex = '.{1,' +width+ '}(\\s|$)' + (cut ? '|.{' +width+ '}|.+$' : '|\\S+?(\\s|$)');

    var matches = str.match( new RegExp(regex, 'g') );
    // trim off leading/trailing spaces from the matched strings
    for (i = 0; i < matches.length; i++) {
    	matches[i] = matches[i].trim();
    }

    return matches.join( brk );
}

//Parse rgb, named colors to hex
function parseColorToHex(color) {
    if (typeof color === "undefined") return color;
    color = color.replace(/\s/g, "");

    //Is hex already
    if (color.substr(0, 1) === "#") {
        return color;
    } else {
        if (color.startsWith("rgb(")) {
            var match = /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(color);
            return match !== null && match.length >= 4 ? $c.rgb2hex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3])) : color;
        } else {
            var hexClr = $c.name2hex(color);
            return !hexClr.startsWith("Invalid") ? hexClr : color;
        }
    }
}