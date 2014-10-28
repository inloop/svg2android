/* Helper methods */
String.prototype.f = function () {
    var s = this,
        i = arguments.length;

    while (i--) {
        s = s.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
    }
    return s;
};

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length) !== -1;
};

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
    var svg = xml.find("svg");

    var dimensions = getDimensions(svg);
    var width = dimensions.width;
    var height = dimensions.height;
    var paths = xml.find("path");

    if (paths.length == 0) {
        setMessage("No path found, you must convert all your objects into path.", "alert-danger");
        $("#output-box").hide();
    } else {

        var DRAW_LINE = "l"; //used as default parameter when no found in path
        var START_PATH = "M";
        var END_PATH = "Z";
        var stylesJson = [];
        var groupTransform = null;
        var transformSet = false;

        for (var i = 0; i < paths.length; i++) {
            var path = $(paths[i]).attr("d");
            var parentTag = $(paths[i]).parent().get(0);

            if (path.match(/-?\d*\.?\d+e[+-]?\d+/g)) {
                setMessage("<b>Warning:</b> found some numbers with scientific E notation in pathData which Android probably does not support. " +
                "Please fix It manually by editing your editor precision or manually by editing pathData.", "alert-warning");
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
                        if (result[1] == "translate") {
                            groupTransform.transformX = split[0];
                            groupTransform.transformY = split[1] || 0;
                        } else if (result[1] == "scale") {
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

            path = pathRebuild.replace("m", START_PATH).replace("z", END_PATH);

            //Convert attributes to style
            var attributes = $(paths[i])[0].attributes;
            stylesJson[i] = [];

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
    }
}

function getDimensions(svg) {
    var widthAttr = svg.attr("width");
    var heightAttr = svg.attr("height");
    if (typeof widthAttr === "undefined" || typeof heightAttr === "undefined") {
        var viewBoxAttr = svg.attr("viewBox").split(/[,\s]+/);
        return { width:viewBoxAttr[2], height:viewBoxAttr[3] };
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
        var attribute = attributes[i];
        output += s + '<path\n';
        output += generateAttr('fillColor', attribute["fill"] , isGroup, "none");
        output += generateAttr('fillAlpha', attribute["fill-opacity"], isGroup, "1");
        output += generateAttr('strokeColor', attribute["stroke"], isGroup, "none");
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
    if (typeof val === "undefined" || val === def) return "";
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

    return str.match( new RegExp(regex, 'g') ).join( brk );

}