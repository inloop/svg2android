/* Helper methods */
String.prototype.f = function () {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};

Array.prototype.pushUnique = function (item) {
    if (this.indexOf(item) == -1) {
        this.push(item);
        return true;
    }
    return false;
};

String.prototype.repeat = function (num) {
    return new Array(num + 1).join(this);
};

function toBool(s, defValue) {
    if (typeof s === "undefined") {
        return typeof defValue !== "undefined" ? defValue : false;
    }
    return "false" !== s;
}

if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function (suffix) {
        return this.indexOf(suffix, this.length - suffix.length) !== -1;
    };
}

if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function (str) {
        return this.indexOf(str) == 0;
    };
}

/* ------ */

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
var INDENT = "    ";

var pathsParsedCount = 0;
var generatedOutput = "";
var lastFileName = "";
var lastFileData;
var warnings = [];

function loadFile(e, file) {
    lastFileName = extractFileNameWithoutExt(file.name) || "";
    $("#opt-id-as-name").prop("checked", toBool(localStorage.useIdAsName));
    $("#bake-transforms").prop("checked", toBool(localStorage.bakeTransforms));
    $("#clear-groups").prop("checked", toBool(localStorage.clearGroups, true));
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

//Main parse & convert logic
function recursiveTreeWalk(parent, groupLevel) {
    parent.children().each(function () {
        var current = $(this);
        if (current.is("g") && current.children().length > 0) { //Group tag, ignore empty groups
            var group = parseGroup(current);
            var ignoreGroup = !(toBool(localStorage.clearGroups, true) && !group.isSet);
            if (ignoreGroup) printGroupStart(group, groupLevel);

            if (ignoreGroup) groupLevel++;
            recursiveTreeWalk(current, groupLevel);
            if (ignoreGroup) groupLevel--;

            if (ignoreGroup) printGroupEnd(groupLevel);
        } else if (current.is("path")) {
            var pathD = parsePathD(current);
            if (pathD != null) {
                printPath(pathD, getStyles(current), groupLevel);
            } else {
                warnings.pushUnique("found path(s) without data (empty or invalid parameter <i>d</i>)");
            }
        } else if (current.is("line")) {
            printPath(ShapeConverter.convertLine(current), getStyles(current), groupLevel);
        } else if (current.is("rect")) {
            printPath(ShapeConverter.convertRect(current), getStyles(current), groupLevel);
        } else if (current.is("circle")) {
            printPath(ShapeConverter.convertCircle(current), getStyles(current), groupLevel);
        } else if (current.is("ellipse")) {
            printPath(ShapeConverter.convertEllipse(current), getStyles(current), groupLevel);
        } else if (current.is("polyline")) {
            printPath(ShapeConverter.convertPolygon(current, true), getStyles(current), groupLevel);
        } else if (current.is("polygon")) {
            printPath(ShapeConverter.convertPolygon(current, false), getStyles(current), groupLevel);
        } else if (current.is("text")) {
            warnings.pushUnique("<i>text</i> element is not supported, export all text into path");
        }
    });
}

function getStyles(el) {
    var styles = parseStyles(el);
    var parentStyles = el.parent().is("g") ? parseStyles(el.parent()) : null;
    return [styles, parentStyles];
}

function parseGroup(groupTag) {
    var transform = groupTag.attr("transform");
    var id = groupTag.attr("id");
    var groupTransform = {transformX: 0, transformY: 0, scaleX: 1, scaleY: 1, rotate:0, rotatePivotX:-1, rotatePivotY:-1, id:"", isSet:false};
    if (typeof transform !== "undefined") {
        var regex = /((\w|\s)+)\(([^)]+)/mg;
        var result;
        while (result = regex.exec(transform)) {
            var split = result[3].split(/[,\s]+/);
            var transformName = result[1].trim();
            if (transformName == "translate") {
                groupTransform.transformX = split[0];
                groupTransform.transformY = split[1] || 0;
                groupTransform.isSet = true;
            } else if (transformName == "scale") {
                groupTransform.scaleX = split[0];
                groupTransform.scaleY = split[1] || 0;
                groupTransform.isSet = true;
            } else if (transformName == "rotate") {
                groupTransform.rotate = split[0];
                groupTransform.rotatePivotX = split[1] || -1;
                groupTransform.rotatePivotY = split[2] || -1;
                groupTransform.isSet = true;
            } else {
                warnings.pushUnique("group transform '<i>" + transformName + "</i>' is not supported, use option <i>Bake transforms into path</i>")
            }
        }
    }
    if (typeof id !== "undefined") {
        groupTransform.id = id;
    }

    return groupTransform;
}

function parsePathD(pathData) {
    var path = pathData.attr("d");

    if (typeof path === "undefined") {
        return null;
    }

    path = path.replace(/\s{2,}/g, " "); //replace extra spaces

    if (path.match(/-?\d*\.?\d+e[+-]?\d+/g)) {
        warnings.pushUnique("found some numbers with scientific E notation in pathData which Android probably does not support. " +
        "Please fix It manually by editing your editor precision or manually by editing pathData");
    }

    //Check path If contains draw otherwise use default l
    var pathStart = false, bigM = false, skipMove = false, stop = false;
    var pathRebuild = "";
    path.split(" ").forEach(function (t) {
        if (stop) {
            pathRebuild += t + " ";
            return;
        }

        if (t.toUpperCase() == START_PATH) {
            pathStart = true;
            bigM = t == START_PATH;
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

    if (!path.endsWith(" ")) {
        path += " ";
    }

    return wordwrap(path.trim(), 80, "\n");
}


function parseStyles(path) {
    //Convert attributes to style
    var attributes = path[0].attributes;
    var stylesArray = {};
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
                    stylesArray[key] = cssAttributes[key];

                    if ((key == "fill" || key == "stroke") && cssAttributes[key].startsWith("url")) {
                        warnings.pushUnique("found fill(s) or stroke(s) which uses <i>url()</i> (gradients and patterns are not supported in Android)");
                    }
                }
            }
        } else {
            stylesArray[name] = value;
        }
    }

    return stylesArray;
}

