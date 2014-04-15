/*global define*/
/**
 * Example usage:
 * var adlift = new Adlift('http://sar.66.ru');
 * adlift.getBanner('<slotId>').writeTo('<divId>');
 */
(function () {
    'use strict';
    var fabric = function () {
        var lastRandomId = 0,
            rcallback = /\=\?/g; // Used to replace jsonp callbacks with unique cb function name

        function getRandomId() {
            lastRandomId += 1;
            return lastRandomId;
        }

        /**
         * Function: jsonp
         * Creates a jsonp request with the specified url and callback. The url
         * should contain a query parameter as x=? for the param the receiving
         * server expects to contain the callback function name. '=?' will be
         * replaced with a unique callback function that invokes the caller's cb.
         *
         * Parameters:
         * url:String - url to request, including [x]=? for the callback parameter
         * cb:Function - callback function
         * timeout:Number - how many MS to wait before invoking cb with a status
         *                  of "error" and null data (default: 1500)
         */
        function jsonp(url, cb, timeout) {
            if (!url || typeof(url) === "undefined" || typeof(cb) !== "function") {
                return false;
            }
            timeout = Math.abs(timeout) || 5000;

            var uniqueCb = "adliftCallback_" + getRandomId(),
                t = 0;

            window[uniqueCb] = function (data) {
                clearTimeout(t);
                cb(data, "success");
                window[uniqueCb] = null;
                removeJsonpScriptTag(uniqueCb);
            };

            createJsonpScriptTag(url, uniqueCb);

            t = setTimeout(function () {
                // in case it eventually comes back, this prevents it invoking a function that doesn't exist
                window[uniqueCb] = function () {
                    window[uniqueCb] = null;
                };
                cb(null, "error");
                removeJsonpScriptTag(uniqueCb);
            }, timeout);
        }

        /**
         * Function: createJsonpScriptTag
         * Creates a SCRIPT tag on the page for a jsonp request by appending the
         * provided cbName to the provided URL.
         *
         * Parameters:
         * url:String - the url to load. Ideally, includes "[callback]=?" where
         *              callback is the param the server API expects for the JSONP
         *              callback. If not provided, "callback" is used.
         * cbName:String - name of the global (window) function to use as the
         *                  JSONP callback
         */
        function createJsonpScriptTag(url, cbName) {
            if (!url || !cbName || typeof(url) !== "string" || typeof(cbName) !== "string") {
                return;
            }

            if (url.indexOf("=?") !== -1) {
                url = url.replace(rcallback, "=" + cbName);
            } else {
                url += (url.indexOf("?") === -1 ? "?jsonp=" : "&jsonp=") + cbName;
            }
            var script = document.createElement("script");
            script.id = "jsonp-" + cbName;
            script.type = "text/javascript";
            script.charset = "utf-8";
            script.src = url;
            document.getElementsByTagName("head")[0].appendChild(script);
        }

        /**
         * Function: removeJsonpScriptTag
         * Removes the SCRIPT tag for a given cbName from the document.
         *
         * Parameters:
         * cbName:String - name of the global (window) function that was used as
         *                  the JSONP callback
         */
        function removeJsonpScriptTag(cbName) {
            var script = document.getElementById("jsonp-" + cbName);
            if (!script) {
                return;
            }
            script.parentNode.removeChild(script);
            for (var prop in script) {
                if (script.hasOwnProperty(prop)) {
                    delete script[prop];
                }
            }
        }


        /**
         * @class Adlift
         */
        var Adlift = function (endpoint) {
            endpoint = endpoint || 'http://show.adlift.ru/';

            /**
             * @class Banner
             * @constructor
             */
            function Banner(slotId) {
                var self = this;

                // Deferred like stack
                this._done = [];
                this._resolved = false;

                this._writeTo = function (elementId) {
                    document.getElementById(elementId).innerHTML = this.html;
                };

                /**
                 * Execute deferred stack
                 * @param list
                 */
                this.execute = function (list) {
                    var i = list.length;

                    while (i) {
                        i -= 1;
                        list[i].func.apply(this, list[i].args);
                    }
                };

                // Send jsonp
                jsonp(endpoint + slotId + '.js', function (data, status) {
                    if (status !== 'success') {
                        throw new Error('Failed to get banner for slot: ' + slotId);
                    }

                    data = JSON.parse(data);
                    self.html = data['banner_html'];
                    self.id = data['slot_id'];

                    // Resolve deferred stack
                    self.execute(self._done);
                });
            }

            Banner.prototype = {
                writeTo: function (elementId) {
                    if (this._resolved) {
                        this._writeTo(elementId);
                        return this;
                    }

                    this._done.push({func: this._writeTo, args: arguments});
                    return this;
                }
            };

            this.getBanner = function (slotId) {
                return new Banner(slotId);
            };
        };
        return Adlift;
    };

    // AMD support
    if (typeof define !== 'undefined') {
        define(fabric);
    }

    window.Adlift = fabric;
})();

