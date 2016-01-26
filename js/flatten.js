/*
 Random path and shape generator, flattener test base: http://jsfiddle.net/xqq5w/embedded/result/
 Basic usage example: http://jsfiddle.net/Nv78L/3/embedded/result/

 Basic usage: flatten(document.getElementById('svg'));

 What it does: Flattens elements (converts elements to paths and flattens transformations).
 If the argument element (whose id is above 'svg') has children, or it's descendants has children,
 these children elements are flattened also.

 If you want to modify path coordinates using non-affine methods (eg. perspective distort),
 you can convert all segments to cubic curves using:

 flatten(document.getElementById('svg'), true);

 There are also arguments 'toAbsolute' (convert coordinates to absolute) and 'dec',
 number of digits after decimal separator.
 */
/*
 The MIT License (MIT)

 Copyright (c) 2014 Timo (https://github.com/timo22345)

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */
 
(function () {
	
	SVGElement.prototype.getTransformToElement = SVGElement.prototype.getTransformToElement || function(elem) {
    return elem.getScreenCTM().inverse().multiply(this.getScreenCTM());};

    var p2s = /,?([achlmqrstvxz]),?/gi;
    var convertToString = function (arr) {
        return arr.join(',').replace(p2s, ' $1');
    };

    var decPrecision = 6;
    var s = function (num) {
        if (decPrecision !== false) return parseFloat(num.toPrecision(decPrecision));
        else return num;
    };

    // Flattens transformations of element or it's children and sub-children
    // elem: DOM element
    // toCubics: converts all segments to cubics
    // toAbsolute: converts all segments to Absolute
    // dec: number of digits after decimal separator
    // Returns: no return value
    function flatten(elem, toCubics, toAbsolute, dec) {
        if (!elem) return;
        if (typeof (rectAsArgs) == 'undefined') rectAsArgs = false;
        if (typeof (toCubics) == 'undefined') toCubics = false;
        if (typeof (toAbsolute) == 'undefined') toAbsolute = false;
        if (typeof (dec) == 'undefined') dec = false;

        if (elem && elem.children && elem.children.length) {
            for (var i = 0, ilen = elem.children.length; i < ilen; i++) {
                flatten(elem.children[i], toCubics, toAbsolute, dec);
            }
            elem.removeAttribute('transform');
            return;
        }
        if (!(elem instanceof SVGCircleElement ||
            elem instanceof SVGRectElement ||
            elem instanceof SVGEllipseElement ||
            elem instanceof SVGLineElement ||
            elem instanceof SVGPolygonElement ||
            elem instanceof SVGPolylineElement ||
            elem instanceof SVGPathElement)) return;

        path_elem = convertToPath(elem);

        if (!path_elem || path_elem.getAttribute(d) == '') return 'M 0 0';

        // Rounding coordinates to dec decimals
        if (dec || dec === 0) {
            if (dec > 15) decPrecision = 15;
            else if (dec < 0) decPrecision = 0;
        }


        var arr;
        //var pathDOM = path_elem.node;
        var pathDOM = path_elem;
        var d = pathDOM.getAttribute('d').trim();

        // If you want to retain current path commans, set toCubics to false
        if (!toCubics) { // Set to false to prevent possible re-normalization.
            arr = parsePathString(d); // str to array
            var arr_orig = arr;
            arr = pathToAbsolute(arr); // mahvstcsqz -> uppercase
        }
        // If you want to modify path data using nonAffine methods,
        // set toCubics to true
        else {
            arr = path2curve(d); // mahvstcsqz -> MC
            var arr_orig = arr;
        }
        var svgDOM = pathDOM.ownerSVGElement;

        // Get the relation matrix that converts path coordinates
        // to SVGroot's coordinate space
        var matrix = pathDOM.getTransformToElement(svgDOM);

        // The following code can bake transformations
        // both normalized and non-normalized data
        // Coordinates have to be Absolute in the following
        var i = 0,
            j, m = arr.length,
            letter = '',
            letter_orig = '',
            x = 0,
            y = 0,
            point, newcoords = [],
            newcoords_orig = [],
            pt = svgDOM.createSVGPoint(),
            subpath_start = {}, prevX = 0,
            prevY = 0;
        subpath_start.x = null;
        subpath_start.y = null;
        for (; i < m; i++) {
            letter = arr[i][0].toUpperCase();
            letter_orig = arr_orig[i][0];
            newcoords[i] = [];
            newcoords[i][0] = arr[i][0];

            if (letter == 'A') {
                x = arr[i][6];
                y = arr[i][7];

                pt.x = arr[i][6];
                pt.y = arr[i][7];
                newcoords[i] = arc_transform(arr[i][1], arr[i][2], arr[i][3], arr[i][4], arr[i][5], pt, matrix);
                // rounding arc parameters
                // x,y are rounded normally
                // other parameters at least to 5 decimals
                // because they affect more than x,y rounding
                newcoords[i][1] = newcoords[i][1]; //rx
                newcoords[i][2] = newcoords[i][2]; //ry
                newcoords[i][3] = newcoords[i][3]; //x-axis-rotation
                newcoords[i][6] = newcoords[i][6]; //x
                newcoords[i][7] = newcoords[i][7]; //y
            }
            else if (letter != 'Z') {
                // parse other segs than Z and A
                for (j = 1; j < arr[i].length; j = j + 2) {
                    if (letter == 'V') y = arr[i][j];
                    else if (letter == 'H') x = arr[i][j];
                    else {
                        x = arr[i][j];
                        y = arr[i][j + 1];
                    }
                    pt.x = x;
                    pt.y = y;
                    point = pt.matrixTransform(matrix);

                    if (letter == 'V' || letter == 'H') {
                        newcoords[i][0] = 'L';
                        newcoords[i][j] = s(point.x);
                        newcoords[i][j + 1] = s(point.y);
                    }
                    else {
                        newcoords[i][j] = s(point.x);
                        newcoords[i][j + 1] = s(point.y);
                    }
                }
            }
            if ((letter != 'Z' && subpath_start.x === null) || letter == 'M') {
                subpath_start.x = x;
                subpath_start.y = y;
            }
            if (letter == 'Z') {
                x = subpath_start.x;
                y = subpath_start.y;
            }
        }
        // Convert all that was relative back to relative
        // This could be combined to above, but to make code more readable
        // this is made separately.
        var prevXtmp = 0;
        var prevYtmp = 0;
        subpath_start.x = '';
        for (i = 0; i < newcoords.length; i++) {
            letter_orig = arr_orig[i][0];
            if (letter_orig == 'A' || letter_orig == 'M' || letter_orig == 'L' || letter_orig == 'C' || letter_orig == 'S' || letter_orig == 'Q' || letter_orig == 'T' || letter_orig == 'H' || letter_orig == 'V') {
                var len = newcoords[i].length;
                var lentmp = len;
                if (letter_orig == 'A') {
                    newcoords[i][6] = s(newcoords[i][6]);
                    newcoords[i][7] = s(newcoords[i][7]);
                }
                else {
                    lentmp--;
                    while (--lentmp) newcoords[i][lentmp] = s(newcoords[i][lentmp]);
                }
                prevX = newcoords[i][len - 2];
                prevY = newcoords[i][len - 1];
            }
            else if (letter_orig == 'a') {
                prevXtmp = newcoords[i][6];
                prevYtmp = newcoords[i][7];
                newcoords[i][0] = letter_orig;
                newcoords[i][6] = s(newcoords[i][6] - prevX);
                newcoords[i][7] = s(newcoords[i][7] - prevY);
                prevX = prevXtmp;
                prevY = prevYtmp;
            }
            else if (letter_orig == 'm' || letter_orig == 'l' || letter_orig == 'c' || letter_orig == 's' || letter_orig == 'q' || letter_orig == 't' || letter_orig == 'h' || letter_orig == 'v') {
                var len = newcoords[i].length;
                prevXtmp = newcoords[i][len - 2];
                prevYtmp = newcoords[i][len - 1];
                for (j = 1; j < len; j = j + 2) {
                    if (letter_orig == 'h' || letter_orig == 'v')
                        newcoords[i][0] = 'l';
                    else newcoords[i][0] = letter_orig;
                    newcoords[i][j] = s(newcoords[i][j] - prevX);
                    newcoords[i][j + 1] = s(newcoords[i][j + 1] - prevY);
                }
                prevX = prevXtmp;
                prevY = prevYtmp;
            }
            if ((letter_orig.toLowerCase() != 'z' && subpath_start.x == '') || letter_orig.toLowerCase() == 'm') {
                subpath_start.x = prevX;
                subpath_start.y = prevY;
            }
            if (letter_orig.toLowerCase() == 'z') {
                prevX = subpath_start.x;
                prevY = subpath_start.y;
            }
        }

        if (toAbsolute) newcoords = pathToAbsolute(newcoords);
        path_elem.setAttribute('d', convertToString(newcoords));
        path_elem.removeAttribute('transform');
    }

    // Converts all shapes to path retaining attributes.
    // oldElem - DOM element to be replaced by path. Can be one of the following:
    //   ellipse, circle, path, line, polyline, polygon and rect.
    // rectAsArgs - Boolean. If true, rect roundings will be as arcs. Otherwise as cubics.
    // Source: https://github.com/duopixel/Method-Draw/blob/master/editor/src/svgcanvas.js
    // Modifications: Timo (https://github.com/timo22345)
    function convertToPath(oldElem) {
        if (!oldElem) return;
        // Create new path element
        var path = document.createElementNS(oldElem.ownerSVGElement.namespaceURI, 'path');

        // All attributes that path element can have
        var attrs = ['requiredFeatures', 'requiredExtensions', 'systemLanguage', 'id', 'xml:base', 'xml:lang', 'xml:space', 'onfocusin', 'onfocusout', 'onactivate', 'onclick', 'onmousedown', 'onmouseup', 'onmouseover', 'onmousemove', 'onmouseout', 'onload', 'alignment-baseline', 'baseline-shift', 'clip', 'clip-path', 'clip-rule', 'color', 'color-interpolation', 'color-interpolation-filters', 'color-profile', 'color-rendering', 'cursor', 'direction', 'display', 'dominant-baseline', 'enable-background', 'fill', 'fill-opacity', 'fill-rule', 'filter', 'flood-color', 'flood-opacity', 'font-family', 'font-size', 'font-size-adjust', 'font-stretch', 'font-style', 'font-variant', 'font-weight', 'glyph-orientation-horizontal', 'glyph-orientation-vertical', 'image-rendering', 'kerning', 'letter-spacing', 'lighting-color', 'marker-end', 'marker-mid', 'marker-start', 'mask', 'opacity', 'overflow', 'pointer-events', 'shape-rendering', 'stop-color', 'stop-opacity', 'stroke', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width', 'text-anchor', 'text-decoration', 'text-rendering', 'unicode-bidi', 'visibility', 'word-spacing', 'writing-mode', 'class', 'style', 'externalResourcesRequired', 'transform', 'd', 'pathLength'];

        // Copy attributes of oldElem to path
        for (var i = 0, ilen = attrs.length; i < ilen; i++) {
            var attrName = attrs[i];
            var attrValue = oldElem.getAttribute(attrName);
            if (attrValue) path.setAttribute(attrName, attrValue);
        }

        var d = '';
        var tag = oldElem.tagName;
        switch (tag) {
            case 'ellipse':
                d += ShapeConverter.convertEllipse($(oldElem));
                break;
            case 'circle':
                d += ShapeConverter.convertCircle($(oldElem));
                break;
            case 'path':
                d = oldElem.getAttribute('d');
                break;
            case 'line':
                d += ShapeConverter.convertLine($(oldElem));
                break;
            case 'polyline':
                d += ShapeConverter.convertPolygon($(oldElem), true);
                break;
            case 'polygon':
                d += ShapeConverter.convertPolygon($(oldElem), false);
                break;
            case 'rect':
                d += ShapeConverter.convertRect($(oldElem));
                break;
            default:
                //path.parentNode.removeChild(path);
                break;
        }

        if (d) path.setAttribute('d', d);

        // Replace the current element with the converted one
        oldElem.parentNode.replaceChild(path, oldElem);
        return path;
    }

    // This is needed to flatten transformations of elliptical arcs
    // Note! This is not needed if Raphael.path2curve is used
    function arc_transform(a_rh, a_rv, a_offsetrot, large_arc_flag, sweep_flag, endpoint, matrix, svgDOM) {
        function NEARZERO(B) {
            if (Math.abs(B) < 0.0000000000000001) return true;
            else return false;
        }

        var rh, rv, rot;

        var m = []; // matrix representation of transformed ellipse
        var s, c; // sin and cos helpers (the former offset rotation)
        var A, B, C; // ellipse implicit equation:
        var ac, A2, C2; // helpers for angle and halfaxis-extraction.
        rh = a_rh;
        rv = a_rv;

        a_offsetrot = a_offsetrot * (Math.PI / 180); // deg->rad
        rot = a_offsetrot;

        s = parseFloat(Math.sin(rot));
        c = parseFloat(Math.cos(rot));

        // build ellipse representation matrix (unit circle transformation).
        // the 2x2 matrix multiplication with the upper 2x2 of a_mat is inlined.
        m[0] = matrix.a * +rh * c + matrix.c * rh * s;
        m[1] = matrix.b * +rh * c + matrix.d * rh * s;
        m[2] = matrix.a * -rv * s + matrix.c * rv * c;
        m[3] = matrix.b * -rv * s + matrix.d * rv * c;

        // to implict equation (centered)
        A = (m[0] * m[0]) + (m[2] * m[2]);
        C = (m[1] * m[1]) + (m[3] * m[3]);
        B = (m[0] * m[1] + m[2] * m[3]) * 2.0;

        // precalculate distance A to C
        ac = A - C;

        // convert implicit equation to angle and halfaxis:
        if (NEARZERO(B)) {
            a_offsetrot = 0;
            A2 = A;
            C2 = C;
        }
        else {
            if (NEARZERO(ac)) {
                A2 = A + B * 0.5;
                C2 = A - B * 0.5;
                a_offsetrot = Math.PI / 4.0;
            }
            else {
                // Precalculate radical:
                var K = 1 + B * B / (ac * ac);

                // Clamp (precision issues might need this.. not likely, but better save than sorry)
                if (K < 0) K = 0;
                else K = Math.sqrt(K);

                A2 = 0.5 * (A + C + K * ac);
                C2 = 0.5 * (A + C - K * ac);
                a_offsetrot = 0.5 * Math.atan2(B, ac);
            }
        }

        // This can get slightly below zero due to rounding issues.
        // it's save to clamp to zero in this case (this yields a zero length halfaxis)
        if (A2 < 0) A2 = 0;
        else A2 = Math.sqrt(A2);
        if (C2 < 0) C2 = 0;
        else C2 = Math.sqrt(C2);

        // now A2 and C2 are half-axis:
        if (ac <= 0) {
            a_rv = A2;
            a_rh = C2;
        }
        else {
            a_rv = C2;
            a_rh = A2;
        }

        // If the transformation matrix contain a mirror-component
        // winding order of the ellise needs to be changed.
        if ((matrix.a * matrix.d) - (matrix.b * matrix.c) < 0) {
            if (!sweep_flag) sweep_flag = 1;
            else sweep_flag = 0;
        }

        // Finally, transform arc endpoint. This takes care about the
        // translational part which we ignored at the whole math-showdown above.
        endpoint = endpoint.matrixTransform(matrix);

        // Radians back to degrees
        a_offsetrot = a_offsetrot * 180 / Math.PI;

        var r = ['A', a_rh, a_rv, a_offsetrot, large_arc_flag, sweep_flag, endpoint.x, endpoint.y];
        return r;
    }

    // Parts of Raphaël 2.1.0 (MIT licence: http://raphaeljs.com/license.html)
    // Contains eg. bugfixed path2curve() function

    var R = {};
    var has = 'hasOwnProperty';
    var Str = String;
    var array = 'array';
    var isnan = {
        'NaN': 1,
        'Infinity': 1,
        '-Infinity': 1
    };
    var lowerCase = Str.prototype.toLowerCase;
    var upperCase = Str.prototype.toUpperCase;
    var objectToString = Object.prototype.toString;
    var concat = 'concat';
    var split = 'split';
    var apply = 'apply';
    var math = Math,
        mmax = math.max,
        mmin = math.min,
        abs = math.abs,
        pow = math.pow,
        PI = math.PI,
        round = math.round,
        toFloat = parseFloat,
        toInt = parseInt;
    var p2s = /,?([achlmqrstvxz]),?/gi;
    var pathCommand = /([achlmrqstvz])[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029,]*((-?\d*\.?\d*(?:e[\-+]?\d+)?[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*,?[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*)+)/ig;
    var pathValues = /(-?\d*\.?\d*(?:e[\-+]?\d+)?)[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*,?[\x09\x0a\x0b\x0c\x0d\x20\xa0\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000\u2028\u2029]*/ig;
    R.is = function (o, type) {
        type = lowerCase.call(type);
        if (type == 'finite') {
            return !isnan[has](+o);
        }
        if (type == 'array') {
            return o instanceof Array;
        }
        return type == 'null' && o === null || type == typeof o && o !== null || type == 'object' && o === Object(o) || type == 'array' && Array.isArray && Array.isArray(o) || objectToString.call(o).slice(8, -1).toLowerCase() == type
    };

    function clone(obj) {
        if (Object(obj) !== obj) {
            return obj;
        }
        var res = new obj.constructor;
        for (var key in obj) {
            if (obj[has](key)) {
                res[key] = clone(obj[key]);
            }
        }
        return res;
    }

    R._path2string = function () {
        return this.join(',').replace(p2s, '$1');
    };

    function repush(array, item) {
        for (var i = 0, ii = array.length; i < ii; i++)
            if (array[i] === item) {
                return array.push(array.splice(i, 1)[0]);
            }
    }

    var pathClone = function (pathArray) {
        var res = clone(pathArray);
        res.toString = R._path2string;
        return res;
    };
    var paths = function (ps) {
        var p = paths.ps = paths.ps ||
        {};
        if (p[ps]) p[ps].sleep = 100;
        else p[ps] = {
            sleep: 100
        };
        setTimeout(function () {
            for (var key in p) {
                if (p[has](key) && key != ps) {
                    p[key].sleep--;
                    !p[key].sleep && delete p[key];
                }
            }
        });
        return p[ps];
    };

    function catmullRom2bezier(crp, z) {
        var d = [];
        for (var i = 0, iLen = crp.length; iLen - 2 * !z > i; i += 2) {
            var p = [
                {
                    x: +crp[i - 2],
                    y: +crp[i - 1]
                },
                {
                    x: +crp[i],
                    y: +crp[i + 1]
                },
                {
                    x: +crp[i + 2],
                    y: +crp[i + 3]
                },
                {
                    x: +crp[i + 4],
                    y: +crp[i + 5]
                }];
            if (z) {
                if (!i) {
                    p[0] = {
                        x: +crp[iLen - 2],
                        y: +crp[iLen - 1]
                    };
                }
                else {
                    if (iLen - 4 == i) {
                        p[3] = {
                            x: +crp[0],
                            y: +crp[1]
                        };
                    }
                    else {
                        if (iLen - 2 == i) {
                            p[2] = {
                                x: +crp[0],
                                y: +crp[1]
                            };
                            p[3] = {
                                x: +crp[2],
                                y: +crp[3]
                            };
                        }
                    }
                }
            }
            else {
                if (iLen - 4 == i) {
                    p[3] = p[2];
                }
                else {
                    if (!i) {
                        p[0] = {
                            x: +crp[i],
                            y: +crp[i + 1]
                        };
                    }
                }
            }
            d.push(['C', (-p[0].x + 6 * p[1].x + p[2].x) / 6, (-p[0].y + 6 * p[1].y + p[2].y) / 6, (p[1].x + 6 * p[2].x - p[3].x) / 6, (p[1].y + 6 * p[2].y - p[3].y) / 6, p[2].x, p[2].y])
        }
        return d
    };
    var parsePathString = function (pathString) {
        if (!pathString) return null;
        var pth = paths(pathString);
        if (pth.arr) return pathClone(pth.arr);
        var paramCounts = {
            a: 7,
            c: 6,
            h: 1,
            l: 2,
            m: 2,
            r: 4,
            q: 4,
            s: 4,
            t: 2,
            v: 1,
            z: 0
        }, data = [];
        if (R.is(pathString, array) && R.is(pathString[0], array)) data = pathClone(pathString);
        if (!data.length) {
            Str(pathString).replace(pathCommand, function (a, b, c) {
                var params = [],
                    name = b.toLowerCase();
                c.replace(pathValues, function (a, b) {
                    b && params.push(+b);
                });
                if (name == 'm' && params.length > 2) {
                    data.push([b][concat](params.splice(0, 2)));
                    name = 'l';
                    b = b == 'm' ? 'l' : 'L'
                }
                if (name == 'r') data.push([b][concat](params));
                else {
                    while (params.length >= paramCounts[name]) {
                        data.push([b][concat](params.splice(0, paramCounts[name])));
                        if (!paramCounts[name]) break;
                    }
                }
            })
        }
        data.toString = R._path2string;
        pth.arr = pathClone(data);
        return data;
    };

    function repush(array, item) {
        for (var i = 0, ii = array.length; i < ii; i++)
            if (array[i] === item) {
                return array.push(array.splice(i, 1)[0]);
            }
    }

    var pathToAbsolute = cacher(function (pathArray) {
        //var pth = paths(pathArray); // Timo: commented to prevent multiple caching
        // for some reason only FF proceed correctly
        // when not cached using cacher() around
        // this function.
        //if (pth.abs) return pathClone(pth.abs)
        if (!R.is(pathArray, array) || !R.is(pathArray && pathArray[0], array))
            pathArray = parsePathString(pathArray);
        if (!pathArray || !pathArray.length) return [['M', 0, 0]];
        var res = [],
            x = 0,
            y = 0,
            mx = 0,
            my = 0,
            start = 0;
        if (pathArray[0][0] == 'M') {
            x = +pathArray[0][1];
            y = +pathArray[0][2];
            mx = x;
            my = y;
            start++;
            res[0] = ['M', x, y];
        }
        var crz = pathArray.length == 3 && pathArray[0][0] == 'M' && pathArray[1][0].toUpperCase() == 'R' && pathArray[2][0].toUpperCase() == 'Z';
        for (var r, pa, i = start, ii = pathArray.length; i < ii; i++) {
            res.push(r = []);
            pa = pathArray[i];
            if (pa[0] != upperCase.call(pa[0])) {
                r[0] = upperCase.call(pa[0]);
                switch (r[0]) {
                    case 'A':
                        r[1] = pa[1];
                        r[2] = pa[2];
                        r[3] = pa[3];
                        r[4] = pa[4];
                        r[5] = pa[5];
                        r[6] = s(pa[6] + x);
                        r[7] = s(pa[7] + y);
                        break;
                    case 'V':
                        r[1] = s(pa[1] + y);
                        break;
                    case 'H':
                        r[1] = s(pa[1] + x);
                        break;
                    case 'R':
                        var dots = [x, y][concat](pa.slice(1));
                        for (var j = 2, jj = dots.length; j < jj; j++) {
                            dots[j] = s(dots[j] + x);
                            dots[++j] = s(dots[j] + y);
                        }
                        res.pop();
                        res = res[concat](catmullRom2bezier(dots, crz));
                        break;
                    case 'M':
                        mx = s(pa[1] + x);
                        my = s(pa[2] + y);
                    default:
                        for (j = 1, jj = pa.length; j < jj; j++)
                            r[j] = s(pa[j] + (j % 2 ? x : y))
                }
            }
            else {
                if (pa[0] == 'R') {
                    dots = [x, y][concat](pa.slice(1));
                    res.pop();
                    res = res[concat](catmullRom2bezier(dots, crz));
                    r = ['R'][concat](pa.slice(-2));
                }
                else {
                    for (var k = 0, kk = pa.length; k < kk; k++)
                        r[k] = pa[k]
                }
            }
            switch (r[0]) {
                case 'Z':
                    x = mx;
                    y = my;
                    break;
                case 'H':
                    x = r[1];
                    break;
                case 'V':
                    y = r[1];
                    break;
                case 'M':
                    mx = r[r.length - 2];
                    my = r[r.length - 1];
                default:
                    x = r[r.length - 2];
                    y = r[r.length - 1];
            }
        }
        res.toString = R._path2string;
        //pth.abs = pathClone(res);
        return res;
    });

    function cacher(f, scope, postprocessor) {
        function newf() {
            var arg = Array.prototype.slice.call(arguments, 0),
                args = arg.join('\u2400'),
                cache = newf.cache = newf.cache ||
                {}, count = newf.count = newf.count || [];
            if (cache.hasOwnProperty(args)) {
                for (var i = 0, ii = count.length; i < ii; i++)
                    if (count[i] === args) {
                        count.push(count.splice(i, 1)[0]);
                    }
                return postprocessor ? postprocessor(cache[args]) : cache[args];
            }
            count.length >= 1E3 && delete cache[count.shift()];
            count.push(args);
            cache[args] = f.apply(scope, arg);
            return postprocessor ? postprocessor(cache[args]) : cache[args];
        }

        return newf;
    }

    var l2c = function (x1, y1, x2, y2) {
            return [x1, y1, x2, y2, x2, y2];
        },
        q2c = function (x1, y1, ax, ay, x2, y2) {
            var _13 = 1 / 3,
                _23 = 2 / 3;
            return [_13 * x1 + _23 * ax, _13 * y1 + _23 * ay, _13 * x2 + _23 * ax, _13 * y2 + _23 * ay, x2, y2]
        },
        a2c = cacher(function (x1, y1, rx, ry, angle, large_arc_flag, sweep_flag, x2, y2, recursive) {
            var _120 = PI * 120 / 180,
                rad = PI / 180 * (+angle || 0),
                res = [],
                xy,
                rotate = cacher(function (x, y, rad) {
                    var X = x * Math.cos(rad) - y * Math.sin(rad),
                        Y = x * Math.sin(rad) + y * Math.cos(rad);
                    return {
                        x: X,
                        y: Y
                    };
                });
            if (!recursive) {
                xy = rotate(x1, y1, -rad);
                x1 = xy.x;
                y1 = xy.y;
                xy = rotate(x2, y2, -rad);
                x2 = xy.x;
                y2 = xy.y;
                var cos = Math.cos(PI / 180 * angle),
                    sin = Math.sin(PI / 180 * angle),
                    x = (x1 - x2) / 2,
                    y = (y1 - y2) / 2;
                var h = x * x / (rx * rx) + y * y / (ry * ry);
                if (h > 1) {
                    h = Math.sqrt(h);
                    rx = h * rx;
                    ry = h * ry;
                }
                var rx2 = rx * rx,
                    ry2 = ry * ry,
                    k = (large_arc_flag == sweep_flag ? -1 : 1) * Math.sqrt(Math.abs((rx2 * ry2 - rx2 * y * y - ry2 * x * x) / (rx2 * y * y + ry2 * x * x))),
                    cx = k * rx * y / ry + (x1 + x2) / 2,
                    cy = k * -ry * x / rx + (y1 + y2) / 2,
                    f1 = Math.asin(((y1 - cy) / ry).toFixed(9)),
                    f2 = Math.asin(((y2 - cy) / ry).toFixed(9));
                f1 = x1 < cx ? PI - f1 : f1;
                f2 = x2 < cx ? PI - f2 : f2;
                f1 < 0 && (f1 = PI * 2 + f1);
                f2 < 0 && (f2 = PI * 2 + f2);
                if (sweep_flag && f1 > f2) {
                    f1 = f1 - PI * 2;
                }
                if (!sweep_flag && f2 > f1) {
                    f2 = f2 - PI * 2;
                }
            }
            else {
                f1 = recursive[0];
                f2 = recursive[1];
                cx = recursive[2];
                cy = recursive[3];
            }
            var df = f2 - f1;
            if (Math.abs(df) > _120) {
                var f2old = f2,
                    x2old = x2,
                    y2old = y2;
                f2 = f1 + _120 * (sweep_flag && f2 > f1 ? 1 : -1);
                x2 = cx + rx * Math.cos(f2);
                y2 = cy + ry * Math.sin(f2);
                res = a2c(x2, y2, rx, ry, angle, 0, sweep_flag, x2old, y2old, [f2, f2old, cx, cy])
            }
            df = f2 - f1;
            var c1 = Math.cos(f1),
                s1 = Math.sin(f1),
                c2 = Math.cos(f2),
                s2 = Math.sin(f2),
                t = Math.tan(df / 4),
                hx = 4 / 3 * rx * t,
                hy = 4 / 3 * ry * t,
                m1 = [x1, y1],
                m2 = [x1 + hx * s1, y1 - hy * c1],
                m3 = [x2 + hx * s2, y2 - hy * c2],
                m4 = [x2, y2];
            m2[0] = 2 * m1[0] - m2[0];
            m2[1] = 2 * m1[1] - m2[1];
            if (recursive) return [m2, m3, m4].concat(res);
            else {
                res = [m2, m3, m4].concat(res).join().split(',');
                var newres = [];
                for (var i = 0, ii = res.length; i < ii; i++)
                    newres[i] = i % 2 ? rotate(res[i - 1], res[i], rad).y : rotate(res[i], res[i + 1], rad).x
                return newres
            }
        });

    var path2curve = cacher(function (path, path2) {
        var pth = !path2 && paths(path);
        if (!path2 && pth.curve) return pathClone(pth.curve);
        var p = pathToAbsolute(path),
            p2 = path2 && pathToAbsolute(path2),
            attrs = {
                x: 0,
                y: 0,
                bx: 0,
                by: 0,
                X: 0,
                Y: 0,
                qx: null,
                qy: null
            },
            attrs2 = {
                x: 0,
                y: 0,
                bx: 0,
                by: 0,
                X: 0,
                Y: 0,
                qx: null,
                qy: null
            },
            processPath = function (path, d, pcom) {
                var nx, ny;
                if (!path) {
                    return ['C', d.x, d.y, d.x, d.y, d.x, d.y];
                }
                !(path[0] in
                {
                    T: 1,
                    Q: 1
                }) && (d.qx = d.qy = null);
                switch (path[0]) {
                    case 'M':
                        d.X = path[1];
                        d.Y = path[2];
                        break;
                    case 'A':
                        path = ['C'][concat](a2c[apply](0, [d.x, d.y][concat](path.slice(1))));
                        break;
                    case 'S':
                        if (pcom == 'C' || pcom == 'S') {
                            nx = d.x * 2 - d.bx;
                            ny = d.y * 2 - d.by;
                        }
                        else {
                            nx = d.x;
                            ny = d.y;
                        }
                        path = ['C', nx, ny][concat](path.slice(1));
                        break;
                    case 'T':
                        if (pcom == 'Q' || pcom == 'T') {
                            d.qx = d.x * 2 - d.qx;
                            d.qy = d.y * 2 - d.qy;
                        }
                        else {
                            d.qx = d.x;
                            d.qy = d.y;
                        }
                        path = ['C'][concat](q2c(d.x, d.y, d.qx, d.qy, path[1], path[2]));
                        break;
                    case 'Q':
                        d.qx = path[1];
                        d.qy = path[2];
                        path = ['C'][concat](q2c(d.x, d.y, path[1], path[2], path[3], path[4]));
                        break;
                    case 'L':
                        path = ['C'][concat](l2c(d.x, d.y, path[1], path[2]));
                        break;
                    case 'H':
                        path = ['C'][concat](l2c(d.x, d.y, path[1], d.y));
                        break;
                    case 'V':
                        path = ['C'][concat](l2c(d.x, d.y, d.x, path[1]));
                        break;
                    case 'Z':
                        path = ['C'][concat](l2c(d.x, d.y, d.X, d.Y));
                        break
                }
                return path
            },
            fixArc = function (pp, i) {
                if (pp[i].length > 7) {
                    pp[i].shift();
                    var pi = pp[i];
                    while (pi.length) {
                        pcoms1[i] = 'A';
                        p2 && (pcoms2[i] = 'A');
                        pp.splice(i++, 0, ['C'][concat](pi.splice(0, 6)));
                    }
                    pp.splice(i, 1);
                    ii = mmax(p.length, p2 && p2.length || 0);
                }
            },
            fixM = function (path1, path2, a1, a2, i) {
                if (path1 && path2 && path1[i][0] == 'M' && path2[i][0] != 'M') {
                    path2.splice(i, 0, ['M', a2.x, a2.y]);
                    a1.bx = 0;
                    a1.by = 0;
                    a1.x = path1[i][1];
                    a1.y = path1[i][2];
                    ii = mmax(p.length, p2 && p2.length || 0);
                }
            },
            pcoms1 = [],
            pcoms2 = [],
            pfirst = '',
            pcom = '';
        for (var i = 0, ii = mmax(p.length, p2 && p2.length || 0); i < ii; i++) {
            p[i] && (pfirst = p[i][0]);
            if (pfirst != 'C') {
                pcoms1[i] = pfirst;
                i && (pcom = pcoms1[i - 1]);
            }
            p[i] = processPath(p[i], attrs, pcom);
            if (pcoms1[i] != 'A' && pfirst == 'C') pcoms1[i] = 'C';
            fixArc(p, i);
            if (p2) {
                p2[i] && (pfirst = p2[i][0]);
                if (pfirst != 'C') {
                    pcoms2[i] = pfirst;
                    i && (pcom = pcoms2[i - 1]);
                }
                p2[i] = processPath(p2[i], attrs2, pcom);
                if (pcoms2[i] != 'A' && pfirst == 'C') pcoms2[i] = 'C';
                fixArc(p2, i);
            }
            fixM(p, p2, attrs, attrs2, i);
            fixM(p2, p, attrs2, attrs, i);
            var seg = p[i],
                seg2 = p2 && p2[i],
                seglen = seg.length,
                seg2len = p2 && seg2.length;
            attrs.x = seg[seglen - 2];
            attrs.y = seg[seglen - 1];
            attrs.bx = toFloat(seg[seglen - 4]) || attrs.x;
            attrs.by = toFloat(seg[seglen - 3]) || attrs.y;
            attrs2.bx = p2 && (toFloat(seg2[seg2len - 4]) || attrs2.x);
            attrs2.by = p2 && (toFloat(seg2[seg2len - 3]) || attrs2.y);
            attrs2.x = p2 && seg2[seg2len - 2];
            attrs2.y = p2 && seg2[seg2len - 1];
        }
        if (!p2) pth.curve = pathClone(p);
        return p2 ? [p, p2] : p
    }, null, pathClone);

    // Export function
    window.flatten = flatten;

})();