function printGroupStart(groupTransform, groupLevel) {
    generatedOutput += INDENT.repeat(groupLevel + 1) + '<group\n';
    if (toBool(localStorage.useIdAsName)) generatedOutput += generateAttr("name", groupTransform.id, groupLevel + 1, "");
    generatedOutput += generateAttr("translateX", groupTransform.transformX, groupLevel + 1, 0);
    generatedOutput += generateAttr("translateY", groupTransform.transformY, groupLevel + 1, 0);
    generatedOutput += generateAttr("scaleX", groupTransform.scaleX, groupLevel + 1, 1);
    generatedOutput += generateAttr("scaleY", groupTransform.scaleY, groupLevel + 1, 1);
    if (generatedOutput.endsWith("\n")) {
        generatedOutput = generatedOutput.substr(0, generatedOutput.length - 1);
    }
    generatedOutput += ">\n";
}

function printGroupEnd(groupLevel) {
    generatedOutput += INDENT.repeat(groupLevel + 1) + '</group>\n';
}

function printPath(pathData, stylesArray, groupLevel) {
    var styles = stylesArray[0];
    var parentGroupStyles = stylesArray[1];

    if (pathData == null) {
        return;
    }

    if (parentGroupStyles != null) {
        //Inherit styles from group first
        for (var styleName in parentGroupStyles) {
            if (typeof styles[styleName] === "undefined") {
                styles[styleName] = parentGroupStyles[styleName];
            }
        }
    }
    //Parent opacity setting - multiply fill-opacity and stroke-opacity
    var opacity = styles["opacity"];
    if (typeof opacity !== "undefined") {
        if (typeof styles["fill-opacity"] !== "undefined") {
            styles["fill-opacity"] *= opacity;
        } else {
            styles["fill-opacity"] = opacity;
        }
        if (typeof styles["stroke-opacity"] !== "undefined") {
            styles["stroke-opacity"] *= opacity;
        } else {
            styles["stroke-opacity"] = opacity;
        }
    }

    //If fill is omitted use default black
    if (typeof styles["fill"] === "undefined") {
        styles["fill"] = "#000000";
    }

    generatedOutput += INDENT.repeat(groupLevel + 1) + '<path\n';
    if (toBool(localStorage.useIdAsName)) generatedOutput += generateAttr('name', styles["id"], groupLevel, "");
    generatedOutput += generateAttr('fillColor', parseColorToHex(styles["fill"]), groupLevel, "none");
    generatedOutput += generateAttr('fillAlpha', styles["fill-opacity"], groupLevel, "1");
    generatedOutput += generateAttr('strokeColor', parseColorToHex(styles["stroke"]), groupLevel, "none");
    generatedOutput += generateAttr('strokeAlpha', styles["stroke-opacity"], groupLevel, "1");
    generatedOutput += generateAttr('strokeWidth', removeNonNumeric(styles["stroke-width"]), groupLevel, "0");
    generatedOutput += generateAttr('strokeLineJoin', styles["stroke-linejoin"], groupLevel, "miter");
    generatedOutput += generateAttr('strokeMiterLimit', styles["stroke-miterlimit"], groupLevel, "4");
    generatedOutput += generateAttr('strokeLineCap', styles["stroke-linecap"], groupLevel, "butt");
    generatedOutput += generateAttr('pathData', pathData, groupLevel, null, true);
    pathsParsedCount++;
}

