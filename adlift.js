/*global define*/
/**
 * Example usage:
 *
 * Create client:
 * var adlift = new Adlift('http://sar.66.ru');
 *
 * Get banner and write it to DOM:
 * var banner = adlift.getBanner('<slotId>', '<code>').writeTo('<divId>');
 *
 * Or check if banner available:
 * adlift.getBanner('<slotId>', '<code>').isAvailable(function(result) {
 *     if (result) {
 *         alert('Banner is available!');
 *         this.writeTo('<divId>');
 *     }
 * });
 *
 * You can modify global code, just assigning it to:
 * adlift.globalCode
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
            this.globalCode = null;

            /**
             * @class Banner
             * @constructor
             */
            function Banner(slotId, code) {
                var self = this;

                // Deferred like stack
                var doneStack = [],
                    resolved = false;

                function writeTo(elementId) {
                    // Check if banner html contains script tag
                    var re = /<script\b[^>]*>([\s\S]*?)<\/script>/im,
                        match = self.html.match(re);

                    if (match) {
                        // Remove script from banner html
                        var html = self.html.replace(match[0], ''),
                            script = document.createElement('script'),
                            cbName = 'adlift_script_' + getRandomId();
                        // Create callback for script remove
                        window[cbName] = function () {
                            script.parentNode.removeChild(script);
                            window[cbName] = null;
                            delete window[cbName];
                        };
                        // Append callback call
                        script.innerHTML = match[1] + '; ' + cbName + '();';

                        // Add banner html & script to DOM
                        document.getElementById(elementId).innerHTML = html;
                        document.head.appendChild(script);
                    } else {
                        document.getElementById(elementId).innerHTML = html;
                    }
                }

                function isAvailable(cb) {
                    if (typeof cb !== 'function') {
                        throw new Error('No callback passed');
                    }

                    cb(self.banner_available);
                }


                /**
                 * Execute deferred stack
                 * @param list
                 */
                function execute(list) {
                    var i = list.length;

                    while (i) {
                        i -= 1;
                        list[i].func.apply(self, list[i].args);
                    }
                }

                var url = endpoint + slotId + '.js',
                    data = [];

                // Check for persotracker id
                if (typeof window.ptrk === 'string') {
                    data.push({
                        key: 'ptrk',
                        val: window.ptrk
                    });
                }

                if (typeof code === 'string') {
                    data.push({
                        key: 'code',
                        val: code
                    });
                }

                data.push({
                    key: 'url',
                    val: 'http://ekabu.ru/'
                });

                // Convert data to query string
                var i = data.length,
                    pairs = [];

                if (i) {
                    url += '?';
                }

                while (i) {
                    i -= 1;
                    pairs.push(data[i].key + '=' + data[i].val);
                }

                url += pairs.join('&');

                // Send jsonp
                jsonp(url, function (data, status) {
                    if (status !== 'success') {
                        throw new Error('Failed to get banner for slot: ' + slotId);
                    }

                    data = JSON.parse(data);

                    self.html = data['banner_html'];
                    self.id = data['slot_id'];
                    self.banner_available = data['banner_available'];

                    resolved = true;
                    // Resolve deferred stack
                    execute(doneStack);
                });

                return {
                    writeTo: function (elementId) {
                        if (resolved) {
                            writeTo(elementId);
                            return this;
                        }

                        doneStack.push({func: writeTo, args: arguments});
                        return this;
                    },
                    isAvailable: function (cb) {
                        if (resolved) {
                            isAvailable(cb);
                        } else {
                            doneStack.push({func: isAvailable, args: arguments});
                        }

                        return this;
                    }
                };
            }

            this.getBanner = function (slotId, code) {
                code = code || this.globalCode;
                return new Banner(slotId, code);
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

