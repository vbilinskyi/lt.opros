(function () {
    "use strict";

    var Timer = function (delay = 100, targetTime = 2000, callback=null) {
        this.init(delay, targetTime, callback);
    };

    Timer.prototype = {
        init: function (delay, targetTime, callback) {
            this._isRunning = false;
            this._interval = 0;
            this._delay = delay;
            this._time = 0;
            this._targetTime = targetTime;
            this._callback = callback;
            this._viewability = 0;
        },
        start: function () {
            if (!this._isRunning) {
                var self = this;
                this._interval = setInterval(function () {
                    self._time += self._delay;
                    self._viewability += self._delay;
                    if (self._viewability >= self._targetTime) {
                        self._targetTime = Number.MAX_VALUE;
                        if (self._callback) {
                            self._callback();
                        }
                    }
                }, this._delay);
                this._isRunning = true;
            }
        },
        pause: function () {
            if (this._isRunning) {
                this._viewability = 0;
                clearInterval(this._interval);
                this._isRunning = false;
            }
        },
        clean: function () {
            clearInterval(this._interval);
            this._time = 0;
            this._viewability = 0;
            this._isRunning = false;
        },
        time: function () {
            return this._time;
        },
        status: function () {
            return this._isRunning ? 'running' : 'paused';
        }
    };

    var TNSViewability = function (conf = {}) {
        var viewableOn = 0.5;
        var timePrecisionMs = 100;
        var timeToViewabilityMs = 2000;
        var statisticUrl = '//istat.mmi.bemobile.ua/cmviewabi';
        //var statisticUrl = 'my_stat';
        var version = 'my_version';
        var tnsBannerId = 'tnsBannerId';
        var tnsTimer = 'tnsTimer';
        var startTime = new Date();
        var spentTime = 0;
        var doNotTrack = false;

        if (conf['viewableOn']) {
            viewableOn = conf['viewableOn'];
        }
        if (conf['timePrecisionMs']) {
            timePrecisionMs = conf['timePrecisionMs'];
        }
        if (conf['statisticUrl']) {
            statisticUrl = conf['statisticUrl'];
        }
        if (conf['timeToViewabilityMs']) {
            timeToViewabilityMs = conf['timeToViewabilityMs'];
        }
        if (conf['doNotTrack']) {
            doNotTrack = true;
        }

        var banners = [];

        function init() {
            // TODO: check 'load'
            document.addEventListener('DOMContentLoaded', function () {
                startTime = new Date();
                checkPositions();
            }, false);

            document.addEventListener('resize', function () {
                checkPositions();
            }, false);

            if (window.attachEvent) {
                window.attachEvent('onbeforeunload', sendUnloadStat);
            } else if (window.addEventListener) {
                window.addEventListener('beforeunload', sendUnloadStat, false);
            } else {
                window.onbeforeunload = sendUnloadStat;
            }

            document.addEventListener('visibilitychange', function () {
                if (document['hidden']) {
                    var endTime = new Date();
                    spentTime += endTime - startTime;
                    pauseAll();
                } else {
                    startTime = new Date();
                    resumeAll();
                }
            }, false);

            // DOMMouseScroll || mousewheel
            window.addEventListener('scroll', function () {
                //TODO check do we need add delay ~100ms
                checkPositions();
            }, false);
            // sendPOST(statisticUrl, {'type': 'ready'});
        }

        function checkPositions() {
            banners.forEach(function (banner) {
                if (isViewable(banner)) {
                    banner[tnsTimer].start();
                } else {
                    banner[tnsTimer].pause();
                }
                //console.log('checkPositions:', banner[tnsTimer].status(), convertTime(banner[tnsTimer].time()));
            });
        }

        function convertTime(ms) {
            var e = ms / 1000;
            var t = parseInt(e / 3600, 10) % 24, n = parseInt(e / 60, 10) % 60, i = Math.round(e % 60);
            return (10 > t ? "0" + t : t) + ":" + (10 > n ? "0" + n : n) + ":" + (10 > i ? "0" + i : i);
        }

        function pauseAll() {
            banners.forEach(function (banner) {
                banner[tnsTimer].pause();
            });
        }

        function resumeAll() {
            checkPositions();
        }

        function addBanner(banner, bannerId=-1) {
            if (banner) {
                if (!banner[tnsTimer]) {
                    banner[tnsTimer] = new Timer(timePrecisionMs, timeToViewabilityMs, function () {
                        sendStat(banner);
                    });
                } else {
                    banner[tnsTimer].clean();
                }
                // unique only
                if (banners.indexOf(banner) == -1) {
                    banners.push(banner);
                }
                // backward compatibility
                if (typeof bannerId == 'number' && bannerId == -1) {
                    bannerId = banners.indexOf(banner);
                }
                banner[tnsBannerId] = bannerId;
                sendPOST(statisticUrl, {
                    'type': 'init',
                    'id': bannerId,
                    'status': 1,
                    'viewability_support': checkViewabilitySupport()
                });
                checkPositions();
            }
        }

        function removeBanner(banner) {
            var index = banners.indexOf(banner);
            if (index !== -1) {
                if (banner[tnsTimer]) {
                    banner[tnsTimer].pause();
                }
                banners.splice(index, 1);
            }
            return index !== -1;
        }

        function isViewable(element, offset = 0) {
            // Do nothing when there is no element selected
            if (!element) {
                return false;
            }

            // Get element info
            var boundingBox = element.getBoundingClientRect();

            // If no width or height is selected return false
            if (boundingBox.width === 0 || boundingBox.height === 0) {
                return false;
            }

            // Get viewport info
            var viewport = {
                top: offset,
                right: (window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth) - offset,
                bottom: (window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight) - offset,
                left: offset
            };

            // Check if the element is visible in the viewport
            var isVisible = !(
                boundingBox.top + (boundingBox.height * viewableOn) >= viewport.bottom ||
                boundingBox.bottom - (boundingBox.height * viewableOn) <= viewport.top
                //TODO do we need another check on left/right side ?
                // || boundingBox.left >= viewport.right ||
                // boundingBox.right <= viewport.left
            );
            return isVisible;
        }

        function getBannerId(banner) {
            var bannerId = banner[tnsBannerId];
            if (!bannerId) {
                bannerId = -1;
            }
            return bannerId;
        }

        function sendStat(banner) {
            if (banner) {
                sendPOST(statisticUrl, {'type': 'viewability', 'id': getBannerId(banner)});
            }
        }

        function getTimeOnPage() {
            var endTime = new Date();
            return spentTime + (endTime - startTime);
        }

        function sendUnloadStat() {
            var data = {};
            data['type'] = 'unload';
            data['sb_support'] = window.navigator['sendBeacon'] ? 1 : 0;
            data['viewability_support'] = checkViewabilitySupport();
            data['time_on_page'] = getTimeOnPage() / 1000;
            data['version'] = version;
            data['banners'] = [];
            banners.forEach(function (banner) {
                data['banners'].push({'id': getBannerId(banner), 'time': banner[tnsTimer].time() / 1000})
            });
            sendPOST(statisticUrl, data);
        }

        function inIframe() {
            try {
                return window.self !== window.top;
            } catch (e) {
                return true;
            }
        }

        function css(el) {
            var sheets = document.styleSheets, ret = [];
            el.matches = el.matches || el['webkitMatchesSelector'] || el['mozMatchesSelector']
                || el['msMatchesSelector'] || el['oMatchesSelector'];
            for (var i in sheets) {
                var rules = sheets[i].rules || sheets[i].cssRules;
                for (var r in rules) {
                    if (el.matches(rules[r].selectorText)) {
                        ret.push(rules[r].cssText);
                    }
                }
            }
            return ret;
        }

        function isBodyHeight100() {
            var result = false;
            css(document.body).forEach(function (str) {
                if (/height: 100%/.test(str)) {
                    result = true;
                }
            });
            return result;
        }

        function checkViewabilitySupport() {
            var support = 1;
            if (inIframe() || isBodyHeight100()) {
                support = 0;
            }
            return support;
        }

        function getCookieID() {
            var cookie = -1;
            try {
                cookie = window["IDCore"]["getId"]();
            } catch (e) {
                // console.error(e);
            }
            return cookie;
        }

        function sendPOST(url, data, convertToString = true) {
            if (!url) {
                console.log('sendPOST: url is empty');
                return false;
            }
            if (doNotTrack && window.navigator['doNotTrack']) {
                // respect rules
                return false;
            }
            data['cookie'] = getCookieID();
            if (convertToString && typeof data != 'string') {
                data = JSON.stringify(data);
            }
            console.log(data);
            if (window.navigator['sendBeacon']) {
                window.navigator['sendBeacon'](url, data);
            } else {
                var cors = window['XDomainRequest'] ? new window['XDomainRequest']() : new XMLHttpRequest();
                var isNotIE = (navigator.userAgent.match(/MSIE/) == null);
                cors.open("POST", url, true);
                if (isNotIE) {
                    cors.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
                } else {
                    cors.contentType = "text/plain";
                }
                cors.send(data);
            }
        }

        if (!conf['manualInit']) {
            init();
        }

        return {
            /*HTMLElement or cssSelector*/
            'addBanner': function (o, bannerId) {
                if (o) {
                    var banner = o;
                    if (typeof o == 'string') {
                        banner = document.querySelector(o);
                    }
                    if (banner instanceof HTMLElement) {
                        addBanner(banner, bannerId);
                    } else {
                        sendPOST(statisticUrl, {'type': 'init', 'id': bannerId, 'status': 0})
                    }
                }
                return this;
            },
            /*HTMLElement or cssSelector or bannerId*/
            'removeBanner': function (o) {
                if (o) {
                    if (o instanceof HTMLElement) {
                        return removeBanner(o);
                    } else {
                        banners.forEach(function (banner) {
                            if (o == getBannerId(banner)) {
                                return removeBanner(banner);
                            }
                        });
                        return removeBanner(document.querySelector(o));
                    }
                }
            },
            'sendUnloadStat': function () {
                sendUnloadStat();
            },
            /*HTMLElement or cssSelector*/
            'sendStat': function (o) {
                if (o) {
                    if (o instanceof HTMLElement) {
                        sendStat(o);
                    } else {
                        banners.forEach(function (banner) {
                            if (o == getBannerId(banner)) {
                                return sendStat(banner);
                            }
                        });
                    }
                }
            },
            'init': function () {
                init();
            }
        };
    };

    var _banners = window['_tnsBanners'];
    if (Array.isArray(_banners) && _banners.length > 0) {
        var tv = new TNSViewability();
        _banners.forEach(function (o) {
            if (o['banner']) {
                tv.addBanner(o['banner'], o['id']);
            }
        });
    }
})();