function parseFile(inputXml) {
    lastFileData = inputXml;
    $(".alert").hide();

    var xml;
    try {
        xml = $($.parseXML(inputXml));
    } catch (e) {
        setMessage("<b>Error:</b> not valid SVG file.", "alert-danger");
        $("#output-box").hide();
        return;
    }

    //Reset previous
    pathsParsedCount = 0;
    warnings = [];

    var svg = xml.find("svg");

    if (toBool(localStorage.bakeTransforms)) {
        flatten(svg[0], true, true, null, 2);
    }

    //Parse dimensions
    var dimensions = getDimensions(svg);
    var width = dimensions.width;
    var height = dimensions.height;

    //XML Vector start
    generatedOutput = '<?xml version="1.0" encoding="utf-8"?>\n';
    generatedOutput += '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n';
    generatedOutput += INDENT + 'android:width="{0}dp"\n'.f(width);
    generatedOutput += INDENT + 'android:height="{0}dp"\n'.f(height);
    generatedOutput += INDENT + 'android:viewportWidth="{0}"\n'.f(width);
    generatedOutput += INDENT + 'android:viewportHeight="{0}">\n\n'.f(height);

    //XML Vector content
    //Iterate through groups and paths
    recursiveTreeWalk(svg, 0);

    //XML Vector end
    generatedOutput += '</vector>';

    //SVG must contain path(s)
    if (pathsParsedCount == 0) {
        setMessage("No shape elements found in svg.", "alert-danger");
        $("#output-box").hide();
        return;
    }

    $("#output-code").text(generatedOutput).animate({scrollTop: 0}, "fast");
    $("#output-box").fadeIn();
    $(".nouploadinfo").hide();
    $("#dropzone").animate({height: 50}, 500);
    $("#success-box").show();

    if (warnings.length == 1) {
        setMessage("<b>Warning:</b> " + warnings[0], "alert-warning")
    } else if (warnings.length > 1) {
        var warnText = "";
        warnings.forEach(function (w, i) {
            warnText += "<tr><td><b>Warning #" + (i + 1) + ":</b></td><td>" + w + "</td></tr>";
        });
        setMessage("<table class='info-items'>" + warnText + "</table>", "alert-warning")
    }
}

function fixPathPositioning(path) {
    return path.replace(/^\s*m/, START_PATH).replace(/^\s*z/, END_PATH);
}

function fixNumberFormatting(path) {
    return path.replace(/(\.\d+)(\.\d+)\s?/g, "\$1 \$2 ");
}

function getDimensions(svg) {
    var widthAttr = svg.attr("width");
    var heightAttr = svg.attr("height");
    var viewBoxAttr = svg.attr("viewBox");

    if (typeof viewBoxAttr === "undefined") {
        if (typeof widthAttr === "undefined" || typeof heightAttr === "undefined") {
            warnings.pushUnique("width or height not set for svg (set -1)");
            return {width: -1, height: -1};
        } else {
            return {width: convertDimensionToPx(widthAttr), height: convertDimensionToPx(heightAttr)};
        }
    } else {
        var viewBoxAttrParts = viewBoxAttr.split(/[,\s]+/);
        if (viewBoxAttrParts[0] > 0 || viewBoxAttrParts[1] > 0) {
            warnings.pushUnique("viewbox minx/miny is other than 0 (not supported)");
        }
        return {width: viewBoxAttrParts[2], height: viewBoxAttrParts[3]};
    }

}

function removeNonNumeric(input) {
    if (typeof input === "undefined") return input;
    return input.replace(/[^0-9.]/g, "");
}


function generateAttr(name, val, groupLevel, def, end) {
    if (typeof val === "undefined" || val == def) return "";
    return INDENT.repeat(groupLevel + 2) + 'android:{0}="{1}"{2}\n'.f(name, val, end ? ' />' : '');
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

function useIdAsName(el) {
    localStorage.useIdAsName = el.checked;
    parseFile(lastFileData);
}

function bakeTransforms(el) {
    localStorage.bakeTransforms = el.checked;
    parseFile(lastFileData);
}

function clearGroups(el) {
    localStorage.clearGroups = el.checked;
    parseFile(lastFileData);
}

function wordwrap(str, width, brk, cut) {
    brk = brk || '\n';
    width = width || 75;
    cut = cut || false;

    if (!str) {
        return str;
    }

    var regex = '.{1,' + width + '}(\\s|$)' + (cut ? '|.{' + width + '}|.+$' : '|\\S+?(\\s|$)');

    var matches = str.match(new RegExp(regex, 'g'));
    // trim off leading/trailing spaces from the matched strings
    for (i = 0; i < matches.length; i++) {
        matches[i] = matches[i].trim();
    }

    return matches.join(brk);
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

function convertDimensionToPx(dimen) {
    var val = removeNonNumeric(dimen);
    var METER_TO_PX = 3543.30709;
    var INCH_TO_PX = 90;
    var PT_TO_PX = 1.25;
    var PC_TO_PX = 15;
    var FT_TO_PX = 1080;

    if (dimen.endsWith("mm")) {
        return val * (METER_TO_PX / 1000);
    } else if (dimen.endsWith("cm")) {
        return val * (METER_TO_PX / 100);
    } else if (dimen.endsWith("m")) {
        return val * METER_TO_PX;
    } else if (dimen.endsWith("in")) {
        return val * INCH_TO_PX;
    } else if (dimen.endsWith("pt")) {
        return val * PT_TO_PX;
    } else if (dimen.endsWith("pc")) {
        return val * PC_TO_PX;
    } else if (dimen.endsWith("ft")) {
        return val * FT_TO_PX;
    } else {
        return val;
    }
}