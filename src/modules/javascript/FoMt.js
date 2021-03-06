(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var JscsStringChecker = require("../node-jscs/lib/string-checker");


module.exports = JscsStringChecker;

},{"../node-jscs/lib/string-checker":107}],2:[function(require,module,exports){
/**
 * Returns the lines from a file with comments removed. Will report erroneous
 * trailing tokens in multiline comments if an error reporter is provided.
 *
 * @param {JsFile} file
 * @param {Errors} [errors=null] errors
 * @returns {Array}
 */
exports.getLinesWithCommentsRemoved = function(file, errors) {
    var lines = file.getLines().concat();
    file.getComments().reverse().forEach(function(comment) {
        var startLine = comment.loc.start.line;
        var startCol = comment.loc.start.column;
        var endLine = comment.loc.end.line;
        var endCol = comment.loc.end.column;
        var i = startLine - 1;

        if (startLine === endLine) {
            lines[i] = lines[i].substring(0, startCol) + lines[i].substring(endCol);
        } else {
            lines[i] = lines[i].substring(0, startCol);
            for (var x = i + 1; x < endLine - 1; x++) {
                lines[x] = '';
            }
            lines[x] = lines[x].substring(endCol + 1);

            if (errors && lines[x] !== '') {
                errors.add(
                    'Multiline comments should not have tokens on its ending line',
                    x + 1,
                    endCol
                );
            }
        }
    });
    return lines;
};

},{}],3:[function(require,module,exports){
var assert = require('assert');
var path = require('path');
var minimatch = require('minimatch');

var BUILTIN_OPTIONS = {
    plugins: true,
    preset: true,
    excludeFiles: true,
    additionalRules: true,
    fileExtensions: true,
    maxErrors: true,
    configPath: true,
    esnext: true,
    esprima: true,
    errorFilter: true
};

/**
 * JSCS Configuration.
 * Browser/Rhino-compatible.
 *
 * @name Configuration
 */
function Configuration() {
    this._presets = {};
    this._rules = {};
    this._configuredRules = [];
    this._configuredFormattingRules = [];
    this._unsupportedRuleNames = [];
    this._fileExtensions = ['.js'];
    this._excludedFileMasks = [];
    this._excludedFileMatchers = [];
    this._ruleSettings = {};
    this._maxErrors = null;
    this._basePath = '.';
    this._overrides = {};
    this._presetName = null;
    this._esnextEnabled = false;
    this._esprima = null;
    this._errorFilter = null;
}

/**
 * Load settings from a configuration.
 *
 * @param {Object} config
 */
Configuration.prototype.load = function(config) {
    this._throwNonCamelCaseErrorIfNeeded(config);

    var overrides = this._overrides;
    var currentConfig = {};

    copyConfiguration(config, currentConfig);
    copyConfiguration(overrides, currentConfig);

    var ruleSettings = this._processConfig(currentConfig);
    var processedSettings = {};

    Object.keys(ruleSettings).forEach(function(optionName) {
        var rule = this._rules[optionName];
        if (rule) {
            var optionValue = ruleSettings[optionName];
            if (optionValue !== null) {
                rule.configure(ruleSettings[optionName]);
                this._configuredRules.push(rule);
                if (rule.format) {
                    this._configuredFormattingRules.push(rule);
                }
                processedSettings[optionName] = ruleSettings[optionName];
            }
        } else {
            this._unsupportedRuleNames.push(optionName);
        }
    }, this);

    this._ruleSettings = processedSettings;
};

/**
 * Returns resulting configuration after preset is applied and options are processed.
 *
 * @return {Object}
 */
Configuration.prototype.getProcessedConfig = function() {
    var result = {};
    Object.keys(this._ruleSettings).forEach(function(key) {
        result[key] = this._ruleSettings[key];
    }, this);
    result.excludeFiles = this._excludedFileMasks;
    result.fileExtensions = this._fileExtensions;
    result.maxErrors = this._maxErrors;
    result.preset = this._presetName;
    result.esnext = this._esnextEnabled;
    result.esprima = this._esprima;
    result.errorFilter = this._errorFilter;
    return result;
};
/**
 * Returns list of configured formatting rules.
 *
 * @returns {Rule[]}
 */
Configuration.prototype.getConfiguredFormattingRules = function() {
    return this._configuredFormattingRules;
};

/**
 * Returns list of configured rules.
 *
 * @returns {Rule[]}
 */
Configuration.prototype.getConfiguredRules = function() {
    return this._configuredRules;
};

/**
 * Returns the list of unsupported rule names.
 *
 * @return {String[]}
 */
Configuration.prototype.getUnsupportedRuleNames = function() {
    return this._unsupportedRuleNames;
};

/**
 * Returns excluded file mask list.
 *
 * @returns {String[]}
 */
Configuration.prototype.getExcludedFileMasks = function() {
    return this._excludedFileMasks;
};

/**
 * Returns `true` if specified file path is excluded.
 *
 * @param {String} filePath
 * @returns {Boolean}
 */
Configuration.prototype.isFileExcluded = function(filePath) {
    filePath = path.resolve(filePath);
    return this._excludedFileMatchers.some(function(matcher) {
        return matcher.match(filePath);
    });
};

/**
 * Returns file extension list.
 *
 * @returns {String[]}
 */
Configuration.prototype.getFileExtensions = function() {
    return this._fileExtensions;
};

/**
 * Returns maximal error count.
 *
 * @returns {Number|undefined}
 */
Configuration.prototype.getMaxErrors = function() {
    return this._maxErrors;
};

/**
 * Returns `true` if `esnext` option is enabled.
 *
 * @returns {Boolean}
 */
Configuration.prototype.isESNextEnabled = function() {
    return this._esnextEnabled;
};

/**
 * Returns `true` if `esprima` option is not null.
 *
 * @returns {Boolean}
 */
Configuration.prototype.hasCustomEsprima = function() {
    return !!this._esprima;
};

/**
 * Returns the custom esprima parser.
 *
 * @returns {Object|null}
 */
Configuration.prototype.getCustomEsprima = function() {
    return this._esprima;
};

/**
 * Returns the loaded error filter.
 *
 * @returns {Function|null}
 */
Configuration.prototype.getErrorFilter = function() {
    return this._errorFilter;
};

/**
 * Returns base path.
 *
 * @returns {String}
 */
Configuration.prototype.getBasePath = function() {
    return this._basePath;
};

/**
 * Overrides specified settings.
 *
 * @param {String} overrides
 */
Configuration.prototype.override = function(overrides) {
    Object.keys(overrides).forEach(function(key) {
        this._overrides[key] = overrides[key];
    }, this);
};

/**
 * Processes configuration and returns config options.
 *
 * @param {Object} config
 * @returns {Object}
 */
Configuration.prototype._processConfig = function(config) {
    var ruleSettings = {};

    // Base path
    if (config.configPath) {
        assert(
            typeof config.configPath === 'string',
            '`configPath` option requires string value'
        );
        this._basePath = path.dirname(config.configPath);
    }

    // Load plugins
    if (config.plugins) {
        assert(Array.isArray(config.plugins), '`plugins` option requires array value');
        config.plugins.forEach(this._loadPlugin, this);
    }

    // Apply presets
    var presetName = config.preset;
    if (presetName) {
        this._presetName = presetName;
        assert(typeof presetName === 'string', '`preset` option requires string value');
        var presetData = this._presets[presetName];
        assert(Boolean(presetData), 'Preset "' + presetName + '" does not exist');
        var presetResult = this._processConfig(presetData);
        Object.keys(presetResult).forEach(function(key) {
            ruleSettings[key] = presetResult[key];
        });
    }

    // File extensions
    if (config.fileExtensions) {
        assert(
            typeof config.fileExtensions === 'string' || Array.isArray(config.fileExtensions),
            '`fileExtensions` option requires string or array value'
        );
        this._fileExtensions = [].concat(config.fileExtensions).map(function(ext) {
            return ext.toLowerCase();
        });
    }

    // File excludes
    if (config.excludeFiles) {
        assert(Array.isArray(config.excludeFiles), '`excludeFiles` option requires array value');
        this._excludedFileMasks = config.excludeFiles;
        this._excludedFileMatchers = this._excludedFileMasks.map(function(fileMask) {
            return new minimatch.Minimatch(path.resolve(this._basePath, fileMask), {
                dot: true
            });
        }, this);
    }

    // Additional rules
    if (config.additionalRules) {
        assert(Array.isArray(config.additionalRules), '`additionalRules` option requires array value');
        config.additionalRules.forEach(this._loadAdditionalRule, this);
    }

    if (config.hasOwnProperty('maxErrors')) {
        var maxErrors = config.maxErrors === null ? null : Number(config.maxErrors);
        assert(
            maxErrors > 0 || isNaN(maxErrors) || maxErrors === null,
            '`maxErrors` option requires number or null value'
        );
        this._maxErrors = maxErrors;
    }

    if (config.hasOwnProperty('esnext')) {
        assert(
            typeof config.esnext === 'boolean' || config.esnext === null,
            '`esnext` option requires boolean or null value'
        );
        this._esnextEnabled = Boolean(config.esnext);
    }

    if (config.hasOwnProperty('esprima')) {
        this._loadEsprima(config.esprima);
    }

    if (config.hasOwnProperty('errorFilter')) {
        this._loadErrorFilter(config.errorFilter);
    }

    // Apply config options
    Object.keys(config).forEach(function(key) {
        if (!BUILTIN_OPTIONS[key]) {
            ruleSettings[key] = config[key];
        }
    });

    return ruleSettings;
};

/**
 * Loads plugin data.
 *
 * @param {function(Configuration)} plugin
 * @protected
 */
Configuration.prototype._loadPlugin = function(plugin) {
    assert(typeof plugin === 'function', '`plugin` should be a function');
    plugin(this);
};

/**
 * Loads an error filter.
 *
 * @param {Function|null} errorFilter
 * @protected
 */
Configuration.prototype._loadErrorFilter = function(errorFilter) {
    assert(
        typeof errorFilter === 'function' ||
        errorFilter === null,
        '`errorFilter` option requires a function or null value'
    );
    this._errorFilter = errorFilter;
};

/**
 * Loads a custom esprima.
 *
 * @param {Object|null} esprima
 * @protected
 */
Configuration.prototype._loadEsprima = function(esprima) {
    assert(
        (esprima && typeof esprima.parse === 'function') ||
        esprima === null,
        '`esprima` option requires a null value or an object with a parse function'
    );
    this._esprima = esprima;
};

/**
 * Includes plugin in the configuration environment.
 *
 * @param {function(Configuration)|*} plugin
 */
Configuration.prototype.usePlugin = function(plugin) {
    this._loadPlugin(plugin);
};

/**
 * Loads additional rule.
 *
 * @param {Rule} additionalRule
 * @protected
 */
Configuration.prototype._loadAdditionalRule = function(additionalRule) {
    assert(typeof additionalRule === 'object', '`additionalRule` should be an object');
    this.registerRule(additionalRule);
};

/**
 * Throws error for non camel-case options.
 *
 * @param {Object} ruleSettings
 * @protected
 */
Configuration.prototype._throwNonCamelCaseErrorIfNeeded = function(ruleSettings) {
    function symbolToUpperCase(s, symbol) {
        return symbol.toUpperCase();
    }
    function fixSettings(originalSettings) {
        var result = {};
        Object.keys(originalSettings).forEach(function(key) {
            var camelCaseName = key.replace(/_([a-zA-Z])/g, symbolToUpperCase);
            var value = originalSettings[key];
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                value = fixSettings(value);
            }
            result[camelCaseName] = value;
        });
        return result;
    }

    Object.keys(ruleSettings).forEach(function(key) {
        if (key.indexOf('_') !== -1) {
            throw new Error(
                'JSCS now accepts configuration options in camel case. Sorry for inconvenience. ' +
                'On the bright side, we tried to convert your jscs config to camel case.\n' +
                '----------------------------------------\n' +
                JSON.stringify(fixSettings(ruleSettings), null, 4) +
                '\n----------------------------------------\n'
            );
        }
    });
};

/**
 * Adds rule to the collection.
 *
 * @param {Rule|function} rule Rule instance or rule class.
 */
Configuration.prototype.registerRule = function(rule) {
    if (typeof rule === 'function') {
        var RuleClass = rule;
        rule = new RuleClass();
    }

    var optionName = rule.getOptionName();
    assert(!this._rules.hasOwnProperty(optionName), 'Rule "' + optionName + '" is already registered');
    this._rules[optionName] = rule;
};

/**
 * Returns list of registered rules.
 *
 * @returns {Rule[]}
 */
Configuration.prototype.getRegisteredRules = function() {
    var rules = this._rules;
    return Object.keys(rules).map(function(ruleOptionName) {
        return rules[ruleOptionName];
    });
};

/**
 * Adds preset to the collection.
 *
 * @param {String} presetName
 * @param {Object} presetConfig
 */
Configuration.prototype.registerPreset = function(presetName, presetConfig) {
    this._presets[presetName] = presetConfig;
};

/**
 * Returns registered presets object (key - preset name, value - preset content).
 *
 * @returns {Object}
 */
Configuration.prototype.getRegisteredPresets = function() {
    return this._presets;
};

/**
 * Returns `true` if preset with specified name exists.
 *
 * @param {String} presetName
 * @return {Boolean}
 */
Configuration.prototype.hasPreset = function(presetName) {
    return this._presets.hasOwnProperty(presetName);
};

/**
 * Registers built-in Code Style cheking rules.
 */
Configuration.prototype.registerDefaultRules = function() {

    /*
        Important!
        These rules are linked explicitly to keep browser-version supported.
    */

    this.registerRule(require('../rules/require-curly-braces'));
    this.registerRule(require('../rules/require-multiple-var-decl'));
    this.registerRule(require('../rules/disallow-multiple-var-decl'));
    this.registerRule(require('../rules/disallow-empty-blocks'));
    this.registerRule(require('../rules/require-space-after-keywords'));
    this.registerRule(require('../rules/require-space-before-keywords'));
    this.registerRule(require('../rules/disallow-space-after-keywords'));
    this.registerRule(require('../rules/disallow-space-before-keywords'));
    this.registerRule(require('../rules/require-parentheses-around-iife'));

    /* deprecated rules */
    this.registerRule(require('../rules/require-left-sticked-operators'));
    this.registerRule(require('../rules/disallow-left-sticked-operators'));
    this.registerRule(require('../rules/require-right-sticked-operators'));
    this.registerRule(require('../rules/disallow-right-sticked-operators'));
    this.registerRule(require('../rules/validate-jsdoc'));
    /* deprecated rules (end) */

    this.registerRule(require('../rules/require-operator-before-line-break'));
    this.registerRule(require('../rules/disallow-operator-before-line-break'));
    this.registerRule(require('../rules/disallow-implicit-type-conversion'));
    this.registerRule(require('../rules/require-camelcase-or-uppercase-identifiers'));
    this.registerRule(require('../rules/disallow-keywords'));
    this.registerRule(require('../rules/disallow-multiple-line-breaks'));
    this.registerRule(require('../rules/disallow-multiple-line-strings'));
    this.registerRule(require('../rules/validate-line-breaks'));
    this.registerRule(require('../rules/validate-quote-marks'));
    this.registerRule(require('../rules/validate-indentation'));
    this.registerRule(require('../rules/disallow-trailing-whitespace'));
    this.registerRule(require('../rules/disallow-mixed-spaces-and-tabs'));
    this.registerRule(require('../rules/require-keywords-on-new-line'));
    this.registerRule(require('../rules/disallow-keywords-on-new-line'));
    this.registerRule(require('../rules/require-line-feed-at-file-end'));
    this.registerRule(require('../rules/maximum-line-length'));
    this.registerRule(require('../rules/require-yoda-conditions'));
    this.registerRule(require('../rules/disallow-yoda-conditions'));
    this.registerRule(require('../rules/require-spaces-inside-object-brackets'));
    this.registerRule(require('../rules/require-spaces-inside-array-brackets'));
    this.registerRule(require('../rules/require-spaces-inside-parentheses'));
    this.registerRule(require('../rules/disallow-spaces-inside-object-brackets'));
    this.registerRule(require('../rules/disallow-spaces-inside-array-brackets'));
    this.registerRule(require('../rules/disallow-spaces-inside-parentheses'));
    this.registerRule(require('../rules/require-blocks-on-newline'));
    this.registerRule(require('../rules/require-space-after-object-keys'));
    this.registerRule(require('../rules/require-space-before-object-values'));
    this.registerRule(require('../rules/disallow-space-after-object-keys'));
    this.registerRule(require('../rules/disallow-space-before-object-values'));
    this.registerRule(require('../rules/disallow-quoted-keys-in-objects'));
    this.registerRule(require('../rules/disallow-dangling-underscores'));
    this.registerRule(require('../rules/require-aligned-object-values'));

    this.registerRule(require('../rules/disallow-padding-newlines-in-blocks'));
    this.registerRule(require('../rules/require-padding-newlines-in-blocks'));
    this.registerRule(require('../rules/require-padding-newlines-in-objects'));
    this.registerRule(require('../rules/disallow-padding-newlines-in-objects'));
    this.registerRule(require('../rules/require-newline-before-block-statements'));
    this.registerRule(require('../rules/disallow-newline-before-block-statements'));

    this.registerRule(require('../rules/require-padding-newlines-before-keywords'));
    this.registerRule(require('../rules/disallow-padding-newlines-before-keywords'));

    this.registerRule(require('../rules/disallow-trailing-comma'));
    this.registerRule(require('../rules/require-trailing-comma'));

    this.registerRule(require('../rules/disallow-comma-before-line-break'));
    this.registerRule(require('../rules/require-comma-before-line-break'));

    this.registerRule(require('../rules/disallow-space-before-block-statements.js'));
    this.registerRule(require('../rules/require-space-before-block-statements.js'));

    this.registerRule(require('../rules/disallow-space-before-postfix-unary-operators.js'));
    this.registerRule(require('../rules/require-space-before-postfix-unary-operators.js'));

    this.registerRule(require('../rules/disallow-space-after-prefix-unary-operators.js'));
    this.registerRule(require('../rules/require-space-after-prefix-unary-operators.js'));

    this.registerRule(require('../rules/disallow-space-before-binary-operators'));
    this.registerRule(require('../rules/require-space-before-binary-operators'));

    this.registerRule(require('../rules/disallow-space-after-binary-operators'));
    this.registerRule(require('../rules/require-space-after-binary-operators'));

    this.registerRule(require('../rules/require-spaces-in-conditional-expression'));
    this.registerRule(require('../rules/disallow-spaces-in-conditional-expression'));

    this.registerRule(require('../rules/require-spaces-in-function'));
    this.registerRule(require('../rules/disallow-spaces-in-function'));
    this.registerRule(require('../rules/require-spaces-in-function-expression'));
    this.registerRule(require('../rules/disallow-spaces-in-function-expression'));
    this.registerRule(require('../rules/require-spaces-in-anonymous-function-expression'));
    this.registerRule(require('../rules/disallow-spaces-in-anonymous-function-expression'));
    this.registerRule(require('../rules/require-spaces-in-named-function-expression'));
    this.registerRule(require('../rules/disallow-spaces-in-named-function-expression'));
    this.registerRule(require('../rules/require-spaces-in-function-declaration'));
    this.registerRule(require('../rules/disallow-spaces-in-function-declaration'));

    this.registerRule(require('../rules/require-spaces-in-call-expression'));
    this.registerRule(require('../rules/disallow-spaces-in-call-expression'));

    this.registerRule(require('../rules/validate-parameter-separator'));
    this.registerRule(require('../rules/require-space-between-arguments'));
    this.registerRule(require('../rules/disallow-space-between-arguments'));

    this.registerRule(require('../rules/require-capitalized-constructors'));

    this.registerRule(require('../rules/safe-context-keyword'));

    this.registerRule(require('../rules/require-dot-notation'));

    this.registerRule(require('../rules/require-space-after-line-comment'));
    this.registerRule(require('../rules/disallow-space-after-line-comment'));

    this.registerRule(require('../rules/require-anonymous-functions'));
    this.registerRule(require('../rules/disallow-anonymous-functions'));

    this.registerRule(require('../rules/require-function-declarations'));
    this.registerRule(require('../rules/disallow-function-declarations'));

    this.registerRule(require('../rules/require-capitalized-comments'));
    this.registerRule(require('../rules/disallow-capitalized-comments'));

    this.registerRule(require('../rules/require-line-break-after-variable-assignment'));

    this.registerRule(require('../rules/disallow-semicolons'));

    this.registerRule(require('../rules/require-spaces-in-for-statement'));
    this.registerRule(require('../rules/require-spaces-in-computed-memberExpression'));
    this.registerRule(require('../rules/validate-object-indentation'));
};

/**
 * Registers built-in Code Style cheking presets.
 */
Configuration.prototype.registerDefaultPresets = function() {
    // https://github.com/airbnb/javascript
    this.registerPreset('airbnb', require('../../presets/airbnb.json'));

    // http://javascript.crockford.com/code.html
    this.registerPreset('crockford', require('../../presets/crockford.json'));

    // https://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml
    this.registerPreset('google', require('../../presets/google.json'));

    // http://gruntjs.com/contributing#syntax
    this.registerPreset('grunt', require('../../presets/grunt.json'));

    // https://contribute.jquery.org/style-guide/js/
    this.registerPreset('jquery', require('../../presets/jquery.json'));

    // https://github.com/mrdoob/three.js/wiki/Mr.doob's-Code-Style%E2%84%A2
    this.registerPreset('mdcs', require('../../presets/mdcs.json'));

    // https://www.mediawiki.org/wiki/Manual:Coding_conventions/JavaScript
    this.registerPreset('wikimedia', require('../../presets/wikimedia.json'));

    // https://github.com/yandex/codestyle/blob/master/js.md
    this.registerPreset('yandex', require('../../presets/yandex.json'));
};

module.exports = Configuration;

function copyConfiguration(source, dest) {
    Object.keys(source).forEach(function(key) {
        dest[key] = source[key];
    });
    if (source.configPath) {
        dest.configPath = source.configPath;
    }
}

},{"../../presets/airbnb.json":135,"../../presets/crockford.json":136,"../../presets/google.json":137,"../../presets/grunt.json":138,"../../presets/jquery.json":139,"../../presets/mdcs.json":140,"../../presets/wikimedia.json":141,"../../presets/yandex.json":142,"../rules/disallow-anonymous-functions":6,"../rules/disallow-capitalized-comments":7,"../rules/disallow-comma-before-line-break":8,"../rules/disallow-dangling-underscores":9,"../rules/disallow-empty-blocks":10,"../rules/disallow-function-declarations":11,"../rules/disallow-implicit-type-conversion":12,"../rules/disallow-keywords":14,"../rules/disallow-keywords-on-new-line":13,"../rules/disallow-left-sticked-operators":15,"../rules/disallow-mixed-spaces-and-tabs":16,"../rules/disallow-multiple-line-breaks":17,"../rules/disallow-multiple-line-strings":18,"../rules/disallow-multiple-var-decl":19,"../rules/disallow-newline-before-block-statements":20,"../rules/disallow-operator-before-line-break":21,"../rules/disallow-padding-newlines-before-keywords":22,"../rules/disallow-padding-newlines-in-blocks":23,"../rules/disallow-padding-newlines-in-objects":24,"../rules/disallow-quoted-keys-in-objects":25,"../rules/disallow-right-sticked-operators":26,"../rules/disallow-semicolons":27,"../rules/disallow-space-after-binary-operators":28,"../rules/disallow-space-after-keywords":29,"../rules/disallow-space-after-line-comment":30,"../rules/disallow-space-after-object-keys":31,"../rules/disallow-space-after-prefix-unary-operators.js":32,"../rules/disallow-space-before-binary-operators":33,"../rules/disallow-space-before-block-statements.js":34,"../rules/disallow-space-before-keywords":35,"../rules/disallow-space-before-object-values":36,"../rules/disallow-space-before-postfix-unary-operators.js":37,"../rules/disallow-space-between-arguments":38,"../rules/disallow-spaces-in-anonymous-function-expression":39,"../rules/disallow-spaces-in-call-expression":40,"../rules/disallow-spaces-in-conditional-expression":41,"../rules/disallow-spaces-in-function":44,"../rules/disallow-spaces-in-function-declaration":42,"../rules/disallow-spaces-in-function-expression":43,"../rules/disallow-spaces-in-named-function-expression":45,"../rules/disallow-spaces-inside-array-brackets":46,"../rules/disallow-spaces-inside-object-brackets":47,"../rules/disallow-spaces-inside-parentheses":48,"../rules/disallow-trailing-comma":49,"../rules/disallow-trailing-whitespace":50,"../rules/disallow-yoda-conditions":51,"../rules/maximum-line-length":52,"../rules/require-aligned-object-values":53,"../rules/require-anonymous-functions":54,"../rules/require-blocks-on-newline":55,"../rules/require-camelcase-or-uppercase-identifiers":56,"../rules/require-capitalized-comments":57,"../rules/require-capitalized-constructors":58,"../rules/require-comma-before-line-break":59,"../rules/require-curly-braces":60,"../rules/require-dot-notation":61,"../rules/require-function-declarations":62,"../rules/require-keywords-on-new-line":63,"../rules/require-left-sticked-operators":64,"../rules/require-line-break-after-variable-assignment":65,"../rules/require-line-feed-at-file-end":66,"../rules/require-multiple-var-decl":67,"../rules/require-newline-before-block-statements":68,"../rules/require-operator-before-line-break":69,"../rules/require-padding-newlines-before-keywords":70,"../rules/require-padding-newlines-in-blocks":71,"../rules/require-padding-newlines-in-objects":72,"../rules/require-parentheses-around-iife":73,"../rules/require-right-sticked-operators":74,"../rules/require-space-after-binary-operators":75,"../rules/require-space-after-keywords":76,"../rules/require-space-after-line-comment":77,"../rules/require-space-after-object-keys":78,"../rules/require-space-after-prefix-unary-operators.js":79,"../rules/require-space-before-binary-operators":80,"../rules/require-space-before-block-statements.js":81,"../rules/require-space-before-keywords":82,"../rules/require-space-before-object-values":83,"../rules/require-space-before-postfix-unary-operators.js":84,"../rules/require-space-between-arguments":85,"../rules/require-spaces-in-anonymous-function-expression":86,"../rules/require-spaces-in-call-expression":87,"../rules/require-spaces-in-computed-memberExpression":88,"../rules/require-spaces-in-conditional-expression":89,"../rules/require-spaces-in-for-statement":90,"../rules/require-spaces-in-function":93,"../rules/require-spaces-in-function-declaration":91,"../rules/require-spaces-in-function-expression":92,"../rules/require-spaces-in-named-function-expression":94,"../rules/require-spaces-inside-array-brackets":95,"../rules/require-spaces-inside-object-brackets":96,"../rules/require-spaces-inside-parentheses":97,"../rules/require-trailing-comma":98,"../rules/require-yoda-conditions":99,"../rules/safe-context-keyword":100,"../rules/validate-indentation":101,"../rules/validate-jsdoc":102,"../rules/validate-line-breaks":103,"../rules/validate-object-indentation":104,"../rules/validate-parameter-separator":105,"../rules/validate-quote-marks":106,"assert":143,"minimatch":126,"path":146}],4:[function(require,module,exports){
var assert = require('assert');
var colors = require('colors');
var TokenAssert = require('./token-assert');

/**
 * Set of errors for specified file.
 *
 * @name Errors
 * @param {JsFile} file
 * @param {Boolean} verbose
 */
var Errors = function(file, verbose) {
    this._errorList = [];
    this._file = file;
    this._currentRule = '';
    this._verbose = verbose || false;

    /**
     * @type {TokenAssert}
     * @public
     */
    this.assert = new TokenAssert(file);
    this.assert.on('error', this._addError.bind(this));
};

Errors.prototype = {
    /**
     * Adds style error to the list
     *
     * @param {String} message
     * @param {Number|Object} line
     * @param {Number} [column] optional if line is an object
     */
    add: function(message, line, column) {
        if (typeof line === 'object') {
            column = line.column;
            line = line.line;
        }

        // line and column numbers should be explicit
        assert(typeof line === 'number' && line > 0,
            'Unable to add an error, `line` should be a number greater than 0 but ' + line + ' given');
        assert(typeof column === 'number' && column >= 0,
            'Unable to add an error, `column` should be a positive number but ' + column + ' given');

        this._addError({
            message: message,
            line: line,
            column: column
        });
    },

    /**
     * Adds error to error list.
     *
     * @param {Object} errorInfo
     * @private
     */
    _addError: function(errorInfo) {
        if (!this._file.isEnabledRule(this._currentRule, errorInfo.line)) {
            return;
        }

        this._errorList.push({
            filename: this._file.getFilename(),
            rule: this._currentRule,
            message: this._verbose ? this._currentRule + ': ' + errorInfo.message : errorInfo.message,
            line: errorInfo.line,
            column: errorInfo.column
        });
    },

    /**
     * Returns style error list.
     *
     * @returns {Object[]}
     */
    getErrorList: function() {
        return this._errorList;
    },

    /**
     * Returns filename of file this error list is for.
     *
     * @returns {String}
     */
    getFilename: function() {
        return this._file.getFilename();
    },

    /**
     * Returns true if no errors are added.
     *
     * @returns {Boolean}
     */
    isEmpty: function() {
        return this._errorList.length === 0;
    },

    /**
     * Returns amount of errors added by the rules.
     *
     * @returns {Number}
     */
    getErrorCount: function() {
        return this._errorList.length;
    },

    /**
     * Strips error list to the specified length.
     *
     * @param {Number} length
     */
    stripErrorList: function(length) {
        this._errorList.splice(length);
    },

    /**
     * Filters out errors based on the supplied filter function
     *
     * @param {Function} filter
     */
    filter: function(filter) {
        this._errorList = this._errorList.filter(filter);
    },

    /**
     * Formats error for further output.
     *
     * @param {Object} error
     * @param {Boolean} colorize
     * @returns {String}
     */
    explainError: function(error, colorize) {
        var lineNumber = error.line - 1;
        var lines = this._file.getLines();
        var result = [
            renderLine(lineNumber, lines[lineNumber], colorize),
            renderPointer(error.column, colorize)
        ];
        var i = lineNumber - 1;
        var linesAround = 2;
        while (i >= 0 && i >= (lineNumber - linesAround)) {
            result.unshift(renderLine(i, lines[i], colorize));
            i--;
        }
        i = lineNumber + 1;
        while (i < lines.length && i <= (lineNumber + linesAround)) {
            result.push(renderLine(i, lines[i], colorize));
            i++;
        }
        result.unshift(formatErrorMessage(error.message, this.getFilename(), colorize));
        return result.join('\n');
    },

   /**
     * Sets the current rule so that errors are aware
     * of which rule triggered them.
     *
     * @param {String} rule
     */
    setCurrentRule: function(rule) {
        this._currentRule = rule;
    }

};

/**
 * Formats error message header.
 *
 * @param {String} message
 * @param {String} filename
 * @param {Boolean} colorize
 * @returns {String}
 */
function formatErrorMessage(message, filename, colorize) {
    return (colorize ? colors.bold(message) : message) +
        ' at ' +
        (colorize ? colors.green(filename) : filename) + ' :';
}

/**
 * Simple util for prepending spaces to the string until it fits specified size.
 *
 * @param {String} s
 * @param {Number} len
 * @returns {String}
 */
function prependSpaces(s, len) {
    while (s.length < len) {
        s = ' ' + s;
    }
    return s;
}

/**
 * Renders single line of code in style error formatted output.
 *
 * @param {Number} n line number
 * @param {String} line
 * @param {Boolean} colorize
 * @returns {String}
 */
function renderLine(n, line, colorize) {
    // Convert tabs to spaces, so errors in code lines with tabs as indention symbol
    // could be correctly rendered, plus it will provide less verbose output
    line = line.replace(/\t/g, ' ');

    // "n + 1" to print lines in human way (counted from 1)
    var lineNumber = prependSpaces((n + 1).toString(), 5) + ' |';
    return ' ' + (colorize ? colors.grey(lineNumber) : lineNumber) + line;
}

/**
 * Renders pointer:
 * ---------------^
 *
 * @param {Number} column
 * @param {Boolean} colorize
 * @returns {String}
 */
function renderPointer(column, colorize) {
    var res = (new Array(column + 9)).join('-') + '^';
    return colorize ? colors.grey(res) : res;
}

module.exports = Errors;

},{"./token-assert":108,"assert":143,"colors":116}],5:[function(require,module,exports){
var treeIterator = require('./tree-iterator');

/**
 * Operator list which are represented as keywords in token list.
 */
var KEYWORD_OPERATORS = {
    'instanceof': true,
    'in': true
};

/**
 * File representation for JSCS.
 *
 * @name JsFile
 */
var JsFile = function(filename, source, tree) {
    this._filename = filename;
    this._source = source;
    this._changes = [];
    this._tree = tree || {tokens: []};
    this._lines = source.split(/\r\n|\r|\n/);
    this._tokenRangeStartIndex = null;
    this._tokenRangeEndIndex = null;
    var index = this._index = {};
    var _this = this;

    this._buildTokenIndex();

    this.iterate(function(node, parentNode, parentCollection) {
        var type = node.type;

        node.parentNode = parentNode;
        node.parentCollection = parentCollection;
        (index[type] || (index[type] = [])).push(node);

        // Temporary fix (i hope) for esprima tokenizer
        // (https://code.google.com/p/esprima/issues/detail?id=481)
        // Fixes #83, #180
        switch (type) {
            case 'Property':
                convertKeywordToIdentifierIfRequired(node.key);
                break;
            case 'MemberExpression':
                convertKeywordToIdentifierIfRequired(node.property);
                break;
        }
    });

    this._buildDisabledRuleIndex();

    // Part of temporary esprima fix.
    function convertKeywordToIdentifierIfRequired(node) {
        var tokenPos = _this.getTokenPosByRangeStart(node.range[0]);
        var token = _this._tree.tokens[tokenPos];
        if (token.type === 'Keyword') {
            token.type = 'Identifier';
        }
    }
};

JsFile.prototype = {
    /**
     * Builds an index of disabled rules by starting line for error suppression.
     */
    _buildDisabledRuleIndex: function() {
        this._disabledRuleIndex = [];

        var comments = this.getComments() || [];
        var commentRe = /(jscs\s*:\s*(en|dis)able)(.*)/;

        comments.forEach(function(comment) {
            var enabled;
            var parsed = commentRe.exec(comment.value.trim());

            if (!parsed || parsed.index !== 0) {
                return;
            }

            enabled = parsed[2] === 'en';
            this._addToDisabledRuleIndex(enabled, parsed[3], comment.loc.start.line);
        }, this);
    },

    /**
     * Returns whether a specific rule is disabled on the given line.
     *
     * @param {String} ruleName the rule name being tested
     * @param {Number} line the line number being tested
     * @returns {Boolean} true if the rule is enabled
     */
    isEnabledRule: function(ruleName, line) {
        var enabled = true;
        this._disabledRuleIndex.some(function(region) {
            // once the comment we're inspecting occurs after the location of the error,
            // no longer check for whether the state is enabled or disable
            if (region.line > line) {
                return true;
            }

            if (region.rule === ruleName || region.rule === '*') {
                enabled = region.enabled;
            }
        }, this);

        return enabled;
    },

    /**
     * Adds rules to the disabled index given a string containing rules (or '' for all).
     *
     * @param {Boolean} enabled whether the rule is disabled or enabled on this line
     * @param {String} rulesStr the string containing specific rules to en/disable
     * @param {Number} line the line the comment appears on
     */
    _addToDisabledRuleIndex: function(enabled, rulesStr, line) {
        rulesStr = rulesStr || '*';

        rulesStr.split(',').forEach(function(rule) {
            rule = rule.trim();

            if (!rule) {
                return;
            }

            this._disabledRuleIndex.push({
                rule: rule,
                enabled: enabled,
                line: line
            });
        }, this);
    },

    /**
     * Builds token index by starting pos for futher navigation.
     */
    _buildTokenIndex: function() {
        var tokens = this._tree.tokens;
        var tokenRangeStartIndex = {};
        var tokenRangeEndIndex = {};
        for (var i = 0, l = tokens.length; i < l; i++) {
            tokenRangeStartIndex[tokens[i].range[0]] = i;
            tokenRangeEndIndex[tokens[i].range[1]] = i;
            tokens[i]._tokenIndex = i;
        }
        this._tokenRangeStartIndex = tokenRangeStartIndex;
        this._tokenRangeEndIndex = tokenRangeEndIndex;
    },
    /**
     * Returns token position using range start from the index.
     *
     * @returns {Object}
     */
    getTokenPosByRangeStart: function(start) {
        return this._tokenRangeStartIndex[start];
    },
    /**
     * Returns token using range start from the index.
     *
     * @returns {Object|undefined}
     */
    getTokenByRangeStart: function(start) {
        var tokenIndex = this._tokenRangeStartIndex[start];
        return tokenIndex === undefined ? undefined : this._tree.tokens[tokenIndex];
    },
    /**
     * Returns token using range end from the index.
     *
     * @returns {Object|undefined}
     */
    getTokenByRangeEnd: function(end) {
        var tokenIndex = this._tokenRangeEndIndex[end];
        return tokenIndex === undefined ? undefined : this._tree.tokens[tokenIndex];
    },
    /**
     * Returns the first token for the node from the AST.
     *
     * @param {Object} node
     * @returns {Object}
     */
    getFirstNodeToken: function(node) {
        return this.getTokenByRangeStart(node.range[0]);
    },
    /**
     * Returns the last token for the node from the AST.
     *
     * @param {Object} node
     * @returns {Object}
     */
    getLastNodeToken: function(node) {
        return this.getTokenByRangeEnd(node.range[1]);
    },
    /**
     * Returns the first token before the given.
     *
     * @param {Object} token
     * @returns {Object|undefined}
     */
    getPrevToken: function(token) {
        var index = token._tokenIndex - 1;
        return index >= 0 ? this._tree.tokens[index] : undefined;
    },
    /**
     * Returns the first token after the given.
     *
     * @param {Object} token
     * @returns {Object|undefined}
     */
    getNextToken: function(token) {
        var index = token._tokenIndex + 1;
        return index < this._tree.tokens.length ? this._tree.tokens[index] : undefined;
    },
    /**
     * Returns the first token before the given which matches type (and value).
     *
     * @param {Object} token
     * @param {String} type
     * @param {String} [value]
     * @returns {Object|undefined}
     */
    findPrevToken: function(token, type, value) {
        var prevToken = this.getPrevToken(token);
        while (prevToken) {
            if (prevToken.type === type && (value === undefined || prevToken.value === value)) {
                return prevToken;
            }
            prevToken = this.getPrevToken(prevToken);
        }
        return prevToken;
    },
    /**
     * Returns the first token after the given which matches type (and value).
     *
     * @param {Object} token
     * @param {String} type
     * @param {String} [value]
     * @returns {Object|undefined}
     */
    findNextToken: function(token, type, value) {
        var nextToken = this.getNextToken(token);
        while (nextToken) {
            if (nextToken.type === type && (value === undefined || nextToken.value === value)) {
                return nextToken;
            }
            nextToken = this.getNextToken(nextToken);
        }
        return nextToken;
    },
    /**
     * Returns the first token before the given which matches type (and value).
     *
     * @param {Object} token
     * @param {String} value
     * @returns {Object|undefined}
     */
    findPrevOperatorToken: function(token, value) {
        return this.findPrevToken(token, value in KEYWORD_OPERATORS ? 'Keyword' : 'Punctuator', value);
    },
    /**
     * Returns the first token after the given which matches type (and value).
     *
     * @param {Object} token
     * @param {String} value
     * @returns {Object|undefined}
     */
    findNextOperatorToken: function(token, value) {
        return this.findNextToken(token, value in KEYWORD_OPERATORS ? 'Keyword' : 'Punctuator', value);
    },
    /**
     * Iterates through the token tree using tree iterator.
     * Calls passed function for every token.
     *
     * @param {Function} cb
     * @param {Object} [tree]
     */
    iterate: function(cb, tree) {
        return treeIterator.iterate(tree || this._tree, cb);
    },
    /**
     * Returns node by its range position
     *
     * @returns {Object}
     */
    getNodeByRange: function(number) {
        var result = {};
        this.iterate(function(node) {
            if (number > node.range[0] && number < node.range[1]) {
                result = node;
            }
            if (number < node.range[0]) {
                return false;
            }
        });
        return result;
    },
    /**
     * Returns nodes by type(s) from earlier built index.
     *
     * @param {String|String[]} type
     * @returns {Object[]}
     */
    getNodesByType: function(type) {
        if (typeof type === 'string') {
            return this._index[type] || [];
        } else {
            var result = [];
            for (var i = 0, l = type.length; i < l; i++) {
                var nodes = this._index[type[i]];
                if (nodes) {
                    result = result.concat(nodes);
                }
            }
            return result;
        }
    },
    /**
     * Iterates nodes by type(s) from earlier built index.
     * Calls passed function for every matched node.
     *
     * @param {String|String[]} type
     * @param {Function} cb
     */
    iterateNodesByType: function(type, cb) {
        return this.getNodesByType(type).forEach(cb);
    },
    /**
     * Iterates tokens by type(s) from the token array.
     * Calls passed function for every matched token.
     *
     * @param {String|String[]} type
     * @param {Function} cb
     */
    iterateTokensByType: function(type, cb) {
        var types = (typeof type === 'string') ? [type] : type;
        var typeIndex = {};
        types.forEach(function(type) {
            typeIndex[type] = true;
        });

        this.getTokens().forEach(function(token, index, tokens) {
            if (typeIndex[token.type]) {
                cb(token, index, tokens);
            }
        });
    },
    /**
     * Iterates token by value from the token array.
     * Calls passed function for every matched token.
     *
     * @param {String|String[]} name
     * @param {Function} cb
     */
    iterateTokenByValue: function(name, cb) {
        var names = (typeof name === 'string') ? [name] : name;
        var nameIndex = {};
        names.forEach(function(type) {
            nameIndex[type] = true;
        });

        this.getTokens().forEach(function(token, index, tokens) {
            if (nameIndex.hasOwnProperty(token.value)) {
                cb(token, index, tokens);
            }
        });
    },
    /**
     * Returns string representing contents of the file.
     *
     * @returns {String}
     */
    getSource: function() {
        return this._source;
    },
    /**
     * Returns token tree, built using esprima.
     *
     * @returns {Object}
     */
    getTree: function() {
        return this._tree;
    },
    /**
     * Returns token list, built using esprima.
     *
     * @returns {Object[]}
     */
    getTokens: function() {
        return this._tree.tokens;
    },
    /**
     * Returns comment token list, built using esprima.
     */
    getComments: function() {
        return this._tree.comments;
    },
    /**
     * Returns source filename for this object representation.
     *
     * @returns {String}
     */
    getFilename: function() {
        return this._filename;
    },
    /**
     * Returns array of source lines for the file.
     *
     * @returns {String[]}
     */
    getLines: function() {
        return this._lines;
    },

    splice: function(startIndex, removeCharCount, charsToAdd) {
        this._changes.push({startIndex: startIndex, removeCharCount: removeCharCount, charsToAdd: charsToAdd});
    },

    applyChanges: function() {
        var result = '';
        var startIndex = 0;
        var source = this._source;
        this._changes.sort(function(a, b) {
            return a.startIndex - b.startIndex;
        });
        this._changes.forEach(function(change) {
            result = result + source.substring(startIndex, change.startIndex) + change.charsToAdd;
            startIndex = change.startIndex + change.removeCharCount;
        });

        if (startIndex < source.length) {
            result = result + source.substring(startIndex, source.length);
        }
        return result;
    },

    getPosByLineAndColumn: function(line, column) {
        var pos = 0;
        var source = this._source;
        for (var i = 0;i < line - 1;i++) {
            pos += this._lines[i].length + 1;
            if (source[pos - 1] === '\r' && source[pos] === '\n') {
                pos += 1;
            }
        }
        return pos + column;
    }
};

module.exports = JsFile;

},{"./tree-iterator":110}],6:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(disallowAnonymousFunctions) {
        assert(
            disallowAnonymousFunctions === true,
            'disallowAnonymousFunctions option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowAnonymousFunctions';
    },

    check: function(file, errors) {
        file.iterateNodesByType(['FunctionExpression', 'FunctionDeclaration'], function(node) {
            if (node.id === null) {
                errors.add('Anonymous functions needs to be named', node.loc.start);
            }
        });
    }
};

},{"assert":143}],7:[function(require,module,exports){
var assert = require('assert');
var Lu = require('unicode-6.3.0/categories/Lu/regex');
var Ll = require('unicode-6.3.0/categories/Ll/regex');
var Lt = require('unicode-6.3.0/categories/Lt/regex');
var Lm = require('unicode-6.3.0/categories/Lm/regex');
var Lo = require('unicode-6.3.0/categories/Lo/regex');

function letterPattern(char) {
    return Lu.test(char) || Ll.test(char) || Lt.test(char) || Lm.test(char) || Lo.test(char);
}
function lowerCasePattern(char) {
    return Ll.test(char);
}

module.exports = function() {};

module.exports.prototype = {
    configure: function(disallowCapitalizedComments) {
        assert(
            disallowCapitalizedComments === true,
            'disallowCapitalizedComments option requires a value of true or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowCapitalizedComments';
    },

    check: function(file, errors) {
        file.getComments().forEach(function(comment) {
            var stripped = comment.value.replace(/[\n\s\*]/g, '');
            var firstChar = stripped[0];

            if (letterPattern(firstChar) && !lowerCasePattern(firstChar)) {
                errors.add(
                    'Comments must start with a lowercase letter',
                    comment.loc.start
                );
            }
        });
    }
};

},{"assert":143,"unicode-6.3.0/categories/Ll/regex":130,"unicode-6.3.0/categories/Lm/regex":131,"unicode-6.3.0/categories/Lo/regex":132,"unicode-6.3.0/categories/Lt/regex":133,"unicode-6.3.0/categories/Lu/regex":134}],8:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowCommaBeforeLineBreak) {
        assert(
            typeof disallowCommaBeforeLineBreak === 'boolean',
            'disallowCommaBeforeLineBreak option requires boolean value'
        );
        assert(
            disallowCommaBeforeLineBreak === true,
            'disallowCommaBeforeLineBreak option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowCommaBeforeLineBreak';
    },

    check: function(file, errors) {
        file.iterateTokensByType('Punctuator', function(token) {
            if (token.value === ',') {
                errors.assert.sameLine({
                    token: token,
                    nextToken: file.getNextToken(token),
                    message: 'Commas should be placed on new line'
                });
            }
        });
    }

};

},{"assert":143}],9:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(identifiers) {
        assert(
            identifiers === true ||
            typeof identifiers === 'object',
            this.getOptionName() + ' option requires the value `true` ' +
            'or an object with String[] `allExcept` property'
        );

         // verify first item in `allExcept` property in object (if it's an object)
        assert(
            typeof identifiers !== 'object' ||
            Array.isArray(identifiers.allExcept) &&
            typeof identifiers.allExcept[0] === 'string',
            'Property `allExcept` in requireSpaceAfterLineComment should be an array of strings'
        );

        var isTrue = identifiers === true;
        var defaultIdentifiers = [
            '__proto__',
            '_',
            '__dirname',
            '__filename',
            'super_'
        ];

        if (isTrue) {
            identifiers = defaultIdentifiers;
        } else {
            identifiers = (identifiers.allExcept).concat(defaultIdentifiers);
        }

        this._identifierIndex = {};
        for (var i = 0, l = identifiers.length; i < l; i++) {
            this._identifierIndex[identifiers[i]] = true;
        }
    },

    getOptionName: function() {
        return 'disallowDanglingUnderscores';
    },

    check: function(file, errors) {
        var allowedIdentifiers = this._identifierIndex;

        file.iterateTokensByType('Identifier', function(token) {
            var value = token.value;
            if ((value[0] === '_' || value.slice(-1) === '_') &&
                !allowedIdentifiers[value]
            ) {
                errors.add(
                    'Invalid dangling underscore found',
                    token.loc.start.line,
                    token.loc.start.column
                );
            }
        });
    }

};

},{"assert":143}],10:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowEmptyBlocks) {
        assert(
            typeof disallowEmptyBlocks === 'boolean',
            'disallowEmptyBlocks option requires boolean value'
        );
        assert(
            disallowEmptyBlocks === true,
            'disallowEmptyBlocks option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowEmptyBlocks';
    },

    check: function(file, errors) {
        file.iterateNodesByType('BlockStatement', function(node) {
            if (node.body.length === 0 &&
                node.parentNode.type !== 'CatchClause' &&
                node.parentNode.type !== 'FunctionDeclaration' &&
                node.parentNode.type !== 'FunctionExpression') {
                errors.add('Empty block found', node.loc.end);
            }
        });
    }

};

},{"assert":143}],11:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(disallowFunctionDeclarations) {
        assert(
            disallowFunctionDeclarations === true,
            'disallowFunctionDeclarations option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowFunctionDeclarations';
    },

    check: function(file, errors) {
        file.iterateNodesByType('FunctionDeclaration', function(node) {
            errors.add('Illegal function declaration', node.loc.start);
        });
    }
};

},{"assert":143}],12:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(types) {
        assert(Array.isArray(types), 'disallowImplicitTypeConversion option requires array value');
        this._typeIndex = {};
        for (var i = 0, l = types.length; i < l; i++) {
            this._typeIndex[types[i]] = true;
        }
    },

    getOptionName: function() {
        return 'disallowImplicitTypeConversion';
    },

    check: function(file, errors) {
        var types = this._typeIndex;
        if (types.numeric || types.boolean || types.binary) {
            file.iterateNodesByType('UnaryExpression', function(node) {
                if (types.numeric && node.operator === '+') {
                    errors.add('Implicit numeric conversion', node.loc.start);
                }
                if (types.binary && node.operator === '~') {
                    errors.add('Implicit binary conversion', node.loc.start);
                }
                if (types.boolean &&
                    node.operator === '!' &&
                    node.argument.type === 'UnaryExpression' &&
                    node.argument.operator === '!'
                ) {
                    errors.add('Implicit boolean conversion', node.loc.start);
                }
            });
        }
        if (types.string) {
            file.iterateNodesByType('BinaryExpression', function(node) {
                if (node.operator === '+' && (
                        (node.left.type === 'Literal' && node.left.value === '') ||
                        (node.right.type === 'Literal' && node.right.value === '')
                    )
                ) {
                    errors.add('Implicit string conversion', node.loc.start);
                }
            });
        }
    }

};

},{"assert":143}],13:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(keywords) {
        assert(Array.isArray(keywords), 'disallowKeywordsOnNewLine option requires array value');
        this._keywordIndex = {};
        for (var i = 0, l = keywords.length; i < l; i++) {
            this._keywordIndex[keywords[i]] = true;
        }
    },

    getOptionName: function() {
        return 'disallowKeywordsOnNewLine';
    },

    check: function(file, errors) {
        var keywordIndex = this._keywordIndex;

        file.iterateTokensByType('Keyword', function(token, i, tokens) {
            if (keywordIndex[token.value]) {
                var prevToken = tokens[i - 1];
                if (prevToken && prevToken.loc.end.line !== token.loc.start.line) {
                    errors.add(
                        'Keyword `' + token.value + '` should not be placed on new line',
                        token.loc.start.line,
                        token.loc.start.column
                    );
                }
            }
        });
    }

};

},{"assert":143}],14:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(keywords) {
        assert(Array.isArray(keywords), 'disallowKeywords option requires array value');
        this._keywordIndex = {};
        for (var i = 0, l = keywords.length; i < l; i++) {
            this._keywordIndex[keywords[i]] = true;
        }
    },

    getOptionName: function() {
        return 'disallowKeywords';
    },

    check: function(file, errors) {
        var keywordIndex = this._keywordIndex;

        file.iterateTokensByType('Keyword', function(token) {
            if (keywordIndex[token.value]) {
                errors.add(
                    'Illegal keyword: ' + token.value,
                    token.loc.start
                );
            }
        });
    }

};

},{"assert":143}],15:[function(require,module,exports){
module.exports = function() {};

module.exports.prototype = {

    configure: function() {},

    getOptionName: function() {
        return 'disallowLeftStickedOperators';
    },

    check: function(file, errors) {
        errors.add(
            'The disallowLeftStickedOperators rule is no longer supported.' +
            '\nPlease use the following rules instead:' +
            '\n' +
            '\nrequireSpaceBeforeBinaryOperators' +
            '\nrequireSpaceBeforePostfixUnaryOperators' +
            '\nrequireSpacesInConditionalExpression',
            1,
            0
        );
    }

};

},{}],16:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowMixedSpacesAndTabs) {
        assert(
            disallowMixedSpacesAndTabs === true || disallowMixedSpacesAndTabs === 'smart',
            'disallowMixedSpacesAndTabs option requires true or "smart" value'
        );

        this._disallowMixedSpacesAndTabs = disallowMixedSpacesAndTabs;
    },

    getOptionName: function() {
        return 'disallowMixedSpacesAndTabs';
    },

    check: function(file, errors) {
        var disallowMixedSpacesAndTabs = this._disallowMixedSpacesAndTabs;

        var lines = file.getLines().concat();

        var test = disallowMixedSpacesAndTabs === true ?
            (/ \t|\t [^\*]|\t $/) :
            (/ \t/);

        // remove comments from the code
        var comments = file.getComments();
        if (comments) {
            comments.forEach(function(comment) {
                var loc = comment.loc;
                var start = loc.start;
                var end = loc.end;
                var startIndex = start.line - 1;

                if (comment.type === 'Line') {
                    lines[startIndex] = lines[startIndex].substring(0, start.column);
                } else if (start.line !== end.line) {
                    for (var x = startIndex; x < end.line; x++) {
                        // remove all multine content to the right of the star
                        var starPos = lines[x].search(/ \*/);
                        if (starPos > -1) {
                            lines[x] = lines[x].substring(0, starPos + 2);
                        }
                    }
                }
            });
        }

        lines.forEach(function(line, i) {
            if (line.match(test)) {
                errors.add('Mixed spaces and tabs found', i + 1, 0);
            }
        });
    }

};

},{"assert":143}],17:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowMultipleLineBreaks) {
        assert(
            typeof disallowMultipleLineBreaks === 'boolean',
            'disallowMultipleLineBreaks option requires boolean value'
        );
        assert(
            disallowMultipleLineBreaks === true,
            'disallowMultipleLineBreaks option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowMultipleLineBreaks';
    },

    check: function(file, errors) {
        var lines = file.getLines();
        for (var i = 1, l = lines.length; i < l; i++) {
            var line = lines[i];
            if (line === '' && lines[i - 1] === '') {
                while (++i < l && lines[i] === '') {}
                errors.add('Multiple line break', i - 1, 0);
            }
        }
    }

};

},{"assert":143}],18:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowMultipleLineStrings) {
        assert(
            typeof disallowMultipleLineStrings === 'boolean',
            'disallowMultipleLineStrings option requires boolean value'
        );
        assert(
            disallowMultipleLineStrings === true,
            'disallowMultipleLineStrings option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowMultipleLineStrings';
    },

    check: function(file, errors) {
        file.iterateTokensByType('String', function(token) {
            if (token.loc.start.line !== token.loc.end.line) {
                errors.add(
                    'Multiline strings are disallowed.',
                    token.loc.start.line,
                    token.loc.start.column
                );
            }
        });
    }

};

},{"assert":143}],19:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowMultipleVarDecl) {
        assert(
            disallowMultipleVarDecl === true ||
            disallowMultipleVarDecl === 'strict' ||
            disallowMultipleVarDecl === 'exceptUndefined',
            'disallowMultipleVarDecl option requires true, "strict", or "exceptUndefined" value'
        );

        this.strictMode = disallowMultipleVarDecl === 'strict';
        this.exceptUndefined = disallowMultipleVarDecl === 'exceptUndefined';
    },

    getOptionName: function() {
        return 'disallowMultipleVarDecl';
    },

    check: function(file, errors) {
        var inStrictMode = this.strictMode;
        var exceptUndefined = this.exceptUndefined;

        file.iterateNodesByType('VariableDeclaration', function(node) {
            var hasDefinedVariables = node.declarations.some(function(declaration) {
                return !!declaration.init;
            });

            var isForStatement = node.parentNode.type === 'ForStatement';

            // allow single var declarations
            if (node.declarations.length === 1 ||
                // allow multiple var declarations in for statement unless we're in strict mode
                // for (var i = 0, j = myArray.length; i < j; i++) {}
                !inStrictMode && isForStatement ||
                // allow multiple var declarations with all undefined variables in exceptUndefined mode
                // var a, b, c
                exceptUndefined && !hasDefinedVariables) {
                return;
            }

            errors.add('Multiple var declaration', node.loc.start);
        });
    }

};

},{"assert":143}],20:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(disallowNewlineBeforeBlockStatements) {
        assert(
            typeof disallowNewlineBeforeBlockStatements === 'boolean',
            'disallowNewlineBeforeBlockStatements option requires boolean value'
        );
        assert(
            disallowNewlineBeforeBlockStatements === true,
            'disallowNewlineBeforeBlockStatements option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowNewlineBeforeBlockStatements';
    },

    check: function(file, errors) {
        file.iterateNodesByType('BlockStatement', function(node) {
            var tokens = file.getTokens();

            var openingBracePos = file.getTokenPosByRangeStart(node.range[0]);
            var openingBrace = tokens[openingBracePos];
            var prevToken = tokens[openingBracePos - 1];

            if (openingBrace.loc.start.line !== prevToken.loc.start.line) {
                errors.add(
                    'Newline before curly brace for block statement is disallowed',
                    node.loc.start
                );
            }
        });
    }
};

},{"assert":143}],21:[function(require,module,exports){
var assert = require('assert');
var defaultOperators = require('../utils').binaryOperators.slice().concat(['.']);

module.exports = function() {};

module.exports.prototype = {
    configure: function(operators) {
        assert(Array.isArray(operators) || operators === true,
            'disallowOperatorBeforeLineBreak option requires array or true value');

        if (operators === true) {
            operators = defaultOperators;
        }
        this._operators = operators;
    },

    getOptionName: function() {
        return 'disallowOperatorBeforeLineBreak';
    },

    check: function(file, errors) {
        var tokens = file.getTokens();
        var lastToken;
        var operators = this._operators;

        tokens.forEach(function(token, i) {
            if (lastToken) {
                if (lastToken.type === 'Punctuator' && operators.indexOf(lastToken.value) > -1) {
                    if (lastToken.loc.end.line < token.loc.end.line) {
                        errors.add(
                            'Operator needs to either be on the same line or after a line break.',
                           token.loc.start
                        );
                    }
                }
            }
            lastToken = token;
        });
    }
};

},{"../utils":111,"assert":143}],22:[function(require,module,exports){
var assert = require('assert');
var defaultKeywords = require('../utils').spacedKeywords;

module.exports = function() { };

module.exports.prototype = {

    configure: function(keywords) {
        assert(Array.isArray(keywords) || keywords === true,
            'disallowPaddingNewlinesBeforeKeywords option requires array or true value');

        if (keywords === true) {
            keywords = defaultKeywords;
        }

        this._keywordIndex = {};
        for (var i = 0, l = keywords.length; i < l; i++) {
            this._keywordIndex[keywords[i]] = true;
        }
    },

    getOptionName: function() {
        return 'disallowPaddingNewlinesBeforeKeywords';
    },

    check: function(file, errors) {
        var keywordIndex = this._keywordIndex;

        file.iterateTokensByType('Keyword', function(token, i, tokens) {
            if (keywordIndex[token.value]) {
                var prevToken = tokens[i - 1];

                if (prevToken && token.loc.start.line - prevToken.loc.end.line > 1) {
                    errors.add(
                        'Keyword `' + token.value + '` should not have an empty line above it',
                        token.loc.start.line,
                        token.loc.start.column
                    );
                }
            }
        });
    }
};

},{"../utils":111,"assert":143}],23:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowPaddingNewlinesInBlocks) {
        assert(
            disallowPaddingNewlinesInBlocks === true,
            'disallowPaddingNewlinesInBlocks option requires the value true or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowPaddingNewlinesInBlocks';
    },

    check: function(file, errors) {
        var lines = file.getLines();
        var tokens = file.getTokens();

        file.iterateNodesByType('BlockStatement', function(node) {
            var openingBracketPos = file.getTokenPosByRangeStart(node.range[0]);
            var openingBracket = tokens[openingBracketPos];
            var startLine = openingBracket.loc.start.line;

            var closingBracketPos = file.getTokenPosByRangeStart(node.range[1] - 1);
            var closingBracket = tokens[closingBracketPos];
            var closingLine = closingBracket.loc.start.line;

            if (startLine === closingLine) {
                return;
            }

            if (lines[startLine] === '') {
                errors.add('Expected no padding newline after opening curly brace', openingBracket.loc.end);
            }

            if (lines[closingLine - 2] === '') {
                errors.add('Expected no padding newline before closing curly brace', closingBracket.loc.start);
            }
        });
    }

};

},{"assert":143}],24:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(value) {
        assert(
            typeof value === 'boolean',
            'disallowPaddingNewLinesInObjects option requires boolean value'
        );
        assert(
            value === true,
            'disallowPaddingNewLinesInObjects option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowPaddingNewLinesInObjects';
    },

    check: function(file, errors) {
        file.iterateNodesByType('ObjectExpression', function(node) {
            var tokens = file.getTokens();
            var openingBracketPos = file.getTokenPosByRangeStart(node.range[0]);

            var openingBracket = tokens[openingBracketPos];
            var nextToken = tokens[openingBracketPos + 1];

            if (nextToken.type === 'Punctuator' && nextToken.value === '}') {
                return;
            }

            if (openingBracket.loc.end.line !== nextToken.loc.start.line) {
                errors.add('Illegal newline after opening curly brace', nextToken.loc.start);
            }

            var closingBracketPos = file.getTokenPosByRangeStart(node.range[1] - 1);
            var closingBracket = tokens[closingBracketPos];
            var prevToken = tokens[closingBracketPos - 1];

            if (closingBracket.loc.start.line !== prevToken.loc.end.line) {
                errors.add('Illegal newline before closing curly brace', closingBracket.loc.start);
            }
        });
    }

};

},{"assert":143}],25:[function(require,module,exports){
var assert = require('assert');
var utils = require('../utils');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowQuotedKeysInObjects) {
        assert(
            disallowQuotedKeysInObjects === true || disallowQuotedKeysInObjects === 'allButReserved',
            this.getOptionName() + ' options should be true or "allButReserved" value'
        );

        this._mode = disallowQuotedKeysInObjects;
    },

    getOptionName: function() {
        return 'disallowQuotedKeysInObjects';
    },

    check: function(file, errors) {
        var KEY_NAME_RE = /^(0|[1-9][0-9]*|[a-zA-Z_$]+[\w$]*)$/; // number or identifier
        var mode = this._mode;

        file.iterateNodesByType('ObjectExpression', function(node) {
            node.properties.forEach(function(prop) {
                var key = prop.key;
                if (key.type === 'Literal' &&
                    typeof key.value === 'string' &&
                    KEY_NAME_RE.test(key.value)
                ) {
                    if (mode === 'allButReserved' &&
                        (utils.isEs3Keyword(key.value) || utils.isEs3FutureReservedWord(key.value))
                    ) {
                        return;
                    }
                    errors.add('Extra quotes for key', prop.loc.start);
                }
            });
        });
    }

};

},{"../utils":111,"assert":143}],26:[function(require,module,exports){
module.exports = function() {};

module.exports.prototype = {

    configure: function() {},

    getOptionName: function() {
        return 'disallowRightStickedOperators';
    },

    check: function(file, errors) {
        errors.add(
            'The disallowRightStickedOperators rule is no longer supported.' +
            '\nPlease use the following rules instead:' +
            '\n' +
            '\nrequireSpaceAfterBinaryOperators' +
            '\nrequireSpaceAfterPrefixUnaryOperators' +
            '\nrequireSpacesInConditionalExpression',
            1,
            0
        );
    }

};

},{}],27:[function(require,module,exports){
var assert = require('assert');
var tokenHelper = require('../token-helper');

module.exports = function() {};

module.exports.prototype = {
    configure: function(disallowSemicolons) {
        assert(
            disallowSemicolons === true,
            'disallowSemicolons option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowSemicolons';
    },

    check: function(file, errors) {
        file.getTokens()
            .filter(function(token) {
                return token.type === 'Punctuator' && token.value === ';';
            })
            .forEach(function(token) {
                var nextToken = file.getNextToken(token);
                if (!nextToken || nextToken.loc.end.line > token.loc.end.line) {
                    errors.add('semicolons are disallowed at the end of a line.', token.loc.end);
                }
            });
    }
};

},{"../token-helper":109,"assert":143}],28:[function(require,module,exports){
var assert = require('assert');
var allOperators = require('../utils').binaryOperators;

module.exports = function() {};

module.exports.prototype = {
    configure: function(operators) {
        var isTrue = operators === true;

        assert(
            Array.isArray(operators) || isTrue,
            'disallowSpaceAfterBinaryOperators option requires array or true value'
        );

        if (isTrue) {
            operators = allOperators;
        }

        this._operatorIndex = {};
        for (var i = 0, l = operators.length; i < l; i++) {
            this._operatorIndex[operators[i]] = true;
        }
    },

    getOptionName: function() {
        return 'disallowSpaceAfterBinaryOperators';
    },

    check: function(file, errors) {
        var operators = this._operatorIndex;

        // Comma
        if (operators[',']) {
            file.iterateTokensByType('Punctuator', function(token) {
                if (token.value === ',') {
                    errors.assert.noWhitespaceBetween({
                        token: token,
                        nextToken: file.getNextToken(token),
                        message: 'Operator , should stick to following expression'
                    });
                }
            });
        }

        // For everything else
        file.iterateNodesByType(
            ['BinaryExpression', 'AssignmentExpression', 'VariableDeclarator', 'LogicalExpression'],
            function(node) {
                var operator;
                var expression;

                if (node.type === 'VariableDeclarator') {
                    expression = node.init;
                    operator = '=';
                } else {
                    operator = node.operator;
                    expression = node.right;
                }

                if (expression === null) {
                    return;
                }

                var operatorToken = file.findPrevOperatorToken(
                    file.getFirstNodeToken(expression),
                    operator
                );

                var nextToken = file.getNextToken(operatorToken);

                if (operators[operator]) {
                    errors.assert.noWhitespaceBetween({
                        token: operatorToken,
                        nextToken: nextToken,
                        message: 'Operator ' + node.operator + ' should stick to following expression'
                    });
                }
            }
        );
    }

};

},{"../utils":111,"assert":143}],29:[function(require,module,exports){
var assert = require('assert');
var defaultKeywords = require('../utils').spacedKeywords;

module.exports = function() {};

module.exports.prototype = {

    configure: function(keywords) {
        assert(
            Array.isArray(keywords) || keywords === true,
            'disallowSpaceAfterKeywords option requires array or true value'
        );

        if (keywords === true) {
            keywords = defaultKeywords;
        }

        this._keywordIndex = {};
        for (var i = 0, l = keywords.length; i < l; i++) {
            this._keywordIndex[keywords[i]] = true;
        }
    },

    getOptionName: function() {
        return 'disallowSpaceAfterKeywords';
    },

    check: function(file, errors) {
        var keywordIndex = this._keywordIndex;

        file.iterateTokensByType('Keyword', function(token, i, tokens) {
            if (keywordIndex[token.value]) {
                var nextToken = tokens[i + 1];
                if (nextToken && nextToken.range[0] !== token.range[1]) {
                    errors.add(
                        'Illegal space after `' + token.value + '` keyword',
                        nextToken.loc.start.line,
                        nextToken.loc.start.column
                    );
                }
            }
        });
    }

};

},{"../utils":111,"assert":143}],30:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowSpaceAfterLineComment) {
        assert(
            disallowSpaceAfterLineComment === true,
            'disallowSpaceAfterLineComment option requires the value true'
        );
    },

    getOptionName: function() {
        return 'disallowSpaceAfterLineComment';
    },

    check: function(file, errors) {
        var comments = file.getComments();

        comments.forEach(function(comment) {
            if (comment.type === 'Line') {
                var value = comment.value;
                if (value.length > 0 && value[0] === ' ') {
                    errors.add('Illegal space after line comment', comment.loc.start);
                }
            }
        });
    }
};

},{"assert":143}],31:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallow) {
        assert(
            typeof disallow === 'boolean',
            this.getOptionName() + ' option requires boolean value'
        );
        assert(
            disallow === true,
            this.getOptionName() + ' option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowSpaceAfterObjectKeys';
    },

    check: function(file, errors) {
        var tokens = file.getTokens();
        file.iterateNodesByType('ObjectExpression', function(node) {
            node.properties.forEach(function(property) {
                var key = property.key;
                var keyPos = file.getTokenPosByRangeStart(key.range[0]);
                var colon = tokens[keyPos + 1];
                if (colon.range[0] !== key.range[1]) {
                    errors.add('Illegal space after key', key.loc.end);
                }
            });
        });
    }

};

},{"assert":143}],32:[function(require,module,exports){
var assert = require('assert');
var defaultOperators = require('../utils').unaryOperators;

module.exports = function() {};

module.exports.prototype = {

    configure: function(operators) {
        var isTrue = operators === true;

        assert(
            Array.isArray(operators) || isTrue,
            this.getOptionName() + ' option requires array or true value'
        );

        if (isTrue) {
            operators = defaultOperators;
        }

        this._operatorIndex = {};
        for (var i = 0, l = operators.length; i < l; i++) {
            this._operatorIndex[operators[i]] = true;
        }
    },

    getOptionName: function() {
        return 'disallowSpaceAfterPrefixUnaryOperators';
    },

    check: function(file, errors) {
        var operatorIndex = this._operatorIndex;
        var tokens = file.getTokens();

        file.iterateNodesByType(['UnaryExpression', 'UpdateExpression'], function(node) {
            // Check "node.prefix" for prefix type of (inc|dec)rement
            if (node.prefix && operatorIndex[node.operator]) {
                var operatorTokenIndex = file.getTokenPosByRangeStart(node.range[0]);
                var operatorToken = tokens[operatorTokenIndex];
                var nextToken = tokens[operatorTokenIndex + 1];
                if (operatorToken.range[1] !== nextToken.range[0]) {
                    errors.add('Operator ' + node.operator + ' should stick to operand', node.loc.start);
                }
            }
        });
    }
};

},{"../utils":111,"assert":143}],33:[function(require,module,exports){
var assert = require('assert');
var allOperators = require('../utils').binaryOperators;

module.exports = function() {};

module.exports.prototype = {

    configure: function(operators) {
        var isTrue = operators === true;

        assert(
            Array.isArray(operators) || isTrue,
            'disallowSpaceBeforeBinaryOperators option requires array or true value'
        );

        if (isTrue) {
            operators = allOperators;
        }

        this._operatorIndex = {};
        for (var i = 0, l = operators.length; i < l; i++) {
            this._operatorIndex[operators[i]] = true;
        }
    },

    getOptionName: function() {
        return 'disallowSpaceBeforeBinaryOperators';
    },

    check: function(file, errors) {
        var operators = this._operatorIndex;

        // Comma
        if (operators[',']) {
            file.iterateTokensByType('Punctuator', function(token) {
                if (token.value === ',') {
                    errors.assert.noWhitespaceBetween({
                        token: file.getPrevToken(token),
                        nextToken: token,
                        message: 'Operator , should stick to previous expression'
                    });
                }
            });
        }

        // For everything else
        file.iterateNodesByType(
            ['BinaryExpression', 'AssignmentExpression', 'VariableDeclarator', 'LogicalExpression'],
            function(node) {
                var operator;
                var expression;

                if (node.type === 'VariableDeclarator') {
                    expression = node.init;
                    operator = '=';
                } else {
                    operator = node.operator;
                    expression = node.right;
                }

                if (expression === null) {
                    return;
                }

                var operatorToken = file.findPrevOperatorToken(
                    file.getFirstNodeToken(expression),
                    operator
                );

                var prevToken = file.getPrevToken(operatorToken);

                if (operators[operator]) {
                    errors.assert.noWhitespaceBetween({
                        token: prevToken,
                        nextToken: operatorToken,
                        message: 'Operator ' + node.operator + ' should stick to previous expression'
                    });
                }
            }
        );
    },

    format: function(file, error) {
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        file.splice(pos, 1, '');
    }

};

},{"../utils":111,"assert":143}],34:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(disallowSpaceBeforeBlockStatements) {
        assert(
            typeof disallowSpaceBeforeBlockStatements === 'boolean',
            'disallowSpaceBeforeBlockStatements option requires boolean value'
        );
        assert(
            disallowSpaceBeforeBlockStatements === true,
            'disallowSpaceBeforeBlockStatements option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowSpaceBeforeBlockStatements';
    },

    check: function(file, errors) {
        var tokens = file.getTokens();

        file.iterateNodesByType('BlockStatement', function(node) {
            var tokenBeforeBodyPos = file.getTokenPosByRangeStart(node.range[0] - 1);
            var tokenBeforeBody = tokens[tokenBeforeBodyPos];
            if (!tokenBeforeBody) {
                errors.add(
                    'Extra space before opening curly brace for block expressions',
                    node.loc.start
                );
            }
        });
    }

};

},{"assert":143}],35:[function(require,module,exports){
var assert = require('assert');
var util = require('util');
var texts = [
    'Illegal space before "%s" keyword',
    'Should be zero spaces instead of %d, before "%s" keyword'
];

var defaultKeywords = require('../utils').spacedKeywords;

module.exports = function() {};

module.exports.prototype = {

    configure: function(keywords) {
        assert(
            Array.isArray(keywords) || keywords === true,
            'disallowSpaceBeforeKeywords option requires array or true value');

        if (keywords === true) {
            keywords = defaultKeywords;
        }

        this._keywordIndex = {};
        for (var i = 0, l = keywords.length; i < l; i++) {
            this._keywordIndex[keywords[i]] = true;
        }
    },

    getOptionName: function() {
        return 'disallowSpaceBeforeKeywords';
    },

    check: function(file, errors) {
        var keywordIndex = this._keywordIndex;

        function getCommentIfExists(start, end) {
            return file.getComments().filter(function(comment) {
                return start <= comment.range[0] && end >= comment.range[1];
            })[0];
        }

        file.iterateTokensByType(['Keyword'], function(token, i, tokens) {
            if (keywordIndex[token.value]) {
                var prevToken = tokens[i - 1];
                if (!prevToken) {
                    return;
                }

                var comment = getCommentIfExists(prevToken.range[1], token.range[0]);
                prevToken = comment || prevToken;

                var diff = token.range[0] - prevToken.range[1];

                if (prevToken.loc.end.line === token.loc.start.line && diff !== 0) {
                    if (prevToken.type !== 'Punctuator' || prevToken.value !== ';') {
                        errors.add(
                            util.format.apply(null,
                                diff === 1 ?
                                    [texts[0], token.value] :
                                    [texts[1], diff, token.value]
                            ),
                            token.loc.start.line,
                            token.loc.start.column
                        );
                    }
                }
            }
        });
    }

};

},{"../utils":111,"assert":143,"util":149}],36:[function(require,module,exports){
var assert = require('assert');
var tokenHelper = require('../token-helper');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallow) {
        assert(
            typeof disallow === 'boolean',
            this.getOptionName() + ' option requires boolean value'
        );
        assert(
            disallow === true,
            this.getOptionName() + ' option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowSpaceBeforeObjectValues';
    },

    check: function(file, errors) {
        file.iterateNodesByType('ObjectExpression', function(node) {
            node.properties.forEach(function(property) {
                var keyToken = file.getTokenByRangeStart(property.key.range[0]);
                var valueToken = file.getTokenByRangeStart(property.value.range[0]);
                var colon = file.findNextToken(keyToken, 'Punctuator', ':');
                var tokenBeforeValue = file.getPrevToken(valueToken);

                var tokenToTest;
                if (tokenHelper.isTokenParenthesis(file, tokenBeforeValue.range[0], true)) {
                    // skip '(' if value is parenthesised
                    tokenToTest = tokenBeforeValue;
                } else {
                    tokenToTest = valueToken;
                }

                if (colon.range[1] !== tokenToTest.range[0]) {
                    errors.add('Illegal space after key colon', colon.loc.end);
                }
            });
        });
    }

};

},{"../token-helper":109,"assert":143}],37:[function(require,module,exports){
var assert = require('assert');
var defaultOperators = require('../utils').incrementAndDecrementOperators;

module.exports = function() {};

module.exports.prototype = {

    configure: function(operators) {
        var isTrue = operators === true;

        assert(
            Array.isArray(operators) || isTrue,
            this.getOptionName() + ' option requires array or true value'
        );

        if (isTrue) {
            operators = defaultOperators;
        }

        this._operatorIndex = {};
        for (var i = 0, l = operators.length; i < l; i++) {
            this._operatorIndex[operators[i]] = true;
        }
    },

    getOptionName: function() {
        return 'disallowSpaceBeforePostfixUnaryOperators';
    },

    check: function(file, errors) {
        var operatorIndex = this._operatorIndex;
        var tokens = file.getTokens();

        // 'UpdateExpression' involve only ++ and -- operators
        file.iterateNodesByType('UpdateExpression', function(node) {
            // "!node.prefix" means postfix type of (inc|dec)rement
            if (!node.prefix && operatorIndex[node.operator]) {
                var operatorStartPos = node.range[1] - node.operator.length;
                var operatorTokenIndex = file.getTokenPosByRangeStart(operatorStartPos);
                var operatorToken = tokens[operatorTokenIndex];
                var prevToken = tokens[operatorTokenIndex - 1];
                if (operatorToken.range[0] !== prevToken.range[1]) {
                    errors.add('Operator ' + node.operator + ' should stick to operand', node.loc.start);
                }
            }
        });
    }
};

},{"../utils":111,"assert":143}],38:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowSpaceBetweenArguments) {
        assert(
            typeof disallowSpaceBetweenArguments === 'boolean',
            this.getOptionName() + ' option requires boolean value'
        );
        assert(
            disallowSpaceBetweenArguments === true,
            this.getOptionName() + ' option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowSpaceBetweenArguments';
    },

    check: function(file, errors) {

        var tokens = file.getTokens();

        file.iterateNodesByType(['CallExpression'], function(node) {

            node.arguments.forEach(function(param, i) {

                var paramTokenPos = file.getTokenPosByRangeStart(param.range[0]);
                var punctuatorToken = tokens[paramTokenPos + 1];
                var argumentIndex = i + 1;

                if (punctuatorToken.value === ',') {

                    var nextParamToken = tokens[paramTokenPos + 2];

                    if (punctuatorToken.range[1] < nextParamToken.range[0] &&
                        param.loc.start.line === nextParamToken.loc.start.line) {

                        errors.add(
                            'Unexpected space before argument ' + argumentIndex,
                            nextParamToken.loc.start
                        );
                    }
                }
            });
        });
    }

};

},{"assert":143}],39:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(options) {
        assert(
            typeof options === 'object',
            'disallowSpacesInAnonymousFunctionExpression option must be the object'
        );

        if ('beforeOpeningRoundBrace' in options) {
            assert(
                options.beforeOpeningRoundBrace === true,
                'disallowSpacesInAnonymousFunctionExpression.beforeOpeningRoundBrace ' +
                'property requires true value or should be removed'
            );
        }

        if ('beforeOpeningCurlyBrace' in options) {
            assert(
                options.beforeOpeningCurlyBrace === true,
                'disallowSpacesInAnonymousFunctionExpression.beforeOpeningCurlyBrace ' +
                'property requires true value or should be removed'
            );
        }

        assert(
            options.beforeOpeningCurlyBrace || options.beforeOpeningRoundBrace,
            'disallowSpacesInAnonymousFunctionExpression must have beforeOpeningCurlyBrace ' +
            ' or beforeOpeningRoundBrace property'
        );

        this._beforeOpeningRoundBrace = Boolean(options.beforeOpeningRoundBrace);
        this._beforeOpeningCurlyBrace = Boolean(options.beforeOpeningCurlyBrace);
    },

    getOptionName: function() {
        return 'disallowSpacesInAnonymousFunctionExpression';
    },

    check: function(file, errors) {
        var beforeOpeningRoundBrace = this._beforeOpeningRoundBrace;
        var beforeOpeningCurlyBrace = this._beforeOpeningCurlyBrace;
        var tokens = file.getTokens();

        file.iterateNodesByType(['FunctionExpression'], function(node) {
            var parent = node.parentNode;

            // Ignore syntactic sugar for getters and setters.
            if (parent.type === 'Property' && (parent.kind === 'get' || parent.kind === 'set')) {
                return;
            }

            // anonymous function expressions only
            if (!node.id) {

                if (beforeOpeningRoundBrace) {
                    var nodeBeforeRoundBrace = node;

                    var functionTokenPos = file.getTokenPosByRangeStart(nodeBeforeRoundBrace.range[0]);
                    var functionToken = tokens[functionTokenPos];

                    var nextTokenPos = file.getTokenPosByRangeStart(functionToken.range[1]);
                    var nextToken = tokens[nextTokenPos];

                    if (!nextToken) {
                        errors.add(
                            'Illegal space before opening round brace',
                            functionToken.loc.end
                        );
                    }
                }

                if (beforeOpeningCurlyBrace) {
                    var tokenBeforeBodyPos = file.getTokenPosByRangeStart(node.body.range[0] - 1);
                    var tokenBeforeBody = tokens[tokenBeforeBodyPos];

                    if (!tokenBeforeBody) {
                        errors.add(
                            'Illegal space before opening curly brace',
                            node.body.loc.start
                        );
                    }
                }
            }
        });
    }

};

},{"assert":143}],40:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(requireSpacesInCallExpression) {
        assert(
            requireSpacesInCallExpression === true,
            'disallowSpacesInCallExpression option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowSpacesInCallExpression';
    },

    check: function(file, errors) {
        var tokens = file.getTokens();

        file.iterateNodesByType('CallExpression', function(node) {
            var nodeBeforeRoundBrace = node;
            if (node.callee) {
                nodeBeforeRoundBrace = node.callee;
            }

            var roundBraceToken = file.getTokenByRangeStart(nodeBeforeRoundBrace.range[0]);
            do {
                roundBraceToken = file.findNextToken(roundBraceToken, 'Punctuator', '(');
            } while (roundBraceToken.range[0] < nodeBeforeRoundBrace.range[1]);

            var functionEndToken = file.getPrevToken(roundBraceToken);

            if (roundBraceToken.value === '(' && functionEndToken.range[1] !== roundBraceToken.range[0]) {
                errors.add(
                    'Illegal space before opening round brace',
                    roundBraceToken.loc.start
                );
            }
        });
    }
};

},{"assert":143}],41:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(options) {
        var validProperties = [
            'afterTest',
            'beforeConsequent',
            'afterConsequent',
            'beforeAlternate'
        ];
        var optionName = this.getOptionName();

        if (options === true) {
            options = {
                'afterTest': true,
                'beforeConsequent': true,
                'afterConsequent': true,
                'beforeAlternate': true
            };
        }

        assert(
            typeof options === 'object',
            optionName + ' option must be an object or boolean true'
        );

        var isProperlyConfigured = validProperties.some(function(key) {
            var isPresent = key in options;

            if (isPresent) {
                assert(
                    options[key] === true,
                    optionName + '.' + key + ' property requires true value or should be removed'
                );
            }

            return isPresent;
        });

        assert(
            isProperlyConfigured,
            optionName + ' must have at least 1 of the following properties: ' + validProperties.join(', ')
        );

        validProperties.forEach(function(property) {
            this['_' + property] = Boolean(options[property]);
        }.bind(this));
    },

    getOptionName: function() {
        return 'disallowSpacesInConditionalExpression';
    },

    check: function(file, errors) {
        var tokens = file.getTokens();

        file.iterateNodesByType(['ConditionalExpression'], function(node) {

            var test = node.test;
            var consequent = node.consequent;
            var consequentToken = file.getFirstNodeToken(consequent);
            var alternate = node.alternate;
            var alternateToken = file.getFirstNodeToken(alternate);
            var questionMarkToken = file.findPrevOperatorToken(consequentToken, '?');
            var colonToken = file.findPrevOperatorToken(alternateToken, ':');
            var token;

            if (this._afterTest && test.loc.end.line === questionMarkToken.loc.start.line) {
                token = file.getPrevToken(questionMarkToken);
                if (token.loc.end.column !== questionMarkToken.loc.start.column) {
                    errors.add(
                        'Illegal space after test',
                        test.loc.end
                    );
                }
            }

            if (this._beforeConsequent && consequent.loc.end.line === questionMarkToken.loc.start.line) {
                token = file.getNextToken(questionMarkToken);
                if (token.loc.start.column !== questionMarkToken.loc.end.column) {
                    errors.add(
                        'Illegal space before consequent',
                        consequent.loc.start
                    );
                }
            }

            if (this._afterConsequent && consequent.loc.end.line === colonToken.loc.start.line) {
                token = file.getPrevToken(colonToken);
                if (token.loc.end.column !== colonToken.loc.start.column) {
                    errors.add(
                        'Illegal space after consequent',
                        consequent.loc.end
                    );
                }
            }

            if (this._beforeAlternate && alternate.loc.end.line === colonToken.loc.start.line) {
                token = file.getNextToken(colonToken);
                if (token.loc.start.column !== colonToken.loc.end.column) {
                    errors.add(
                        'Illegal space before alternate',
                        alternate.loc.start
                    );
                }
            }
        }.bind(this));
    }

};

},{"assert":143}],42:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(options) {
        assert(
            typeof options === 'object',
            'disallowSpacesInFunctionDeclaration option must be the object'
        );

        if ('beforeOpeningRoundBrace' in options) {
            assert(
                options.beforeOpeningRoundBrace === true,
                'disallowSpacesInFunctionDeclaration.beforeOpeningRoundBrace ' +
                'property requires true value or should be removed'
            );
        }

        if ('beforeOpeningCurlyBrace' in options) {
            assert(
                options.beforeOpeningCurlyBrace === true,
                'disallowSpacesInFunctionDeclaration.beforeOpeningCurlyBrace ' +
                'property requires true value or should be removed'
            );
        }

        assert(
            options.beforeOpeningCurlyBrace || options.beforeOpeningRoundBrace,
            'disallowSpacesInFunctionDeclaration must have beforeOpeningCurlyBrace or beforeOpeningRoundBrace property'
        );

        this._beforeOpeningRoundBrace = Boolean(options.beforeOpeningRoundBrace);
        this._beforeOpeningCurlyBrace = Boolean(options.beforeOpeningCurlyBrace);
    },

    getOptionName: function() {
        return 'disallowSpacesInFunctionDeclaration';
    },

    check: function(file, errors) {
        var beforeOpeningRoundBrace = this._beforeOpeningRoundBrace;
        var beforeOpeningCurlyBrace = this._beforeOpeningCurlyBrace;
        var tokens = file.getTokens();

        file.iterateNodesByType(['FunctionDeclaration'], function(node) {

            if (beforeOpeningRoundBrace) {
                var nodeBeforeRoundBrace = node;
                // named function
                if (node.id) {
                    nodeBeforeRoundBrace = node.id;
                }

                var functionTokenPos = file.getTokenPosByRangeStart(nodeBeforeRoundBrace.range[0]);
                var functionToken = tokens[functionTokenPos];

                var nextTokenPos = file.getTokenPosByRangeStart(functionToken.range[1]);
                var nextToken = tokens[nextTokenPos];

                if (!nextToken) {
                    errors.add(
                        'Illegal space before opening round brace',
                        functionToken.loc.start
                    );
                }
            }

            if (beforeOpeningCurlyBrace) {
                var tokenBeforeBodyPos = file.getTokenPosByRangeStart(node.body.range[0] - 1);
                var tokenBeforeBody = tokens[tokenBeforeBodyPos];

                if (!tokenBeforeBody) {
                    errors.add(
                        'Illegal space before opening curly brace',
                        node.body.loc.start
                    );
                }
            }
        });
    }

};

},{"assert":143}],43:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(options) {
        assert(
            typeof options === 'object',
            'disallowSpacesInFunctionExpression option must be the object'
        );

        if ('beforeOpeningRoundBrace' in options) {
            assert(
                options.beforeOpeningRoundBrace === true,
                'disallowSpacesInFunctionExpression.beforeOpeningRoundBrace ' +
                'property requires true value or should be removed'
            );
        }

        if ('beforeOpeningCurlyBrace' in options) {
            assert(
                options.beforeOpeningCurlyBrace === true,
                'disallowSpacesInFunctionExpression.beforeOpeningCurlyBrace ' +
                'property requires true value or should be removed'
            );
        }

        assert(
            options.beforeOpeningCurlyBrace || options.beforeOpeningRoundBrace,
            'disallowSpacesInFunctionExpression must have beforeOpeningCurlyBrace or beforeOpeningRoundBrace property'
        );

        this._beforeOpeningRoundBrace = Boolean(options.beforeOpeningRoundBrace);
        this._beforeOpeningCurlyBrace = Boolean(options.beforeOpeningCurlyBrace);
    },

    getOptionName: function() {
        return 'disallowSpacesInFunctionExpression';
    },

    check: function(file, errors) {
        var beforeOpeningRoundBrace = this._beforeOpeningRoundBrace;
        var beforeOpeningCurlyBrace = this._beforeOpeningCurlyBrace;
        var tokens = file.getTokens();

        file.iterateNodesByType('FunctionExpression', function(node) {
            var parent = node.parentNode;

            // Ignore syntactic sugar for getters and setters.
            if (parent.type === 'Property' && (parent.kind === 'get' || parent.kind === 'set')) {
                return;
            }

            if (beforeOpeningRoundBrace) {
                var nodeBeforeRoundBrace = node;
                // named function
                if (node.id) {
                    nodeBeforeRoundBrace = node.id;
                }

                var functionTokenPos = file.getTokenPosByRangeStart(nodeBeforeRoundBrace.range[0]);
                var functionToken = tokens[functionTokenPos];

                var nextTokenPos = file.getTokenPosByRangeStart(functionToken.range[1]);
                var nextToken = tokens[nextTokenPos];

                if (!nextToken) {
                    errors.add(
                        'Illegal space before opening round brace',
                        functionToken.loc.start
                    );
                }
            }

            if (beforeOpeningCurlyBrace) {
                var tokenBeforeBodyPos = file.getTokenPosByRangeStart(node.body.range[0] - 1);
                var tokenBeforeBody = tokens[tokenBeforeBodyPos];

                if (!tokenBeforeBody) {
                    errors.add(
                        'Illegal space before opening curly brace',
                        node.body.loc.start
                    );
                }
            }
        });
    }

};

},{"assert":143}],44:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(options) {
        assert(
            typeof options === 'object',
            'disallowSpacesInFunction option must be the object'
        );

        if ('beforeOpeningRoundBrace' in options) {
            assert(
                options.beforeOpeningRoundBrace === true,
                'disallowSpacesInFunction.beforeOpeningRoundBrace ' +
                'property requires true value or should be removed'
            );
        }

        if ('beforeOpeningCurlyBrace' in options) {
            assert(
                options.beforeOpeningCurlyBrace === true,
                'disallowSpacesInFunction.beforeOpeningCurlyBrace ' +
                'property requires true value or should be removed'
            );
        }

        assert(
            options.beforeOpeningCurlyBrace || options.beforeOpeningRoundBrace,
            'disallowSpacesInFunction must have beforeOpeningCurlyBrace or beforeOpeningRoundBrace property'
        );

        this._beforeOpeningRoundBrace = Boolean(options.beforeOpeningRoundBrace);
        this._beforeOpeningCurlyBrace = Boolean(options.beforeOpeningCurlyBrace);
    },

    getOptionName: function() {
        return 'disallowSpacesInFunction';
    },

    check: function(file, errors) {
        var beforeOpeningRoundBrace = this._beforeOpeningRoundBrace;
        var beforeOpeningCurlyBrace = this._beforeOpeningCurlyBrace;
        var tokens = file.getTokens();

        file.iterateNodesByType(['FunctionDeclaration', 'FunctionExpression'], function(node) {
            var parent = node.parentNode;

            // Ignore syntactic sugar for getters and setters.
            if (parent.type === 'Property' && (parent.kind === 'get' || parent.kind === 'set')) {
                return;
            }

            if (beforeOpeningRoundBrace) {
                var nodeBeforeRoundBrace = node;
                // named function
                if (node.id) {
                    nodeBeforeRoundBrace = node.id;
                }

                var functionTokenPos = file.getTokenPosByRangeStart(nodeBeforeRoundBrace.range[0]);
                var functionToken = tokens[functionTokenPos];

                var nextTokenPos = file.getTokenPosByRangeStart(functionToken.range[1]);
                var nextToken = tokens[nextTokenPos];

                if (!nextToken) {
                    errors.add(
                        'Illegal space before opening round brace',
                        functionToken.loc.start
                    );
                }
            }

            if (beforeOpeningCurlyBrace) {
                var tokenBeforeBodyPos = file.getTokenPosByRangeStart(node.body.range[0] - 1);
                var tokenBeforeBody = tokens[tokenBeforeBodyPos];

                if (!tokenBeforeBody) {
                    errors.add(
                        'Illegal space before opening curly brace',
                        node.body.loc.start
                    );
                }
            }
        });
    }

};

},{"assert":143}],45:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(options) {
        assert(
            typeof options === 'object',
            'disallowSpacesInNamedFunctionExpression option must be the object'
        );

        if ('beforeOpeningRoundBrace' in options) {
            assert(
                options.beforeOpeningRoundBrace === true,
                'disallowSpacesInNamedFunctionExpression.beforeOpeningRoundBrace ' +
                'property requires true value or should be removed'
            );
        }

        if ('beforeOpeningCurlyBrace' in options) {
            assert(
                options.beforeOpeningCurlyBrace === true,
                'disallowSpacesInNamedFunctionExpression.beforeOpeningCurlyBrace ' +
                'property requires true value or should be removed'
            );
        }

        assert(
            options.beforeOpeningCurlyBrace || options.beforeOpeningRoundBrace,
            'disallowSpacesInNamedFunctionExpression must have beforeOpeningCurlyBrace ' +
            'or beforeOpeningRoundBrace property'
        );

        this._beforeOpeningRoundBrace = Boolean(options.beforeOpeningRoundBrace);
        this._beforeOpeningCurlyBrace = Boolean(options.beforeOpeningCurlyBrace);
    },

    getOptionName: function() {
        return 'disallowSpacesInNamedFunctionExpression';
    },

    check: function(file, errors) {
        var beforeOpeningRoundBrace = this._beforeOpeningRoundBrace;
        var beforeOpeningCurlyBrace = this._beforeOpeningCurlyBrace;
        var tokens = file.getTokens();

        file.iterateNodesByType(['FunctionExpression'], function(node) {

            // named function expressions only
            if (node.id) {

                if (beforeOpeningRoundBrace) {
                    var nodeBeforeRoundBrace = node.id;

                    var functionTokenPos = file.getTokenPosByRangeStart(nodeBeforeRoundBrace.range[0]);
                    var functionToken = tokens[functionTokenPos];

                    var nextTokenPos = file.getTokenPosByRangeStart(functionToken.range[1]);
                    var nextToken = tokens[nextTokenPos];

                    if (!nextToken) {
                        errors.add(
                            'Illegal space before opening round brace',
                            functionToken.loc.start
                        );
                    }
                }

                if (beforeOpeningCurlyBrace) {
                    var tokenBeforeBodyPos = file.getTokenPosByRangeStart(node.body.range[0] - 1);
                    var tokenBeforeBody = tokens[tokenBeforeBodyPos];

                    if (!tokenBeforeBody) {
                        errors.add(
                            'Illegal space before opening curly brace',
                            node.body.loc.start
                        );
                    }
                }
            }
        });
    }

};

},{"assert":143}],46:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallow) {
        assert(
            disallow === true || disallow === 'all' || disallow === 'nested',
            this.getOptionName() + ' option requires "all"(true value) or "nested" string'
        );

        this._mode = disallow === true ? 'all' : disallow;
    },

    getOptionName: function() {
        return 'disallowSpacesInsideArrayBrackets';
    },

    check: function(file, errors) {
        var mode = this._mode;

        file.iterateNodesByType(['ArrayExpression'], function(node) {
            var tokens = file.getTokens();

            var openingBracketPos = file.getTokenPosByRangeStart(node.range[0]);
            var closingBracketPos = file.getTokenPosByRangeStart(node.range[1] - 1);

            var brackets = {
                opening: tokens[openingBracketPos],
                closing: tokens[closingBracketPos]
            };

            var insideTokens = {
                prev: tokens[closingBracketPos - 1],
                next: tokens[openingBracketPos + 1]
            };

            if (mode === 'all') {
                check(brackets, errors, insideTokens);

            } else if (node.parentNode.type === 'ArrayExpression') {
                check(brackets, errors, insideTokens);
            }
        });
    }
};

function check(brackets, errors, insideTokens) {
    if (brackets.opening.loc.start.line === insideTokens.next.loc.start.line &&
        brackets.opening.range[1] !== insideTokens.next.range[0]
    ) {
        errors.add('Illegal space after opening square brace', brackets.opening.loc.end);
    }

    if (brackets.closing.loc.start.line === insideTokens.prev.loc.start.line &&
        brackets.closing.range[0] !== insideTokens.prev.range[1]
    ) {
        errors.add('Illegal space before closing square brace', insideTokens.prev.loc.end);
    }
}

},{"assert":143}],47:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowSpacesInsideObjectBrackets) {
        assert(
            disallowSpacesInsideObjectBrackets === true || disallowSpacesInsideObjectBrackets === 'all' ||
            disallowSpacesInsideObjectBrackets === 'nested',
            'disallowSpacesInsideObjectBrackets option requires "all"(true value) or "nested" string'
        );

        this._mode = disallowSpacesInsideObjectBrackets === true ? 'all' : disallowSpacesInsideObjectBrackets;
    },

    getOptionName: function() {
        return 'disallowSpacesInsideObjectBrackets';
    },

    check: function(file, errors) {
        var mode = this._mode;

        file.iterateNodesByType('ObjectExpression', function(node) {
            var tokens = file.getTokens();

            var openingBracketPos = file.getTokenPosByRangeStart(node.range[0]);
            var closingBracketPos = file.getTokenPosByRangeStart(node.range[1] - 1);

            var brackets = {
                opening: tokens[openingBracketPos],
                closing: tokens[closingBracketPos]
            };

            var insideTokens = {
                prev: tokens[closingBracketPos - 1],
                next: tokens[openingBracketPos + 1]
            };

            if (mode === 'all') {
                check(brackets, errors, insideTokens);

            } else if (node.parentNode.type === 'Property') {
                check(brackets, errors, insideTokens);
            }
        });
    }
};

function check(brackets, errors, insideTokens) {
    if (brackets.opening.loc.start.line === insideTokens.next.loc.start.line &&
        brackets.opening.range[1] !== insideTokens.next.range[0]
    ) {
        errors.add('Illegal space after opening curly brace', brackets.opening.loc.end);
    }

    if (brackets.closing.loc.start.line === insideTokens.prev.loc.start.line &&
        brackets.closing.range[0] !== insideTokens.prev.range[1]
    ) {
        errors.add('Illegal space before closing curly brace', insideTokens.prev.loc.end);
    }
}

},{"assert":143}],48:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(option) {
        var isObject = typeof option === 'object';

        var error = 'disallowSpacesInsideParentheses option requires' +
            ' true or object value with "all" or "only" properties ';

        if (typeof option === 'boolean') {
            assert(option === true, error);

        } else if (isObject) {
            assert(!('all' in option && 'only' in option), error);
            assert('all' in option || 'only' in option, error);

        } else {
            assert(false, error);
        }

        if (option.only) {
            this._only = {};
            (option.only || []).forEach(function(value) {
                this._only[value] = true;
            }, this);
        } else {
            this._only = null;
        }
    },

    getOptionName: function() {
        return 'disallowSpacesInsideParentheses';
    },

    check: function(file, errors) {
        var only = this._only;

        function isCommentInRange(start, end) {
            return file.getComments().some(function(comment) {
                return start <= comment.range[0] && end >= comment.range[1];
            });
        }

        file.iterateTokenByValue('(', function(token, index, tokens) {
            var nextToken = file.getNextToken(token);
            var value = nextToken.value;
            var type = nextToken.type;

            if (only && !(value in only)) {
                return;
            }

            if (token.range[1] !== nextToken.range[0] &&
                    token.loc.end.line === nextToken.loc.start.line &&
                    !isCommentInRange(token.range[1], nextToken.range[0])) {
                errors.add('Illegal space after opening round bracket', token.loc.end);
            }
        });

        file.iterateTokenByValue(')', function(token, index, tokens) {
            var prevToken = file.getPrevToken(token);
            var value = prevToken.value;
            var type = prevToken.type;

            if (only) {
                if (!(value in only)) {
                    return;
                }

                if (
                    value === ']' &&
                    file.getNodeByRange(prevToken.range[0]).type === 'MemberExpression'
                ) {
                    return;
                }
            }

            if (prevToken.range[1] !== token.range[0] &&
                    prevToken.loc.end.line === token.loc.start.line &&
                    !isCommentInRange(prevToken.range[1], token.range[0])) {
                errors.add('Illegal space before closing round bracket', prevToken.loc.end);
            }
        });
    }

};

},{"assert":143}],49:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(disallowTrailingComma) {
        assert(
            typeof disallowTrailingComma === 'boolean',
            'disallowTrailingComma option requires boolean value'
        );
        assert(
            disallowTrailingComma === true,
            'disallowTrailingComma option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowTrailingComma';
    },

    check: function(file, errors) {
        file.iterateNodesByType(['ObjectExpression', 'ArrayExpression'], function(node) {
            var closingToken = file.getLastNodeToken(node);

            errors.assert.noTokenBefore({
                token: closingToken,
                expectedTokenBefore: {type: 'Punctuator', value: ','},
                message: 'Extra comma following the final element of an array or object literal'
            });
        });
    }

};

},{"assert":143}],50:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowTrailingWhitespace) {
        assert(
            typeof disallowTrailingWhitespace === 'boolean',
            'disallowTrailingWhitespace option requires boolean value'
        );
        assert(
            disallowTrailingWhitespace === true,
            'disallowTrailingWhitespace option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'disallowTrailingWhitespace';
    },

    check: function(file, errors) {
        var lines = file.getLines();
        for (var i = 0, l = lines.length; i < l; i++) {
            if (lines[i].match(/\s$/)) {
                errors.add('Illegal trailing whitespace', i + 1, lines[i].length);
            }
        }
    }

};

},{"assert":143}],51:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallowYodaConditions) {
        assert(
            typeof disallowYodaConditions === 'boolean',
            'disallowYodaConditions option requires boolean value'
        );
        assert(
            disallowYodaConditions === true,
            'disallowYodaConditions option requires true value or should be removed'
        );
        this._operatorIndex = {
            '==': true,
            '===': true,
            '!=': true,
            '!==': true,
            '>': true,
            '<': true,
            '>=': true,
            '<=': true
        };
    },

    getOptionName: function() {
        return 'disallowYodaConditions';
    },

    check: function(file, errors) {
        var operators = this._operatorIndex;
        file.iterateNodesByType('BinaryExpression', function(node) {
            if (operators[node.operator]) {
                if (node.left.type === 'Literal' ||
                    (node.left.type === 'Identifier' && node.left.name === 'undefined')
                ) {
                    errors.add('Yoda condition', node.left.loc.start);
                }
            }
        });
    }

};

},{"assert":143}],52:[function(require,module,exports){
var assert = require('assert');
var commentHelper = require('../comment-helper');

module.exports = function() {};

module.exports.prototype = {

    configure: function(maximumLineLength) {
        this._tabSize = '';
        this._allowRegex = false;
        this._allowComments = false;
        this._allowUrlComments = false;

        if (typeof maximumLineLength === 'object') {
            assert(
                typeof maximumLineLength.value === 'number',
                'maximumLineLength option requires the "value" property to be defined'
            );

            this._maximumLineLength = maximumLineLength.value;
            var tabSize = maximumLineLength.tabSize || 0;

            while (tabSize--) {
                this._tabSize += ' ';
            }

            this._allowRegex = (maximumLineLength.allowRegex === true);
            this._allowComments = (maximumLineLength.allowComments === true);
            this._allowUrlComments = (maximumLineLength.allowUrlComments === true);
        } else {
            assert(
                typeof maximumLineLength === 'number',
                'maximumLineLength option requires number value or options object'
            );

            this._maximumLineLength = maximumLineLength;
        }
    },

    getOptionName: function() {
        return 'maximumLineLength';
    },

    check: function(file, errors) {
        var maximumLineLength = this._maximumLineLength;

        var line;
        var lines = this._allowComments ?
            commentHelper.getLinesWithCommentsRemoved(file) : file.getLines();

        // This check should not be destructive
        lines = lines.slice();

        if (this._allowRegex) {
            file.iterateTokensByType('RegularExpression', function(token) {
                for (var i = token.loc.start.line; i <= token.loc.end.line; i++) {
                    lines[i - 1] = '';
                }
            });
        }

        if (this._allowUrlComments) {
            file.getComments().forEach(function(comment) {
                for (var i = comment.loc.start.line; i <= comment.loc.end.line; i++) {
                    lines[i - 1] = lines[i - 1].replace(/(http|https|ftp):\/\/[^\s$]+/, '');
                }
            });
        }

        for (var i = 0, l = lines.length; i < l; i++) {
            line = this._tabSize ? lines[i].replace(/\t/g, this._tabSize) : lines[i];

            if (line.length > maximumLineLength) {
                errors.add(
                    'Line must be at most ' + maximumLineLength + ' characters',
                    i + 1,
                    lines[i].length
                );
            }
        }
    }

};

},{"../comment-helper":2,"assert":143}],53:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(mode) {
        var modes = {
            'all': 'all',
            'ignoreFunction': 'ignoreFunction',
            'ignoreLineBreak': 'ignoreLineBreak',
            'skipWithFunction': 'ignoreFunction',
            'skipWithLineBreak': 'ignoreLineBreak'
        };
        assert(
            typeof mode === 'string' && modes[mode],
            this.getOptionName() + ' requires one of the following values: ' + Object.keys(modes).join(', ')
        );
        this._mode = modes[mode];
    },

    getOptionName: function() {
        return 'requireAlignedObjectValues';
    },

    check: function(file, errors) {
        var tokens = file.getTokens();
        var mode = this._mode;
        file.iterateNodesByType('ObjectExpression', function(node) {
            if (node.loc.start.line === node.loc.end.line || node.properties < 2) {
                return;
            }

            var maxKeyEndPos = 0;
            var skip = node.properties.some(function(property, index) {
                maxKeyEndPos = Math.max(maxKeyEndPos, property.key.loc.end.column);

                if (mode === 'ignoreFunction' && property.value.type === 'FunctionExpression') {
                    return true;
                }

                if (mode === 'ignoreLineBreak' && index > 0 &&
                     node.properties[index - 1].loc.end.line !== property.loc.start.line - 1) {
                    return true;
                }
            });

            if (skip) {
                return;
            }

            node.properties.forEach(function(property) {
                var keyPos = file.getTokenPosByRangeStart(property.key.range[0]);
                var colon = tokens[keyPos + 1];
                if (colon.loc.start.column !== maxKeyEndPos + 1) {
                    errors.add('Alignment required', colon.loc.start);
                }
            });
        });
    }

};

},{"assert":143}],54:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(requireAnonymousFunctions) {
        assert(
            requireAnonymousFunctions === true,
            'requireAnonymousFunctions option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireAnonymousFunctions';
    },

    check: function(file, errors) {
        file.iterateNodesByType(['FunctionExpression', 'FunctionDeclaration'], function(node) {
            if (node.id !== null) {
                errors.add('Functions must not be named', node.loc.start);
            }
        });
    }
};

},{"assert":143}],55:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requireBlocksOnNewline) {
        assert(
            requireBlocksOnNewline === true || typeof requireBlocksOnNewline === 'number',
            'requireBlocksOnNewline option requires the value true or an Integer'
        );

        this._minStatements = requireBlocksOnNewline === true ? 0 : requireBlocksOnNewline;
    },

    getOptionName: function() {
        return 'requireBlocksOnNewline';
    },

    check: function(file, errors) {
        var minStatements = this._minStatements;

        file.iterateNodesByType('BlockStatement', function(node) {
            if (node.body.length <= minStatements) {
                return;
            }
            var tokens = file.getTokens();
            var openingBracketPos = file.getTokenPosByRangeStart(node.range[0]);

            var openingBracket = tokens[openingBracketPos];
            var nextToken = tokens[openingBracketPos + 1];

            if (openingBracket.loc.start.line === nextToken.loc.start.line) {
                errors.add('Missing newline after opening curly brace', openingBracket.loc.end);
            }

            var closingBracketPos = file.getTokenPosByRangeStart(node.range[1] - 1);
            var closingBracket = tokens[closingBracketPos];
            var prevToken = tokens[closingBracketPos - 1];

            if (closingBracket.loc.start.line === prevToken.loc.start.line) {
                errors.add('Missing newline before closing curly brace', prevToken.loc.end);
            }
        });
    }

};

},{"assert":143}],56:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requireCamelCase) {
        assert(
            requireCamelCase === true || requireCamelCase === 'ignoreProperties',
            'requireCamelCaseOrUpperCaseIdentifiers option requires true value or `ignoreProperties` string'
        );

        this._ignoreProperties = (requireCamelCase === 'ignoreProperties');
    },

    getOptionName: function() {
        return 'requireCamelCaseOrUpperCaseIdentifiers';
    },

    check: function(file, errors) {
        file.iterateTokensByType('Identifier', function(token, index, tokens) {
            var value = token.value;
            if (value.replace(/^_+|_+$/g, '').indexOf('_') === -1 || value.toUpperCase() === value) {
                return;
            }
            if (this._ignoreProperties) {
                if (index + 1 < tokens.length && tokens[index + 1].value === ':') {
                    return;
                }
                if (index > 0 && tokens[index - 1].value === '.') {
                    return;
                }
            }
            errors.add(
                'All identifiers must be camelCase or UPPER_CASE',
                token.loc.start.line,
                token.loc.start.column
            );
        }.bind(this));
    }

};

},{"assert":143}],57:[function(require,module,exports){
var assert = require('assert');
var Lu = require('unicode-6.3.0/categories/Lu/regex');
var Ll = require('unicode-6.3.0/categories/Ll/regex');
var Lt = require('unicode-6.3.0/categories/Lt/regex');
var Lm = require('unicode-6.3.0/categories/Lm/regex');
var Lo = require('unicode-6.3.0/categories/Lo/regex');

function letterPattern(char) {
    return Lu.test(char) || Ll.test(char) || Lt.test(char) || Lm.test(char) || Lo.test(char);
}
function upperCasePattern(char) {
    return Lu.test(char);
}

module.exports = function() {};

module.exports.prototype = {
    configure: function(requireCapitalizedComments) {
        assert(
            requireCapitalizedComments === true,
            'requireCapitalizedComments option requires a value of true or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireCapitalizedComments';
    },

    check: function(file, errors) {
        var inTextBlock = null;

        file.getComments().forEach(function(comment) {
            var stripped = comment.value.replace(/[\n\s\*]/g, '');
            var firstChar = stripped[0];
            var isLetter = firstChar && letterPattern(firstChar);

            if (!isLetter) {
                inTextBlock = false;
                return;
            }

            var isUpperCase = upperCasePattern(firstChar);
            var isValid = isUpperCase || (inTextBlock && !isUpperCase);

            if (!isValid) {
                errors.add(
                    'Comments must start with an uppercase letter, unless it is part of a textblock',
                    comment.loc.start
                );
            }

            inTextBlock = !inTextBlock ? isLetter && isUpperCase : isLetter;
        });
    }
};

},{"assert":143,"unicode-6.3.0/categories/Ll/regex":130,"unicode-6.3.0/categories/Lm/regex":131,"unicode-6.3.0/categories/Lo/regex":132,"unicode-6.3.0/categories/Lt/regex":133,"unicode-6.3.0/categories/Lu/regex":134}],58:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requireCapitalizedConstructors) {
        assert(
            typeof requireCapitalizedConstructors === 'boolean',
            'requireCapitalizedConstructors option requires boolean value'
        );
        assert(
            requireCapitalizedConstructors === true,
            'requireCapitalizedConstructors option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireCapitalizedConstructors';
    },

    check: function(file, errors) {
        file.iterateNodesByType('NewExpression', function(node) {
            if (node.callee.type === 'Identifier' &&
                node.callee.name[0].toUpperCase() !== node.callee.name[0]
            ) {
                errors.add(
                    'Constructor functions should be capitalized',
                    node.callee.loc.start.line,
                    node.callee.loc.start.column
                );
            }
        });
    }

};

},{"assert":143}],59:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requireCommaBeforeLineBreak) {
        assert(
            typeof requireCommaBeforeLineBreak === 'boolean',
            'requireCommaBeforeLineBreak option requires boolean value'
        );
        assert(
            requireCommaBeforeLineBreak === true,
            'requireCommaBeforeLineBreak option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireCommaBeforeLineBreak';
    },

    check: function(file, errors) {
        file.iterateTokensByType('Punctuator', function(token) {
            if (token.value === ',') {
                errors.assert.sameLine({
                    token: file.getPrevToken(token),
                    nextToken: token,
                    message: 'Commas should not be placed on new line'
                });
            }
        });
    }

};

},{"assert":143}],60:[function(require,module,exports){
var assert = require('assert');
var defaultKeywords = require('../utils').curlyBracedKeywords;

module.exports = function() {};

module.exports.prototype = {

    configure: function(statementTypes) {
        assert(
            Array.isArray(statementTypes) || statementTypes === true,
            'requireCurlyBraces option requires array or true value'
        );

        if (statementTypes === true) {
            statementTypes = defaultKeywords;
        }

        this._typeIndex = {};
        for (var i = 0, l = statementTypes.length; i < l; i++) {
            this._typeIndex[statementTypes[i]] = true;
        }
    },

    getOptionName: function() {
        return 'requireCurlyBraces';
    },

    check: function(file, errors) {

        function addError(typeString, node) {
            var entity = node;

            if (typeString === 'Else') {
                entity = file.findPrevToken(
                    file.getTokenByRangeStart(node.alternate.range[0]),
                    'Keyword',
                    'else'
                );
            }

            errors.add(
                typeString + ' statement without curly braces',
                entity.loc.start.line,
                entity.loc.start.column
            );
        }

        function checkBody(type, typeString) {
            file.iterateNodesByType(type, function(node) {
                if (node.body && node.body.type !== 'BlockStatement') {
                    addError(typeString, node, typeString);
                }
            });
        }

        var typeIndex = this._typeIndex;

        if (typeIndex['if'] || typeIndex['else']) {
            file.iterateNodesByType('IfStatement', function(node) {
                if (typeIndex.if && node.consequent && node.consequent.type !== 'BlockStatement') {
                    addError('If', node);
                }
                if (typeIndex['else'] && node.alternate &&
                    node.alternate.type !== 'BlockStatement' &&
                    node.alternate.type !== 'IfStatement'
                ) {
                    addError('Else', node);
                }
            });
        }

        if (typeIndex['case'] || typeIndex['default']) {
            file.iterateNodesByType('SwitchCase', function(node) {
                // empty case statement
                if (!node.consequent || node.consequent.length === 0) {
                    return;
                }

                if (node.consequent.length === 1 && node.consequent[0].type === 'BlockStatement') {
                    return;
                }

                if (node.test === null && typeIndex['default']) {
                    addError('Default', node);
                }

                if (node.test !== null && typeIndex['case']) {
                    addError('Case', node);
                }
            });
        }

        if (typeIndex['while']) {
            checkBody('WhileStatement', 'While');
        }

        if (typeIndex['for']) {
            checkBody('ForStatement', 'For');
            checkBody('ForInStatement', 'For in');
        }

        if (typeIndex['do']) {
            checkBody('DoWhileStatement', 'Do while');
        }
        if (typeIndex['with']) {
            checkBody('WithStatement', 'With');
        }
    },

    format: function(file, error) {
        // This needs to be rewritten by the option feature.
        var node = file.getNodeByRange(file.getPosByLineAndColumn(error.line, error.column) + 1);
        var body;
        if (node.type === 'WhileStatement') {
            body = node.body;
            if (file._source[body.range[1] + 1] === ';') {
                file.splice(body.range[1] + 1, 0, '}');
            } else {
                file.splice(body.range[1], 0, '}');
            }
            file.splice(body.range[0], 0, '{');
        }
        if (node.type === 'DoWhileStatement') {
            body = node.body;
            if (file._source[body.range[1] + 1] === ';') {
                file.splice(body.range[1] + 1, 0, '}');
            } else {
                file.splice(body.range[1], 0, '}');
            }
            file.splice(body.range[0], 0, '{');

        }
        if (node.type === 'IfStatement') {
            if (node.consequent && error.message.indexOf('If') !== -1) {
                body = node.consequent;
                if (file._source[body.range[1] + 1] === ';') {
                    file.splice(body.range[1] + 1, 0, '}');
                } else {
                    file.splice(body.range[1], 0, '}');
                }
                file.splice(body.range[0], 0, '{');
            } else {
                body = node.alternate;
                if (file._source[body.range[1] + 1] === ';') {
                    file.splice(body.range[1] + 1, 0, '}');
                } else {
                    file.splice(body.range[1], 0, '}');
                }
                file.splice(body.range[0], 0, '{');
            }

        }
    }

};

},{"../utils":111,"assert":143}],61:[function(require,module,exports){
var assert = require('assert');
var utils = require('../utils');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requireDotNotation) {
        assert(
            typeof requireDotNotation === 'boolean',
            'requireDotNotation option requires boolean value'
        );
        assert(
            requireDotNotation === true,
            'requireDotNotation option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireDotNotation';
    },

    check: function(file, errors) {
        file.iterateNodesByType('MemberExpression', function(node) {
            if (!node.computed || node.property.type !== 'Literal') {
                return;
            }

            var value = node.property.value;
            if (typeof value === 'number' || (typeof value === 'string' && !utils.isValidIdentifierName(value))) {
                return;
            }

            if (value === null ||
                typeof value === 'boolean' ||
                value === 'null' ||
                value === 'true' ||
                value === 'false' ||
                utils.isEs3Keyword(value) ||
                utils.isEs3FutureReservedWord(value)
            ) {
                return;
            }

            errors.add(
                'Use dot notation instead of brackets for member expressions',
                node.property.loc.start
            );
        });
    }

};

},{"../utils":111,"assert":143}],62:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(requireFunctionDeclarations) {
        assert(
            requireFunctionDeclarations === true,
            'requireFunctionDeclarations option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireFunctionDeclarations';
    },

    check: function(file, errors) {
        file.iterateNodesByType(
            'VariableDeclarator',
            function(node) {
                if (node.init && node.init.type === 'FunctionExpression') {
                    errors.add('Use a function declaration instead', node.loc.start);
                }
            }
        );

        file.iterateNodesByType(
            'AssignmentExpression',
            function(node) {
                if (node.left.type !== 'MemberExpression' &&
                    node.right.type === 'FunctionExpression') {
                    errors.add('Use a function declaration instead', node.loc.start);
                }
            }
        );
    }
};

},{"assert":143}],63:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(keywords) {
        assert(Array.isArray(keywords), 'requireKeywordsOnNewLine option requires array value');
        this._keywordIndex = {};
        for (var i = 0, l = keywords.length; i < l; i++) {
            this._keywordIndex[keywords[i]] = true;
        }
    },

    getOptionName: function() {
        return 'requireKeywordsOnNewLine';
    },

    check: function(file, errors) {
        var keywordIndex = this._keywordIndex;

        file.iterateTokensByType('Keyword', function(token, i, tokens) {
            if (keywordIndex[token.value]) {
                var prevToken = tokens[i - 1];
                if (prevToken && prevToken.loc.end.line === token.loc.start.line) {
                    errors.add(
                        'Keyword `' + token.value + '` should be placed on new line',
                        token.loc.start.line,
                        token.loc.start.column
                    );
                }
            }
        });
    }

};

},{"assert":143}],64:[function(require,module,exports){
module.exports = function() {};

module.exports.prototype = {

    configure: function() {},

    getOptionName: function() {
        return 'requireLeftStickedOperators';
    },

    check: function(file, errors) {
        errors.add(
            'The requireLeftStickedOperators rule is no longer supported.' +
            '\nPlease use the following rules instead:' +
            '\n' +
            '\ndisallowSpaceBeforeBinaryOperators' +
            '\ndisallowSpaceBeforePostfixUnaryOperators' +
            '\ndisallowSpacesInConditionalExpression',
            1,
            0
        );
    }

};

},{}],65:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requireLineBreakAfterVariableAssignment) {
        assert(
            typeof requireLineBreakAfterVariableAssignment === 'boolean',
            'requireLineFeedAtFileEnd option requires boolean value'
        );
        assert(
            requireLineBreakAfterVariableAssignment === true,
            'requireLineFeedAtFileEnd option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireLineBreakAfterVariableAssignment';
    },

    check: function(file, errors) {
        file.iterate(function(node) {
            var lastDeclaration;

            if (node && node.type === 'VariableDeclaration') {
                for (var i = 0; i < node.declarations.length; i++) {
                    var thisDeclaration = node.declarations[i];
                    if (lastDeclaration && lastDeclaration.init &&
                        thisDeclaration.loc.start.line === lastDeclaration.loc.start.line) {
                        errors.add('Variable assignments should be followed by new line',
                            thisDeclaration.loc.start.line, thisDeclaration.loc.start.column);
                    }
                    lastDeclaration = thisDeclaration;
                }
            }
        });
    }

};

},{"assert":143}],66:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requireLineFeedAtFileEnd) {
        assert(
            typeof requireLineFeedAtFileEnd === 'boolean',
            'requireLineFeedAtFileEnd option requires boolean value'
        );
        assert(
            requireLineFeedAtFileEnd === true,
            'requireLineFeedAtFileEnd option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireLineFeedAtFileEnd';
    },

    check: function(file, errors) {
        var lines = file.getLines();
        if (lines[lines.length - 1] !== '') {
            errors.add('Missing line feed at file end', lines.length, 0);
        }
    },

    format: function(file, error) {
        file.splice(file.getSource().length, 0, '\n');
    }

};

},{"assert":143}],67:[function(require,module,exports){
var assert = require('assert');

function consecutive(file, errors) {
    file.iterateNodesByType('VariableDeclaration', function(node) {
        var pos = node.parentCollection.indexOf(node);
        if (pos < node.parentCollection.length - 1) {
            var sibling = node.parentCollection[pos + 1];
            if (sibling.type === 'VariableDeclaration' && sibling.kind === node.kind) {
                errors.add(
                    node.kind[0].toUpperCase() + node.kind.slice(1) + ' declarations should be joined',
                    sibling.loc.start
                );
            }
        }
    });
}

function onevar(file, errors) {
    file.iterateNodesByType(['Program', 'FunctionDeclaration', 'FunctionExpression'], function(node) {
        var firstVar = true;
        var firstConst = true;
        var firstParent = true;

        file.iterate(function(node) {
            var type = node.type;
            var kind = node.kind;

            // Don't go in nested scopes
            if (!firstParent && ['FunctionDeclaration', 'FunctionExpression'].indexOf(type) > -1) {
                return false;
            }

            if (firstParent) {
                firstParent = false;
            }

            if (type === 'VariableDeclaration') {
                if (kind === 'var') {
                    if (!firstVar) {
                        errors.add(
                            'Var declarations should be joined',
                            node.loc.start
                        );
                    } else {
                        firstVar = false;
                    }
                }

                if (kind === 'const') {
                    if (!firstConst) {
                        errors.add(
                            'Const declarations should be joined',
                            node.loc.start
                        );
                    } else {
                        firstConst = false;
                    }
                }
            }
        }, node);
    });
}

module.exports = function() {};

module.exports.prototype = {
    configure: function(requireMultipleVarDecl) {
        assert(
            typeof requireMultipleVarDecl === 'boolean' ||
            typeof requireMultipleVarDecl === 'string',
            'requireMultipleVarDecl option requires boolean or string'
        );
        assert(
            requireMultipleVarDecl === true || requireMultipleVarDecl === 'onevar',
            'requireMultipleVarDecl option requires true value or `onevar` string'
        );

        this._check = typeof requireMultipleVarDecl === 'string' ? onevar : consecutive;
    },

    getOptionName: function() {
        return 'requireMultipleVarDecl';
    },

    check: function() {
        return this._check.apply(this, arguments);
    }
};

},{"assert":143}],68:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(requireNewlineBeforeBlockStatements) {
        assert(
            typeof requireNewlineBeforeBlockStatements === 'boolean',
            'requireNewlineBeforeBlockStatements option requires boolean value'
        );
        assert(
            requireNewlineBeforeBlockStatements === true,
            'requireNewlineBeforeBlockStatements option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireNewlineBeforeBlockStatements';
    },

    check: function(file, errors) {
        file.iterateNodesByType('BlockStatement', function(node) {
            var tokens = file.getTokens();

            var openingBracePos = file.getTokenPosByRangeStart(node.range[0]);
            var openingBrace = tokens[openingBracePos];
            var prevToken = tokens[openingBracePos - 1];

            if (openingBrace.loc.start.line === prevToken.loc.start.line) {
                errors.add(
                    'Missing newline before curly brace for block statement',
                    node.loc.start
                );
            }
        });
    }
};

},{"assert":143}],69:[function(require,module,exports){
var assert = require('assert');
var tokenHelper = require('../token-helper');
var defaultOperators = require('../utils').binaryOperators.slice();

defaultOperators.push('?');

module.exports = function() {};

module.exports.prototype = {

    configure: function(operators) {
        var isTrue = operators === true;

        assert(
            Array.isArray(operators) || isTrue,
            'requireOperatorBeforeLineBreak option requires array value or true value'
        );

        if (isTrue) {
            operators = defaultOperators;
        }

        this._operatorIndex = {};
        for (var i = 0, l = operators.length; i < l; i++) {
            this._operatorIndex[operators[i]] = true;
        }
    },

    getOptionName: function() {
        return 'requireOperatorBeforeLineBreak';
    },

    check: function(file, errors) {
        var operators = this._operatorIndex;
        var tokens = file.getTokens();
        var throughTokens = ['?', ','];

        function errorIfApplicable(token, prevToken) {
            if (prevToken && prevToken.loc.end.line !== token.loc.start.line) {
                var loc = token.loc.start;

                errors.add(
                    'Operator ' + token.value + ' should not be on a new line',
                    loc.line,
                    tokenHelper.getPointerEntities(loc.column, token.value.length)
                );
            }
        }

        throughTokens = throughTokens.filter(function(operator) {
            return operators[operator];
        });

        if (throughTokens.length) {
            file.iterateTokensByType('Punctuator', function(token, i, tokens) {
                var operator = token.value;

                if (throughTokens.every(function() {
                    return throughTokens.indexOf(operator) >= 0;
                })) {
                    errorIfApplicable(token, tokens[i - 1]);
                }
            });
        }

        file.iterateNodesByType(
            ['BinaryExpression', 'AssignmentExpression', 'LogicalExpression'],
            function(node) {
                var operator = node.operator;

                if (!operators[operator]) {
                    return;
                }

                var token = tokenHelper.findOperatorByRangeStart(
                    file,
                    node.argument ? node.argument.range[0] : node.right.range[0],
                    operator,
                    true
                );

                errorIfApplicable(
                    token,
                    tokens[tokens.indexOf(token) - 1]
                );
            }
        );
    }
};

},{"../token-helper":109,"../utils":111,"assert":143}],70:[function(require,module,exports){
var assert = require('assert');
var defaultKeywords = require('../utils').spacedKeywords;

module.exports = function() { };

module.exports.prototype = {

    configure: function(keywords) {
        assert(Array.isArray(keywords) || keywords === true,
            'requirePaddingNewlinesBeforeKeywords option requires array or true value');

        if (keywords === true) {
            keywords = defaultKeywords;
        }

        this._keywordIndex = {};
        for (var i = 0, l = keywords.length; i < l; i++) {
            this._keywordIndex[keywords[i]] = true;
        }
    },

    getOptionName: function() {
        return 'requirePaddingNewlinesBeforeKeywords';
    },

    check: function(file, errors) {
        var excludedTokens = [':', ',', '(', '='];
        var keywordIndex = this._keywordIndex;

        file.iterateTokensByType('Keyword', function(token, i, tokens) {
            if (keywordIndex[token.value]) {
                var prevToken = tokens[i - 1];

                // Handle special case of 'else if' construct.
                if (token.value === 'if' && prevToken && prevToken.value === 'else') {
                    return;
                // Handling for special cases.
                } else if (prevToken && excludedTokens.indexOf(prevToken.value) > -1) {
                    return;
                }

                // Handle all other cases
                // The { character is there to handle the case of a matching token which happens to be the first
                //   statement in a block
                // The ) character is there to handle the case of `if (...) matchingKeyword` in which case
                //   requiring padding would break the statement
                if (prevToken && prevToken.value !== '{' && prevToken.value !== ')' &&
                    token.loc.start.line - prevToken.loc.end.line < 2) {
                    errors.add(
                        'Keyword `' + token.value + '` should have an empty line above it',
                        token.loc.start.line,
                        token.loc.start.column
                    );
                }
            }
        });
    }
};

},{"../utils":111,"assert":143}],71:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requirePaddingNewlinesInBlocks) {
        assert(
            requirePaddingNewlinesInBlocks === true || typeof requirePaddingNewlinesInBlocks === 'number',
            'requirePaddingNewlinesInBlocks option requires the value true or an Integer'
        );

        this._minStatements = requirePaddingNewlinesInBlocks === true ? 0 : requirePaddingNewlinesInBlocks;
    },

    getOptionName: function() {
        return 'requirePaddingNewlinesInBlocks';
    },

    check: function(file, errors) {
        var minStatements = this._minStatements;

        file.iterateNodesByType('BlockStatement', function(node) {
            if (node.body.length <= minStatements) {
                return;
            }

            var tokens = file.getTokens();
            var openingBracketPos = file.getTokenPosByRangeStart(node.range[0]);

            var openingBracket = tokens[openingBracketPos];
            var nextToken = tokens[openingBracketPos + 1];

            if (nextToken.loc.start.line - openingBracket.loc.start.line < 2) {
                errors.add('Expected a padding newline after opening curly brace', openingBracket.loc.end);
            }

            var closingBracketPos = file.getTokenPosByRangeStart(node.range[1] - 1);
            var closingBracket = tokens[closingBracketPos];
            var prevToken = tokens[closingBracketPos - 1];

            if (closingBracket.loc.start.line - prevToken.loc.start.line < 2) {
                errors.add('Expected a padding newline before closing curly brace', prevToken.loc.end);
            }
        });
    },

    format: function(file, error) {
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        if (error.message.indexOf('after') !== -1) {
            var openingBracket = file.getTokenByRangeEnd(pos);
            var nextToken = file.getNextToken(openingBracket);
            if (nextToken.loc.start.line - openingBracket.loc.start.line === 1) {
                file.splice(nextToken.range[0], 0, '\n');
            } else {
                file.splice(nextToken.range[0], 0, '\n\n');
            }
        } else {
            while (!file.getTokenPosByRangeStart(pos)) { pos++; }
            var closingBracket = file.getTokenByRangeStart(pos);
            var prevToken = file.getPrevToken(closingBracket);
            if (closingBracket.loc.start.line - prevToken.loc.start.line === 1) {
                file.splice(pos, 0, '\n');
            } else {
                file.splice(pos, 0, '\n\n');
            }

        }
    }
};

},{"assert":143}],72:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(value) {
        assert(
            typeof value === 'boolean',
            'requirePaddingNewLinesInObjects option requires boolean value'
        );
        assert(
            value === true,
            'requirePaddingNewLinesInObjects option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requirePaddingNewLinesInObjects';
    },

    check: function(file, errors) {
        file.iterateNodesByType('ObjectExpression', function(node) {
            var tokens = file.getTokens();
            var openingBracketPos = file.getTokenPosByRangeStart(node.range[0]);

            var openingBracket = tokens[openingBracketPos];
            var nextToken = tokens[openingBracketPos + 1];

            if (nextToken.type === 'Punctuator' && nextToken.value === '}') {
                return;
            }

            if (openingBracket.loc.end.line === nextToken.loc.start.line) {
                errors.add('Missing newline after opening curly brace', nextToken.loc.start);
            }

            var closingBracketPos = file.getTokenPosByRangeStart(node.range[1] - 1);
            var closingBracket = tokens[closingBracketPos];
            var prevToken = tokens[closingBracketPos - 1];

            if (closingBracket.loc.start.line === prevToken.loc.end.line) {
                errors.add('Missing newline before closing curly brace', closingBracket.loc.start);
            }
        });
    }

};

},{"assert":143}],73:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requireParenthesesAroundIIFE) {
        assert(
            typeof requireParenthesesAroundIIFE === 'boolean',
            'requireParenthesesAroundIIFE option requires boolean value'
        );
        assert(
            requireParenthesesAroundIIFE === true,
            'requireParenthesesAroundIIFE option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireParenthesesAroundIIFE';
    },

    check: function(file, errors) {

        function isWrapped(node) {
            var tokens = file.getTokens();
            var openingToken = file.getTokenPosByRangeStart(node.range[0]);
            var closingToken = file.getTokenPosByRangeStart(node.range[1] - 1);

            return tokens[openingToken - 1].value + tokens[closingToken + 1].value === '()';
        }

        file.iterateNodesByType('CallExpression', function(node) {
            var callee = node.callee;
            var outer = node;
            var inner;

            if (callee.type === 'MemberExpression' &&
                callee.object.type === 'FunctionExpression' &&
                callee.property.type === 'Identifier' &&
                (callee.property.name === 'call' || callee.property.name === 'apply')
            ) {
                inner = callee.object;
            } else if (callee.type === 'FunctionExpression') {
                inner = callee;
            } else {
                return;
            }

            if (!isWrapped(inner) && !isWrapped(outer)) {
                errors.add(
                    'Wrap immediately invoked function expressions in parentheses',
                    node.loc.start.line,
                    node.loc.start.column
                );

            }
        });
    }

};

},{"assert":143}],74:[function(require,module,exports){
module.exports = function() {};

module.exports.prototype = {

    configure: function() {},

    getOptionName: function() {
        return 'requireRightStickedOperators';
    },

    check: function(file, errors) {
        errors.add(
            'The requireRightStickedOperators rule is no longer supported.' +
            '\nPlease use the following rules instead:' +
            '\n' +
            '\ndisallowSpaceAfterBinaryOperators' +
            '\ndisallowSpaceAfterPrefixUnaryOperators' +
            '\ndisallowSpacesInConditionalExpression',
            1,
            0
        );
    }

};

},{}],75:[function(require,module,exports){
var assert = require('assert');
var allOperators = require('../utils').binaryOperators;

module.exports = function() {};

module.exports.prototype = {

    configure: function(operators) {
        var isTrue = operators === true;

        assert(
            Array.isArray(operators) || isTrue,
            'requireSpaceAfterBinaryOperators option requires array or true value'
        );

        if (isTrue) {
            operators = allOperators;
        }

        this._operatorIndex = {};
        for (var i = 0, l = operators.length; i < l; i++) {
            this._operatorIndex[operators[i]] = true;
        }
    },

    getOptionName: function() {
        return 'requireSpaceAfterBinaryOperators';
    },

    check: function(file, errors) {
        var operators = this._operatorIndex;

        // Comma
        if (operators[',']) {
            file.iterateTokensByType('Punctuator', function(token) {
                if (token.value === ',') {
                    errors.assert.whitespaceBetween({
                        token: token,
                        nextToken: file.getNextToken(token),
                        message: 'Operator , should not stick to following expression'
                    });
                }
            });
        }

        // For everything else
        file.iterateNodesByType(
            ['BinaryExpression', 'AssignmentExpression', 'VariableDeclarator', 'LogicalExpression'],
            function(node) {
                var operator;
                var expression;

                if (node.type === 'VariableDeclarator') {
                    expression = node.init;
                    operator = '=';
                } else {
                    operator = node.operator;
                    expression = node.right;
                }

                if (expression === null) {
                    return;
                }

                var operatorToken = file.findPrevOperatorToken(
                    file.getFirstNodeToken(expression),
                    operator
                );

                var nextToken = file.getNextToken(operatorToken);

                if (operators[operator]) {
                    errors.assert.whitespaceBetween({
                        token: operatorToken,
                        nextToken: nextToken,
                        message: 'Operator ' + node.operator + ' should not stick to following expression'
                    });
                }
            }
        );
    },

    format: function(file, error) {
        var tokens = file.getTokens();
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        var operatorTokenIndex = file.getTokenPosByRangeStart(pos);
        if (!operatorTokenIndex) {
            //console.log(tokens[file.getTokenPosByRangeStart(pos - 1)].value);
            operatorTokenIndex = file.getTokenPosByRangeStart(pos - 1);
        }
        var nextToken = tokens[operatorTokenIndex];
        file.splice(nextToken.range[0], 0, ' ');
    }

};

},{"../utils":111,"assert":143}],76:[function(require,module,exports){
var assert = require('assert');
var util = require('util');
var texts = [
    'Missing space after "%s" keyword',
    'Should be one space instead of %d, after "%s" keyword'
];

var defaultKeywords = require('../utils').spacedKeywords;

module.exports = function() {};

module.exports.prototype = {

    configure: function(keywords) {
        assert(
            Array.isArray(keywords) || keywords === true,
            'requireSpaceAfterKeywords option requires array or true value');

        if (keywords === true) {
            keywords = defaultKeywords;
        }

        this._keywordIndex = {};
        for (var i = 0, l = keywords.length; i < l; i++) {
            this._keywordIndex[keywords[i]] = true;
        }
    },

    getOptionName: function() {
        return 'requireSpaceAfterKeywords';
    },

    check: function(file, errors) {
        var keywordIndex = this._keywordIndex;

        function getCommentIfExists(start, end) {
            return file.getComments().filter(function(comment) {
                return start <= comment.range[0] && end >= comment.range[1];
            })[0];
        }

        file.iterateTokensByType(['Keyword'], function(token, i, tokens) {
            if (keywordIndex[token.value]) {
                var nextToken = tokens[i + 1];
                var comment = getCommentIfExists(token.range[1], nextToken.range[0]);
                nextToken = comment || nextToken;

                var diff = nextToken.range[0] - token.range[1];

                if (nextToken &&
                    nextToken.loc.end.line === token.loc.start.line &&
                    diff !== 1
                ) {
                    if (nextToken.type !== 'Punctuator' || nextToken.value !== ';') {
                        errors.add(
                            util.format.apply(null,
                                diff === 0 ?
                                    [texts[0], token.value] :
                                    [texts[1], diff, token.value]
                            ),
                            nextToken.loc.start.line,
                            nextToken.loc.start.column
                        );
                    }
                }
            }
        });
    },

    format: function(file, error) {
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        var source = file.getSource();
        var count = 0;
        while (source[pos - count - 1 ] === ' ') {
            count++;
        }
        file.splice(pos - count, count, ' ');
    }

};

},{"../utils":111,"assert":143,"util":149}],77:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requireSpaceAfterLineComment) {
        assert(
            requireSpaceAfterLineComment === true ||
            requireSpaceAfterLineComment === 'allowSlash' ||
            typeof requireSpaceAfterLineComment === 'object',
            'requireSpaceAfterLineComment option requires the value `true` ' +
            'or an object with String[] `allExcept` property'
        );

        // verify first item in `allExcept` property in object (if it's an object)
        assert(
            typeof requireSpaceAfterLineComment !== 'object' ||
            Array.isArray(requireSpaceAfterLineComment.allExcept) &&
            typeof requireSpaceAfterLineComment.allExcept[0] === 'string',
            'Property `allExcept` in requireSpaceAfterLineComment should be an array of strings'
        );

        // don't check triple slashed comments, microsoft js doc convention. see #593
        // exceptions. see #592
        // need to drop allowSlash support in 2.0. Fixes #697
        this._allExcept = requireSpaceAfterLineComment === 'allowSlash' ? ['/'] :
            requireSpaceAfterLineComment.allExcept || [];
    },

    getOptionName: function() {
        return 'requireSpaceAfterLineComment';
    },

    check: function(file, errors) {
        var comments = file.getComments();
        var allExcept = this._allExcept;

        comments.forEach(function(comment) {
            if (comment.type === 'Line') {
                var value = comment.value;

                // cutout exceptions
                allExcept.forEach(function(el) {
                    if (value.indexOf(el) === 0) {
                        value = value.substr(el.length);
                    }
                });

                if (value.length === 0) {
                    return;
                }

                if (value[0] !== ' ') {
                    errors.add('Missing space after line comment', comment.loc.start);
                }
            }
        });
    }
};

},{"assert":143}],78:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requireSpaceAfterObjectKeys) {
        assert(
            typeof requireSpaceAfterObjectKeys === 'boolean',
            this.getOptionName() + ' option requires boolean value'
        );
        assert(
            requireSpaceAfterObjectKeys === true,
            this.getOptionName() + ' option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireSpaceAfterObjectKeys';
    },

    check: function(file, errors) {
        var tokens = file.getTokens();
        file.iterateNodesByType('ObjectExpression', function(node) {
            node.properties.forEach(function(property) {
                var key = property.key;
                var keyPos = file.getTokenPosByRangeStart(key.range[0]);
                var colon = tokens[keyPos + 1];
                if (colon.range[0] === key.range[1]) {
                    errors.add('Missing space after key', key.loc.end);
                }
            });
        });
    }

};

},{"assert":143}],79:[function(require,module,exports){
var assert = require('assert');
var defaultOperators = require('../utils').unaryOperators;

module.exports = function() {};

module.exports.prototype = {

    configure: function(operators) {
        var isTrue = operators === true;

        assert(
            Array.isArray(operators) || isTrue,
            this.getOptionName() + ' option requires array or true value'
        );

        if (isTrue) {
            operators = defaultOperators;
        }

        this._operatorIndex = {};
        for (var i = 0, l = operators.length; i < l; i++) {
            this._operatorIndex[operators[i]] = true;
        }
    },

    getOptionName: function() {
        return 'requireSpaceAfterPrefixUnaryOperators';
    },

    check: function(file, errors) {
        var operatorIndex = this._operatorIndex;
        var tokens = file.getTokens();

        file.iterateNodesByType(['UnaryExpression', 'UpdateExpression'], function(node) {
            // Check "node.prefix" for prefix type of (inc|dec)rement
            if (node.prefix && operatorIndex[node.operator]) {
                var argument = node.argument.type;
                var operatorTokenIndex = file.getTokenPosByRangeStart(node.range[0]);
                var operatorToken = tokens[operatorTokenIndex];
                var nextToken = tokens[operatorTokenIndex + 1];

                // Do not report consecutive operators (#405)
                if (
                    argument === 'UnaryExpression' || argument === 'UpdateExpression' &&
                    nextToken.value !== '('
                ) {
                    return;
                }

                if (operatorToken.range[1] === nextToken.range[0]) {
                    errors.add('Operator ' + node.operator + ' should not stick to operand', node.loc.start);
                }
            }
        });
    },

    format: function(file, error) {
        var tokens = file.getTokens();
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        var operatorTokenIndex = file.getTokenPosByRangeStart(pos);
        var nextToken = tokens[operatorTokenIndex + 1];
        file.splice(nextToken.range[0], 0, ' ');
    }

};

},{"../utils":111,"assert":143}],80:[function(require,module,exports){
var assert = require('assert');
var allOperators = require('../../lib/utils').binaryOperators.filter(function(operator) {
    return operator !== ',';
});

module.exports = function() {};

module.exports.prototype = {

    configure: function(operators) {
        var isTrue = operators === true;

        assert(
            Array.isArray(operators) || isTrue,
            'requireSpaceBeforeBinaryOperators option requires array or true value'
        );

        if (isTrue) {
            operators = allOperators;
        }

        this._operatorIndex = {};
        for (var i = 0, l = operators.length; i < l; i++) {
            this._operatorIndex[operators[i]] = true;
        }
    },

    getOptionName: function() {
        return 'requireSpaceBeforeBinaryOperators';
    },

    check: function(file, errors) {
        var operators = this._operatorIndex;

        // Comma
        if (operators[',']) {
            file.iterateTokensByType('Punctuator', function(token) {
                if (token.value === ',') {
                    errors.assert.whitespaceBetween({
                        token: file.getPrevToken(token),
                        nextToken: token,
                        message: 'Operator , should not stick to preceding expression'
                    });
                }
            });
        }

        // For everything else
        file.iterateNodesByType(
            ['BinaryExpression', 'AssignmentExpression', 'VariableDeclarator', 'LogicalExpression'],
            function(node) {
                var operator;
                var expression;

                if (node.type === 'VariableDeclarator') {
                    expression = node.init;
                    operator = '=';
                } else {
                    operator = node.operator;
                    expression = node.right;
                }

                if (expression === null) {
                    return;
                }

                var operatorToken = file.findPrevOperatorToken(
                    file.getFirstNodeToken(expression),
                    operator
                );

                var prevToken = file.getPrevToken(operatorToken);

                if (operators[operator]) {
                    errors.assert.whitespaceBetween({
                        token: prevToken,
                        nextToken: operatorToken,
                        message: 'Operator ' + node.operator + ' should not stick to preceding expression'
                    });
                }
            }
        );
    },

    format: function(file, error) {
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        var operatorTokenIndex = file.getTokenPosByRangeStart(pos);
        if (!operatorTokenIndex) {
            pos--;
        }
        file.splice(pos, 0, ' ');
    }

};

},{"../../lib/utils":111,"assert":143}],81:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(requireSpaceBeforeBlockStatements) {
        assert(
            typeof requireSpaceBeforeBlockStatements === 'boolean',
            'requireSpaceBeforeBlockStatements option requires boolean value'
        );
        assert(
            requireSpaceBeforeBlockStatements === true,
            'requireSpaceBeforeBlockStatements option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireSpaceBeforeBlockStatements';
    },

    check: function(file, errors) {
        var tokens = file.getTokens();

        file.iterateNodesByType('BlockStatement', function(node) {
            var tokenBeforeBodyPos = file.getTokenPosByRangeStart(node.range[0] - 1);
            var tokenBeforeBody = tokens[tokenBeforeBodyPos];
            if (tokenBeforeBody) {
                errors.add(
                    'Missing space before opening curly brace for block expressions',
                    tokenBeforeBody.loc.start
                );
            }
        });
    },

    format: function(file, error) {
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        file.splice(pos + 1, 0, ' ');
    }

};

},{"assert":143}],82:[function(require,module,exports){
var assert = require('assert');
var util = require('util');
var texts = [
    'Missing space before "%s" keyword',
    'Should be one space instead of %d, before "%s" keyword'
];

var defaultKeywords = require('../utils').spacedKeywords;

module.exports = function() {};

module.exports.prototype = {

    configure: function(keywords) {
        assert(
            Array.isArray(keywords) || keywords === true,
            'requireSpaceAfterKeywords option requires array or true value');

        if (keywords === true) {
            keywords = defaultKeywords;
        }

        this._keywordIndex = {};
        for (var i = 0, l = keywords.length; i < l; i++) {
            this._keywordIndex[keywords[i]] = true;
        }
    },

    getOptionName: function() {
        return 'requireSpaceBeforeKeywords';
    },

    check: function(file, errors) {
        var keywordIndex = this._keywordIndex;

        function getCommentIfExists(start, end) {
            return file.getComments().filter(function(comment) {
                return start <= comment.range[0] && end >= comment.range[1];
            })[0];
        }

        file.iterateTokensByType(['Keyword'], function(token, i, tokens) {
            if (keywordIndex[token.value]) {
                var prevToken = tokens[i - 1];
                if (!prevToken) {
                    return;
                }

                var comment = getCommentIfExists(prevToken.range[1], token.range[0]);
                prevToken = comment || prevToken;

                var diff = token.range[0] - prevToken.range[1];

                if (prevToken.loc.end.line === token.loc.start.line && diff !== 1) {
                    if (prevToken.type !== 'Punctuator' || prevToken.value !== ';') {
                        errors.add(
                            util.format.apply(null,
                                diff === 0 ?
                                    [texts[0], token.value] :
                                    [texts[1], diff, token.value]
                            ),
                            token.loc.start.line,
                            token.loc.start.column
                        );
                    }
                }
            }
        });
    }

};

},{"../utils":111,"assert":143,"util":149}],83:[function(require,module,exports){
var assert = require('assert');
var tokenHelper = require('../token-helper');

module.exports = function() {};

module.exports.prototype = {

    configure: function(disallow) {
        assert(
            typeof disallow === 'boolean',
            this.getOptionName() + ' option requires boolean value'
        );
        assert(
            disallow === true,
            this.getOptionName() + ' option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireSpaceBeforeObjectValues';
    },

    check: function(file, errors) {
        var tokens = file.getTokens();
        file.iterateNodesByType('ObjectExpression', function(node) {
            node.properties.forEach(function(property) {
                var value = property.value;
                var valuePos = file.getTokenPosByRangeStart(value.range[0]);
                var colon = tokens[valuePos - 1];
                if (tokenHelper.isTokenParenthesis(file, colon.range[0], true)) {
                    colon = file.getPrevToken(colon);
                }
                if (colon.range[1] === value.range[0]) {
                    errors.add('Missing space after key colon', colon.loc.end);
                }
            });
        });
    },
    format: function(file, error) {
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        file.splice(pos, 0, ' ');
    }

};

},{"../token-helper":109,"assert":143}],84:[function(require,module,exports){
var assert = require('assert');
var defaultOperators = require('../utils').incrementAndDecrementOperators;

module.exports = function() {};

module.exports.prototype = {

    configure: function(operators) {
        var isTrue = operators === true;

        assert(
            Array.isArray(operators) || isTrue,
            this.getOptionName() + ' option requires array or true value'
        );

        if (isTrue) {
            operators = defaultOperators;
        }

        this._operatorIndex = {};
        for (var i = 0, l = operators.length; i < l; i++) {
            this._operatorIndex[operators[i]] = true;
        }
    },

    getOptionName: function() {
        return 'requireSpaceBeforePostfixUnaryOperators';
    },

    check: function(file, errors) {
        var operatorIndex = this._operatorIndex;
        var tokens = file.getTokens();

        // 'UpdateExpression' involve only ++ and -- operators
        file.iterateNodesByType('UpdateExpression', function(node) {
            // "!node.prefix" means postfix type of (inc|dec)rement
            if (!node.prefix && operatorIndex[node.operator]) {
                var operatorStartPos = node.range[1] - node.operator.length;
                var operatorTokenIndex = file.getTokenPosByRangeStart(operatorStartPos);
                var operatorToken = tokens[operatorTokenIndex];
                var prevToken = tokens[operatorTokenIndex - 1];
                if (operatorToken.range[0] === prevToken.range[1]) {
                    errors.add('Operator ' + node.operator + ' should not stick to operand', node.loc.start);
                }
            }
        });
    },

    format: function(file, error) {
        var node = file.getNodeByRange(file.getPosByLineAndColumn(error.line, error.column) + 1);
        while (node.type !== 'UpdateExpression') {node = node.parentNode;}
        file.splice(node.range[1] - node.operator.length, 0, ' ');
    }
};

},{"../utils":111,"assert":143}],85:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requireSpaceBetweenArguments) {
        assert(
            typeof requireSpaceBetweenArguments === 'boolean',
            this.getOptionName() + ' option requires boolean value'
        );
        assert(
            requireSpaceBetweenArguments === true,
            this.getOptionName() + ' option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireSpaceBetweenArguments';
    },

    check: function(file, errors) {

        var tokens = file.getTokens();

        file.iterateNodesByType(['CallExpression'], function(node) {

            node.arguments.forEach(function(param, i) {

                var paramTokenPos = file.getTokenPosByRangeStart(param.range[0]);
                var punctuatorToken = tokens[paramTokenPos + 1];
                var argumentIndex = i + 1;

                if (punctuatorToken.value === ',') {

                    var nextParamToken = tokens[paramTokenPos + 2];

                    if (punctuatorToken.range[1] === nextParamToken.range[0]) {
                        errors.add(
                            'Missing space before argument ' + argumentIndex,
                            nextParamToken.loc.start
                        );
                    }
                }
            });
        });
    }

};

},{"assert":143}],86:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(options) {
        assert(
            typeof options === 'object',
            'requireSpacesInAnonymousFunctionExpression option must be the object'
        );

        if ('beforeOpeningRoundBrace' in options) {
            assert(
                options.beforeOpeningRoundBrace === true,
                'requireSpacesInAnonymousFunctionExpression.beforeOpeningRoundBrace ' +
                'property requires true value or should be removed'
            );
        }

        if ('beforeOpeningCurlyBrace' in options) {
            assert(
                options.beforeOpeningCurlyBrace === true,
                'requireSpacesInAnonymousFunctionExpression.beforeOpeningCurlyBrace ' +
                'property requires true value or should be removed'
            );
        }

        assert(
            options.beforeOpeningCurlyBrace || options.beforeOpeningRoundBrace,
            'requireSpacesInAnonymousFunctionExpression must have beforeOpeningCurlyBrace ' +
            ' or beforeOpeningRoundBrace property'
        );

        this._beforeOpeningRoundBrace = Boolean(options.beforeOpeningRoundBrace);
        this._beforeOpeningCurlyBrace = Boolean(options.beforeOpeningCurlyBrace);
    },

    getOptionName: function() {
        return 'requireSpacesInAnonymousFunctionExpression';
    },

    check: function(file, errors) {
        var beforeOpeningRoundBrace = this._beforeOpeningRoundBrace;
        var beforeOpeningCurlyBrace = this._beforeOpeningCurlyBrace;
        var tokens = file.getTokens();

        file.iterateNodesByType(['FunctionExpression'], function(node) {
            var parent = node.parentNode;

            // Ignore syntactic sugar for getters and setters.
            if (parent.type === 'Property' && (parent.kind === 'get' || parent.kind === 'set')) {
                return;
            }

            if (!node.id) {

                if (beforeOpeningRoundBrace) {
                    var nodeBeforeRoundBrace = node;

                    var functionTokenPos = file.getTokenPosByRangeStart(nodeBeforeRoundBrace.range[0]);
                    var functionToken = tokens[functionTokenPos];

                    var nextTokenPos = file.getTokenPosByRangeStart(functionToken.range[1]);
                    var nextToken = tokens[nextTokenPos];

                    if (nextToken) {
                        errors.add(
                            'Missing space before opening round brace',
                            nextToken.loc.start
                        );
                    }
                }

                if (beforeOpeningCurlyBrace) {
                    var tokenBeforeBodyPos = file.getTokenPosByRangeStart(node.body.range[0] - 1);
                    var tokenBeforeBody = tokens[tokenBeforeBodyPos];

                    if (tokenBeforeBody) {
                        errors.add(
                            'Missing space before opening curly brace',
                            tokenBeforeBody.loc.start
                        );
                    }
                }
            }
        });
    }

};

},{"assert":143}],87:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(requireSpacesInCallExpression) {
        assert(
            requireSpacesInCallExpression === true,
            'requireSpacesInCallExpression option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireSpacesInCallExpression';
    },

    check: function(file, errors) {
        var tokens = file.getTokens();

        file.iterateNodesByType('CallExpression', function(node) {
            var nodeBeforeRoundBrace = node;
            if (node.callee) {
                nodeBeforeRoundBrace = node.callee;
            }

            var roundBraceToken = file.getTokenByRangeStart(nodeBeforeRoundBrace.range[0]);
            do {
                roundBraceToken = file.findNextToken(roundBraceToken, 'Punctuator', '(');
            } while (roundBraceToken.range[0] < nodeBeforeRoundBrace.range[1]);

            var functionEndToken = file.getPrevToken(roundBraceToken);

            if (roundBraceToken.value === '(' && functionEndToken.range[1] === roundBraceToken.range[0]) {
                errors.add(
                    'Missing space before opening round brace',
                    roundBraceToken.loc.start
                );
            }
        });
    }
};

},{"assert":143}],88:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(requireSpacesInComputedMemberExpression) {
        assert(
            requireSpacesInComputedMemberExpression === true,
            'requireSpacesInComputedMemberExpression option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireSpacesInComputedMemberExpression';
    },

    check: function(file, errors) {
        file.iterateNodesByType('MemberExpression', function(node) {
            if (node.computed) {
                var testToken = file.getTokenByRangeStart(node.property.range[0]);
                var prevToken = file.getPrevToken(testToken);
                if (prevToken.value === '[' && prevToken.range[1] === testToken.range[0]) {
                    errors.add(
                        'Missing space after opening square bracket',
                        testToken.loc.start
                    );
                }
                testToken = file.getTokenByRangeEnd(node.property.range[1]);
                var nextToken = file.getNextToken(testToken);
                if (nextToken.value === ']' && nextToken.range[0] === testToken.range[1]) {
                    errors.add(
                        'Missing space before opening square bracket',
                        testToken.loc.end
                    );
                }
            }
        });
    },
    format: function(file, error) {
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        file.splice(pos, 0, ' ');
    }
};

},{"assert":143}],89:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(options) {
        var validProperties = [
            'afterTest',
            'beforeConsequent',
            'afterConsequent',
            'beforeAlternate'
        ];
        var optionName = this.getOptionName();

        if (options === true) {
            options = {
                'afterTest': true,
                'beforeConsequent': true,
                'afterConsequent': true,
                'beforeAlternate': true
            };
        }

        assert(
            typeof options === 'object',
            optionName + ' option must be an object or boolean true'
        );

        var isProperlyConfigured = validProperties.some(function(key) {
            var isPresent = key in options;

            if (isPresent) {
                assert(
                    options[key] === true,
                    optionName + '.' + key + ' property requires true value or should be removed'
                );
            }

            return isPresent;
        });

        assert(
            isProperlyConfigured,
            optionName + ' must have at least 1 of the following properties: ' + validProperties.join(', ')
        );

        validProperties.forEach(function(property) {
            this['_' + property] = Boolean(options[property]);
        }.bind(this));
    },

    getOptionName: function() {
        return 'requireSpacesInConditionalExpression';
    },

    check: function(file, errors) {
        var tokens = file.getTokens();

        file.iterateNodesByType(['ConditionalExpression'], function(node) {
            var test = node.test;
            var consequent = node.consequent;
            var alternate = node.alternate;
            var consequentToken = file.getFirstNodeToken(consequent);
            var alternateToken = file.getFirstNodeToken(alternate);
            var questionMarkToken = file.findPrevOperatorToken(consequentToken, '?');
            var colonToken = file.findPrevOperatorToken(alternateToken, ':');
            var token;

            if (this._afterTest) {
                token = file.getPrevToken(questionMarkToken);
                if (token.loc.end.column === questionMarkToken.loc.start.column) {
                    errors.add(
                        'Missing space after test',
                        test.loc.end
                    );
                }
            }

            if (this._beforeConsequent) {
                token = file.getNextToken(questionMarkToken);
                if (token.loc.start.column === questionMarkToken.loc.end.column) {
                    errors.add(
                        'Missing space before consequent',
                        consequent.loc.start
                    );
                }
            }

            if (this._afterConsequent) {
                token = file.getPrevToken(colonToken);
                if (token.loc.end.column === colonToken.loc.start.column) {
                    errors.add(
                        'Missing space after consequent',
                        consequent.loc.end
                    );
                }
            }

            if (this._beforeAlternate) {
                token = file.getNextToken(colonToken);
                if (token.loc.start.column === colonToken.loc.end.column) {
                    errors.add(
                        'Missing space before alternate',
                        alternate.loc.start
                    );
                }
            }
        }.bind(this));
    },

    format: function(file, error) {
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        var source = file.getSource();
        while (source[pos] === ')') {
            pos++;
        }
        file.splice(pos, 0, ' ');
    }

};

},{"assert":143}],90:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(requireSpacesInForStatement) {
        assert(
            requireSpacesInForStatement === true,
            'requireSpacesInForStatement option requires true value or should be removed'
        );
    },

    getOptionName: function() {
        return 'requireSpacesInForStatement';
    },

    check: function(file, errors) {
        file.iterateNodesByType('ForStatement', function(node) {
            if (node.test) {
                var testToken = file.getTokenByRangeStart(node.test.range[0]);
                var prevToken1 = file.getPrevToken(testToken);
                if (prevToken1.value === ';' && prevToken1.range[1] === testToken.range[0]) {
                    errors.add(
                        'Missing space after semicolon',
                        testToken.loc.start
                    );
                }
            }
            if (node.update) {
                var updateToken = file.getTokenByRangeStart(node.update.range[0]);
                var prevToken2 = file.getPrevToken(updateToken);
                if (prevToken2.value === ';' && prevToken2.range[1] === updateToken.range[0]) {
                    errors.add(
                        'Missing space after semicolon',
                        updateToken.loc.start
                    );
                }
            }
        });
    },
    format: function(file, error) {
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        file.splice(pos, 0, ' ');
    }
};

},{"assert":143}],91:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(options) {
        assert(
            typeof options === 'object',
            'requireSpacesInFunctionDeclaration option must be the object'
        );

        if ('beforeOpeningRoundBrace' in options) {
            assert(
                options.beforeOpeningRoundBrace === true,
                'requireSpacesInFunctionDeclaration.beforeOpeningRoundBrace ' +
                'property requires true value or should be removed'
            );
        }

        if ('beforeOpeningCurlyBrace' in options) {
            assert(
                options.beforeOpeningCurlyBrace === true,
                'requireSpacesInFunctionDeclaration.beforeOpeningCurlyBrace ' +
                'property requires true value or should be removed'
            );
        }

        assert(
            options.beforeOpeningCurlyBrace || options.beforeOpeningRoundBrace,
            'requireSpacesInFunctionDeclaration must have beforeOpeningCurlyBrace or beforeOpeningRoundBrace property'
        );

        this._beforeOpeningRoundBrace = Boolean(options.beforeOpeningRoundBrace);
        this._beforeOpeningCurlyBrace = Boolean(options.beforeOpeningCurlyBrace);
    },

    getOptionName: function() {
        return 'requireSpacesInFunctionDeclaration';
    },

    check: function(file, errors) {
        var beforeOpeningRoundBrace = this._beforeOpeningRoundBrace;
        var beforeOpeningCurlyBrace = this._beforeOpeningCurlyBrace;
        var tokens = file.getTokens();

        file.iterateNodesByType(['FunctionDeclaration'], function(node) {

            if (beforeOpeningRoundBrace) {
                var nodeBeforeRoundBrace = node;
                // named function
                if (node.id) {
                    nodeBeforeRoundBrace = node.id;
                }

                var functionTokenPos = file.getTokenPosByRangeStart(nodeBeforeRoundBrace.range[0]);
                var functionToken = tokens[functionTokenPos];

                var nextTokenPos = file.getTokenPosByRangeStart(functionToken.range[1]);
                var nextToken = tokens[nextTokenPos];

                if (nextToken) {
                    errors.add(
                        'Missing space before opening round brace',
                        nextToken.loc.start
                    );
                }
            }

            if (beforeOpeningCurlyBrace) {
                var tokenBeforeBodyPos = file.getTokenPosByRangeStart(node.body.range[0] - 1);
                var tokenBeforeBody = tokens[tokenBeforeBodyPos];

                if (tokenBeforeBody) {
                    errors.add(
                        'Missing space before opening curly brace',
                        tokenBeforeBody.loc.start
                    );
                }
            }
        });
    }

};

},{"assert":143}],92:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(options) {
        assert(
            typeof options === 'object',
            'requireSpacesInFunctionExpression option must be the object'
        );

        if ('beforeOpeningRoundBrace' in options) {
            assert(
                options.beforeOpeningRoundBrace === true,
                'requireSpacesInFunctionExpression.beforeOpeningRoundBrace ' +
                'property requires true value or should be removed'
            );
        }

        if ('beforeOpeningCurlyBrace' in options) {
            assert(
                options.beforeOpeningCurlyBrace === true,
                'requireSpacesInFunctionExpression.beforeOpeningCurlyBrace ' +
                'property requires true value or should be removed'
            );
        }

        assert(
            options.beforeOpeningCurlyBrace || options.beforeOpeningRoundBrace,
            'requireSpacesInFunctionExpression must have beforeOpeningCurlyBrace or beforeOpeningRoundBrace property'
        );

        this._beforeOpeningRoundBrace = Boolean(options.beforeOpeningRoundBrace);
        this._beforeOpeningCurlyBrace = Boolean(options.beforeOpeningCurlyBrace);
    },

    getOptionName: function() {
        return 'requireSpacesInFunctionExpression';
    },

    check: function(file, errors) {
        var beforeOpeningRoundBrace = this._beforeOpeningRoundBrace;
        var beforeOpeningCurlyBrace = this._beforeOpeningCurlyBrace;
        var tokens = file.getTokens();

        file.iterateNodesByType('FunctionExpression', function(node) {
            var parent = node.parentNode;

            // Ignore syntactic sugar for getters and setters.
            if (parent.type === 'Property' && (parent.kind === 'get' || parent.kind === 'set')) {
                return;
            }

            if (beforeOpeningRoundBrace) {
                var nodeBeforeRoundBrace = node;
                // named function
                if (node.id) {
                    nodeBeforeRoundBrace = node.id;
                }

                var functionTokenPos = file.getTokenPosByRangeStart(nodeBeforeRoundBrace.range[0]);
                var functionToken = tokens[functionTokenPos];

                var nextTokenPos = file.getTokenPosByRangeStart(functionToken.range[1]);
                var nextToken = tokens[nextTokenPos];

                if (nextToken) {
                    errors.add(
                        'Missing space before opening round brace',
                        nextToken.loc.start
                    );
                }
            }

            if (beforeOpeningCurlyBrace) {
                var tokenBeforeBodyPos = file.getTokenPosByRangeStart(node.body.range[0] - 1);
                var tokenBeforeBody = tokens[tokenBeforeBodyPos];

                if (tokenBeforeBody) {
                    errors.add(
                        'Missing space before opening curly brace',
                        tokenBeforeBody.loc.start
                    );
                }
            }
        });
    },

    format: function(file, error) {
        // This works for beforeOpeningCurlyBrace but does it work for beforeOpeningRoundBrace??
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        file.splice(pos + 1, 0, ' ');
    }

};

},{"assert":143}],93:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(options) {
        assert(
            typeof options === 'object',
            'requireSpacesInFunction option must be the object'
        );

        if ('beforeOpeningRoundBrace' in options) {
            assert(
                options.beforeOpeningRoundBrace === true,
                'requireSpacesInFunction.beforeOpeningRoundBrace ' +
                'property requires true value or should be removed'
            );
        }

        if ('beforeOpeningCurlyBrace' in options) {
            assert(
                options.beforeOpeningCurlyBrace === true,
                'requireSpacesInFunction.beforeOpeningCurlyBrace ' +
                'property requires true value or should be removed'
            );
        }

        assert(
            options.beforeOpeningCurlyBrace || options.beforeOpeningRoundBrace,
            'requireSpacesInFunction must have beforeOpeningCurlyBrace or beforeOpeningRoundBrace property'
        );

        this._beforeOpeningRoundBrace = Boolean(options.beforeOpeningRoundBrace);
        this._beforeOpeningCurlyBrace = Boolean(options.beforeOpeningCurlyBrace);
    },

    getOptionName: function() {
        return 'requireSpacesInFunction';
    },

    check: function(file, errors) {
        var beforeOpeningRoundBrace = this._beforeOpeningRoundBrace;
        var beforeOpeningCurlyBrace = this._beforeOpeningCurlyBrace;
        var tokens = file.getTokens();

        file.iterateNodesByType(['FunctionDeclaration', 'FunctionExpression'], function(node) {
            var parent = node.parentNode;

            // Ignore syntactic sugar for getters and setters.
            if (parent.type === 'Property' && (parent.kind === 'get' || parent.kind === 'set')) {
                return;
            }

            if (beforeOpeningRoundBrace) {
                var nodeBeforeRoundBrace = node;
                // named function
                if (node.id) {
                    nodeBeforeRoundBrace = node.id;
                }

                var functionTokenPos = file.getTokenPosByRangeStart(nodeBeforeRoundBrace.range[0]);
                var functionToken = tokens[functionTokenPos];

                var nextTokenPos = file.getTokenPosByRangeStart(functionToken.range[1]);
                var nextToken = tokens[nextTokenPos];

                if (nextToken) {
                    errors.add(
                        'Missing space before opening round brace',
                        nextToken.loc.start
                    );
                }
            }

            if (beforeOpeningCurlyBrace) {
                var tokenBeforeBodyPos = file.getTokenPosByRangeStart(node.body.range[0] - 1);
                var tokenBeforeBody = tokens[tokenBeforeBodyPos];

                if (tokenBeforeBody) {
                    errors.add(
                        'Missing space before opening curly brace',
                        tokenBeforeBody.loc.start
                    );
                }
            }
        });
    }

};

},{"assert":143}],94:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(options) {
        assert(
            typeof options === 'object',
            'requireSpacesInNamedFunctionExpression option must be the object'
        );

        if ('beforeOpeningRoundBrace' in options) {
            assert(
                options.beforeOpeningRoundBrace === true,
                'requireSpacesInNamedFunctionExpression.beforeOpeningRoundBrace ' +
                'property requires true value or should be removed'
            );
        }

        if ('beforeOpeningCurlyBrace' in options) {
            assert(
                options.beforeOpeningCurlyBrace === true,
                'requireSpacesInNamedFunctionExpression.beforeOpeningCurlyBrace ' +
                'property requires true value or should be removed'
            );
        }

        assert(
            options.beforeOpeningCurlyBrace || options.beforeOpeningRoundBrace,
            'requireSpacesInNamedFunctionExpression must have beforeOpeningCurlyBrace ' +
            'or beforeOpeningRoundBrace property'
        );

        this._beforeOpeningRoundBrace = Boolean(options.beforeOpeningRoundBrace);
        this._beforeOpeningCurlyBrace = Boolean(options.beforeOpeningCurlyBrace);
    },

    getOptionName: function() {
        return 'requireSpacesInNamedFunctionExpression';
    },

    check: function(file, errors) {
        var beforeOpeningRoundBrace = this._beforeOpeningRoundBrace;
        var beforeOpeningCurlyBrace = this._beforeOpeningCurlyBrace;
        var tokens = file.getTokens();

        file.iterateNodesByType(['FunctionExpression'], function(node) {

            if (node.id) {

                if (beforeOpeningRoundBrace) {
                    var nodeBeforeRoundBrace = node.id;

                    var functionTokenPos = file.getTokenPosByRangeStart(nodeBeforeRoundBrace.range[0]);
                    var functionToken = tokens[functionTokenPos];

                    var nextTokenPos = file.getTokenPosByRangeStart(functionToken.range[1]);
                    var nextToken = tokens[nextTokenPos];

                    if (nextToken) {
                        errors.add(
                            'Missing space before opening round brace',
                            nextToken.loc.start
                        );
                    }
                }

                if (beforeOpeningCurlyBrace) {
                    var tokenBeforeBodyPos = file.getTokenPosByRangeStart(node.body.range[0] - 1);
                    var tokenBeforeBody = tokens[tokenBeforeBodyPos];

                    if (tokenBeforeBody) {
                        errors.add(
                            'Missing space before opening curly brace',
                            tokenBeforeBody.loc.start
                        );
                    }
                }
            }
        });
    }

};

},{"assert":143}],95:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(mode) {
        var modes = {
            'all': true,
            'allButNested': true
        };
        assert(
            typeof mode === 'string' &&
            modes[mode],
            'requireSpacesInsideArrayBrackets option requires string value \'all\' or \'allButNested\''
        );
        this._mode = mode;
    },

    getOptionName: function() {
        return 'requireSpacesInsideArrayBrackets';
    },

    check: function(file, errors) {
        var mode = this._mode;
        file.iterateNodesByType('ArrayExpression', function(node) {
            var tokens = file.getTokens();
            var openingBracketPos = file.getTokenPosByRangeStart(node.range[0]);

            var openingBracket = tokens[openingBracketPos];
            var nextToken = tokens[openingBracketPos + 1];

            if (nextToken.type === 'Punctuator' && nextToken.value === ']') {
                return;
            }

            if (mode === 'allButNested' && nextToken.type === 'Punctuator' && nextToken.value === '[') {
                return;
            }

            if (openingBracket.range[1] === nextToken.range[0]) {
                errors.add('Missing space after opening square bracket', nextToken.loc.start);
            }

            var closingBracketPos = file.getTokenPosByRangeStart(node.range[1] - 1);
            var closingBracket = tokens[closingBracketPos];
            var prevToken = tokens[closingBracketPos - 1];

            if (closingBracket.range[0] === prevToken.range[1]) {
                if (!(mode === 'allButNested' &&
                    prevToken.type === 'Punctuator' &&
                    prevToken.value === ']'
                )) {
                    errors.add('Missing space before closing square bracket', closingBracket.loc.start);
                }
            }
        });
    },

    format: function(file, error) {
        var source = file.getSource();
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        if (source[pos] === ']') {
            file.splice(pos, 0, ' ');
        } else if (source[pos - 1] === '[') {
            file.splice(pos, 0, ' ');
        }
    }

};

},{"assert":143}],96:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(mode) {
        var modes = {
            'all': true,
            'allButNested': true
        };
        assert(
            typeof mode === 'string' &&
            modes[mode],
            'requireSpacesInsideObjectBrackets option requires string value \'all\' or \'allButNested\''
        );
        this._mode = mode;
    },

    getOptionName: function() {
        return 'requireSpacesInsideObjectBrackets';
    },

    check: function(file, errors) {
        var mode = this._mode;
        file.iterateNodesByType('ObjectExpression', function(node) {
            var tokens = file.getTokens();
            var openingBracketPos = file.getTokenPosByRangeStart(node.range[0]);

            var openingBracket = tokens[openingBracketPos];
            var nextToken = tokens[openingBracketPos + 1];

            if (nextToken.type === 'Punctuator' && nextToken.value === '}') {
                return;
            }

            if (openingBracket.range[1] === nextToken.range[0]) {
                errors.add('Missing space after opening curly brace', nextToken.loc.start);
            }

            var closingBracketPos = file.getTokenPosByRangeStart(node.range[1] - 1);
            var closingBracket = tokens[closingBracketPos];
            var prevToken = tokens[closingBracketPos - 1];
            var isNested = mode === 'allButNested' &&
                           prevToken.type === 'Punctuator' &&
                           prevToken.value === '}';

            if (closingBracket.range[0] === prevToken.range[1] && !isNested) {
                errors.add('Missing space before closing curly brace', closingBracket.loc.start);
            }
        });
    },

    format: function(file, error) {
        var source = file.getSource();
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        if (source[pos] === '}') {
            file.splice(pos, 0, ' ');
        } else if (source[pos - 1] === '{') {
            file.splice(pos, 0, ' ');
        }
    }

};

},{"assert":143}],97:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(value) {
        var mode;
        var modes = {
            'all': true,
            'allButNested': true
        };
        var isObject = typeof value === 'object';

        var error = 'requireSpacesInsideParentheses rule' +
        ' requires string value \'all\' or \'allButNested\' or object';

        if (typeof value === 'string') {
            assert(modes[value], error);

        } else if (isObject) {
            assert(
                'all' in value || 'allButNested' in value,
                error
            );
        } else {
            assert(false, error);
        }

        this._exceptions = {};

        if (isObject) {
            mode = 'all' in value ? 'all' : 'allButNested';

            (value.except || []).forEach(function(value) {
                this._exceptions[value] = true;
            }, this);

        } else {
            mode = value;
        }

        if (mode === 'allButNested') {
            this._exceptions[')'] = this._exceptions['('] = true;
        }
    },

    getOptionName: function() {
        return 'requireSpacesInsideParentheses';
    },

    check: function(file, errors) {
        var exceptions = this._exceptions;

        function isComment(position) {
            return file.getComments().some(function(comment) {
                return position >= comment.range[0] && position < comment.range[1];
            });
        }

        file.iterateTokenByValue('(', function(token, index, tokens) {
            var nextToken = file.getNextToken(token);
            var value = nextToken.value;
            var type = nextToken.type;

            if (value in exceptions) {
                return;
            }

            // Skip for empty parentheses
            if (value === ')') {
                return;
            }

            if (
                (token.range[1] === nextToken.range[0] &&
                    token.loc.end.line === nextToken.loc.start.line) ||
                    isComment(token.range[1])
            ) {
                errors.add('Missing space after opening round bracket', token.loc.end);
            }
        });

        file.iterateTokenByValue(')', function(token, index, tokens) {
            var prevToken = file.getPrevToken(token);
            var value = prevToken.value;
            var type = prevToken.type;

            if (value in exceptions) {

                // Special case - foo( object[i] )
                if (!(
                    value === ']' &&
                    file.getNodeByRange(token.range[0] - 1).type === 'MemberExpression'
                )) {
                    return;
                }
            }

            // Skip for empty parentheses
            if (value === '(') {
                return;
            }

            if (
                (token.range[0] === prevToken.range[1] &&
                    token.loc.end.line === prevToken.loc.start.line) ||
                    isComment(token.range[0] - 1)
            ) {
                errors.add('Missing space before closing round bracket',
                    token.loc.end.line,
                    token.loc.end.column - 2);
            }
        });
    },

    format: function(file, error) {
        var pos = file.getPosByLineAndColumn(error.line, error.column);
        if (error.message.indexOf('before') !== -1) {
            file.splice(pos + 1, 0, ' ');
        } else {
            file.splice(pos, 0, ' ');
        }
    }
};

},{"assert":143}],98:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {
    configure: function(requireTrailingComma) {

        if (typeof requireTrailingComma === 'object') {
            if ('ignoreSingleValue' in requireTrailingComma) {
                assert(
                    requireTrailingComma.ignoreSingleValue === true,
                    'requireTrailingComma option ignoreSingleValue requires true value or should be removed'
                );
                this._ignoreSingleValue = true;
            }
            if ('ignoreSingleLine' in requireTrailingComma) {
                assert(
                    requireTrailingComma.ignoreSingleLine === true,
                    'requireTrailingComma option ignoreSingleLine requires true value or should be removed'
                );
                this._ignoreSingleLine = true;
            }
        } else {
            assert(
                requireTrailingComma === true,
                'requireTrailingComma option requires true value or should be removed'
            );
        }
    },

    getOptionName: function() {
        return 'requireTrailingComma';
    },

    check: function(file, errors) {
        var _this = this;

        file.iterateNodesByType(['ObjectExpression', 'ArrayExpression'], function(node) {
            var isObject = node.type === 'ObjectExpression';
            var entities = isObject ? node.properties : node.elements;

            if (entities.length === 0) {
                return;
            }

            if (_this._ignoreSingleValue && entities.length === 1) {
                return;
            }

            if (_this._ignoreSingleLine && node.loc.start.line === node.loc.end.line) {
                return;
            }

            var closingToken = file.getLastNodeToken(node);

            errors.assert.tokenBefore({
                token: closingToken,
                expectedTokenBefore: {type: 'Punctuator', value: ','},
                message: 'Missing comma before closing ' + (isObject ? ' curly brace' : ' bracket')
            });
        });
    }

};

},{"assert":143}],99:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(requireYodaConditions) {
        assert(
            typeof requireYodaConditions === 'boolean',
            'requireYodaConditions option requires boolean value'
        );
        assert(
            requireYodaConditions === true,
            'requireYodaConditions option requires true value or should be removed'
        );
        this._operatorIndex = {
            '==': true,
            '===': true,
            '!=': true,
            '!==': true,
            '>': true,
            '<': true,
            '>=': true,
            '<=': true
        };
    },

    getOptionName: function() {
        return 'requireYodaConditions';
    },

    check: function(file, errors) {
        var operators = this._operatorIndex;
        file.iterateNodesByType('BinaryExpression', function(node) {
            if (operators[node.operator]) {
                if (node.right.type === 'Literal' ||
                    (node.right.type === 'Identifier' && node.right.name === 'undefined')
                ) {
                    errors.add('Not yoda condition', node.left.loc.start);
                }
            }
        });
    }

};

},{"assert":143}],100:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(keywords) {
        assert(
            typeof keywords === 'string' ||
            typeof Array.isArray(keywords),
            'safeContextKeyword option requires string or array value'
        );

        this._keywords = keywords;
    },

    getOptionName: function() {
        return 'safeContextKeyword';
    },

    check: function(file, errors) {
        var keywords = typeof this._keywords === 'string' ? [this._keywords] : this._keywords;

        // var that = this
        file.iterateNodesByType('VariableDeclaration', function(node) {
            for (var i = 0; i < node.declarations.length; i++) {
                var decl = node.declarations[i];

                // decl.init === null in case of "var foo;"
                if (decl.init &&
                    (decl.init.type === 'ThisExpression' && checkKeywords(decl.id.name, keywords))
                ) {
                    errors.add(
                        'You should use "' + keywords.join('" or "') + '" to save a reference to "this"',
                        node.loc.start
                    );
                }
            }
        });

        // that = this
        file.iterateNodesByType('AssignmentExpression', function(node) {

            if (
                // filter property assignments "foo.bar = this"
                node.left.type === 'Identifier' &&
                (node.right.type === 'ThisExpression' && checkKeywords(node.left.name, keywords))
            ) {
                errors.add(
                    'You should use "' + keywords.join('" or "') + '" to save a reference to "this"',
                    node.loc.start
                );
            }
        });
    }
};

/**
 * Check if at least one keyword equals to passed name
 * @param {String} name
 * @param {Array} keywords
 * @return {Boolean}
 */
function checkKeywords(name, keywords) {
    for (var i = 0; i < keywords.length; i++) {
        if (name === keywords[i]) {
            return false;
        }
    }

    return true;
}

},{"assert":143}],101:[function(require,module,exports){
var assert = require('assert');
var commentHelper = require('../comment-helper');

module.exports = function() {};

module.exports.prototype = {

    configure: function(validateIndentation) {
        assert(
            validateIndentation === '\t' ||
                (typeof validateIndentation === 'number' && validateIndentation > 0),
            'validateIndentation option requires a positive number of spaces or "\\t"'
        );

        if (typeof validateIndentation === 'number') {
            this._indentChar = ' ';
            this._indentSize = validateIndentation;
        } else {
            this._indentChar = '\t';
            this._indentSize = 1;
        }

        this._breakIndents = null;

        this._indentableNodes = {
            BlockStatement: 'body',
            Program: 'body',
            ObjectExpression: 'properties',
            ArrayExpression: 'elements',
            SwitchStatement: 'cases',
            SwitchCase: 'consequent'
        };
    },

    getOptionName: function() {
        return 'validateIndentation';
    },

    check: function(file, errors) {
        function isMultiline(node) {
            return node.loc.start.line !== node.loc.end.line;
        }

        function getIndentationFromLine(i) {
            var rNotIndentChar = new RegExp('[^' + indentChar + ']');
            var firstContent = Math.max(lines[i].search(rNotIndentChar), 0);
            return firstContent;
        }

        function markPop(node, outdents) {
            linesToCheck[node.loc.end.line - 1].pop = outdents;
        }

        function markExtraPops(node, count) {
            linesToCheck[node.loc.end.line - 1].extraPops = count;
        }

        function markCasePop(caseNode, children) {
            var outdentNode = getCaseOutdent(children);
            var outdents;

            // If a case statement has a `break` or `return` as a direct child and it is the
            // first one encountered, use it as the example for all future case indentation
            if (outdentNode && _this._breakIndents === null) {
                _this._breakIndents = (caseNode.loc.start.column === outdentNode.loc.start.column) ? 1 : 0;
            }

            // If a case statement has no `break` nor `return` as a direct child
            // (e.g. an if nested in a case statement), mark that there is an extra
            // pop because there is no statement that "closes" the case statement
            if (!outdentNode) {
                markExtraPops(caseNode, 1);
            } else {
                markPop(caseNode, _this._breakIndents);
            }
        }

        function markPushAndCheck(pushNode, indents) {
            linesToCheck[pushNode.loc.start.line - 1].push = indents;
            linesToCheck[pushNode.loc.end.line - 1].check = true;
        }

        function markChildren(node) {
            var childrenProperty = indentableNodes[node.type];
            var children = node[childrenProperty];

            children.forEach(function(childNode, i) {
                if (childNode.loc.start.line !== node.loc.start.line) {
                    linesToCheck[childNode.loc.start.line - 1].check = true;
                }
            });
        }

        function checkIndentations() {
            linesToCheck.forEach(function(line, i) {
                var actualIndentation = getIndentationFromLine(i);

                var expectedIndentation = getExpectedIndentation(line, actualIndentation);

                if (line.check) {
                    if (actualIndentation !== expectedIndentation) {
                        errors.add(
                            'Expected indentation of ' + expectedIndentation + ' characters',
                            i + 1,
                            expectedIndentation
                        );
                        // correct the indentation so that future lines
                        // can be validated appropriately
                        actualIndentation = expectedIndentation;
                    }
                }

                if (line.push !== null) {
                    pushExpectedIndentations(line, actualIndentation);
                }
            });
        }

        function getExpectedIndentation(line, actual) {
            var outdent = indentSize * line.pop;
            var expected;
            var idx = indentStack.length - 1;
            var extraPops = line.extraPops;

            if (line.pop === null) {
                expected = indentStack[idx];
            } else {
                expected = indentStack.pop();

                if (Array.isArray(expected)) {
                    expected[0] -= outdent;
                    expected[1] -= outdent;
                } else {
                    expected -= outdent;
                }
            }

            // when the expected is an array, resolve the value
            // back into a Number by checking both values are the actual indentation
            if (line.check && Array.isArray(expected)) {
                expected = actual === expected[1] ? expected[1] : expected[0];
                if (!line.pop) {
                    indentStack[idx] = expected;
                }
            }

            while (extraPops--) {
                indentStack.pop();
            }

            if (expected < 0) {
                expected = 0;
            }

            return expected;
        }

        function pushExpectedIndentations(line, actualIndentation) {
            var expectedIndentation = actualIndentation + (indentSize * line.push);
            var expectedIndentation2;

            // when a line has an alternate indentation, push an array of possible values
            // on the stack, to be resolved when checked against an actual indentation
            if (line.pushAltLine !== null) {
                expectedIndentation2 = getIndentationFromLine(line.pushAltLine) + (indentSize * line.push);
                indentStack.push([expectedIndentation, expectedIndentation2]);
            } else {
                indentStack.push(expectedIndentation);
            }
        }

        function checkAlternateBlockStatement(node, property) {
            var child =  node[property];
            if (child && child.type === 'BlockStatement') {
                linesToCheck[child.loc.start.line - 1].push = 1;
                linesToCheck[child.loc.start.line - 1].check = true;
            }
        }

        function getCaseOutdent(caseChildren) {
            var outdentNode;
            caseChildren.some(function(node) {
                if (node.type === 'BreakStatement' || node.type === 'ReturnStatement') {
                    outdentNode = node;
                    return true;
                }
            });

            return outdentNode;
        }

        function generateIndentations() {
            file.iterateNodesByType([
                'Program'
            ], function(node) {
                if (!isMultiline(node)) {
                    return;
                }

                markChildren(node);
            });

            file.iterateNodesByType('BlockStatement', function(node) {
                if (!isMultiline(node)) {
                    return;
                }

                markChildren(node);
                markPop(node, 1);

                // The parent of an else block statement is the entire if/else
                // block. In order to avoid over indenting in the case of a
                // non-block if with a block else, mark push where the else starts,
                // not where the if starts!
                if (node.parentNode.type === 'IfStatement' &&
                    node.parentNode.alternate === node) {
                    markPushAndCheck(node, 1);
                } else {
                    markPushAndCheck(node.parentNode, 1);
                }
            });

            file.iterateNodesByType('IfStatement', function(node) {
                checkAlternateBlockStatement(node, 'alternate');

                var test = node.test;
                var endLine = test.loc.end.line - 1;

                // Assume that if the test starts on the line following the parens,
                // that the closing parens is on the line after the end of the test.
                if (node.loc.start.line + 1 === test.loc.start.line) {
                    endLine++;
                }

                if (isMultiline(test) && linesToCheck[endLine].pop !== null) {
                    linesToCheck[endLine].push = 1;
                }
            });

            file.iterateNodesByType('TryStatement', function(node) {
                checkAlternateBlockStatement(node, 'handler');
                checkAlternateBlockStatement(node, 'finalizer');
            });

            file.iterateNodesByType('SwitchStatement', function(node) {
                if (!isMultiline(node)) {
                    return;
                }
                var indents = 1;

                var childrenProperty = indentableNodes[node.type];
                var children = node[childrenProperty];

                if (children.length > 0 &&
                    node.loc.start.column === children[0].loc.start.column) {
                    indents = 0;
                }

                markChildren(node);
                markPop(node, indents);
                markPushAndCheck(node, indents);
            });

            file.iterateNodesByType('SwitchCase', function(node) {
                if (!isMultiline(node)) {
                    return;
                }

                var childrenProperty = indentableNodes[node.type];
                var children = node[childrenProperty];

                if (children.length > 1 ||
                    (children[0] && children[0].type !== 'BlockStatement')) {
                    markChildren(node);
                    markCasePop(node, children);
                    markPushAndCheck(node, 1);
                } else if (children.length === 0) {
                    linesToCheck[node.loc.start.line - 1].push = 1;
                    linesToCheck[node.loc.start.line - 1].check = true;
                    markPop(node, 0);
                }
            });

            // indentations inside of function expressions can be offset from
            // either the start of the function or the end of the function, therefore
            // mark all starting lines of functions as potential indentations
            file.iterateNodesByType(['FunctionDeclaration', 'FunctionExpression'], function(node) {
                linesToCheck[node.loc.start.line - 1].pushAltLine = node.loc.end.line - 1;
            });

            file.iterateNodesByType('VariableDeclaration', function(node) {
                var startLine = node.loc.start.line - 1;
                var decls = node.declarations;
                var declStartLine = decls[0].loc.start.line - 1;
                var actualIndents;
                var newIndents;

                if (startLine !== declStartLine) {
                    return;
                }

                if (linesToCheck[startLine].push !== null) {
                    actualIndents = getIndentationFromLine(startLine);

                    if (decls.length > 1) {
                        newIndents = getIndentationFromLine(decls[1].loc.start.line - 1);
                    } else {
                        newIndents = getIndentationFromLine(decls[0].loc.end.line - 1);
                    }
                    linesToCheck[startLine].push = ((newIndents - actualIndents) / indentSize) + 1;
                }
            });
        }

        var _this = this;

        var indentableNodes = this._indentableNodes;
        var indentChar = this._indentChar;
        var indentSize = this._indentSize;

        var lines = commentHelper.getLinesWithCommentsRemoved(file, errors);
        var indentStack = [0];
        var linesToCheck = lines.map(function() {
            return {
                push: null,
                pushAltLine: null,
                pop: null,
                check: null,
                extraPops: 0
            };
        });

        generateIndentations();
        checkIndentations();
    },

    format: function(file, error) {
        if (error.message.indexOf('Multiline comments') === -1) {
            var pos = file.getPosByLineAndColumn(error.line, 0);
            var amount = error.column;
            var str = '';
            for (var i = 0;i < amount;i++) {
                for (var j = 0;j < this._indentSize;j++) {
                    str += this._indentChar;
                }
            }
            var toRemove = 0;
            var source = file.getSource();
            while (source[pos + toRemove] === '\t' || source[pos + toRemove] === ' ') { toRemove++; }
            file.splice(pos, toRemove, str);
        } else {
            file.splice(file.getPosByLineAndColumn(error.line, error.column), 0, '\n');
        }
    }

};

},{"../comment-helper":2,"assert":143}],102:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(options) {
        assert(typeof options === 'object', 'validateJSDoc option requires object value');
        this._options = options;
    },

    getOptionName: function() {
        return 'validateJSDoc';
    },

    check: function(file, errors) {
        var options = this._options;
        var comments = file.getComments();
        file.iterateNodesByType(['FunctionDeclaration', 'FunctionExpression'], function(node) {
            var jsDoc = getJsDocForLine(node.loc.start.line);
            if (jsDoc) {
                var jsDocData = jsDoc.value;
                var jsDocLines = jsDocData.split('\n');
                var paramIndex = 0;
                if (options.checkParamNames || options.checkRedundantParams || options.requireParamTypes) {
                    for (var i = 0, l = jsDocLines.length; i < l; i++) {
                        var line = jsDocLines[i].trim();
                        if (line.charAt(0) === '*') {
                            line = line.substr(1).trim();
                            if (line.indexOf('@param') === 0) {
                                var match = line.match(/^@param\s+(?:{(.+?)})?\s*(?:\[)?([a-zA-Z0-9_\.\$]+)/);
                                if (match) {
                                    var jsDocParamType = match[1];
                                    var jsDocParamName = match[2];
                                    if (options.requireParamTypes && !jsDocParamType) {
                                        errors.add(
                                            'Missing JSDoc @param type',
                                            jsDoc.loc.start.line + i,
                                            jsDocLines[i].indexOf('@param')
                                        );
                                    }
                                    if (jsDocParamName.indexOf('.') === -1) {
                                        var param = node.params[paramIndex];
                                        if (param) {
                                            if (jsDocParamName !== param.name) {
                                                if (options.checkParamNames) {
                                                    errors.add(
                                                        'Invalid JSDoc @param argument name',
                                                        jsDoc.loc.start.line + i,
                                                        jsDocLines[i].indexOf('@param')
                                                    );
                                                }
                                            }
                                        } else {
                                            if (options.checkRedundantParams) {
                                                errors.add(
                                                    'Redundant JSDoc @param',
                                                    jsDoc.loc.start.line + i,
                                                    jsDocLines[i].indexOf('@param')
                                                );
                                            }
                                        }
                                        paramIndex++;
                                    }
                                } else {
                                    errors.add(
                                        'Invalid JSDoc @param',
                                        jsDoc.loc.start.line + i,
                                        jsDocLines[i].indexOf('@param')
                                    );
                                }
                            }
                        }
                    }
                }
            }
        });

        function getJsDocForLine(line) {
            line--;
            for (var i = 0, l = comments.length; i < l; i++) {
                var comment = comments[i];
                if (comment.loc.end.line === line && comment.type === 'Block' && comment.value.charAt(0) === '*') {
                    return comment;
                }
            }
            return null;
        }
    }

};

},{"assert":143}],103:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(options) {
        assert(
            typeof options === 'string' || typeof options === 'object',
            'validateLineBreaks option requires string or object value'
        );

        if (typeof options === 'string') {
            options = { character: options };
        }

        var lineBreaks = {
            CR: '\r',
            LF: '\n',
            CRLF: '\r\n'
        };
        this._allowedLineBreak = lineBreaks[options.character];

        this._reportOncePerFile = options.reportOncePerFile !== false;
    },

    getOptionName: function() {
        return 'validateLineBreaks';
    },

    check: function(file, errors) {
        var lines = file.getLines();
        if (lines.length < 2) {
            return;
        }

        var lineBreaks = file.getSource().match(/\r\n|\r|\n/g);
        for (var i = 0, len = lineBreaks.length; i < len; i++) {
            if (lineBreaks[i] !== this._allowedLineBreak) {
                errors.add('Invalid line break', i + 1, lines[i].length);
                if (this._reportOncePerFile) {
                    break;
                }
            }
        }
    },

    format: function(file, error) {
        // we should keep _reportOncePerFile in mind
        var regex = /\r\n|\r|\n/g;
        var source = file.getSource();
        var lineBreak = regex.exec(source);
        while (lineBreak !== null) {
            if (lineBreak[0] !== this._allowedLineBreak) {
                file.splice(lineBreak.index, lineBreak[0].length, this._allowedLineBreak);
            }
            lineBreak = regex.exec(source);
        }
    }
};

},{"assert":143}],104:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(validateObjectIndentation) {
        assert(
            validateObjectIndentation === '\t' ||
                (typeof validateObjectIndentation === 'number' && validateObjectIndentation > 0),
            'validateObjectIndentation option requires a positive number of spaces or "\\t"'
        );

        if (typeof validateObjectIndentation === 'number') {
            this._indentChar = ' ';
            this._indentSize = validateObjectIndentation;
        } else {
            this._indentChar = '\t';
            this._indentSize = 1;
        }

    },

    getOptionName: function() {
        return 'validateObjectIndentation';
    },

    check: function(file, errors) {

        var lines = file.getLines(file, errors);
        var indentChar = this._indentChar;
        var indentSize = this._indentSize;
        function isMultiline(node) {
            return node.loc.start.line !== node.loc.end.line;
        }

        function getIndentationFromLine(i) {
            var rNotIndentChar = new RegExp('[^' + indentChar + ']');
            var firstContent = 0;
            if (lines[i - 1]) {
                firstContent = Math.max(lines[i - 1].search(rNotIndentChar), 0);
            }
            return firstContent;
        }

        file.iterateNodesByType('ObjectExpression', function(node) {
            var linesInspected = [node.loc.start.line];
            var expectedIndentation = getIndentationFromLine(node.loc.start.line) + indentSize;
            if (isMultiline(node) && node.properties.length > 0) {
                node.properties.forEach(function(property) {
                    var startLine = property.loc.start.line;
                    if (linesInspected.indexOf(startLine) === -1 &&
                    getIndentationFromLine(startLine) !== expectedIndentation) {
                        errors.add(
                            'Expected indentation of ' + expectedIndentation + ' characters',
                            startLine,
                            expectedIndentation
                        );
                    }
                    linesInspected.push(startLine);
                });
            }
        });
    },

    format: function(file, error) {
        var pos = file.getPosByLineAndColumn(error.line, 0);
        var amount = error.column;
        var str = '';
        for (var i = 0;i < amount;i++) {
            for (var j = 0;j < this._indentSize;j++) {
                str += this._indentChar;
            }
        }
        var toRemove = 0;
        var source = file.getSource();
        while (source[pos + toRemove] === '\t' || source[pos + toRemove] === ' ') { toRemove++; }
        var propertyPos = pos;
        var property = file.getNodeByRange(propertyPos);
        while ((!property || property.type !== 'Property') && propertyPos < source.length) {
            propertyPos++;
            property = file.getNodeByRange(propertyPos);
        }
        property = property;

        var startLine = property.loc.start.line;
        var endLine = property.loc.end.line;
        for (var line = startLine; line <= endLine; line++) {
            pos = file.getPosByLineAndColumn(line, 0);
            file.splice(pos, toRemove, str);
        }

    }

};

},{"assert":143}],105:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(validateParameterSeparator) {
        assert(
            typeof validateParameterSeparator === 'string' && /^[ ]?,[ ]?$/.test(validateParameterSeparator),
            'validateParameterSpacing option requires string value containing only a comma and optional spaces'
        );

        this._separator = validateParameterSeparator;
    },

    getOptionName: function() {
        return 'validateParameterSeparator';
    },

    check: function(file, errors) {

        var separators = this._separator.split(',');
        var whitespaceBeforeComma = Boolean(separators.shift());
        var whitespaceAfterComma = Boolean(separators.pop());

        file.iterateNodesByType(['FunctionDeclaration', 'FunctionExpression'], function(node) {

            node.params.forEach(function(paramNode) {

                var prevParamToken = file.getFirstNodeToken(paramNode);
                var punctuatorToken = file.getNextToken(prevParamToken);

                if (punctuatorToken.value === ',') {

                    if (whitespaceBeforeComma) {
                        errors.assert.whitespaceBetween({
                            token: prevParamToken,
                            nextToken: punctuatorToken,
                            spaces: 1,
                            message: 'Missing space after function parameter \'' + prevParamToken.value + '\''
                        });
                    } else {
                        errors.assert.noWhitespaceBetween({
                            token: prevParamToken,
                            nextToken: punctuatorToken,
                            message: 'Unexpected space after function parameter \'' + prevParamToken.value + '\''
                        });
                    }

                    var nextParamToken = file.getNextToken(punctuatorToken);

                    if (whitespaceAfterComma) {
                        errors.assert.whitespaceBetween({
                            token: punctuatorToken,
                            nextToken: nextParamToken,
                            spaces: 1,
                            message: 'Missing space before function parameter \'' + nextParamToken.value + '\''
                        });
                    } else {
                        errors.assert.noWhitespaceBetween({
                            token: punctuatorToken,
                            nextToken: nextParamToken,
                            message: 'Unexpected space before function parameter \'' + nextParamToken.value + '\''
                        });
                    }
                }
            });
        });
    }

};

},{"assert":143}],106:[function(require,module,exports){
var assert = require('assert');

module.exports = function() {};

module.exports.prototype = {

    configure: function(quoteMark) {
        this._allowEscape = false;

        if (typeof quoteMark === 'object') {
            assert(
                typeof quoteMark.escape === 'boolean' && quoteMark.mark !== undefined,
                'validateQuoteMarks option requires the "escape" and "mark" property to be defined'
            );
            this._allowEscape = quoteMark.escape;
            quoteMark = quoteMark.mark;
        }

        assert(
            quoteMark === '"' || quoteMark === '\'' || quoteMark === true,
            'validateQuoteMarks option requires \'"\', "\'", or boolean true'
        );

        this._quoteMark = quoteMark;
    },

    getOptionName: function() {
        return 'validateQuoteMarks';
    },

    check: function(file, errors) {
        var quoteMark = this._quoteMark;
        var allowEscape = this._allowEscape;
        var opposite = {
            '"': '\'',
            '\'': '"'
        };

        file.iterateTokensByType('String', function(token) {
            var str = token.value;
            var mark = str[0];
            var stripped = str.substring(1, str.length - 1);

            if (quoteMark === true) {
                quoteMark = mark;
            }

            if (mark !== quoteMark) {
                if (allowEscape && stripped.indexOf(opposite[mark]) > -1) {
                    return;
                }

                errors.add(
                    'Invalid quote mark found',
                    token.loc.start.line,
                    token.loc.start.column
                );
            }
        });
    }

};

},{"assert":143}],107:[function(require,module,exports){
var defaultEsprima = require('esprima');
var harmonyEsprima = require('esprima-harmony-jscs');
var Errors = require('./errors');
var JsFile = require('./js-file');
var Configuration = require('./config/configuration');
/**
 * Starts Code Style checking process.
 *
 * @name StringChecker
 * @param {Boolean|Object} options either a boolean flag representing verbosity (deprecated), or an options object
 * @param {Boolean} options.verbose true adds the rule name to the error messages it produces, false does not
 * @param {Boolean} options.esnext true attempts to parse the code as es6, false does not
 * @param {Object} options.esprima if provided, will be used to parse source code instead of the built-in esprima parser
 */

var StringChecker = function(options) {
    this._configuredRules = [];

    this._errorsFound = 0;
    this._maxErrorsExceeded = false;

    this._configuration = this._createConfiguration();
    this._configuration.registerDefaultPresets();

    if (typeof options === 'boolean') {
        this._verbose = options;
    } else {
        options = options || {};
        this._verbose = options.verbose || false;
        this._esprima = options.esprima || (options.esnext ? harmonyEsprima : defaultEsprima);
    }
};

StringChecker.prototype = {
    /**
     * Registers single Code Style checking rule.
     *
     * @param {Rule} rule
     */
    registerRule: function(rule) {
        this._configuration.registerRule(rule);
    },

    /**
     * Registers built-in Code Style checking rules.
     */
    registerDefaultRules: function() {
        this._configuration.registerDefaultRules();
    },

    /**
     * Get processed config.
     *
     * @return {Object}
     */
    getProcessedConfig: function() {
        return this._configuration.getProcessedConfig();
    },

    /**
     * Loads configuration from JS Object. Activates and configures required rules.
     *
     * @param {Object} config
     */
    configure: function(config) {
        this._configuration.load(config);

        if (this._configuration.hasCustomEsprima()) {
            this._esprima = this._configuration.getCustomEsprima();
        } else if (this._configuration.isESNextEnabled()) {
            this._esprima = harmonyEsprima;
        }

        this._configuredRules = this._configuration.getConfiguredRules();
        this._activeFormattingRules = this._configuration.getConfiguredFormattingRules();
        this._maxErrors = this._configuration.getMaxErrors();
    },

    /**
     * Checks file provided with a string.
     * @param {String} str
     * @param {String} filename
     * @returns {Errors}
     */
    checkString: function(str, filename) {
        filename = filename || 'input';
        str = str.replace(/^#!?[^\n]+\n/gm, '');

        var tree;
        var parseError;

        try {
            tree = this._esprima.parse(str, {loc: true, range: true, comment: true, tokens: true});
        } catch (e) {
            parseError = e;
        }
        var file = new JsFile(filename, str, tree);
        var errors = new Errors(file, this._verbose);
        var errorFilter = this._configuration.getErrorFilter();

        if (!this._maxErrorsExceeded) {
            if (parseError) {
                errors.setCurrentRule('parseError');
                errors.add(parseError.description, parseError.lineNumber, parseError.column);

                return errors;
            }

            this._configuredRules.forEach(function(rule) {
                errors.setCurrentRule(rule.getOptionName());
                rule.check(file, errors);
            }, this);

            this._configuration.getUnsupportedRuleNames().forEach(function(rulename) {
                errors.add('Unsupported rule: ' + rulename, 1, 0);
            });

            // sort errors list to show errors as they appear in source
            errors.getErrorList().sort(function(a, b) {
                return (a.line - b.line) || (a.column - b.column);
            });

            if (errorFilter) {
                errors.filter(errorFilter);
            }

            if (this._maxErrors !== null && !isNaN(this._maxErrors)) {
                if (!this._maxErrorsExceeded) {
                    this._maxErrorsExceeded = this._errorsFound + errors.getErrorCount() > this._maxErrors;
                }
                errors.stripErrorList(Math.max(0, this._maxErrors - this._errorsFound));
            }

            this._errorsFound += errors.getErrorCount();
        }

        return errors;
    },

    formatString: function(str, filename) {
        filename = filename || 'input';
        var tree;
        var rules = {};
        var configs = this._configuration;
        var retryCount = 0;
        var errors;
        var file;

        str = str.replace(/^#!?[^\n]+$/gm, '\n');

        function ruleCheck(rule) {
            rules[rule.getOptionName()] = rule;

            errors.setCurrentRule(rule.getOptionName());
            rule.check(file, errors);
        }

        function sortFunction(a, b) {
            return (b.line - a.line) || (b.column - a.column);
        }

        function formatFunction(error) {
            rules[error.rule].format(file, error, configs._ruleSettings[error.rule]);
        }

        do {
            retryCount++;
            try {
                tree = this._esprima.parse(str, {loc: true, range: true, comment: true, tokens: true});
            } catch (e) {
                console.log(str);
                throw new Error('Syntax error at ' + filename + ': ' + e.message);
            }
            file = new JsFile(filename, str, tree);
            errors = new Errors(file);
            this._activeFormattingRules.forEach(ruleCheck, this);

            errors.getErrorList().sort(sortFunction);

            errors.getErrorList().forEach(formatFunction);
            str = file.applyChanges();
        } while (!errors.isEmpty() && retryCount < 10);

        return str;
    },
    /**
     * Returns `true` if error count exceeded `maxErrors` option value.
     *
     * @returns {Boolean}
     */
    maxErrorsExceeded: function() {
        return this._maxErrorsExceeded;
    },

    /**
     * Returns new configuration instance.
     *
     * @protected
     * @returns {Configuration}
     */
    _createConfiguration: function() {
        return new Configuration();
    },

    /**
     * Returns current configuration instance.
     *
     * @returns {Configuration}
     */
    getConfiguration: function() {
        return this._configuration;
    }
};

module.exports = StringChecker;

},{"./config/configuration":3,"./errors":4,"./js-file":5,"esprima":124,"esprima-harmony-jscs":123}],108:[function(require,module,exports){
var utils = require('util');
var EventEmitter = require('events').EventEmitter;

/**
 * Token assertions class.
 *
 * @name {TokenAssert}
 * @param {JsFile} file
 */
function TokenAssert(file) {
    EventEmitter.call(this);

    this._file = file;
}

utils.inherits(TokenAssert, EventEmitter);

/**
 * Requires to have whitespace between specified tokens. Ignores newlines.
 *
 * @param {Object} options.token
 * @param {Object} options.nextToken
 * @param {String} [options.message]
 * @param {Number} [options.spaces] Amount of spaces between tokens.
 */
TokenAssert.prototype.whitespaceBetween = function(options) {
    var token = options.token;
    var nextToken = options.nextToken;
    if (options.hasOwnProperty('spaces')) {
        var spaces = options.spaces;
        if (nextToken.loc.start.line === token.loc.end.line &&
            (nextToken.loc.start.column - token.loc.end.column) !== spaces
        ) {
            this.emit('error', {
                message: options.message ||
                    spaces + ' spaces required between ' + token.value + ' and ' + nextToken.value,
                line: token.loc.end.line,
                column: token.loc.end.column
            });
        }
    } else {
        if (nextToken.range[0] === token.range[1]) {
            this.emit('error', {
                message: options.message || 'Missing space between ' + token.value + ' and ' + nextToken.value,
                line: token.loc.end.line,
                column: token.loc.end.column
            });
        }
    }
};

/**
 * Requires to have no whitespace between specified tokens.
 *
 * @param {Object} options.token
 * @param {Object} options.nextToken
 * @param {String} [options.message]
 * @param {Boolean} [options.disallowNewLine=false]
 */
TokenAssert.prototype.noWhitespaceBetween = function(options) {
    var token = options.token;
    var nextToken = options.nextToken;
    if (nextToken.range[0] !== token.range[1] &&
        (options.disallowNewLine || token.loc.end.line === nextToken.loc.start.line)
    ) {
        this.emit('error', {
            message: options.message || 'Unexpected whitespace between ' + token.value + ' and ' + nextToken.value,
            line: token.loc.end.line,
            column: token.loc.end.column
        });
    }
};

/**
 * Requires tokens to be on the same line.
 *
 * @param {Object} options.token
 * @param {Object} options.nextToken
 * @param {String} [options.message]
 */
TokenAssert.prototype.sameLine = function(options) {
    var token = options.token;
    var nextToken = options.nextToken;
    if (token.loc.end.line !== nextToken.loc.start.line) {
        this.emit('error', {
            message: options.message || token.value + ' and ' + nextToken.value + ' should be on the same line',
            line: token.loc.end.line,
            column: token.loc.end.column
        });
    }
};

/**
 * Requires tokens to be on different lines.
 *
 * @param {Object} options.token
 * @param {Object} options.nextToken
 * @param {Object} [options.message]
 */
TokenAssert.prototype.differentLine = function(options) {
    var token = options.token;
    var nextToken = options.nextToken;
    if (token.loc.end.line === nextToken.loc.start.line) {
        this.emit('error', {
            message: options.message || token.value + ' and ' + nextToken.value + ' should be on different lines',
            line: token.loc.end.line,
            column: token.loc.end.column
        });
    }
};

/**
 * Requires specific token before given.
 *
 * @param {Object} options.token
 * @param {Object} options.expectedTokenBefore
 * @param {String} [options.message]
 */
TokenAssert.prototype.tokenBefore = function(options) {
    var token = options.token;
    var actualTokenBefore = this._file.getPrevToken(token);
    var expectedTokenBefore = options.expectedTokenBefore;
    if (
        actualTokenBefore.type !== expectedTokenBefore.type ||
        actualTokenBefore.value !== expectedTokenBefore.value
    ) {
        var message = options.message;
        if (!message) {
            var showTypes = expectedTokenBefore.value === actualTokenBefore.value;
            message =
                expectedTokenBefore.value + (showTypes ? ' (' + expectedTokenBefore.type + ')' : '') +
                ' was expected before ' + token.value +
                ' but ' + actualTokenBefore.value + (showTypes ? ' (' + actualTokenBefore.type + ')' : '') + ' found';
        }
        this.emit('error', {
            message: message,
            line: token.loc.start.line,
            column: token.loc.start.column
        });
    }
};
/**
 * Disallows specific token before given.
 *
 * @param {Object} options.token
 * @param {Object} options.expectedTokenBefore
 * @param {String} [options.message]
 */
TokenAssert.prototype.noTokenBefore = function(options) {
    var token = options.token;
    var actualTokenBefore = this._file.getPrevToken(token);
    var expectedTokenBefore = options.expectedTokenBefore;
    if (actualTokenBefore.type === expectedTokenBefore.type &&
        actualTokenBefore.value === expectedTokenBefore.value
    ) {
        this.emit('error', {
            message: options.message || 'Illegal ' + expectedTokenBefore.value + ' was found before ' + token.value,
            line: token.loc.start.line,
            column: token.loc.start.column
        });
    }
};

module.exports = TokenAssert;

},{"events":144,"util":149}],109:[function(require,module,exports){
/**
 * Returns token by range start. Ignores ()
 *
 * @param {JsFile} file
 * @param {Number} range
 * @param {Boolean} [backward=false] Direction
 * @returns {Object|null}
 */
exports.getTokenByRangeStart = function(file, range, backward) {
    var tokens = file.getTokens();

    // get next token
    var tokenPos = file.getTokenPosByRangeStart(range);
    var token = tokens[tokenPos];

    // if token is ")" -> get next token
    // for example (a) + (b)
    // next token ---^
    // we should find (a) + (b)
    // ------------------^
    if (this.isTokenParenthesis(file, range, backward)) {
        var pos = backward ? token.range[0] - 1 : token.range[1];
        tokenPos = file.getTokenPosByRangeStart(pos);
        token = tokens[tokenPos];
    }

    return token || null;
};

/**
 * Is next/previous token a parentheses?
 *
 * @param {JsFile} file
 * @param {Number} range
 * @param {Boolean} [backward=false] Direction
 * @returns {Boolean}
 */
exports.isTokenParenthesis = function(file, range, backward) {
    var tokens = file.getTokens();

    // get next token
    var tokenPos = file.getTokenPosByRangeStart(range);
    var token = tokens[tokenPos];

    // we should check for "(" if we go backward
    var parenthesis = backward ? '(' : ')';

    return token && token.type === 'Punctuator' && token.value === parenthesis;
};

/**
 * Returns true if token is punctuator
 *
 * @param {Object} token
 * @param {String} punctuator
 * @returns {Boolean}
 */
exports.tokenIsPunctuator = function(token, punctuator) {
    return token && token.type === 'Punctuator' && token.value === punctuator;
};

/**
 * Find next/previous operator by range start
 *
 * @param {JsFile} file
 * @param {Number} range
 * @param {String} operator
 * @param {Boolean} [backward=false] Direction
 * @returns {Object|null}
 */
exports.findOperatorByRangeStart = function(file, range, operator, backward) {
    var tokens = file.getTokens();
    var index = file.getTokenPosByRangeStart(range);

    while (tokens[ index ]) {
        if (tokens[ index ].value === operator) {
            return tokens[ index ];
        }

        if (backward) {
            index--;
        } else {
            index++;
        }
    }

    return null;
};

/**
 * Returns token or false if there is a punctuator in a given range
 *
 * @param {JsFile} file
 * @param {Number} range
 * @param {String} operator
 * @param {Boolean} [backward=false] Direction
 * @returns {Object|null}
 */
exports.getTokenByRangeStartIfPunctuator = function(file, range, operator, backward) {
    var part = this.getTokenByRangeStart(file, range, backward);

    if (this.tokenIsPunctuator(part, operator)) {
        return part;
    }

    return null;
};

/**
 * Get column for long entities
 * @param {Number} column
 * @param {Number} length
 * @return {Number}
 */
exports.getPointerEntities = function(column, length) {
    return column - 1 + Math.ceil(length / 2);
};

},{}],110:[function(require,module,exports){
var estraverse = require('estraverse');

module.exports = {
    iterate: iterate
};

function iterate(node, cb) {
    if ('type' in node) {
        estraverse.traverse(node, {
            enter: function(node, parent) {
                var parentCollection = [];

                // parentCollection support
                var path = this.path();
                if (path) {
                    var collectionKey;
                    while (path.length > 0) {
                        var pathElement = path.pop();
                        if (typeof pathElement === 'string') {
                            collectionKey = pathElement;
                        }
                    }

                    parentCollection = parent[collectionKey];
                    if (!Array.isArray(parentCollection)) {
                        parentCollection = [parentCollection];
                    }
                }

                if (cb(node, parent, parentCollection) === false) {
                    return estraverse.VisitorOption.Skip;
                }
            },
            keys: {
                XJSIdentifier: [],
                XJSNamespacedName: ['namespace', 'name'],
                XJSMemberExpression: ['object', 'property'],
                XJSEmptyExpression: [],
                XJSExpressionContainer: ['expression'],
                XJSElement: ['openingElement', 'closingElement', 'children'],
                XJSClosingElement: ['name'],
                XJSOpeningElement: ['name', 'attributes'],
                XJSAttribute: ['name', 'value'],
                XJSSpreadAttribute: ['argument'],
                XJSText: null
            }
        });
    }
}

},{"estraverse":125}],111:[function(require,module,exports){
// 7.5.2 Keywords
var ES3_KEYWORDS = {
    'break': true,
    'case': true,
    'catch': true,
    'continue': true,
    'default': true,
    'delete': true,
    'do': true,
    'else': true,
    'finally': true,
    'for': true,
    'function': true,
    'if': true,
    'in': true,
    'instanceof': true,
    'new': true,
    'null': true,
    'return': true,
    'switch': true,
    'this': true,
    'throw': true,
    'try': true,
    'typeof': true,
    'var': true,
    'void': true,
    'while': true,
    'with': true
};

// 7.5.3 Future Reserved Words
var ES3_FUTURE_RESERVED_WORDS = {
    'abstract': true,
    'boolean': true,
    'byte': true,
    'char': true,
    'class': true,
    'const': true,
    'debugger': true,
    'double': true,
    'enum': true,
    'export': true,
    'extends': true,
    'final': true,
    'float': true,
    'goto': true,
    'implements': true,
    'import': true,
    'int': true,
    'interface': true,
    'long': true,
    'native': true,
    'package': true,
    'private': true,
    'protected': true,
    'public': true,
    'short': true,
    'static': true,
    'super': true,
    'synchronized': true,
    'throws': true,
    'transient': true,
    'volatile': true
};

var IDENTIFIER_NAME_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * All keywords where spaces are a stylistic choice
 * @type {Array}
 */
exports.spacedKeywords = [
    'do',
    'for',
    'if',
    'else',
    'switch',
    'case',
    'try',
    'catch',
    'finally',
    'void',
    'while',
    'with',
    'return',
    'typeof',
    'function'
];

/**
 * All keywords where curly braces are a stylistic choice
 * @type {Array}
 */
exports.curlyBracedKeywords = [
    'if',
    'else',
    'for',
    'while',
    'do',
    'case',
    'default',
    'with'
];

/**
 * Returns true if word is keyword in ECMAScript 3 specification.
 *
 * @param {String} word
 * @returns {Boolean}
 */
exports.isEs3Keyword = function(word) {
    return Boolean(ES3_KEYWORDS[word]);
};

/**
 * Returns true if word is future reserved word in ECMAScript 3 specification.
 *
 * @param {String} word
 * @returns {Boolean}
 */
exports.isEs3FutureReservedWord = function(word) {
    return Boolean(ES3_FUTURE_RESERVED_WORDS[word]);
};

/**
 * Returns true if name is valid identifier name.
 *
 * @param {String} name
 * @returns {Boolean}
 */
exports.isValidIdentifierName = function(name) {
    return IDENTIFIER_NAME_RE.test(name);
};

/**
 * All possible binary operators supported by JSCS
 * @type {Array}
 */
exports.binaryOperators = [

    // assignment operators
    '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=',
    '&=', '|=', '^=',

    '+', '-', '*', '/', '%', '<<', '>>', '>>>', '&',
    '|', '^', '&&', '||', '===', '==', '>=',
    '<=', '<', '>', '!=', '!==',

    ','
];

/**
 * Increment and decrement operators
 * @type {Array}
 */
exports.incrementAndDecrementOperators = ['++', '--'];

/**
 * All possible unary operators supported by JSCS
 * @type {Array}
 */
exports.unaryOperators = ['-', '+', '!', '~'].concat(exports.incrementAndDecrementOperators);

/**
 * All possible operators support by JSCS
 * @type {Array}
 */
exports.operators = exports.binaryOperators.concat(exports.unaryOperators);

},{}],112:[function(require,module,exports){
/*

The MIT License (MIT)

Original Library 
  - Copyright (c) Marak Squires

Additional functionality
 - Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)

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

var colors = {};
module['exports'] = colors;

colors.themes = {};

var ansiStyles = colors.styles = require('./styles');
var defineProps = Object.defineProperties;

colors.supportsColor = require('./system/supports-colors');

if (typeof colors.enabled === "undefined") {
  colors.enabled = colors.supportsColor;
}

colors.stripColors = colors.strip = function(str){
  return ("" + str).replace(/\x1B\[\d+m/g, '');
};


var stylize = colors.stylize = function stylize (str, style) {
  return ansiStyles[style].open + str + ansiStyles[style].close;
}

var matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
var escapeStringRegexp = function (str) {
  if (typeof str !== 'string') {
    throw new TypeError('Expected a string');
  }
  return str.replace(matchOperatorsRe,  '\\$&');
}

function build(_styles) {
  var builder = function builder() {
    return applyStyle.apply(builder, arguments);
  };
  builder._styles = _styles;
  // __proto__ is used because we must return a function, but there is
  // no way to create a function with a different prototype.
  builder.__proto__ = proto;
  return builder;
}

var styles = (function () {
  var ret = {};
  ansiStyles.grey = ansiStyles.gray;
  Object.keys(ansiStyles).forEach(function (key) {
    ansiStyles[key].closeRe = new RegExp(escapeStringRegexp(ansiStyles[key].close), 'g');
    ret[key] = {
      get: function () {
        return build(this._styles.concat(key));
      }
    };
  });
  return ret;
})();

var proto = defineProps(function colors() {}, styles);

function applyStyle() {
  var args = arguments;
  var argsLen = args.length;
  var str = argsLen !== 0 && String(arguments[0]);
  if (argsLen > 1) {
    for (var a = 1; a < argsLen; a++) {
      str += ' ' + args[a];
    }
  }

  if (!colors.enabled || !str) {
    return str;
  }

  var nestedStyles = this._styles;

  var i = nestedStyles.length;
  while (i--) {
    var code = ansiStyles[nestedStyles[i]];
    str = code.open + str.replace(code.closeRe, code.open) + code.close;
  }

  return str;
}

function applyTheme (theme) {
  for (var style in theme) {
    (function(style){
      colors[style] = function(str){
        return colors[theme[style]](str);
      };
    })(style)
  }
}

colors.setTheme = function (theme) {
  if (typeof theme === 'string') {
    try {
      colors.themes[theme] = require(theme);
      applyTheme(colors.themes[theme]);
      return colors.themes[theme];
    } catch (err) {
      console.log(err);
      return err;
    }
  } else {
    applyTheme(theme);
  }
};

function init() {
  var ret = {};
  Object.keys(styles).forEach(function (name) {
    ret[name] = {
      get: function () {
        return build([name]);
      }
    };
  });
  return ret;
}

var sequencer = function sequencer (map, str) {
  var exploded = str.split(""), i = 0;
  exploded = exploded.map(map);
  return exploded.join("");
};

// custom formatter methods
colors.trap = require('./custom/trap');
colors.zalgo = require('./custom/zalgo');

// maps
colors.maps = {};
colors.maps.america = require('./maps/america');
colors.maps.zebra = require('./maps/zebra');
colors.maps.rainbow = require('./maps/rainbow');
colors.maps.random = require('./maps/random')

for (var map in colors.maps) {
  (function(map){
    colors[map] = function (str) {
      return sequencer(colors.maps[map], str);
    }
  })(map)
}

defineProps(colors, init());
},{"./custom/trap":113,"./custom/zalgo":114,"./maps/america":117,"./maps/rainbow":118,"./maps/random":119,"./maps/zebra":120,"./styles":121,"./system/supports-colors":122}],113:[function(require,module,exports){
module['exports'] = function runTheTrap (text, options) {
  var result = "";
  text = text || "Run the trap, drop the bass";
  text = text.split('');
  var trap = {
    a: ["\u0040", "\u0104", "\u023a", "\u0245", "\u0394", "\u039b", "\u0414"],
    b: ["\u00df", "\u0181", "\u0243", "\u026e", "\u03b2", "\u0e3f"],
    c: ["\u00a9", "\u023b", "\u03fe"],
    d: ["\u00d0", "\u018a", "\u0500" , "\u0501" ,"\u0502", "\u0503"],
    e: ["\u00cb", "\u0115", "\u018e", "\u0258", "\u03a3", "\u03be", "\u04bc", "\u0a6c"],
    f: ["\u04fa"],
    g: ["\u0262"],
    h: ["\u0126", "\u0195", "\u04a2", "\u04ba", "\u04c7", "\u050a"],
    i: ["\u0f0f"],
    j: ["\u0134"],
    k: ["\u0138", "\u04a0", "\u04c3", "\u051e"],
    l: ["\u0139"],
    m: ["\u028d", "\u04cd", "\u04ce", "\u0520", "\u0521", "\u0d69"],
    n: ["\u00d1", "\u014b", "\u019d", "\u0376", "\u03a0", "\u048a"],
    o: ["\u00d8", "\u00f5", "\u00f8", "\u01fe", "\u0298", "\u047a", "\u05dd", "\u06dd", "\u0e4f"],
    p: ["\u01f7", "\u048e"],
    q: ["\u09cd"],
    r: ["\u00ae", "\u01a6", "\u0210", "\u024c", "\u0280", "\u042f"],
    s: ["\u00a7", "\u03de", "\u03df", "\u03e8"],
    t: ["\u0141", "\u0166", "\u0373"],
    u: ["\u01b1", "\u054d"],
    v: ["\u05d8"],
    w: ["\u0428", "\u0460", "\u047c", "\u0d70"],
    x: ["\u04b2", "\u04fe", "\u04fc", "\u04fd"],
    y: ["\u00a5", "\u04b0", "\u04cb"],
    z: ["\u01b5", "\u0240"]
  }
  text.forEach(function(c){
    c = c.toLowerCase();
    var chars = trap[c] || [" "];
    var rand = Math.floor(Math.random() * chars.length);
    if (typeof trap[c] !== "undefined") {
      result += trap[c][rand];
    } else {
      result += c;
    }
  });
  return result;

}

},{}],114:[function(require,module,exports){
// please no
module['exports'] = function zalgo(text, options) {
  text = text || "   he is here   ";
  var soul = {
    "up" : [
      '̍', '̎', '̄', '̅',
      '̿', '̑', '̆', '̐',
      '͒', '͗', '͑', '̇',
      '̈', '̊', '͂', '̓',
      '̈', '͊', '͋', '͌',
      '̃', '̂', '̌', '͐',
      '̀', '́', '̋', '̏',
      '̒', '̓', '̔', '̽',
      '̉', 'ͣ', 'ͤ', 'ͥ',
      'ͦ', 'ͧ', 'ͨ', 'ͩ',
      'ͪ', 'ͫ', 'ͬ', 'ͭ',
      'ͮ', 'ͯ', '̾', '͛',
      '͆', '̚'
    ],
    "down" : [
      '̖', '̗', '̘', '̙',
      '̜', '̝', '̞', '̟',
      '̠', '̤', '̥', '̦',
      '̩', '̪', '̫', '̬',
      '̭', '̮', '̯', '̰',
      '̱', '̲', '̳', '̹',
      '̺', '̻', '̼', 'ͅ',
      '͇', '͈', '͉', '͍',
      '͎', '͓', '͔', '͕',
      '͖', '͙', '͚', '̣'
    ],
    "mid" : [
      '̕', '̛', '̀', '́',
      '͘', '̡', '̢', '̧',
      '̨', '̴', '̵', '̶',
      '͜', '͝', '͞',
      '͟', '͠', '͢', '̸',
      '̷', '͡', ' ҉'
    ]
  },
  all = [].concat(soul.up, soul.down, soul.mid),
  zalgo = {};

  function randomNumber(range) {
    var r = Math.floor(Math.random() * range);
    return r;
  }

  function is_char(character) {
    var bool = false;
    all.filter(function (i) {
      bool = (i === character);
    });
    return bool;
  }
  

  function heComes(text, options) {
    var result = '', counts, l;
    options = options || {};
    options["up"] = options["up"] || true;
    options["mid"] = options["mid"] || true;
    options["down"] = options["down"] || true;
    options["size"] = options["size"] || "maxi";
    text = text.split('');
    for (l in text) {
      if (is_char(l)) {
        continue;
      }
      result = result + text[l];
      counts = {"up" : 0, "down" : 0, "mid" : 0};
      switch (options.size) {
      case 'mini':
        counts.up = randomNumber(8);
        counts.min = randomNumber(2);
        counts.down = randomNumber(8);
        break;
      case 'maxi':
        counts.up = randomNumber(16) + 3;
        counts.min = randomNumber(4) + 1;
        counts.down = randomNumber(64) + 3;
        break;
      default:
        counts.up = randomNumber(8) + 1;
        counts.mid = randomNumber(6) / 2;
        counts.down = randomNumber(8) + 1;
        break;
      }

      var arr = ["up", "mid", "down"];
      for (var d in arr) {
        var index = arr[d];
        for (var i = 0 ; i <= counts[index]; i++) {
          if (options[index]) {
            result = result + soul[index][randomNumber(soul[index].length)];
          }
        }
      }
    }
    return result;
  }
  // don't summon him
  return heComes(text);
}

},{}],115:[function(require,module,exports){
var colors = require('./colors'),
    styles = require('./styles');

module['exports'] = function () {

  //
  // Extends prototype of native string object to allow for "foo".red syntax
  //
  var addProperty = function (color, func) {
    String.prototype.__defineGetter__(color, func);
  };

  var sequencer = function sequencer (map, str) {
      return function () {
        var exploded = this.split(""), i = 0;
        exploded = exploded.map(map);
        return exploded.join("");
      }
  };

  var stylize = function stylize (str, style) {
    return styles[style].open + str + styles[style].close;
  }

  addProperty('strip', function () {
    return colors.strip(this);
  });

  addProperty('stripColors', function () {
    return colors.strip(this);
  });

  addProperty("trap", function(){
    return colors.trap(this);
  });

  addProperty("zalgo", function(){
    return colors.zalgo(this);
  });

  addProperty("zebra", function(){
    return colors.zebra(this);
  });

  addProperty("rainbow", function(){
    return colors.rainbow(this);
  });

  addProperty("random", function(){
    return colors.random(this);
  });

  addProperty("america", function(){
    return colors.america(this);
  });

  //
  // Iterate through all default styles and colors
  //
  var x = Object.keys(colors.styles);
  x.forEach(function (style) {
    addProperty(style, function () {
      return stylize(this, style);
    });
  });

  function applyTheme(theme) {
    //
    // Remark: This is a list of methods that exist
    // on String that you should not overwrite.
    //
    var stringPrototypeBlacklist = [
      '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__', 'charAt', 'constructor',
      'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'toString', 'valueOf', 'charCodeAt',
      'indexOf', 'lastIndexof', 'length', 'localeCompare', 'match', 'replace', 'search', 'slice', 'split', 'substring',
      'toLocaleLowerCase', 'toLocaleUpperCase', 'toLowerCase', 'toUpperCase', 'trim', 'trimLeft', 'trimRight'
    ];

    Object.keys(theme).forEach(function (prop) {
      if (stringPrototypeBlacklist.indexOf(prop) !== -1) {
        console.log('warn: '.red + ('String.prototype' + prop).magenta + ' is probably something you don\'t want to override. Ignoring style name');
      }
      else {
        if (typeof(theme[prop]) === 'string') {
          colors[prop] = colors[theme[prop]];
          addProperty(prop, function () {
            return colors[theme[prop]](this);
          });
        }
        else {
          addProperty(prop, function () {
            var ret = this;
            for (var t = 0; t < theme[prop].length; t++) {
              ret = exports[theme[prop][t]](ret);
            }
            return ret;
          });
        }
      }
    });
  }

  colors.setTheme = function (theme) {
    if (typeof theme === 'string') {
      try {
        colors.themes[theme] = require(theme);
        applyTheme(colors.themes[theme]);
        return colors.themes[theme];
      } catch (err) {
        console.log(err);
        return err;
      }
    } else {
      applyTheme(theme);
    }
  };

};
},{"./colors":112,"./styles":121}],116:[function(require,module,exports){
var colors = require('./colors');
module['exports'] = colors;

// Remark: By default, colors will add style properties to String.prototype
//
// If you don't wish to extend String.prototype you can do this instead and native String will not be touched
//
//   var colors = require('colors/safe);
//   colors.red("foo")
//
//
var extendStringPrototype = require('./extendStringPrototype')();
},{"./colors":112,"./extendStringPrototype":115}],117:[function(require,module,exports){
var colors = require('../colors');

module['exports'] = (function() {
  return function (letter, i, exploded) {
    if(letter === " ") return letter;
    switch(i%3) {
      case 0: return colors.red(letter);
      case 1: return colors.white(letter)
      case 2: return colors.blue(letter)
    }
  }
})();
},{"../colors":112}],118:[function(require,module,exports){
var colors = require('../colors');

module['exports'] = (function () {
  var rainbowColors = ['red', 'yellow', 'green', 'blue', 'magenta']; //RoY G BiV
  return function (letter, i, exploded) {
    if (letter === " ") {
      return letter;
    } else {
      return colors[rainbowColors[i++ % rainbowColors.length]](letter);
    }
  };
})();


},{"../colors":112}],119:[function(require,module,exports){
var colors = require('../colors');

module['exports'] = (function () {
  var available = ['underline', 'inverse', 'grey', 'yellow', 'red', 'green', 'blue', 'white', 'cyan', 'magenta'];
  return function(letter, i, exploded) {
    return letter === " " ? letter : colors[available[Math.round(Math.random() * (available.length - 1))]](letter);
  };
})();
},{"../colors":112}],120:[function(require,module,exports){
var colors = require('../colors');

module['exports'] = function (letter, i, exploded) {
  return i % 2 === 0 ? letter : colors.inverse(letter);
};
},{"../colors":112}],121:[function(require,module,exports){
/*
The MIT License (MIT)

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)

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

var styles = {};
module['exports'] = styles;

var codes = {
  reset: [0, 0],

  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  hidden: [8, 28],
  strikethrough: [9, 29],

  black: [30, 39],
  red: [31, 39],
  green: [32, 39],
  yellow: [33, 39],
  blue: [34, 39],
  magenta: [35, 39],
  cyan: [36, 39],
  white: [37, 39],
  gray: [90, 39],
  grey: [90, 39],

  bgBlack: [40, 49],
  bgRed: [41, 49],
  bgGreen: [42, 49],
  bgYellow: [43, 49],
  bgBlue: [44, 49],
  bgMagenta: [45, 49],
  bgCyan: [46, 49],
  bgWhite: [47, 49],

  // legacy styles for colors pre v1.0.0
  blackBG: [40, 49],
  redBG: [41, 49],
  greenBG: [42, 49],
  yellowBG: [43, 49],
  blueBG: [44, 49],
  magentaBG: [45, 49],
  cyanBG: [46, 49],
  whiteBG: [47, 49]

};

Object.keys(codes).forEach(function (key) {
  var val = codes[key];
  var style = styles[key] = [];
  style.open = '\u001b[' + val[0] + 'm';
  style.close = '\u001b[' + val[1] + 'm';
});
},{}],122:[function(require,module,exports){
(function (process){
/*
The MIT License (MIT)

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (sindresorhus.com)

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

var argv = process.argv;

module.exports = (function () {
  if (argv.indexOf('--no-color') !== -1 ||
    argv.indexOf('--color=false') !== -1) {
    return false;
  }

  if (argv.indexOf('--color') !== -1 ||
    argv.indexOf('--color=true') !== -1 ||
    argv.indexOf('--color=always') !== -1) {
    return true;
  }

  if (process.stdout && !process.stdout.isTTY) {
    return false;
  }

  if (process.platform === 'win32') {
    return true;
  }

  if ('COLORTERM' in process.env) {
    return true;
  }

  if (process.env.TERM === 'dumb') {
    return false;
  }

  if (/^screen|^xterm|^vt100|color|ansi|cygwin|linux/i.test(process.env.TERM)) {
    return true;
  }

  return false;
})();
}).call(this,require('_process'))
},{"_process":147}],123:[function(require,module,exports){
/*
  Copyright (C) 2013 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2013 Thaddee Tyl <thaddee.tyl@gmail.com>
  Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2012 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Joost-Wim Boekesteijn <joost-wim@boekesteijn.nl>
  Copyright (C) 2012 Kris Kowal <kris.kowal@cixar.com>
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>
  Copyright (C) 2012 Arpad Borsos <arpad.borsos@googlemail.com>
  Copyright (C) 2011 Ariya Hidayat <ariya.hidayat@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*jslint bitwise:true plusplus:true */
/*global esprima:true, define:true, exports:true, window: true,
throwError: true, generateStatement: true, peek: true,
parseAssignmentExpression: true, parseBlock: true,
parseClassExpression: true, parseClassDeclaration: true, parseExpression: true,
parseForStatement: true,
parseFunctionDeclaration: true, parseFunctionExpression: true,
parseFunctionSourceElements: true, parseVariableIdentifier: true,
parseImportSpecifier: true,
parseLeftHandSideExpression: true, parseParams: true, validateParam: true,
parseSpreadOrAssignmentExpression: true,
parseStatement: true, parseSourceElement: true, parseConciseBody: true,
parseYieldExpression: true
*/

(function (root, factory) {
    'use strict';

    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // Rhino, and plain browser loading.
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        factory((root.esprima = {}));
    }
}(this, function (exports) {
    'use strict';

    var Token,
        TokenName,
        FnExprTokens,
        Syntax,
        PropertyKind,
        Messages,
        Regex,
        SyntaxTreeDelegate,
        ClassPropertyType,
        source,
        strict,
        index,
        lineNumber,
        lineStart,
        length,
        delegate,
        lookahead,
        state,
        extra;

    Token = {
        BooleanLiteral: 1,
        EOF: 2,
        Identifier: 3,
        Keyword: 4,
        NullLiteral: 5,
        NumericLiteral: 6,
        Punctuator: 7,
        StringLiteral: 8,
        RegularExpression: 9,
        Template: 10
    };

    TokenName = {};
    TokenName[Token.BooleanLiteral] = 'Boolean';
    TokenName[Token.EOF] = '<end>';
    TokenName[Token.Identifier] = 'Identifier';
    TokenName[Token.Keyword] = 'Keyword';
    TokenName[Token.NullLiteral] = 'Null';
    TokenName[Token.NumericLiteral] = 'Numeric';
    TokenName[Token.Punctuator] = 'Punctuator';
    TokenName[Token.StringLiteral] = 'String';
    TokenName[Token.RegularExpression] = 'RegularExpression';

    // A function following one of those tokens is an expression.
    FnExprTokens = ['(', '{', '[', 'in', 'typeof', 'instanceof', 'new',
                    'return', 'case', 'delete', 'throw', 'void',
                    // assignment operators
                    '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=',
                    '&=', '|=', '^=', ',',
                    // binary/unary operators
                    '+', '-', '*', '/', '%', '++', '--', '<<', '>>', '>>>', '&',
                    '|', '^', '!', '~', '&&', '||', '?', ':', '===', '==', '>=',
                    '<=', '<', '>', '!=', '!=='];

    Syntax = {
        ArrayExpression: 'ArrayExpression',
        ArrayPattern: 'ArrayPattern',
        ArrowFunctionExpression: 'ArrowFunctionExpression',
        AssignmentExpression: 'AssignmentExpression',
        BinaryExpression: 'BinaryExpression',
        BlockStatement: 'BlockStatement',
        BreakStatement: 'BreakStatement',
        CallExpression: 'CallExpression',
        CatchClause: 'CatchClause',
        ClassBody: 'ClassBody',
        ClassDeclaration: 'ClassDeclaration',
        ClassExpression: 'ClassExpression',
        ComprehensionBlock: 'ComprehensionBlock',
        ComprehensionExpression: 'ComprehensionExpression',
        ConditionalExpression: 'ConditionalExpression',
        ContinueStatement: 'ContinueStatement',
        DebuggerStatement: 'DebuggerStatement',
        DoWhileStatement: 'DoWhileStatement',
        EmptyStatement: 'EmptyStatement',
        ExportDeclaration: 'ExportDeclaration',
        ExportBatchSpecifier: 'ExportBatchSpecifier',
        ExportSpecifier: 'ExportSpecifier',
        ExpressionStatement: 'ExpressionStatement',
        ForInStatement: 'ForInStatement',
        ForOfStatement: 'ForOfStatement',
        ForStatement: 'ForStatement',
        FunctionDeclaration: 'FunctionDeclaration',
        FunctionExpression: 'FunctionExpression',
        Identifier: 'Identifier',
        IfStatement: 'IfStatement',
        ImportDeclaration: 'ImportDeclaration',
        ImportDefaultSpecifier: 'ImportDefaultSpecifier',
        ImportNamespaceSpecifier: 'ImportNamespaceSpecifier',
        ImportSpecifier: 'ImportSpecifier',
        LabeledStatement: 'LabeledStatement',
        Literal: 'Literal',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        MethodDefinition: 'MethodDefinition',
        ModuleSpecifier: 'ModuleSpecifier',
        NewExpression: 'NewExpression',
        ObjectExpression: 'ObjectExpression',
        ObjectPattern: 'ObjectPattern',
        Program: 'Program',
        Property: 'Property',
        ReturnStatement: 'ReturnStatement',
        SequenceExpression: 'SequenceExpression',
        SpreadElement: 'SpreadElement',
        SwitchCase: 'SwitchCase',
        SwitchStatement: 'SwitchStatement',
        TaggedTemplateExpression: 'TaggedTemplateExpression',
        TemplateElement: 'TemplateElement',
        TemplateLiteral: 'TemplateLiteral',
        ThisExpression: 'ThisExpression',
        ThrowStatement: 'ThrowStatement',
        TryStatement: 'TryStatement',
        UnaryExpression: 'UnaryExpression',
        UpdateExpression: 'UpdateExpression',
        VariableDeclaration: 'VariableDeclaration',
        VariableDeclarator: 'VariableDeclarator',
        WhileStatement: 'WhileStatement',
        WithStatement: 'WithStatement',
        YieldExpression: 'YieldExpression'
    };

    PropertyKind = {
        Data: 1,
        Get: 2,
        Set: 4
    };

    ClassPropertyType = {
        'static': 'static',
        prototype: 'prototype'
    };

    // Error messages should be identical to V8.
    Messages = {
        UnexpectedToken:  'Unexpected token %0',
        UnexpectedNumber:  'Unexpected number',
        UnexpectedString:  'Unexpected string',
        UnexpectedIdentifier:  'Unexpected identifier',
        UnexpectedReserved:  'Unexpected reserved word',
        UnexpectedTemplate:  'Unexpected quasi %0',
        UnexpectedEOS:  'Unexpected end of input',
        NewlineAfterThrow:  'Illegal newline after throw',
        InvalidRegExp: 'Invalid regular expression',
        UnterminatedRegExp:  'Invalid regular expression: missing /',
        InvalidLHSInAssignment:  'Invalid left-hand side in assignment',
        InvalidLHSInFormalsList:  'Invalid left-hand side in formals list',
        InvalidLHSInForIn:  'Invalid left-hand side in for-in',
        MultipleDefaultsInSwitch: 'More than one default clause in switch statement',
        NoCatchOrFinally:  'Missing catch or finally after try',
        UnknownLabel: 'Undefined label \'%0\'',
        Redeclaration: '%0 \'%1\' has already been declared',
        IllegalContinue: 'Illegal continue statement',
        IllegalBreak: 'Illegal break statement',
        IllegalDuplicateClassProperty: 'Illegal duplicate property in class definition',
        IllegalReturn: 'Illegal return statement',
        IllegalYield: 'Illegal yield expression',
        IllegalSpread: 'Illegal spread element',
        StrictModeWith:  'Strict mode code may not include a with statement',
        StrictCatchVariable:  'Catch variable may not be eval or arguments in strict mode',
        StrictVarName:  'Variable name may not be eval or arguments in strict mode',
        StrictParamName:  'Parameter name eval or arguments is not allowed in strict mode',
        StrictParamDupe: 'Strict mode function may not have duplicate parameter names',
        ParameterAfterRestParameter: 'Rest parameter must be final parameter of an argument list',
        DefaultRestParameter: 'Rest parameter can not have a default value',
        ElementAfterSpreadElement: 'Spread must be the final element of an element list',
        ObjectPatternAsRestParameter: 'Invalid rest parameter',
        ObjectPatternAsSpread: 'Invalid spread argument',
        StrictFunctionName:  'Function name may not be eval or arguments in strict mode',
        StrictOctalLiteral:  'Octal literals are not allowed in strict mode.',
        StrictDelete:  'Delete of an unqualified identifier in strict mode.',
        StrictDuplicateProperty:  'Duplicate data property in object literal not allowed in strict mode',
        AccessorDataProperty:  'Object literal may not have data and accessor property with the same name',
        AccessorGetSet:  'Object literal may not have multiple get/set accessors with the same name',
        StrictLHSAssignment:  'Assignment to eval or arguments is not allowed in strict mode',
        StrictLHSPostfix:  'Postfix increment/decrement may not have eval or arguments operand in strict mode',
        StrictLHSPrefix:  'Prefix increment/decrement may not have eval or arguments operand in strict mode',
        StrictReservedWord:  'Use of future reserved word in strict mode',
        MissingFromClause: 'Missing from clause',
        NoAsAfterImportNamespace: 'Missing as after import *',
        InvalidModuleSpecifier: 'Invalid module specifier',
        NoUnintializedConst: 'Const must be initialized',
        ComprehensionRequiresBlock: 'Comprehension must have at least one block',
        ComprehensionError:  'Comprehension Error',
        EachNotAllowed:  'Each is not supported'
    };

    // See also tools/generate-unicode-regex.py.
    Regex = {
        NonAsciiIdentifierStart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]'),
        NonAsciiIdentifierPart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0300-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u0483-\u0487\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea\u05f0-\u05f2\u0610-\u061a\u0620-\u0669\u066e-\u06d3\u06d5-\u06dc\u06df-\u06e8\u06ea-\u06fc\u06ff\u0710-\u074a\u074d-\u07b1\u07c0-\u07f5\u07fa\u0800-\u082d\u0840-\u085b\u08a0\u08a2-\u08ac\u08e4-\u08fe\u0900-\u0963\u0966-\u096f\u0971-\u0977\u0979-\u097f\u0981-\u0983\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bc-\u09c4\u09c7\u09c8\u09cb-\u09ce\u09d7\u09dc\u09dd\u09df-\u09e3\u09e6-\u09f1\u0a01-\u0a03\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a59-\u0a5c\u0a5e\u0a66-\u0a75\u0a81-\u0a83\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abc-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ad0\u0ae0-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3c-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5c\u0b5d\u0b5f-\u0b63\u0b66-\u0b6f\u0b71\u0b82\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd0\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c58\u0c59\u0c60-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbc-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0cde\u0ce0-\u0ce3\u0ce6-\u0cef\u0cf1\u0cf2\u0d02\u0d03\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d-\u0d44\u0d46-\u0d48\u0d4a-\u0d4e\u0d57\u0d60-\u0d63\u0d66-\u0d6f\u0d7a-\u0d7f\u0d82\u0d83\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e01-\u0e3a\u0e40-\u0e4e\u0e50-\u0e59\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb9\u0ebb-\u0ebd\u0ec0-\u0ec4\u0ec6\u0ec8-\u0ecd\u0ed0-\u0ed9\u0edc-\u0edf\u0f00\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e-\u0f47\u0f49-\u0f6c\u0f71-\u0f84\u0f86-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1049\u1050-\u109d\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u135d-\u135f\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176c\u176e-\u1770\u1772\u1773\u1780-\u17d3\u17d7\u17dc\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1820-\u1877\u1880-\u18aa\u18b0-\u18f5\u1900-\u191c\u1920-\u192b\u1930-\u193b\u1946-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u19d0-\u19d9\u1a00-\u1a1b\u1a20-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1aa7\u1b00-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1bf3\u1c00-\u1c37\u1c40-\u1c49\u1c4d-\u1c7d\u1cd0-\u1cd2\u1cd4-\u1cf6\u1d00-\u1de6\u1dfc-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u200c\u200d\u203f\u2040\u2054\u2071\u207f\u2090-\u209c\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d7f-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2de0-\u2dff\u2e2f\u3005-\u3007\u3021-\u302f\u3031-\u3035\u3038-\u303c\u3041-\u3096\u3099\u309a\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua62b\ua640-\ua66f\ua674-\ua67d\ua67f-\ua697\ua69f-\ua6f1\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua827\ua840-\ua873\ua880-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f7\ua8fb\ua900-\ua92d\ua930-\ua953\ua960-\ua97c\ua980-\ua9c0\ua9cf-\ua9d9\uaa00-\uaa36\uaa40-\uaa4d\uaa50-\uaa59\uaa60-\uaa76\uaa7a\uaa7b\uaa80-\uaac2\uaadb-\uaadd\uaae0-\uaaef\uaaf2-\uaaf6\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabea\uabec\uabed\uabf0-\uabf9\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff3f\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]')
    };

    // Ensure the condition is true, otherwise throw an error.
    // This is only to have a better contract semantic, i.e. another safety net
    // to catch a logic error. The condition shall be fulfilled in normal case.
    // Do NOT use this to enforce a certain condition on any user input.

    function assert(condition, message) {
        if (!condition) {
            throw new Error('ASSERT: ' + message);
        }
    }

    function isDecimalDigit(ch) {
        return (ch >= 48 && ch <= 57);   // 0..9
    }

    function isHexDigit(ch) {
        return '0123456789abcdefABCDEF'.indexOf(ch) >= 0;
    }

    function isOctalDigit(ch) {
        return '01234567'.indexOf(ch) >= 0;
    }


    // 7.2 White Space

    function isWhiteSpace(ch) {
        return (ch === 32) ||  // space
            (ch === 9) ||      // tab
            (ch === 0xB) ||
            (ch === 0xC) ||
            (ch === 0xA0) ||
            (ch >= 0x1680 && '\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\uFEFF'.indexOf(String.fromCharCode(ch)) > 0);
    }

    // 7.3 Line Terminators

    function isLineTerminator(ch) {
        return (ch === 10) || (ch === 13) || (ch === 0x2028) || (ch === 0x2029);
    }

    // 7.6 Identifier Names and Identifiers

    function isIdentifierStart(ch) {
        return (ch === 36) || (ch === 95) ||  // $ (dollar) and _ (underscore)
            (ch >= 65 && ch <= 90) ||         // A..Z
            (ch >= 97 && ch <= 122) ||        // a..z
            (ch === 92) ||                    // \ (backslash)
            ((ch >= 0x80) && Regex.NonAsciiIdentifierStart.test(String.fromCharCode(ch)));
    }

    function isIdentifierPart(ch) {
        return (ch === 36) || (ch === 95) ||  // $ (dollar) and _ (underscore)
            (ch >= 65 && ch <= 90) ||         // A..Z
            (ch >= 97 && ch <= 122) ||        // a..z
            (ch >= 48 && ch <= 57) ||         // 0..9
            (ch === 92) ||                    // \ (backslash)
            ((ch >= 0x80) && Regex.NonAsciiIdentifierPart.test(String.fromCharCode(ch)));
    }

    // 7.6.1.2 Future Reserved Words

    function isFutureReservedWord(id) {
        switch (id) {
        case 'class':
        case 'enum':
        case 'export':
        case 'extends':
        case 'import':
        case 'super':
            return true;
        default:
            return false;
        }
    }

    function isStrictModeReservedWord(id) {
        switch (id) {
        case 'implements':
        case 'interface':
        case 'package':
        case 'private':
        case 'protected':
        case 'public':
        case 'static':
        case 'yield':
        case 'let':
            return true;
        default:
            return false;
        }
    }

    function isRestrictedWord(id) {
        return id === 'eval' || id === 'arguments';
    }

    // 7.6.1.1 Keywords

    function isKeyword(id) {
        if (strict && isStrictModeReservedWord(id)) {
            return true;
        }

        // 'const' is specialized as Keyword in V8.
        // 'yield' is only treated as a keyword in strict mode.
        // 'let' is for compatiblity with SpiderMonkey and ES.next.
        // Some others are from future reserved words.

        switch (id.length) {
        case 2:
            return (id === 'if') || (id === 'in') || (id === 'do');
        case 3:
            return (id === 'var') || (id === 'for') || (id === 'new') ||
                (id === 'try') || (id === 'let');
        case 4:
            return (id === 'this') || (id === 'else') || (id === 'case') ||
                (id === 'void') || (id === 'with') || (id === 'enum');
        case 5:
            return (id === 'while') || (id === 'break') || (id === 'catch') ||
                (id === 'throw') || (id === 'const') ||
                (id === 'class') || (id === 'super');
        case 6:
            return (id === 'return') || (id === 'typeof') || (id === 'delete') ||
                (id === 'switch') || (id === 'export') || (id === 'import');
        case 7:
            return (id === 'default') || (id === 'finally') || (id === 'extends');
        case 8:
            return (id === 'function') || (id === 'continue') || (id === 'debugger');
        case 10:
            return (id === 'instanceof');
        default:
            return false;
        }
    }

    // 7.4 Comments

    function skipComment() {
        var ch, blockComment, lineComment;

        blockComment = false;
        lineComment = false;

        while (index < length) {
            ch = source.charCodeAt(index);

            if (lineComment) {
                ++index;
                if (isLineTerminator(ch)) {
                    lineComment = false;
                    if (ch === 13 && source.charCodeAt(index) === 10) {
                        ++index;
                    }
                    ++lineNumber;
                    lineStart = index;
                }
            } else if (blockComment) {
                if (isLineTerminator(ch)) {
                    if (ch === 13 && source.charCodeAt(index + 1) === 10) {
                        ++index;
                    }
                    ++lineNumber;
                    ++index;
                    lineStart = index;
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    ch = source.charCodeAt(index++);
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                    // Block comment ends with '*/' (char #42, char #47).
                    if (ch === 42) {
                        ch = source.charCodeAt(index);
                        if (ch === 47) {
                            ++index;
                            blockComment = false;
                        }
                    }
                }
            } else if (ch === 47) {
                ch = source.charCodeAt(index + 1);
                // Line comment starts with '//' (char #47, char #47).
                if (ch === 47) {
                    index += 2;
                    lineComment = true;
                } else if (ch === 42) {
                    // Block comment starts with '/*' (char #47, char #42).
                    index += 2;
                    blockComment = true;
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    break;
                }
            } else if (isWhiteSpace(ch)) {
                ++index;
            } else if (isLineTerminator(ch)) {
                ++index;
                if (ch === 13 && source.charCodeAt(index) === 10) {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
            } else {
                break;
            }
        }
    }

    function scanHexEscape(prefix) {
        var i, len, ch, code = 0;

        len = (prefix === 'u') ? 4 : 2;
        for (i = 0; i < len; ++i) {
            if (index < length && isHexDigit(source[index])) {
                ch = source[index++];
                code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
            } else {
                return '';
            }
        }
        return String.fromCharCode(code);
    }

    function scanUnicodeCodePointEscape() {
        var ch, code, cu1, cu2;

        ch = source[index];
        code = 0;

        // At least, one hex digit is required.
        if (ch === '}') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        while (index < length) {
            ch = source[index++];
            if (!isHexDigit(ch)) {
                break;
            }
            code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
        }

        if (code > 0x10FFFF || ch !== '}') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        // UTF-16 Encoding
        if (code <= 0xFFFF) {
            return String.fromCharCode(code);
        }
        cu1 = ((code - 0x10000) >> 10) + 0xD800;
        cu2 = ((code - 0x10000) & 1023) + 0xDC00;
        return String.fromCharCode(cu1, cu2);
    }

    function getEscapedIdentifier() {
        var ch, id;

        ch = source.charCodeAt(index++);
        id = String.fromCharCode(ch);

        // '\u' (char #92, char #117) denotes an escaped character.
        if (ch === 92) {
            if (source.charCodeAt(index) !== 117) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
            ++index;
            ch = scanHexEscape('u');
            if (!ch || ch === '\\' || !isIdentifierStart(ch.charCodeAt(0))) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
            id = ch;
        }

        while (index < length) {
            ch = source.charCodeAt(index);
            if (!isIdentifierPart(ch)) {
                break;
            }
            ++index;
            id += String.fromCharCode(ch);

            // '\u' (char #92, char #117) denotes an escaped character.
            if (ch === 92) {
                id = id.substr(0, id.length - 1);
                if (source.charCodeAt(index) !== 117) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
                ++index;
                ch = scanHexEscape('u');
                if (!ch || ch === '\\' || !isIdentifierPart(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
                id += ch;
            }
        }

        return id;
    }

    function getIdentifier() {
        var start, ch;

        start = index++;
        while (index < length) {
            ch = source.charCodeAt(index);
            if (ch === 92) {
                // Blackslash (char #92) marks Unicode escape sequence.
                index = start;
                return getEscapedIdentifier();
            }
            if (isIdentifierPart(ch)) {
                ++index;
            } else {
                break;
            }
        }

        return source.slice(start, index);
    }

    function scanIdentifier() {
        var start, id, type;

        start = index;

        // Backslash (char #92) starts an escaped character.
        id = (source.charCodeAt(index) === 92) ? getEscapedIdentifier() : getIdentifier();

        // There is no keyword or literal with only one character.
        // Thus, it must be an identifier.
        if (id.length === 1) {
            type = Token.Identifier;
        } else if (isKeyword(id)) {
            type = Token.Keyword;
        } else if (id === 'null') {
            type = Token.NullLiteral;
        } else if (id === 'true' || id === 'false') {
            type = Token.BooleanLiteral;
        } else {
            type = Token.Identifier;
        }

        return {
            type: type,
            value: id,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }


    // 7.7 Punctuators

    function scanPunctuator() {
        var start = index,
            code = source.charCodeAt(index),
            code2,
            ch1 = source[index],
            ch2,
            ch3,
            ch4;

        switch (code) {
        // Check for most common single-character punctuators.
        case 40:   // ( open bracket
        case 41:   // ) close bracket
        case 59:   // ; semicolon
        case 44:   // , comma
        case 123:  // { open curly brace
        case 125:  // } close curly brace
        case 91:   // [
        case 93:   // ]
        case 58:   // :
        case 63:   // ?
        case 126:  // ~
            ++index;
            if (extra.tokenize) {
                if (code === 40) {
                    extra.openParenToken = extra.tokens.length;
                } else if (code === 123) {
                    extra.openCurlyToken = extra.tokens.length;
                }
            }
            return {
                type: Token.Punctuator,
                value: String.fromCharCode(code),
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };

        default:
            code2 = source.charCodeAt(index + 1);

            // '=' (char #61) marks an assignment or comparison operator.
            if (code2 === 61) {
                switch (code) {
                case 37:  // %
                case 38:  // &
                case 42:  // *:
                case 43:  // +
                case 45:  // -
                case 47:  // /
                case 60:  // <
                case 62:  // >
                case 94:  // ^
                case 124: // |
                    index += 2;
                    return {
                        type: Token.Punctuator,
                        value: String.fromCharCode(code) + String.fromCharCode(code2),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };

                case 33: // !
                case 61: // =
                    index += 2;

                    // !== and ===
                    if (source.charCodeAt(index) === 61) {
                        ++index;
                    }
                    return {
                        type: Token.Punctuator,
                        value: source.slice(start, index),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                default:
                    break;
                }
            }
            break;
        }

        // Peek more characters.

        ch2 = source[index + 1];
        ch3 = source[index + 2];
        ch4 = source[index + 3];

        // 4-character punctuator: >>>=

        if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
            if (ch4 === '=') {
                index += 4;
                return {
                    type: Token.Punctuator,
                    value: '>>>=',
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }
        }

        // 3-character punctuators: === !== >>> <<= >>=

        if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '>>>',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '<' && ch2 === '<' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '<<=',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '>' && ch2 === '>' && ch3 === '=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '>>=',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '.' && ch2 === '.' && ch3 === '.') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: '...',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // Other 2-character punctuators: ++ -- << >> && ||

        if (ch1 === ch2 && ('+-<>&|'.indexOf(ch1) >= 0)) {
            index += 2;
            return {
                type: Token.Punctuator,
                value: ch1 + ch2,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '=' && ch2 === '>') {
            index += 2;
            return {
                type: Token.Punctuator,
                value: '=>',
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if ('<>=!+-*%&|^/'.indexOf(ch1) >= 0) {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        if (ch1 === '.') {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    // 7.8.3 Numeric Literals

    function scanHexLiteral(start) {
        var number = '';

        while (index < length) {
            if (!isHexDigit(source[index])) {
                break;
            }
            number += source[index++];
        }

        if (number.length === 0) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseInt('0x' + number, 16),
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanOctalLiteral(prefix, start) {
        var number, octal;

        if (isOctalDigit(prefix)) {
            octal = true;
            number = '0' + source[index++];
        } else {
            octal = false;
            ++index;
            number = '';
        }

        while (index < length) {
            if (!isOctalDigit(source[index])) {
                break;
            }
            number += source[index++];
        }

        if (!octal && number.length === 0) {
            // only 0o or 0O
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        if (isIdentifierStart(source.charCodeAt(index)) || isDecimalDigit(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseInt(number, 8),
            octal: octal,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanNumericLiteral() {
        var number, start, ch, octal;

        ch = source[index];
        assert(isDecimalDigit(ch.charCodeAt(0)) || (ch === '.'),
            'Numeric literal must start with a decimal digit or a decimal point');

        start = index;
        number = '';
        if (ch !== '.') {
            number = source[index++];
            ch = source[index];

            // Hex number starts with '0x'.
            // Octal number starts with '0'.
            // Octal number in ES6 starts with '0o'.
            // Binary number in ES6 starts with '0b'.
            if (number === '0') {
                if (ch === 'x' || ch === 'X') {
                    ++index;
                    return scanHexLiteral(start);
                }
                if (ch === 'b' || ch === 'B') {
                    ++index;
                    number = '';

                    while (index < length) {
                        ch = source[index];
                        if (ch !== '0' && ch !== '1') {
                            break;
                        }
                        number += source[index++];
                    }

                    if (number.length === 0) {
                        // only 0b or 0B
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }

                    if (index < length) {
                        ch = source.charCodeAt(index);
                        if (isIdentifierStart(ch) || isDecimalDigit(ch)) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                    }
                    return {
                        type: Token.NumericLiteral,
                        value: parseInt(number, 2),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                }
                if (ch === 'o' || ch === 'O' || isOctalDigit(ch)) {
                    return scanOctalLiteral(ch, start);
                }
                // decimal number starts with '0' such as '09' is illegal.
                if (ch && isDecimalDigit(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            }

            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === '.') {
            number += source[index++];
            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === 'e' || ch === 'E') {
            number += source[index++];

            ch = source[index];
            if (ch === '+' || ch === '-') {
                number += source[index++];
            }
            if (isDecimalDigit(source.charCodeAt(index))) {
                while (isDecimalDigit(source.charCodeAt(index))) {
                    number += source[index++];
                }
            } else {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseFloat(number),
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    // 7.8.4 String Literals

    function scanStringLiteral() {
        var str = '', quote, start, ch, code, unescaped, restore, octal = false;

        quote = source[index];
        assert((quote === '\'' || quote === '"'),
            'String literal must starts with a quote');

        start = index;
        ++index;

        while (index < length) {
            ch = source[index++];

            if (ch === quote) {
                quote = '';
                break;
            } else if (ch === '\\') {
                ch = source[index++];
                if (!ch || !isLineTerminator(ch.charCodeAt(0))) {
                    switch (ch) {
                    case 'n':
                        str += '\n';
                        break;
                    case 'r':
                        str += '\r';
                        break;
                    case 't':
                        str += '\t';
                        break;
                    case 'u':
                    case 'x':
                        if (source[index] === '{') {
                            ++index;
                            str += scanUnicodeCodePointEscape();
                        } else {
                            restore = index;
                            unescaped = scanHexEscape(ch);
                            if (unescaped) {
                                str += unescaped;
                            } else {
                                index = restore;
                                str += ch;
                            }
                        }
                        break;
                    case 'b':
                        str += '\b';
                        break;
                    case 'f':
                        str += '\f';
                        break;
                    case 'v':
                        str += '\x0B';
                        break;

                    default:
                        if (isOctalDigit(ch)) {
                            code = '01234567'.indexOf(ch);

                            // \0 is not octal escape sequence
                            if (code !== 0) {
                                octal = true;
                            }

                            if (index < length && isOctalDigit(source[index])) {
                                octal = true;
                                code = code * 8 + '01234567'.indexOf(source[index++]);

                                // 3 digits are only allowed when string starts
                                // with 0, 1, 2, 3
                                if ('0123'.indexOf(ch) >= 0 &&
                                        index < length &&
                                        isOctalDigit(source[index])) {
                                    code = code * 8 + '01234567'.indexOf(source[index++]);
                                }
                            }
                            str += String.fromCharCode(code);
                        } else {
                            str += ch;
                        }
                        break;
                    }
                } else {
                    ++lineNumber;
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                    lineStart = index;
                }
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                break;
            } else {
                str += ch;
            }
        }

        if (quote !== '') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.StringLiteral,
            value: str,
            octal: octal,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanTemplate() {
        var cooked = '', ch, start, terminated, tail, restore, unescaped, code, octal;

        terminated = false;
        tail = false;
        start = index;

        ++index;

        while (index < length) {
            ch = source[index++];
            if (ch === '`') {
                tail = true;
                terminated = true;
                break;
            } else if (ch === '$') {
                if (source[index] === '{') {
                    ++index;
                    terminated = true;
                    break;
                }
                cooked += ch;
            } else if (ch === '\\') {
                ch = source[index++];
                if (!isLineTerminator(ch.charCodeAt(0))) {
                    switch (ch) {
                    case 'n':
                        cooked += '\n';
                        break;
                    case 'r':
                        cooked += '\r';
                        break;
                    case 't':
                        cooked += '\t';
                        break;
                    case 'u':
                    case 'x':
                        if (source[index] === '{') {
                            ++index;
                            cooked += scanUnicodeCodePointEscape();
                        } else {
                            restore = index;
                            unescaped = scanHexEscape(ch);
                            if (unescaped) {
                                cooked += unescaped;
                            } else {
                                index = restore;
                                cooked += ch;
                            }
                        }
                        break;
                    case 'b':
                        cooked += '\b';
                        break;
                    case 'f':
                        cooked += '\f';
                        break;
                    case 'v':
                        cooked += '\v';
                        break;

                    default:
                        if (isOctalDigit(ch)) {
                            code = '01234567'.indexOf(ch);

                            // \0 is not octal escape sequence
                            if (code !== 0) {
                                octal = true;
                            }

                            if (index < length && isOctalDigit(source[index])) {
                                octal = true;
                                code = code * 8 + '01234567'.indexOf(source[index++]);

                                // 3 digits are only allowed when string starts
                                // with 0, 1, 2, 3
                                if ('0123'.indexOf(ch) >= 0 &&
                                        index < length &&
                                        isOctalDigit(source[index])) {
                                    code = code * 8 + '01234567'.indexOf(source[index++]);
                                }
                            }
                            cooked += String.fromCharCode(code);
                        } else {
                            cooked += ch;
                        }
                        break;
                    }
                } else {
                    ++lineNumber;
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                    lineStart = index;
                }
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                ++lineNumber;
                if (ch ===  '\r' && source[index] === '\n') {
                    ++index;
                }
                lineStart = index;
                cooked += '\n';
            } else {
                cooked += ch;
            }
        }

        if (!terminated) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.Template,
            value: {
                cooked: cooked,
                raw: source.slice(start + 1, index - ((tail) ? 1 : 2))
            },
            tail: tail,
            octal: octal,
            lineNumber: lineNumber,
            lineStart: lineStart,
            range: [start, index]
        };
    }

    function scanTemplateElement(option) {
        var startsWith, template;

        lookahead = null;
        skipComment();

        startsWith = (option.head) ? '`' : '}';

        if (source[index] !== startsWith) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        template = scanTemplate();

        peek();

        return template;
    }

    function scanRegExp() {
        var str, ch, start, pattern, flags, value, classMarker = false, restore, terminated = false, tmp;

        lookahead = null;
        skipComment();

        start = index;
        ch = source[index];
        assert(ch === '/', 'Regular expression literal must start with a slash');
        str = source[index++];

        while (index < length) {
            ch = source[index++];
            str += ch;
            if (classMarker) {
                if (ch === ']') {
                    classMarker = false;
                }
            } else {
                if (ch === '\\') {
                    ch = source[index++];
                    // ECMA-262 7.8.5
                    if (isLineTerminator(ch.charCodeAt(0))) {
                        throwError({}, Messages.UnterminatedRegExp);
                    }
                    str += ch;
                } else if (ch === '/') {
                    terminated = true;
                    break;
                } else if (ch === '[') {
                    classMarker = true;
                } else if (isLineTerminator(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnterminatedRegExp);
                }
            }
        }

        if (!terminated) {
            throwError({}, Messages.UnterminatedRegExp);
        }

        // Exclude leading and trailing slash.
        pattern = str.substr(1, str.length - 2);

        flags = '';
        while (index < length) {
            ch = source[index];
            if (!isIdentifierPart(ch.charCodeAt(0))) {
                break;
            }

            ++index;
            if (ch === '\\' && index < length) {
                ch = source[index];
                if (ch === 'u') {
                    ++index;
                    restore = index;
                    ch = scanHexEscape('u');
                    if (ch) {
                        flags += ch;
                        for (str += '\\u'; restore < index; ++restore) {
                            str += source[restore];
                        }
                    } else {
                        index = restore;
                        flags += 'u';
                        str += '\\u';
                    }
                } else {
                    str += '\\';
                }
            } else {
                flags += ch;
                str += ch;
            }
        }

        tmp = pattern;
        if (flags.indexOf('u') >= 0) {
            // Replace each astral symbol and every Unicode code point
            // escape sequence that represents such a symbol with a single
            // ASCII symbol to avoid throwing on regular expressions that
            // are only valid in combination with the `/u` flag.
            tmp = tmp
                .replace(/\\u\{([0-9a-fA-F]{5,6})\}/g, 'x')
                .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, 'x');
        }

        // First, detect invalid regular expressions.
        try {
            value = new RegExp(tmp);
        } catch (e) {
            throwError({}, Messages.InvalidRegExp);
        }

        // Return a regular expression object for this pattern-flag pair, or
        // `null` in case the current environment doesn't support the flags it
        // uses.
        try {
            value = new RegExp(pattern, flags);
        } catch (exception) {
            value = null;
        }

        peek();

        if (extra.tokenize) {
            return {
                type: Token.RegularExpression,
                value: value,
                regex: {
                    pattern: pattern,
                    flags: flags
                },
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }
        return {
            literal: str,
            value: value,
            regex: {
                pattern: pattern,
                flags: flags
            },
            range: [start, index]
        };
    }

    function isIdentifierName(token) {
        return token.type === Token.Identifier ||
            token.type === Token.Keyword ||
            token.type === Token.BooleanLiteral ||
            token.type === Token.NullLiteral;
    }

    function advanceSlash() {
        var prevToken,
            checkToken;
        // Using the following algorithm:
        // https://github.com/mozilla/sweet.js/wiki/design
        prevToken = extra.tokens[extra.tokens.length - 1];
        if (!prevToken) {
            // Nothing before that: it cannot be a division.
            return scanRegExp();
        }
        if (prevToken.type === 'Punctuator') {
            if (prevToken.value === ')') {
                checkToken = extra.tokens[extra.openParenToken - 1];
                if (checkToken &&
                        checkToken.type === 'Keyword' &&
                        (checkToken.value === 'if' ||
                         checkToken.value === 'while' ||
                         checkToken.value === 'for' ||
                         checkToken.value === 'with')) {
                    return scanRegExp();
                }
                return scanPunctuator();
            }
            if (prevToken.value === '}') {
                // Dividing a function by anything makes little sense,
                // but we have to check for that.
                if (extra.tokens[extra.openCurlyToken - 3] &&
                        extra.tokens[extra.openCurlyToken - 3].type === 'Keyword') {
                    // Anonymous function.
                    checkToken = extra.tokens[extra.openCurlyToken - 4];
                    if (!checkToken) {
                        return scanPunctuator();
                    }
                } else if (extra.tokens[extra.openCurlyToken - 4] &&
                        extra.tokens[extra.openCurlyToken - 4].type === 'Keyword') {
                    // Named function.
                    checkToken = extra.tokens[extra.openCurlyToken - 5];
                    if (!checkToken) {
                        return scanRegExp();
                    }
                } else {
                    return scanPunctuator();
                }
                // checkToken determines whether the function is
                // a declaration or an expression.
                if (FnExprTokens.indexOf(checkToken.value) >= 0) {
                    // It is an expression.
                    return scanPunctuator();
                }
                // It is a declaration.
                return scanRegExp();
            }
            return scanRegExp();
        }
        if (prevToken.type === 'Keyword') {
            return scanRegExp();
        }
        return scanPunctuator();
    }

    function advance() {
        var ch;

        skipComment();

        if (index >= length) {
            return {
                type: Token.EOF,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [index, index]
            };
        }

        ch = source.charCodeAt(index);

        // Very common: ( and ) and ;
        if (ch === 40 || ch === 41 || ch === 58) {
            return scanPunctuator();
        }

        // String literal starts with single quote (#39) or double quote (#34).
        if (ch === 39 || ch === 34) {
            return scanStringLiteral();
        }

        if (ch === 96) {
            return scanTemplate();
        }
        if (isIdentifierStart(ch)) {
            return scanIdentifier();
        }

        // Dot (.) char #46 can also start a floating-point number, hence the need
        // to check the next character.
        if (ch === 46) {
            if (isDecimalDigit(source.charCodeAt(index + 1))) {
                return scanNumericLiteral();
            }
            return scanPunctuator();
        }

        if (isDecimalDigit(ch)) {
            return scanNumericLiteral();
        }

        // Slash (/) char #47 can also start a regex.
        if (extra.tokenize && ch === 47) {
            return advanceSlash();
        }

        return scanPunctuator();
    }

    function lex() {
        var token;

        token = lookahead;
        index = token.range[1];
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;

        lookahead = advance();

        index = token.range[1];
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;

        return token;
    }

    function peek() {
        var pos, line, start;

        pos = index;
        line = lineNumber;
        start = lineStart;
        lookahead = advance();
        index = pos;
        lineNumber = line;
        lineStart = start;
    }

    function lookahead2() {
        var adv, pos, line, start, result;

        // If we are collecting the tokens, don't grab the next one yet.
        adv = (typeof extra.advance === 'function') ? extra.advance : advance;

        pos = index;
        line = lineNumber;
        start = lineStart;

        // Scan for the next immediate token.
        if (lookahead === null) {
            lookahead = adv();
        }
        index = lookahead.range[1];
        lineNumber = lookahead.lineNumber;
        lineStart = lookahead.lineStart;

        // Grab the token right after.
        result = adv();
        index = pos;
        lineNumber = line;
        lineStart = start;

        return result;
    }

    function markerCreate() {
        if (!extra.loc && !extra.range) {
            return undefined;
        }
        skipComment();
        return {offset: index, line: lineNumber, col: index - lineStart};
    }

    function processComment(node) {
        var lastChild,
            trailingComments,
            bottomRight = extra.bottomRightStack,
            last = bottomRight[bottomRight.length - 1];

        if (node.type === Syntax.Program) {
            if (node.body.length > 0) {
                return;
            }
        }

        if (extra.trailingComments.length > 0) {
            if (extra.trailingComments[0].range[0] >= node.range[1]) {
                trailingComments = extra.trailingComments;
                extra.trailingComments = [];
            } else {
                extra.trailingComments.length = 0;
            }
        } else {
            if (last && last.trailingComments && last.trailingComments[0].range[0] >= node.range[1]) {
                trailingComments = last.trailingComments;
                delete last.trailingComments;
            }
        }

        // Eating the stack.
        if (last) {
            while (last && last.range[0] >= node.range[0]) {
                lastChild = last;
                last = bottomRight.pop();
            }
        }

        if (lastChild) {
            if (lastChild.leadingComments && lastChild.leadingComments[lastChild.leadingComments.length - 1].range[1] <= node.range[0]) {
                node.leadingComments = lastChild.leadingComments;
                delete lastChild.leadingComments;
            }
        } else if (extra.leadingComments.length > 0 && extra.leadingComments[extra.leadingComments.length - 1].range[1] <= node.range[0]) {
            node.leadingComments = extra.leadingComments;
            extra.leadingComments = [];
        }

        if (trailingComments) {
            node.trailingComments = trailingComments;
        }

        bottomRight.push(node);
    }

    function markerApply(marker, node) {
        if (extra.range) {
            node.range = [marker.offset, index];
        }
        if (extra.loc) {
            node.loc = {
                start: {
                    line: marker.line,
                    column: marker.col
                },
                end: {
                    line: lineNumber,
                    column: index - lineStart
                }
            };
            node = delegate.postProcess(node);
        }
        if (extra.attachComment) {
            processComment(node);
        }
        return node;
    }

    SyntaxTreeDelegate = {

        name: 'SyntaxTree',

        postProcess: function (node) {
            return node;
        },

        createArrayExpression: function (elements) {
            return {
                type: Syntax.ArrayExpression,
                elements: elements
            };
        },

        createAssignmentExpression: function (operator, left, right) {
            return {
                type: Syntax.AssignmentExpression,
                operator: operator,
                left: left,
                right: right
            };
        },

        createBinaryExpression: function (operator, left, right) {
            var type = (operator === '||' || operator === '&&') ? Syntax.LogicalExpression :
                        Syntax.BinaryExpression;
            return {
                type: type,
                operator: operator,
                left: left,
                right: right
            };
        },

        createBlockStatement: function (body) {
            return {
                type: Syntax.BlockStatement,
                body: body
            };
        },

        createBreakStatement: function (label) {
            return {
                type: Syntax.BreakStatement,
                label: label
            };
        },

        createCallExpression: function (callee, args) {
            return {
                type: Syntax.CallExpression,
                callee: callee,
                'arguments': args
            };
        },

        createCatchClause: function (param, body) {
            return {
                type: Syntax.CatchClause,
                param: param,
                body: body
            };
        },

        createConditionalExpression: function (test, consequent, alternate) {
            return {
                type: Syntax.ConditionalExpression,
                test: test,
                consequent: consequent,
                alternate: alternate
            };
        },

        createContinueStatement: function (label) {
            return {
                type: Syntax.ContinueStatement,
                label: label
            };
        },

        createDebuggerStatement: function () {
            return {
                type: Syntax.DebuggerStatement
            };
        },

        createDoWhileStatement: function (body, test) {
            return {
                type: Syntax.DoWhileStatement,
                body: body,
                test: test
            };
        },

        createEmptyStatement: function () {
            return {
                type: Syntax.EmptyStatement
            };
        },

        createExpressionStatement: function (expression) {
            return {
                type: Syntax.ExpressionStatement,
                expression: expression
            };
        },

        createForStatement: function (init, test, update, body) {
            return {
                type: Syntax.ForStatement,
                init: init,
                test: test,
                update: update,
                body: body
            };
        },

        createForInStatement: function (left, right, body) {
            return {
                type: Syntax.ForInStatement,
                left: left,
                right: right,
                body: body,
                each: false
            };
        },

        createForOfStatement: function (left, right, body) {
            return {
                type: Syntax.ForOfStatement,
                left: left,
                right: right,
                body: body
            };
        },

        createFunctionDeclaration: function (id, params, defaults, body, rest, generator, expression) {
            return {
                type: Syntax.FunctionDeclaration,
                id: id,
                params: params,
                defaults: defaults,
                body: body,
                rest: rest,
                generator: generator,
                expression: expression
            };
        },

        createFunctionExpression: function (id, params, defaults, body, rest, generator, expression) {
            return {
                type: Syntax.FunctionExpression,
                id: id,
                params: params,
                defaults: defaults,
                body: body,
                rest: rest,
                generator: generator,
                expression: expression
            };
        },

        createIdentifier: function (name) {
            return {
                type: Syntax.Identifier,
                name: name
            };
        },

        createIfStatement: function (test, consequent, alternate) {
            return {
                type: Syntax.IfStatement,
                test: test,
                consequent: consequent,
                alternate: alternate
            };
        },

        createLabeledStatement: function (label, body) {
            return {
                type: Syntax.LabeledStatement,
                label: label,
                body: body
            };
        },

        createLiteral: function (token) {
            var object = {
                type: Syntax.Literal,
                value: token.value,
                raw: source.slice(token.range[0], token.range[1])
            };
            if (token.regex) {
                object.regex = token.regex;
            }
            return object;
        },

        createMemberExpression: function (accessor, object, property) {
            return {
                type: Syntax.MemberExpression,
                computed: accessor === '[',
                object: object,
                property: property
            };
        },

        createNewExpression: function (callee, args) {
            return {
                type: Syntax.NewExpression,
                callee: callee,
                'arguments': args
            };
        },

        createObjectExpression: function (properties) {
            return {
                type: Syntax.ObjectExpression,
                properties: properties
            };
        },

        createPostfixExpression: function (operator, argument) {
            return {
                type: Syntax.UpdateExpression,
                operator: operator,
                argument: argument,
                prefix: false
            };
        },

        createProgram: function (body) {
            return {
                type: Syntax.Program,
                body: body
            };
        },

        createProperty: function (kind, key, value, method, shorthand, computed) {
            return {
                type: Syntax.Property,
                key: key,
                value: value,
                kind: kind,
                method: method,
                shorthand: shorthand,
                computed: computed
            };
        },

        createReturnStatement: function (argument) {
            return {
                type: Syntax.ReturnStatement,
                argument: argument
            };
        },

        createSequenceExpression: function (expressions) {
            return {
                type: Syntax.SequenceExpression,
                expressions: expressions
            };
        },

        createSwitchCase: function (test, consequent) {
            return {
                type: Syntax.SwitchCase,
                test: test,
                consequent: consequent
            };
        },

        createSwitchStatement: function (discriminant, cases) {
            return {
                type: Syntax.SwitchStatement,
                discriminant: discriminant,
                cases: cases
            };
        },

        createThisExpression: function () {
            return {
                type: Syntax.ThisExpression
            };
        },

        createThrowStatement: function (argument) {
            return {
                type: Syntax.ThrowStatement,
                argument: argument
            };
        },

        createTryStatement: function (block, guardedHandlers, handlers, finalizer) {
            return {
                type: Syntax.TryStatement,
                block: block,
                guardedHandlers: guardedHandlers,
                handlers: handlers,
                finalizer: finalizer
            };
        },

        createUnaryExpression: function (operator, argument) {
            if (operator === '++' || operator === '--') {
                return {
                    type: Syntax.UpdateExpression,
                    operator: operator,
                    argument: argument,
                    prefix: true
                };
            }
            return {
                type: Syntax.UnaryExpression,
                operator: operator,
                argument: argument,
                prefix: true
            };
        },

        createVariableDeclaration: function (declarations, kind) {
            return {
                type: Syntax.VariableDeclaration,
                declarations: declarations,
                kind: kind
            };
        },

        createVariableDeclarator: function (id, init) {
            return {
                type: Syntax.VariableDeclarator,
                id: id,
                init: init
            };
        },

        createWhileStatement: function (test, body) {
            return {
                type: Syntax.WhileStatement,
                test: test,
                body: body
            };
        },

        createWithStatement: function (object, body) {
            return {
                type: Syntax.WithStatement,
                object: object,
                body: body
            };
        },

        createTemplateElement: function (value, tail) {
            return {
                type: Syntax.TemplateElement,
                value: value,
                tail: tail
            };
        },

        createTemplateLiteral: function (quasis, expressions) {
            return {
                type: Syntax.TemplateLiteral,
                quasis: quasis,
                expressions: expressions
            };
        },

        createSpreadElement: function (argument) {
            return {
                type: Syntax.SpreadElement,
                argument: argument
            };
        },

        createTaggedTemplateExpression: function (tag, quasi) {
            return {
                type: Syntax.TaggedTemplateExpression,
                tag: tag,
                quasi: quasi
            };
        },

        createArrowFunctionExpression: function (params, defaults, body, rest, expression) {
            return {
                type: Syntax.ArrowFunctionExpression,
                id: null,
                params: params,
                defaults: defaults,
                body: body,
                rest: rest,
                generator: false,
                expression: expression
            };
        },

        createMethodDefinition: function (propertyType, kind, key, value) {
            return {
                type: Syntax.MethodDefinition,
                key: key,
                value: value,
                kind: kind,
                'static': propertyType === ClassPropertyType.static
            };
        },

        createClassBody: function (body) {
            return {
                type: Syntax.ClassBody,
                body: body
            };
        },

        createClassExpression: function (id, superClass, body) {
            return {
                type: Syntax.ClassExpression,
                id: id,
                superClass: superClass,
                body: body
            };
        },

        createClassDeclaration: function (id, superClass, body) {
            return {
                type: Syntax.ClassDeclaration,
                id: id,
                superClass: superClass,
                body: body
            };
        },

        createModuleSpecifier: function (token) {
            return {
                type: Syntax.ModuleSpecifier,
                value: token.value,
                raw: source.slice(token.range[0], token.range[1])
            };
        },

        createExportSpecifier: function (id, name) {
            return {
                type: Syntax.ExportSpecifier,
                id: id,
                name: name
            };
        },

        createExportBatchSpecifier: function () {
            return {
                type: Syntax.ExportBatchSpecifier
            };
        },

        createImportDefaultSpecifier: function (id) {
            return {
                type: Syntax.ImportDefaultSpecifier,
                id: id
            };
        },

        createImportNamespaceSpecifier: function (id) {
            return {
                type: Syntax.ImportNamespaceSpecifier,
                id: id
            };
        },

        createExportDeclaration: function (isDefault, declaration, specifiers, source) {
            return {
                type: Syntax.ExportDeclaration,
                'default': !!isDefault,
                declaration: declaration,
                specifiers: specifiers,
                source: source
            };
        },

        createImportSpecifier: function (id, name) {
            return {
                type: Syntax.ImportSpecifier,
                id: id,
                name: name
            };
        },

        createImportDeclaration: function (specifiers, source) {
            return {
                type: Syntax.ImportDeclaration,
                specifiers: specifiers,
                source: source
            };
        },

        createYieldExpression: function (argument, delegate) {
            return {
                type: Syntax.YieldExpression,
                argument: argument,
                delegate: delegate
            };
        },

        createComprehensionExpression: function (filter, blocks, body) {
            return {
                type: Syntax.ComprehensionExpression,
                filter: filter,
                blocks: blocks,
                body: body
            };
        }

    };

    // Return true if there is a line terminator before the next token.

    function peekLineTerminator() {
        var pos, line, start, found;

        pos = index;
        line = lineNumber;
        start = lineStart;
        skipComment();
        found = lineNumber !== line;
        index = pos;
        lineNumber = line;
        lineStart = start;

        return found;
    }

    // Throw an exception

    function throwError(token, messageFormat) {
        var error,
            args = Array.prototype.slice.call(arguments, 2),
            msg = messageFormat.replace(
                /%(\d)/g,
                function (whole, index) {
                    assert(index < args.length, 'Message reference must be in range');
                    return args[index];
                }
            );

        if (typeof token.lineNumber === 'number') {
            error = new Error('Line ' + token.lineNumber + ': ' + msg);
            error.index = token.range[0];
            error.lineNumber = token.lineNumber;
            error.column = token.range[0] - lineStart + 1;
        } else {
            error = new Error('Line ' + lineNumber + ': ' + msg);
            error.index = index;
            error.lineNumber = lineNumber;
            error.column = index - lineStart + 1;
        }

        error.description = msg;
        throw error;
    }

    function throwErrorTolerant() {
        try {
            throwError.apply(null, arguments);
        } catch (e) {
            if (extra.errors) {
                extra.errors.push(e);
            } else {
                throw e;
            }
        }
    }


    // Throw an exception because of the token.

    function throwUnexpected(token) {
        if (token.type === Token.EOF) {
            throwError(token, Messages.UnexpectedEOS);
        }

        if (token.type === Token.NumericLiteral) {
            throwError(token, Messages.UnexpectedNumber);
        }

        if (token.type === Token.StringLiteral) {
            throwError(token, Messages.UnexpectedString);
        }

        if (token.type === Token.Identifier) {
            throwError(token, Messages.UnexpectedIdentifier);
        }

        if (token.type === Token.Keyword) {
            if (isFutureReservedWord(token.value)) {
                throwError(token, Messages.UnexpectedReserved);
            } else if (strict && isStrictModeReservedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictReservedWord);
                return;
            }
            throwError(token, Messages.UnexpectedToken, token.value);
        }

        if (token.type === Token.Template) {
            throwError(token, Messages.UnexpectedTemplate, token.value.raw);
        }

        // BooleanLiteral, NullLiteral, or Punctuator.
        throwError(token, Messages.UnexpectedToken, token.value);
    }

    // Expect the next token to match the specified punctuator.
    // If not, an exception will be thrown.

    function expect(value) {
        var token = lex();
        if (token.type !== Token.Punctuator || token.value !== value) {
            throwUnexpected(token);
        }
    }

    // Expect the next token to match the specified keyword.
    // If not, an exception will be thrown.

    function expectKeyword(keyword) {
        var token = lex();
        if (token.type !== Token.Keyword || token.value !== keyword) {
            throwUnexpected(token);
        }
    }

    // Return true if the next token matches the specified punctuator.

    function match(value) {
        return lookahead.type === Token.Punctuator && lookahead.value === value;
    }

    // Return true if the next token matches the specified keyword

    function matchKeyword(keyword) {
        return lookahead.type === Token.Keyword && lookahead.value === keyword;
    }


    // Return true if the next token matches the specified contextual keyword

    function matchContextualKeyword(keyword) {
        return lookahead.type === Token.Identifier && lookahead.value === keyword;
    }

    // Return true if the next token is an assignment operator

    function matchAssign() {
        var op;

        if (lookahead.type !== Token.Punctuator) {
            return false;
        }
        op = lookahead.value;
        return op === '=' ||
            op === '*=' ||
            op === '/=' ||
            op === '%=' ||
            op === '+=' ||
            op === '-=' ||
            op === '<<=' ||
            op === '>>=' ||
            op === '>>>=' ||
            op === '&=' ||
            op === '^=' ||
            op === '|=';
    }

    function consumeSemicolon() {
        var line, oldIndex = index, oldLineNumber = lineNumber,
            oldLineStart = lineStart, oldLookahead = lookahead;

        // Catch the very common case first: immediately a semicolon (char #59).
        if (source.charCodeAt(index) === 59) {
            lex();
            return;
        }

        line = lineNumber;
        skipComment();
        if (lineNumber !== line) {
            index = oldIndex;
            lineNumber = oldLineNumber;
            lineStart = oldLineStart;
            lookahead = oldLookahead;
            return;
        }

        if (match(';')) {
            lex();
            return;
        }

        if (lookahead.type !== Token.EOF && !match('}')) {
            throwUnexpected(lookahead);
        }
    }

    // Return true if provided expression is LeftHandSideExpression

    function isLeftHandSide(expr) {
        return expr.type === Syntax.Identifier || expr.type === Syntax.MemberExpression;
    }

    function isAssignableLeftHandSide(expr) {
        return isLeftHandSide(expr) || expr.type === Syntax.ObjectPattern || expr.type === Syntax.ArrayPattern;
    }

    // 11.1.4 Array Initialiser

    function parseArrayInitialiser() {
        var elements = [], blocks = [], filter = null, tmp, possiblecomprehension = true, body,
            marker = markerCreate();

        expect('[');
        while (!match(']')) {
            if (lookahead.value === 'for' &&
                    lookahead.type === Token.Keyword) {
                if (!possiblecomprehension) {
                    throwError({}, Messages.ComprehensionError);
                }
                matchKeyword('for');
                tmp = parseForStatement({ignoreBody: true});
                tmp.of = tmp.type === Syntax.ForOfStatement;
                tmp.type = Syntax.ComprehensionBlock;
                if (tmp.left.kind) { // can't be let or const
                    throwError({}, Messages.ComprehensionError);
                }
                blocks.push(tmp);
            } else if (lookahead.value === 'if' &&
                           lookahead.type === Token.Keyword) {
                if (!possiblecomprehension) {
                    throwError({}, Messages.ComprehensionError);
                }
                expectKeyword('if');
                expect('(');
                filter = parseExpression();
                expect(')');
            } else if (lookahead.value === ',' &&
                           lookahead.type === Token.Punctuator) {
                possiblecomprehension = false; // no longer allowed.
                lex();
                elements.push(null);
            } else {
                tmp = parseSpreadOrAssignmentExpression();
                elements.push(tmp);
                if (tmp && tmp.type === Syntax.SpreadElement) {
                    if (!match(']')) {
                        throwError({}, Messages.ElementAfterSpreadElement);
                    }
                } else if (!(match(']') || matchKeyword('for') || matchKeyword('if'))) {
                    expect(','); // this lexes.
                    possiblecomprehension = false;
                }
            }
        }

        expect(']');

        if (filter && !blocks.length) {
            throwError({}, Messages.ComprehensionRequiresBlock);
        }

        if (blocks.length) {
            if (elements.length !== 1) {
                throwError({}, Messages.ComprehensionError);
            }
            return markerApply(marker, delegate.createComprehensionExpression(filter, blocks, elements[0]));
        }
        return markerApply(marker, delegate.createArrayExpression(elements));
    }

    // 11.1.5 Object Initialiser

    function parsePropertyFunction(options) {
        var previousStrict, previousYieldAllowed, params, defaults, body,
            marker = markerCreate();

        previousStrict = strict;
        previousYieldAllowed = state.yieldAllowed;
        state.yieldAllowed = options.generator;
        params = options.params || [];
        defaults = options.defaults || [];

        body = parseConciseBody();
        if (options.name && strict && isRestrictedWord(params[0].name)) {
            throwErrorTolerant(options.name, Messages.StrictParamName);
        }
        strict = previousStrict;
        state.yieldAllowed = previousYieldAllowed;

        return markerApply(marker, delegate.createFunctionExpression(
            null,
            params,
            defaults,
            body,
            options.rest || null,
            options.generator,
            body.type !== Syntax.BlockStatement
        ));
    }


    function parsePropertyMethodFunction(options) {
        var previousStrict, tmp, method;

        previousStrict = strict;
        strict = true;

        tmp = parseParams();

        if (tmp.stricted) {
            throwErrorTolerant(tmp.stricted, tmp.message);
        }


        method = parsePropertyFunction({
            params: tmp.params,
            defaults: tmp.defaults,
            rest: tmp.rest,
            generator: options.generator
        });

        strict = previousStrict;

        return method;
    }


    function parseObjectPropertyKey() {
        var marker = markerCreate(),
            token = lex(),
            propertyKey,
            result;

        // Note: This function is called only from parseObjectProperty(), where
        // EOF and Punctuator tokens are already filtered out.

        if (token.type === Token.StringLiteral || token.type === Token.NumericLiteral) {
            if (strict && token.octal) {
                throwErrorTolerant(token, Messages.StrictOctalLiteral);
            }
            return markerApply(marker, delegate.createLiteral(token));
        }

        if (token.type === Token.Punctuator && token.value === '[') {
            // For computed properties we should skip the [ and ], and
            // capture in marker only the assignment expression itself.
            marker = markerCreate();
            propertyKey = parseAssignmentExpression();
            result = markerApply(marker, propertyKey);
            expect(']');
            return result;
        }

        return markerApply(marker, delegate.createIdentifier(token.value));
    }

    function parseObjectProperty() {
        var token, key, id, value, param, expr, computed,
            marker = markerCreate();

        token = lookahead;
        computed = (token.value === '[');

        if (token.type === Token.Identifier || computed) {

            id = parseObjectPropertyKey();

            // Property Assignment: Getter and Setter.

            if (token.value === 'get' && !(match(':') || match('('))) {
                computed = (lookahead.value === '[');
                key = parseObjectPropertyKey();
                expect('(');
                expect(')');
                return markerApply(marker, delegate.createProperty('get', key, parsePropertyFunction({ generator: false }), false, false, computed));
            }
            if (token.value === 'set' && !(match(':') || match('('))) {
                computed = (lookahead.value === '[');
                key = parseObjectPropertyKey();
                expect('(');
                token = lookahead;
                param = [ parseVariableIdentifier() ];
                expect(')');
                return markerApply(marker, delegate.createProperty('set', key, parsePropertyFunction({ params: param, generator: false, name: token }), false, false, computed));
            }
            if (match(':')) {
                lex();
                return markerApply(marker, delegate.createProperty('init', id, parseAssignmentExpression(), false, false, computed));
            }
            if (match('(')) {
                return markerApply(marker, delegate.createProperty('init', id, parsePropertyMethodFunction({ generator: false }), true, false, computed));
            }
            if (computed) {
                // Computed properties can only be used with full notation.
                throwUnexpected(lookahead);
            }
            return markerApply(marker, delegate.createProperty('init', id, id, false, true, false));
        }
        if (token.type === Token.EOF || token.type === Token.Punctuator) {
            if (!match('*')) {
                throwUnexpected(token);
            }
            lex();

            computed = (lookahead.type === Token.Punctuator && lookahead.value === '[');

            id = parseObjectPropertyKey();

            if (!match('(')) {
                throwUnexpected(lex());
            }

            return markerApply(marker, delegate.createProperty('init', id, parsePropertyMethodFunction({ generator: true }), true, false, computed));
        }
        key = parseObjectPropertyKey();
        if (match(':')) {
            lex();
            return markerApply(marker, delegate.createProperty('init', key, parseAssignmentExpression(), false, false, false));
        }
        if (match('(')) {
            return markerApply(marker, delegate.createProperty('init', key, parsePropertyMethodFunction({ generator: false }), true, false, false));
        }
        throwUnexpected(lex());
    }

    function parseObjectInitialiser() {
        var properties = [], property, name, key, kind, map = {}, toString = String,
            marker = markerCreate();

        expect('{');

        while (!match('}')) {
            property = parseObjectProperty();

            if (property.key.type === Syntax.Identifier) {
                name = property.key.name;
            } else {
                name = toString(property.key.value);
            }
            kind = (property.kind === 'init') ? PropertyKind.Data : (property.kind === 'get') ? PropertyKind.Get : PropertyKind.Set;

            key = '$' + name;
            if (Object.prototype.hasOwnProperty.call(map, key)) {
                if (map[key] === PropertyKind.Data) {
                    if (strict && kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.StrictDuplicateProperty);
                    } else if (kind !== PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    }
                } else {
                    if (kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    } else if (map[key] & kind) {
                        throwErrorTolerant({}, Messages.AccessorGetSet);
                    }
                }
                map[key] |= kind;
            } else {
                map[key] = kind;
            }

            properties.push(property);

            if (!match('}')) {
                expect(',');
            }
        }

        expect('}');

        return markerApply(marker, delegate.createObjectExpression(properties));
    }

    function parseTemplateElement(option) {
        var marker = markerCreate(),
            token = scanTemplateElement(option);
        if (strict && token.octal) {
            throwError(token, Messages.StrictOctalLiteral);
        }
        return markerApply(marker, delegate.createTemplateElement({ raw: token.value.raw, cooked: token.value.cooked }, token.tail));
    }

    function parseTemplateLiteral() {
        var quasi, quasis, expressions, marker = markerCreate();

        quasi = parseTemplateElement({ head: true });
        quasis = [ quasi ];
        expressions = [];

        while (!quasi.tail) {
            expressions.push(parseExpression());
            quasi = parseTemplateElement({ head: false });
            quasis.push(quasi);
        }

        return markerApply(marker, delegate.createTemplateLiteral(quasis, expressions));
    }

    // 11.1.6 The Grouping Operator

    function parseGroupExpression() {
        var expr;

        expect('(');

        ++state.parenthesizedCount;

        expr = parseExpression();

        expect(')');

        return expr;
    }


    // 11.1 Primary Expressions

    function parsePrimaryExpression() {
        var marker, type, token, expr;

        type = lookahead.type;

        if (type === Token.Identifier) {
            marker = markerCreate();
            return markerApply(marker, delegate.createIdentifier(lex().value));
        }

        if (type === Token.StringLiteral || type === Token.NumericLiteral) {
            if (strict && lookahead.octal) {
                throwErrorTolerant(lookahead, Messages.StrictOctalLiteral);
            }
            marker = markerCreate();
            return markerApply(marker, delegate.createLiteral(lex()));
        }

        if (type === Token.Keyword) {
            if (matchKeyword('this')) {
                marker = markerCreate();
                lex();
                return markerApply(marker, delegate.createThisExpression());
            }

            if (matchKeyword('function')) {
                return parseFunctionExpression();
            }

            if (matchKeyword('class')) {
                return parseClassExpression();
            }

            if (matchKeyword('super')) {
                marker = markerCreate();
                lex();
                return markerApply(marker, delegate.createIdentifier('super'));
            }
        }

        if (type === Token.BooleanLiteral) {
            marker = markerCreate();
            token = lex();
            token.value = (token.value === 'true');
            return markerApply(marker, delegate.createLiteral(token));
        }

        if (type === Token.NullLiteral) {
            marker = markerCreate();
            token = lex();
            token.value = null;
            return markerApply(marker, delegate.createLiteral(token));
        }

        if (match('[')) {
            return parseArrayInitialiser();
        }

        if (match('{')) {
            return parseObjectInitialiser();
        }

        if (match('(')) {
            return parseGroupExpression();
        }

        if (match('/') || match('/=')) {
            marker = markerCreate();
            return markerApply(marker, delegate.createLiteral(scanRegExp()));
        }

        if (type === Token.Template) {
            return parseTemplateLiteral();
        }

        throwUnexpected(lex());
    }

    // 11.2 Left-Hand-Side Expressions

    function parseArguments() {
        var args = [], arg;

        expect('(');

        if (!match(')')) {
            while (index < length) {
                arg = parseSpreadOrAssignmentExpression();
                args.push(arg);

                if (match(')')) {
                    break;
                } else if (arg.type === Syntax.SpreadElement) {
                    throwError({}, Messages.ElementAfterSpreadElement);
                }

                expect(',');
            }
        }

        expect(')');

        return args;
    }

    function parseSpreadOrAssignmentExpression() {
        if (match('...')) {
            var marker = markerCreate();
            lex();
            return markerApply(marker, delegate.createSpreadElement(parseAssignmentExpression()));
        }
        return parseAssignmentExpression();
    }

    function parseNonComputedProperty() {
        var marker = markerCreate(),
            token = lex();

        if (!isIdentifierName(token)) {
            throwUnexpected(token);
        }

        return markerApply(marker, delegate.createIdentifier(token.value));
    }

    function parseNonComputedMember() {
        expect('.');

        return parseNonComputedProperty();
    }

    function parseComputedMember() {
        var expr;

        expect('[');

        expr = parseExpression();

        expect(']');

        return expr;
    }

    function parseNewExpression() {
        var callee, args, marker = markerCreate();

        expectKeyword('new');
        callee = parseLeftHandSideExpression();
        args = match('(') ? parseArguments() : [];

        return markerApply(marker, delegate.createNewExpression(callee, args));
    }

    function parseLeftHandSideExpressionAllowCall() {
        var expr, args, marker = markerCreate();

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[') || match('(') || lookahead.type === Token.Template) {
            if (match('(')) {
                args = parseArguments();
                expr = markerApply(marker, delegate.createCallExpression(expr, args));
            } else if (match('[')) {
                expr = markerApply(marker, delegate.createMemberExpression('[', expr, parseComputedMember()));
            } else if (match('.')) {
                expr = markerApply(marker, delegate.createMemberExpression('.', expr, parseNonComputedMember()));
            } else {
                expr = markerApply(marker, delegate.createTaggedTemplateExpression(expr, parseTemplateLiteral()));
            }
        }

        return expr;
    }

    function parseLeftHandSideExpression() {
        var expr, marker = markerCreate();

        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();

        while (match('.') || match('[') || lookahead.type === Token.Template) {
            if (match('[')) {
                expr = markerApply(marker, delegate.createMemberExpression('[', expr, parseComputedMember()));
            } else if (match('.')) {
                expr = markerApply(marker, delegate.createMemberExpression('.', expr, parseNonComputedMember()));
            } else {
                expr = markerApply(marker, delegate.createTaggedTemplateExpression(expr, parseTemplateLiteral()));
            }
        }

        return expr;
    }

    // 11.3 Postfix Expressions

    function parsePostfixExpression() {
        var marker = markerCreate(),
            expr = parseLeftHandSideExpressionAllowCall(),
            token;

        if (lookahead.type !== Token.Punctuator) {
            return expr;
        }

        if ((match('++') || match('--')) && !peekLineTerminator()) {
            // 11.3.1, 11.3.2
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant({}, Messages.StrictLHSPostfix);
            }

            if (!isLeftHandSide(expr)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }

            token = lex();
            expr = markerApply(marker, delegate.createPostfixExpression(token.value, expr));
        }

        return expr;
    }

    // 11.4 Unary Operators

    function parseUnaryExpression() {
        var marker, token, expr;

        if (lookahead.type !== Token.Punctuator && lookahead.type !== Token.Keyword) {
            return parsePostfixExpression();
        }

        if (match('++') || match('--')) {
            marker = markerCreate();
            token = lex();
            expr = parseUnaryExpression();
            // 11.4.4, 11.4.5
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant({}, Messages.StrictLHSPrefix);
            }

            if (!isLeftHandSide(expr)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }

            return markerApply(marker, delegate.createUnaryExpression(token.value, expr));
        }

        if (match('+') || match('-') || match('~') || match('!')) {
            marker = markerCreate();
            token = lex();
            expr = parseUnaryExpression();
            return markerApply(marker, delegate.createUnaryExpression(token.value, expr));
        }

        if (matchKeyword('delete') || matchKeyword('void') || matchKeyword('typeof')) {
            marker = markerCreate();
            token = lex();
            expr = parseUnaryExpression();
            expr = markerApply(marker, delegate.createUnaryExpression(token.value, expr));
            if (strict && expr.operator === 'delete' && expr.argument.type === Syntax.Identifier) {
                throwErrorTolerant({}, Messages.StrictDelete);
            }
            return expr;
        }

        return parsePostfixExpression();
    }

    function binaryPrecedence(token, allowIn) {
        var prec = 0;

        if (token.type !== Token.Punctuator && token.type !== Token.Keyword) {
            return 0;
        }

        switch (token.value) {
        case '||':
            prec = 1;
            break;

        case '&&':
            prec = 2;
            break;

        case '|':
            prec = 3;
            break;

        case '^':
            prec = 4;
            break;

        case '&':
            prec = 5;
            break;

        case '==':
        case '!=':
        case '===':
        case '!==':
            prec = 6;
            break;

        case '<':
        case '>':
        case '<=':
        case '>=':
        case 'instanceof':
            prec = 7;
            break;

        case 'in':
            prec = allowIn ? 7 : 0;
            break;

        case '<<':
        case '>>':
        case '>>>':
            prec = 8;
            break;

        case '+':
        case '-':
            prec = 9;
            break;

        case '*':
        case '/':
        case '%':
            prec = 11;
            break;

        default:
            break;
        }

        return prec;
    }

    // 11.5 Multiplicative Operators
    // 11.6 Additive Operators
    // 11.7 Bitwise Shift Operators
    // 11.8 Relational Operators
    // 11.9 Equality Operators
    // 11.10 Binary Bitwise Operators
    // 11.11 Binary Logical Operators

    function parseBinaryExpression() {
        var expr, token, prec, previousAllowIn, stack, right, operator, left, i,
            marker, markers;

        previousAllowIn = state.allowIn;
        state.allowIn = true;

        marker = markerCreate();
        left = parseUnaryExpression();

        token = lookahead;
        prec = binaryPrecedence(token, previousAllowIn);
        if (prec === 0) {
            return left;
        }
        token.prec = prec;
        lex();

        markers = [marker, markerCreate()];
        right = parseUnaryExpression();

        stack = [left, token, right];

        while ((prec = binaryPrecedence(lookahead, previousAllowIn)) > 0) {

            // Reduce: make a binary expression from the three topmost entries.
            while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
                right = stack.pop();
                operator = stack.pop().value;
                left = stack.pop();
                expr = delegate.createBinaryExpression(operator, left, right);
                markers.pop();
                marker = markers.pop();
                markerApply(marker, expr);
                stack.push(expr);
                markers.push(marker);
            }

            // Shift.
            token = lex();
            token.prec = prec;
            stack.push(token);
            markers.push(markerCreate());
            expr = parseUnaryExpression();
            stack.push(expr);
        }

        state.allowIn = previousAllowIn;

        // Final reduce to clean-up the stack.
        i = stack.length - 1;
        expr = stack[i];
        markers.pop();
        while (i > 1) {
            expr = delegate.createBinaryExpression(stack[i - 1].value, stack[i - 2], expr);
            i -= 2;
            marker = markers.pop();
            markerApply(marker, expr);
        }

        return expr;
    }


    // 11.12 Conditional Operator

    function parseConditionalExpression() {
        var expr, previousAllowIn, consequent, alternate, marker = markerCreate();
        expr = parseBinaryExpression();

        if (match('?')) {
            lex();
            previousAllowIn = state.allowIn;
            state.allowIn = true;
            consequent = parseAssignmentExpression();
            state.allowIn = previousAllowIn;
            expect(':');
            alternate = parseAssignmentExpression();

            expr = markerApply(marker, delegate.createConditionalExpression(expr, consequent, alternate));
        }

        return expr;
    }

    // 11.13 Assignment Operators

    function reinterpretAsAssignmentBindingPattern(expr) {
        var i, len, property, element;

        if (expr.type === Syntax.ObjectExpression) {
            expr.type = Syntax.ObjectPattern;
            for (i = 0, len = expr.properties.length; i < len; i += 1) {
                property = expr.properties[i];
                if (property.kind !== 'init') {
                    throwError({}, Messages.InvalidLHSInAssignment);
                }
                reinterpretAsAssignmentBindingPattern(property.value);
            }
        } else if (expr.type === Syntax.ArrayExpression) {
            expr.type = Syntax.ArrayPattern;
            for (i = 0, len = expr.elements.length; i < len; i += 1) {
                element = expr.elements[i];
                if (element) {
                    reinterpretAsAssignmentBindingPattern(element);
                }
            }
        } else if (expr.type === Syntax.Identifier) {
            if (isRestrictedWord(expr.name)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }
        } else if (expr.type === Syntax.SpreadElement) {
            reinterpretAsAssignmentBindingPattern(expr.argument);
            if (expr.argument.type === Syntax.ObjectPattern) {
                throwError({}, Messages.ObjectPatternAsSpread);
            }
        } else {
            if (expr.type !== Syntax.MemberExpression && expr.type !== Syntax.CallExpression && expr.type !== Syntax.NewExpression) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }
        }
    }


    function reinterpretAsDestructuredParameter(options, expr) {
        var i, len, property, element;

        if (expr.type === Syntax.ObjectExpression) {
            expr.type = Syntax.ObjectPattern;
            for (i = 0, len = expr.properties.length; i < len; i += 1) {
                property = expr.properties[i];
                if (property.kind !== 'init') {
                    throwError({}, Messages.InvalidLHSInFormalsList);
                }
                reinterpretAsDestructuredParameter(options, property.value);
            }
        } else if (expr.type === Syntax.ArrayExpression) {
            expr.type = Syntax.ArrayPattern;
            for (i = 0, len = expr.elements.length; i < len; i += 1) {
                element = expr.elements[i];
                if (element) {
                    reinterpretAsDestructuredParameter(options, element);
                }
            }
        } else if (expr.type === Syntax.Identifier) {
            validateParam(options, expr, expr.name);
        } else {
            if (expr.type !== Syntax.MemberExpression) {
                throwError({}, Messages.InvalidLHSInFormalsList);
            }
        }
    }

    function reinterpretAsCoverFormalsList(expressions) {
        var i, len, param, params, defaults, defaultCount, options, rest;

        params = [];
        defaults = [];
        defaultCount = 0;
        rest = null;
        options = {
            paramSet: {}
        };

        for (i = 0, len = expressions.length; i < len; i += 1) {
            param = expressions[i];
            if (param.type === Syntax.Identifier) {
                params.push(param);
                defaults.push(null);
                validateParam(options, param, param.name);
            } else if (param.type === Syntax.ObjectExpression || param.type === Syntax.ArrayExpression) {
                reinterpretAsDestructuredParameter(options, param);
                params.push(param);
                defaults.push(null);
            } else if (param.type === Syntax.SpreadElement) {
                assert(i === len - 1, 'It is guaranteed that SpreadElement is last element by parseExpression');
                reinterpretAsDestructuredParameter(options, param.argument);
                rest = param.argument;
            } else if (param.type === Syntax.AssignmentExpression) {
                params.push(param.left);
                defaults.push(param.right);
                ++defaultCount;
                validateParam(options, param.left, param.left.name);
            } else {
                return null;
            }
        }

        if (options.message === Messages.StrictParamDupe) {
            throwError(
                strict ? options.stricted : options.firstRestricted,
                options.message
            );
        }

        if (defaultCount === 0) {
            defaults = [];
        }

        return {
            params: params,
            defaults: defaults,
            rest: rest,
            stricted: options.stricted,
            firstRestricted: options.firstRestricted,
            message: options.message
        };
    }

    function parseArrowFunctionExpression(options, marker) {
        var previousStrict, previousYieldAllowed, body;

        expect('=>');

        previousStrict = strict;
        previousYieldAllowed = state.yieldAllowed;
        state.yieldAllowed = false;
        body = parseConciseBody();

        if (strict && options.firstRestricted) {
            throwError(options.firstRestricted, options.message);
        }
        if (strict && options.stricted) {
            throwErrorTolerant(options.stricted, options.message);
        }

        strict = previousStrict;
        state.yieldAllowed = previousYieldAllowed;

        return markerApply(marker, delegate.createArrowFunctionExpression(
            options.params,
            options.defaults,
            body,
            options.rest,
            body.type !== Syntax.BlockStatement
        ));
    }

    function parseAssignmentExpression() {
        var marker, expr, token, params, oldParenthesizedCount;

        // Note that 'yield' is treated as a keyword in strict mode, but a
        // contextual keyword (identifier) in non-strict mode, so we need
        // to use matchKeyword and matchContextualKeyword appropriately.
        if ((state.yieldAllowed && matchContextualKeyword('yield')) || (strict && matchKeyword('yield'))) {
            return parseYieldExpression();
        }

        oldParenthesizedCount = state.parenthesizedCount;

        marker = markerCreate();

        if (match('(')) {
            token = lookahead2();
            if ((token.type === Token.Punctuator && token.value === ')') || token.value === '...') {
                params = parseParams();
                if (!match('=>')) {
                    throwUnexpected(lex());
                }
                return parseArrowFunctionExpression(params, marker);
            }
        }

        token = lookahead;
        expr = parseConditionalExpression();

        if (match('=>') &&
                (state.parenthesizedCount === oldParenthesizedCount ||
                state.parenthesizedCount === (oldParenthesizedCount + 1))) {
            if (expr.type === Syntax.Identifier) {
                params = reinterpretAsCoverFormalsList([ expr ]);
            } else if (expr.type === Syntax.SequenceExpression) {
                params = reinterpretAsCoverFormalsList(expr.expressions);
            }
            if (params) {
                return parseArrowFunctionExpression(params, marker);
            }
        }

        if (matchAssign()) {
            // 11.13.1
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant(token, Messages.StrictLHSAssignment);
            }

            // ES.next draf 11.13 Runtime Semantics step 1
            if (match('=') && (expr.type === Syntax.ObjectExpression || expr.type === Syntax.ArrayExpression)) {
                reinterpretAsAssignmentBindingPattern(expr);
            } else if (!isLeftHandSide(expr)) {
                throwError({}, Messages.InvalidLHSInAssignment);
            }

            expr = markerApply(marker, delegate.createAssignmentExpression(lex().value, expr, parseAssignmentExpression()));
        }

        return expr;
    }

    // 11.14 Comma Operator

    function parseExpression() {
        var marker, expr, expressions, sequence, coverFormalsList, spreadFound, oldParenthesizedCount;

        oldParenthesizedCount = state.parenthesizedCount;

        marker = markerCreate();
        expr = parseAssignmentExpression();
        expressions = [ expr ];

        if (match(',')) {
            while (index < length) {
                if (!match(',')) {
                    break;
                }

                lex();
                expr = parseSpreadOrAssignmentExpression();
                expressions.push(expr);

                if (expr.type === Syntax.SpreadElement) {
                    spreadFound = true;
                    if (!match(')')) {
                        throwError({}, Messages.ElementAfterSpreadElement);
                    }
                    break;
                }
            }

            sequence = markerApply(marker, delegate.createSequenceExpression(expressions));
        }

        if (match('=>')) {
            // Do not allow nested parentheses on the LHS of the =>.
            if (state.parenthesizedCount === oldParenthesizedCount || state.parenthesizedCount === (oldParenthesizedCount + 1)) {
                expr = expr.type === Syntax.SequenceExpression ? expr.expressions : expressions;
                coverFormalsList = reinterpretAsCoverFormalsList(expr);
                if (coverFormalsList) {
                    return parseArrowFunctionExpression(coverFormalsList, marker);
                }
            }
            throwUnexpected(lex());
        }

        if (spreadFound && lookahead2().value !== '=>') {
            throwError({}, Messages.IllegalSpread);
        }

        return sequence || expr;
    }

    // 12.1 Block

    function parseStatementList() {
        var list = [],
            statement;

        while (index < length) {
            if (match('}')) {
                break;
            }
            statement = parseSourceElement();
            if (typeof statement === 'undefined') {
                break;
            }
            list.push(statement);
        }

        return list;
    }

    function parseBlock() {
        var block, marker = markerCreate();

        expect('{');

        block = parseStatementList();

        expect('}');

        return markerApply(marker, delegate.createBlockStatement(block));
    }

    // 12.2 Variable Statement

    function parseVariableIdentifier() {
        var marker = markerCreate(),
            token = lex();

        if (token.type !== Token.Identifier) {
            throwUnexpected(token);
        }

        return markerApply(marker, delegate.createIdentifier(token.value));
    }

    function parseVariableDeclaration(kind) {
        var id,
            marker = markerCreate(),
            init = null;
        if (match('{')) {
            id = parseObjectInitialiser();
            reinterpretAsAssignmentBindingPattern(id);
        } else if (match('[')) {
            id = parseArrayInitialiser();
            reinterpretAsAssignmentBindingPattern(id);
        } else {
            id = state.allowKeyword ? parseNonComputedProperty() : parseVariableIdentifier();
            // 12.2.1
            if (strict && isRestrictedWord(id.name)) {
                throwErrorTolerant({}, Messages.StrictVarName);
            }
        }

        if (kind === 'const') {
            if (!match('=')) {
                throwError({}, Messages.NoUnintializedConst);
            }
            expect('=');
            init = parseAssignmentExpression();
        } else if (match('=')) {
            lex();
            init = parseAssignmentExpression();
        }

        return markerApply(marker, delegate.createVariableDeclarator(id, init));
    }

    function parseVariableDeclarationList(kind) {
        var list = [];

        do {
            list.push(parseVariableDeclaration(kind));
            if (!match(',')) {
                break;
            }
            lex();
        } while (index < length);

        return list;
    }

    function parseVariableStatement() {
        var declarations, marker = markerCreate();

        expectKeyword('var');

        declarations = parseVariableDeclarationList();

        consumeSemicolon();

        return markerApply(marker, delegate.createVariableDeclaration(declarations, 'var'));
    }

    // kind may be `const` or `let`
    // Both are experimental and not in the specification yet.
    // see http://wiki.ecmascript.org/doku.php?id=harmony:const
    // and http://wiki.ecmascript.org/doku.php?id=harmony:let
    function parseConstLetDeclaration(kind) {
        var declarations, marker = markerCreate();

        expectKeyword(kind);

        declarations = parseVariableDeclarationList(kind);

        consumeSemicolon();

        return markerApply(marker, delegate.createVariableDeclaration(declarations, kind));
    }

    // people.mozilla.org/~jorendorff/es6-draft.html

    function parseModuleSpecifier() {
        var marker = markerCreate(),
            specifier;

        if (lookahead.type !== Token.StringLiteral) {
            throwError({}, Messages.InvalidModuleSpecifier);
        }
        specifier = delegate.createModuleSpecifier(lookahead);
        lex();
        return markerApply(marker, specifier);
    }

    function parseExportBatchSpecifier() {
        var marker = markerCreate();
        expect('*');
        return markerApply(marker, delegate.createExportBatchSpecifier());
    }

    function parseExportSpecifier() {
        var id, name = null, marker = markerCreate(), from;
        if (matchKeyword('default')) {
            lex();
            id = markerApply(marker, delegate.createIdentifier('default'));
            // export {default} from "something";
        } else {
            id = parseVariableIdentifier();
        }
        if (matchContextualKeyword('as')) {
            lex();
            name = parseNonComputedProperty();
        }

        return markerApply(marker, delegate.createExportSpecifier(id, name));
    }

    function parseExportDeclaration() {
        var backtrackToken, id, previousAllowKeyword, declaration = null,
            isExportFromIdentifier,
            src = null, specifiers = [],
            marker = markerCreate();

        function rewind(token) {
            index = token.range[0];
            lineNumber = token.lineNumber;
            lineStart = token.lineStart;
            lookahead = token;
        }

        expectKeyword('export');

        if (matchKeyword('default')) {
            // covers:
            // export default ...
            lex();
            if (matchKeyword('function') || matchKeyword('class')) {
                backtrackToken = lookahead;
                lex();
                if (isIdentifierName(lookahead)) {
                    // covers:
                    // export default function foo () {}
                    // export default class foo {}
                    id = parseNonComputedProperty();
                    rewind(backtrackToken);
                    return markerApply(marker, delegate.createExportDeclaration(true, parseSourceElement(), [id], null));
                }
                // covers:
                // export default function () {}
                // export default class {}
                rewind(backtrackToken);
                switch (lookahead.value) {
                case 'class':
                    return markerApply(marker, delegate.createExportDeclaration(true, parseClassExpression(), [], null));
                case 'function':
                    return markerApply(marker, delegate.createExportDeclaration(true, parseFunctionExpression(), [], null));
                }
            }

            if (matchContextualKeyword('from')) {
                throwError({}, Messages.UnexpectedToken, lookahead.value);
            }

            // covers:
            // export default {};
            // export default [];
            if (match('{')) {
                declaration = parseObjectInitialiser();
            } else if (match('[')) {
                declaration = parseArrayInitialiser();
            } else {
                declaration = parseAssignmentExpression();
            }
            consumeSemicolon();
            return markerApply(marker, delegate.createExportDeclaration(true, declaration, [], null));
        }

        // non-default export
        if (lookahead.type === Token.Keyword) {
            // covers:
            // export var f = 1;
            switch (lookahead.value) {
            case 'let':
            case 'const':
            case 'var':
            case 'class':
            case 'function':
                return markerApply(marker, delegate.createExportDeclaration(false, parseSourceElement(), specifiers, null));
            }
        }

        if (match('*')) {
            // covers:
            // export * from "foo";
            specifiers.push(parseExportBatchSpecifier());

            if (!matchContextualKeyword('from')) {
                throwError({}, lookahead.value ?
                        Messages.UnexpectedToken : Messages.MissingFromClause, lookahead.value);
            }
            lex();
            src = parseModuleSpecifier();
            consumeSemicolon();

            return markerApply(marker, delegate.createExportDeclaration(false, null, specifiers, src));
        }

        expect('{');
        do {
            isExportFromIdentifier = isExportFromIdentifier || matchKeyword('default');
            specifiers.push(parseExportSpecifier());
        } while (match(',') && lex());
        expect('}');

        if (matchContextualKeyword('from')) {
            // covering:
            // export {default} from "foo";
            // export {foo} from "foo";
            lex();
            src = parseModuleSpecifier();
            consumeSemicolon();
        } else if (isExportFromIdentifier) {
            // covering:
            // export {default}; // missing fromClause
            throwError({}, lookahead.value ?
                    Messages.UnexpectedToken : Messages.MissingFromClause, lookahead.value);
        } else {
            // cover
            // export {foo};
            consumeSemicolon();
        }
        return markerApply(marker, delegate.createExportDeclaration(false, declaration, specifiers, src));
    }


    function parseImportSpecifier() {
        // import {<foo as bar>} ...;
        var id, name = null, marker = markerCreate();

        id = parseNonComputedProperty();
        if (matchContextualKeyword('as')) {
            lex();
            name = parseVariableIdentifier();
        }

        return markerApply(marker, delegate.createImportSpecifier(id, name));
    }

    function parseNamedImports() {
        var specifiers = [];
        // {foo, bar as bas}
        expect('{');
        do {
            specifiers.push(parseImportSpecifier());
        } while (match(',') && lex());
        expect('}');
        return specifiers;
    }

    function parseImportDefaultSpecifier() {
        // import <foo> ...;
        var id, marker = markerCreate();

        id = parseNonComputedProperty();

        return markerApply(marker, delegate.createImportDefaultSpecifier(id));
    }

    function parseImportNamespaceSpecifier() {
        // import <* as foo> ...;
        var id, marker = markerCreate();

        expect('*');
        if (!matchContextualKeyword('as')) {
            throwError({}, Messages.NoAsAfterImportNamespace);
        }
        lex();
        id = parseNonComputedProperty();

        return markerApply(marker, delegate.createImportNamespaceSpecifier(id));
    }

    function parseImportDeclaration() {
        var specifiers, src, marker = markerCreate();

        expectKeyword('import');
        specifiers = [];

        if (lookahead.type === Token.StringLiteral) {
            // covers:
            // import "foo";
            src = parseModuleSpecifier();
            consumeSemicolon();
            return markerApply(marker, delegate.createImportDeclaration(specifiers, src));
        }

        if (!matchKeyword('default') && isIdentifierName(lookahead)) {
            // covers:
            // import foo
            // import foo, ...
            specifiers.push(parseImportDefaultSpecifier());
            if (match(',')) {
                lex();
            }
        }
        if (match('*')) {
            // covers:
            // import foo, * as foo
            // import * as foo
            specifiers.push(parseImportNamespaceSpecifier());
        } else if (match('{')) {
            // covers:
            // import foo, {bar}
            // import {bar}
            specifiers = specifiers.concat(parseNamedImports());
        }

        if (!matchContextualKeyword('from')) {
            throwError({}, lookahead.value ?
                    Messages.UnexpectedToken : Messages.MissingFromClause, lookahead.value);
        }
        lex();
        src = parseModuleSpecifier();
        consumeSemicolon();

        return markerApply(marker, delegate.createImportDeclaration(specifiers, src));
    }

    // 12.3 Empty Statement

    function parseEmptyStatement() {
        var marker = markerCreate();
        expect(';');
        return markerApply(marker, delegate.createEmptyStatement());
    }

    // 12.4 Expression Statement

    function parseExpressionStatement() {
        var marker = markerCreate(), expr = parseExpression();
        consumeSemicolon();
        return markerApply(marker, delegate.createExpressionStatement(expr));
    }

    // 12.5 If statement

    function parseIfStatement() {
        var test, consequent, alternate, marker = markerCreate();

        expectKeyword('if');

        expect('(');

        test = parseExpression();

        expect(')');

        consequent = parseStatement();

        if (matchKeyword('else')) {
            lex();
            alternate = parseStatement();
        } else {
            alternate = null;
        }

        return markerApply(marker, delegate.createIfStatement(test, consequent, alternate));
    }

    // 12.6 Iteration Statements

    function parseDoWhileStatement() {
        var body, test, oldInIteration, marker = markerCreate();

        expectKeyword('do');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        if (match(';')) {
            lex();
        }

        return markerApply(marker, delegate.createDoWhileStatement(body, test));
    }

    function parseWhileStatement() {
        var test, body, oldInIteration, marker = markerCreate();

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        return markerApply(marker, delegate.createWhileStatement(test, body));
    }

    function parseForVariableDeclaration() {
        var marker = markerCreate(),
            token = lex(),
            declarations = parseVariableDeclarationList();

        return markerApply(marker, delegate.createVariableDeclaration(declarations, token.value));
    }

    function parseForStatement(opts) {
        var init, test, update, left, right, body, operator, oldInIteration,
            marker = markerCreate();
        init = test = update = null;
        expectKeyword('for');

        // http://wiki.ecmascript.org/doku.php?id=proposals:iterators_and_generators&s=each
        if (matchContextualKeyword('each')) {
            throwError({}, Messages.EachNotAllowed);
        }

        expect('(');

        if (match(';')) {
            lex();
        } else {
            if (matchKeyword('var') || matchKeyword('let') || matchKeyword('const')) {
                state.allowIn = false;
                init = parseForVariableDeclaration();
                state.allowIn = true;

                if (init.declarations.length === 1) {
                    if (matchKeyword('in') || matchContextualKeyword('of')) {
                        operator = lookahead;
                        if (!((operator.value === 'in' || init.kind !== 'var') && init.declarations[0].init)) {
                            lex();
                            left = init;
                            right = parseExpression();
                            init = null;
                        }
                    }
                }
            } else {
                state.allowIn = false;
                init = parseExpression();
                state.allowIn = true;

                if (matchContextualKeyword('of')) {
                    operator = lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                } else if (matchKeyword('in')) {
                    // LeftHandSideExpression
                    if (!isAssignableLeftHandSide(init)) {
                        throwError({}, Messages.InvalidLHSInForIn);
                    }
                    operator = lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                }
            }

            if (typeof left === 'undefined') {
                expect(';');
            }
        }

        if (typeof left === 'undefined') {

            if (!match(';')) {
                test = parseExpression();
            }
            expect(';');

            if (!match(')')) {
                update = parseExpression();
            }
        }

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        if (!(opts !== undefined && opts.ignoreBody)) {
            body = parseStatement();
        }

        state.inIteration = oldInIteration;

        if (typeof left === 'undefined') {
            return markerApply(marker, delegate.createForStatement(init, test, update, body));
        }

        if (operator.value === 'in') {
            return markerApply(marker, delegate.createForInStatement(left, right, body));
        }
        return markerApply(marker, delegate.createForOfStatement(left, right, body));
    }

    // 12.7 The continue statement

    function parseContinueStatement() {
        var label = null, key, marker = markerCreate();

        expectKeyword('continue');

        // Optimize the most common form: 'continue;'.
        if (source.charCodeAt(index) === 59) {
            lex();

            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return markerApply(marker, delegate.createContinueStatement(null));
        }

        if (peekLineTerminator()) {
            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return markerApply(marker, delegate.createContinueStatement(null));
        }

        if (lookahead.type === Token.Identifier) {
            label = parseVariableIdentifier();

            key = '$' + label.name;
            if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !state.inIteration) {
            throwError({}, Messages.IllegalContinue);
        }

        return markerApply(marker, delegate.createContinueStatement(label));
    }

    // 12.8 The break statement

    function parseBreakStatement() {
        var label = null, key, marker = markerCreate();

        expectKeyword('break');

        // Catch the very common case first: immediately a semicolon (char #59).
        if (source.charCodeAt(index) === 59) {
            lex();

            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return markerApply(marker, delegate.createBreakStatement(null));
        }

        if (peekLineTerminator()) {
            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return markerApply(marker, delegate.createBreakStatement(null));
        }

        if (lookahead.type === Token.Identifier) {
            label = parseVariableIdentifier();

            key = '$' + label.name;
            if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !(state.inIteration || state.inSwitch)) {
            throwError({}, Messages.IllegalBreak);
        }

        return markerApply(marker, delegate.createBreakStatement(label));
    }

    // 12.9 The return statement

    function parseReturnStatement() {
        var argument = null, marker = markerCreate();

        expectKeyword('return');

        if (!state.inFunctionBody) {
            throwErrorTolerant({}, Messages.IllegalReturn);
        }

        // 'return' followed by a space and an identifier is very common.
        if (source.charCodeAt(index) === 32) {
            if (isIdentifierStart(source.charCodeAt(index + 1))) {
                argument = parseExpression();
                consumeSemicolon();
                return markerApply(marker, delegate.createReturnStatement(argument));
            }
        }

        if (peekLineTerminator()) {
            return markerApply(marker, delegate.createReturnStatement(null));
        }

        if (!match(';')) {
            if (!match('}') && lookahead.type !== Token.EOF) {
                argument = parseExpression();
            }
        }

        consumeSemicolon();

        return markerApply(marker, delegate.createReturnStatement(argument));
    }

    // 12.10 The with statement

    function parseWithStatement() {
        var object, body, marker = markerCreate();

        if (strict) {
            throwErrorTolerant({}, Messages.StrictModeWith);
        }

        expectKeyword('with');

        expect('(');

        object = parseExpression();

        expect(')');

        body = parseStatement();

        return markerApply(marker, delegate.createWithStatement(object, body));
    }

    // 12.10 The swith statement

    function parseSwitchCase() {
        var test,
            consequent = [],
            sourceElement,
            marker = markerCreate();

        if (matchKeyword('default')) {
            lex();
            test = null;
        } else {
            expectKeyword('case');
            test = parseExpression();
        }
        expect(':');

        while (index < length) {
            if (match('}') || matchKeyword('default') || matchKeyword('case')) {
                break;
            }
            sourceElement = parseSourceElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            consequent.push(sourceElement);
        }

        return markerApply(marker, delegate.createSwitchCase(test, consequent));
    }

    function parseSwitchStatement() {
        var discriminant, cases, clause, oldInSwitch, defaultFound, marker = markerCreate();

        expectKeyword('switch');

        expect('(');

        discriminant = parseExpression();

        expect(')');

        expect('{');

        cases = [];

        if (match('}')) {
            lex();
            return markerApply(marker, delegate.createSwitchStatement(discriminant, cases));
        }

        oldInSwitch = state.inSwitch;
        state.inSwitch = true;
        defaultFound = false;

        while (index < length) {
            if (match('}')) {
                break;
            }
            clause = parseSwitchCase();
            if (clause.test === null) {
                if (defaultFound) {
                    throwError({}, Messages.MultipleDefaultsInSwitch);
                }
                defaultFound = true;
            }
            cases.push(clause);
        }

        state.inSwitch = oldInSwitch;

        expect('}');

        return markerApply(marker, delegate.createSwitchStatement(discriminant, cases));
    }

    // 12.13 The throw statement

    function parseThrowStatement() {
        var argument, marker = markerCreate();

        expectKeyword('throw');

        if (peekLineTerminator()) {
            throwError({}, Messages.NewlineAfterThrow);
        }

        argument = parseExpression();

        consumeSemicolon();

        return markerApply(marker, delegate.createThrowStatement(argument));
    }

    // 12.14 The try statement

    function parseCatchClause() {
        var param, body, marker = markerCreate();

        expectKeyword('catch');

        expect('(');
        if (match(')')) {
            throwUnexpected(lookahead);
        }

        param = parseExpression();
        // 12.14.1
        if (strict && param.type === Syntax.Identifier && isRestrictedWord(param.name)) {
            throwErrorTolerant({}, Messages.StrictCatchVariable);
        }

        expect(')');
        body = parseBlock();
        return markerApply(marker, delegate.createCatchClause(param, body));
    }

    function parseTryStatement() {
        var block, handlers = [], finalizer = null, marker = markerCreate();

        expectKeyword('try');

        block = parseBlock();

        if (matchKeyword('catch')) {
            handlers.push(parseCatchClause());
        }

        if (matchKeyword('finally')) {
            lex();
            finalizer = parseBlock();
        }

        if (handlers.length === 0 && !finalizer) {
            throwError({}, Messages.NoCatchOrFinally);
        }

        return markerApply(marker, delegate.createTryStatement(block, [], handlers, finalizer));
    }

    // 12.15 The debugger statement

    function parseDebuggerStatement() {
        var marker = markerCreate();
        expectKeyword('debugger');

        consumeSemicolon();

        return markerApply(marker, delegate.createDebuggerStatement());
    }

    // 12 Statements

    function parseStatement() {
        var type = lookahead.type,
            marker,
            expr,
            labeledBody,
            key;

        if (type === Token.EOF) {
            throwUnexpected(lookahead);
        }

        if (type === Token.Punctuator) {
            switch (lookahead.value) {
            case ';':
                return parseEmptyStatement();
            case '{':
                return parseBlock();
            case '(':
                return parseExpressionStatement();
            default:
                break;
            }
        }

        if (type === Token.Keyword) {
            switch (lookahead.value) {
            case 'break':
                return parseBreakStatement();
            case 'continue':
                return parseContinueStatement();
            case 'debugger':
                return parseDebuggerStatement();
            case 'do':
                return parseDoWhileStatement();
            case 'for':
                return parseForStatement();
            case 'function':
                return parseFunctionDeclaration();
            case 'class':
                return parseClassDeclaration();
            case 'if':
                return parseIfStatement();
            case 'return':
                return parseReturnStatement();
            case 'switch':
                return parseSwitchStatement();
            case 'throw':
                return parseThrowStatement();
            case 'try':
                return parseTryStatement();
            case 'var':
                return parseVariableStatement();
            case 'while':
                return parseWhileStatement();
            case 'with':
                return parseWithStatement();
            default:
                break;
            }
        }

        marker = markerCreate();
        expr = parseExpression();

        // 12.12 Labelled Statements
        if ((expr.type === Syntax.Identifier) && match(':')) {
            lex();

            key = '$' + expr.name;
            if (Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.Redeclaration, 'Label', expr.name);
            }

            state.labelSet[key] = true;
            labeledBody = parseStatement();
            delete state.labelSet[key];
            return markerApply(marker, delegate.createLabeledStatement(expr, labeledBody));
        }

        consumeSemicolon();

        return markerApply(marker, delegate.createExpressionStatement(expr));
    }

    // 13 Function Definition

    function parseConciseBody() {
        if (match('{')) {
            return parseFunctionSourceElements();
        }
        return parseAssignmentExpression();
    }

    function parseFunctionSourceElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted,
            oldLabelSet, oldInIteration, oldInSwitch, oldInFunctionBody, oldParenthesizedCount,
            marker = markerCreate();

        expect('{');

        while (index < length) {
            if (lookahead.type !== Token.StringLiteral) {
                break;
            }
            token = lookahead;

            sourceElement = parseSourceElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = source.slice(token.range[0] + 1, token.range[1] - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        oldLabelSet = state.labelSet;
        oldInIteration = state.inIteration;
        oldInSwitch = state.inSwitch;
        oldInFunctionBody = state.inFunctionBody;
        oldParenthesizedCount = state.parenthesizedCount;

        state.labelSet = {};
        state.inIteration = false;
        state.inSwitch = false;
        state.inFunctionBody = true;
        state.parenthesizedCount = 0;

        while (index < length) {
            if (match('}')) {
                break;
            }
            sourceElement = parseSourceElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }

        expect('}');

        state.labelSet = oldLabelSet;
        state.inIteration = oldInIteration;
        state.inSwitch = oldInSwitch;
        state.inFunctionBody = oldInFunctionBody;
        state.parenthesizedCount = oldParenthesizedCount;

        return markerApply(marker, delegate.createBlockStatement(sourceElements));
    }

    function validateParam(options, param, name) {
        var key = '$' + name;
        if (strict) {
            if (isRestrictedWord(name)) {
                options.stricted = param;
                options.message = Messages.StrictParamName;
            }
            if (Object.prototype.hasOwnProperty.call(options.paramSet, key)) {
                options.stricted = param;
                options.message = Messages.StrictParamDupe;
            }
        } else if (!options.firstRestricted) {
            if (isRestrictedWord(name)) {
                options.firstRestricted = param;
                options.message = Messages.StrictParamName;
            } else if (isStrictModeReservedWord(name)) {
                options.firstRestricted = param;
                options.message = Messages.StrictReservedWord;
            } else if (Object.prototype.hasOwnProperty.call(options.paramSet, key)) {
                options.firstRestricted = param;
                options.message = Messages.StrictParamDupe;
            }
        }
        options.paramSet[key] = true;
    }

    function parseParam(options) {
        var token, rest, param, def;

        token = lookahead;
        if (token.value === '...') {
            token = lex();
            rest = true;
        }

        if (match('[')) {
            param = parseArrayInitialiser();
            reinterpretAsDestructuredParameter(options, param);
        } else if (match('{')) {
            if (rest) {
                throwError({}, Messages.ObjectPatternAsRestParameter);
            }
            param = parseObjectInitialiser();
            reinterpretAsDestructuredParameter(options, param);
        } else {
            param = parseVariableIdentifier();
            validateParam(options, token, token.value);
        }

        if (match('=')) {
            if (rest) {
                throwErrorTolerant(lookahead, Messages.DefaultRestParameter);
            }
            lex();
            def = parseAssignmentExpression();
            ++options.defaultCount;
        }

        if (rest) {
            if (!match(')')) {
                throwError({}, Messages.ParameterAfterRestParameter);
            }
            options.rest = param;
            return false;
        }

        options.params.push(param);
        options.defaults.push(def);
        return !match(')');
    }

    function parseParams(firstRestricted) {
        var options, marker = markerCreate();

        options = {
            params: [],
            defaultCount: 0,
            defaults: [],
            rest: null,
            firstRestricted: firstRestricted
        };

        expect('(');

        if (!match(')')) {
            options.paramSet = {};
            while (index < length) {
                if (!parseParam(options)) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        if (options.defaultCount === 0) {
            options.defaults = [];
        }

        return markerApply(marker, options);
    }

    function parseFunctionDeclaration() {
        var id, body, token, tmp, firstRestricted, message, previousStrict, previousYieldAllowed, generator,
            marker = markerCreate();

        expectKeyword('function');

        generator = false;
        if (match('*')) {
            lex();
            generator = true;
        }

        token = lookahead;

        id = parseVariableIdentifier();

        if (strict) {
            if (isRestrictedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictFunctionName);
            }
        } else {
            if (isRestrictedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictFunctionName;
            } else if (isStrictModeReservedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictReservedWord;
            }
        }

        tmp = parseParams(firstRestricted);
        firstRestricted = tmp.firstRestricted;
        if (tmp.message) {
            message = tmp.message;
        }

        previousStrict = strict;
        previousYieldAllowed = state.yieldAllowed;
        state.yieldAllowed = generator;

        body = parseFunctionSourceElements();

        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && tmp.stricted) {
            throwErrorTolerant(tmp.stricted, message);
        }
        strict = previousStrict;
        state.yieldAllowed = previousYieldAllowed;

        return markerApply(marker, delegate.createFunctionDeclaration(id, tmp.params, tmp.defaults, body, tmp.rest, generator, false));
    }

    function parseFunctionExpression() {
        var token, id = null, firstRestricted, message, tmp, body, previousStrict, previousYieldAllowed, generator,
            marker = markerCreate();

        expectKeyword('function');

        generator = false;

        if (match('*')) {
            lex();
            generator = true;
        }

        if (!match('(')) {
            token = lookahead;
            id = parseVariableIdentifier();
            if (strict) {
                if (isRestrictedWord(token.value)) {
                    throwErrorTolerant(token, Messages.StrictFunctionName);
                }
            } else {
                if (isRestrictedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictFunctionName;
                } else if (isStrictModeReservedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictReservedWord;
                }
            }
        }

        tmp = parseParams(firstRestricted);
        firstRestricted = tmp.firstRestricted;
        if (tmp.message) {
            message = tmp.message;
        }

        previousStrict = strict;
        previousYieldAllowed = state.yieldAllowed;
        state.yieldAllowed = generator;

        body = parseFunctionSourceElements();

        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && tmp.stricted) {
            throwErrorTolerant(tmp.stricted, message);
        }
        strict = previousStrict;
        state.yieldAllowed = previousYieldAllowed;

        return markerApply(marker, delegate.createFunctionExpression(id, tmp.params, tmp.defaults, body, tmp.rest, generator, false));
    }

    function parseYieldExpression() {
        var yieldToken, delegateFlag, expr, marker = markerCreate();

        yieldToken = lex();
        assert(yieldToken.value === 'yield', 'Called parseYieldExpression with non-yield lookahead.');

        if (!state.yieldAllowed) {
            throwErrorTolerant({}, Messages.IllegalYield);
        }

        delegateFlag = false;
        if (match('*')) {
            lex();
            delegateFlag = true;
        }

        expr = parseAssignmentExpression();

        return markerApply(marker, delegate.createYieldExpression(expr, delegateFlag));
    }

    // 14 Classes

    function parseMethodDefinition(existingPropNames) {
        var token, key, param, propType, isValidDuplicateProp = false,
            marker = markerCreate();

        if (lookahead.value === 'static') {
            propType = ClassPropertyType.static;
            lex();
        } else {
            propType = ClassPropertyType.prototype;
        }

        if (match('*')) {
            lex();
            return markerApply(marker, delegate.createMethodDefinition(
                propType,
                '',
                parseObjectPropertyKey(),
                parsePropertyMethodFunction({ generator: true })
            ));
        }

        token = lookahead;
        key = parseObjectPropertyKey();

        if (token.value === 'get' && !match('(')) {
            key = parseObjectPropertyKey();

            // It is a syntax error if any other properties have a name
            // duplicating this one unless they are a setter
            if (existingPropNames[propType].hasOwnProperty(key.name)) {
                isValidDuplicateProp =
                    // There isn't already a getter for this prop
                    existingPropNames[propType][key.name].get === undefined
                    // There isn't already a data prop by this name
                    && existingPropNames[propType][key.name].data === undefined
                    // The only existing prop by this name is a setter
                    && existingPropNames[propType][key.name].set !== undefined;
                if (!isValidDuplicateProp) {
                    throwError(key, Messages.IllegalDuplicateClassProperty);
                }
            } else {
                existingPropNames[propType][key.name] = {};
            }
            existingPropNames[propType][key.name].get = true;

            expect('(');
            expect(')');
            return markerApply(marker, delegate.createMethodDefinition(
                propType,
                'get',
                key,
                parsePropertyFunction({ generator: false })
            ));
        }
        if (token.value === 'set' && !match('(')) {
            key = parseObjectPropertyKey();

            // It is a syntax error if any other properties have a name
            // duplicating this one unless they are a getter
            if (existingPropNames[propType].hasOwnProperty(key.name)) {
                isValidDuplicateProp =
                    // There isn't already a setter for this prop
                    existingPropNames[propType][key.name].set === undefined
                    // There isn't already a data prop by this name
                    && existingPropNames[propType][key.name].data === undefined
                    // The only existing prop by this name is a getter
                    && existingPropNames[propType][key.name].get !== undefined;
                if (!isValidDuplicateProp) {
                    throwError(key, Messages.IllegalDuplicateClassProperty);
                }
            } else {
                existingPropNames[propType][key.name] = {};
            }
            existingPropNames[propType][key.name].set = true;

            expect('(');
            token = lookahead;
            param = [ parseVariableIdentifier() ];
            expect(')');
            return markerApply(marker, delegate.createMethodDefinition(
                propType,
                'set',
                key,
                parsePropertyFunction({ params: param, generator: false, name: token })
            ));
        }

        // It is a syntax error if any other properties have the same name as a
        // non-getter, non-setter method
        if (existingPropNames[propType].hasOwnProperty(key.name)) {
            throwError(key, Messages.IllegalDuplicateClassProperty);
        } else {
            existingPropNames[propType][key.name] = {};
        }
        existingPropNames[propType][key.name].data = true;

        return markerApply(marker, delegate.createMethodDefinition(
            propType,
            '',
            key,
            parsePropertyMethodFunction({ generator: false })
        ));
    }

    function parseClassElement(existingProps) {
        if (match(';')) {
            lex();
            return;
        }
        return parseMethodDefinition(existingProps);
    }

    function parseClassBody() {
        var classElement, classElements = [], existingProps = {}, marker = markerCreate();

        existingProps[ClassPropertyType.static] = {};
        existingProps[ClassPropertyType.prototype] = {};

        expect('{');

        while (index < length) {
            if (match('}')) {
                break;
            }
            classElement = parseClassElement(existingProps);

            if (typeof classElement !== 'undefined') {
                classElements.push(classElement);
            }
        }

        expect('}');

        return markerApply(marker, delegate.createClassBody(classElements));
    }

    function parseClassExpression() {
        var id, previousYieldAllowed, superClass = null, marker = markerCreate();

        expectKeyword('class');

        if (!matchKeyword('extends') && !match('{')) {
            id = parseVariableIdentifier();
        }

        if (matchKeyword('extends')) {
            expectKeyword('extends');
            previousYieldAllowed = state.yieldAllowed;
            state.yieldAllowed = false;
            superClass = parseAssignmentExpression();
            state.yieldAllowed = previousYieldAllowed;
        }

        return markerApply(marker, delegate.createClassExpression(id, superClass, parseClassBody()));
    }

    function parseClassDeclaration() {
        var id, previousYieldAllowed, superClass = null, marker = markerCreate();

        expectKeyword('class');

        id = parseVariableIdentifier();

        if (matchKeyword('extends')) {
            expectKeyword('extends');
            previousYieldAllowed = state.yieldAllowed;
            state.yieldAllowed = false;
            superClass = parseAssignmentExpression();
            state.yieldAllowed = previousYieldAllowed;
        }

        return markerApply(marker, delegate.createClassDeclaration(id, superClass, parseClassBody()));
    }

    // 15 Program

    function parseSourceElement() {
        if (lookahead.type === Token.Keyword) {
            switch (lookahead.value) {
            case 'const':
            case 'let':
                return parseConstLetDeclaration(lookahead.value);
            case 'function':
                return parseFunctionDeclaration();
            default:
                return parseStatement();
            }
        }

        if (lookahead.type !== Token.EOF) {
            return parseStatement();
        }
    }

    function parseProgramElement() {
        if (lookahead.type === Token.Keyword) {
            switch (lookahead.value) {
            case 'export':
                return parseExportDeclaration();
            case 'import':
                return parseImportDeclaration();
            }
        }

        return parseSourceElement();
    }

    function parseProgramElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted;

        while (index < length) {
            token = lookahead;
            if (token.type !== Token.StringLiteral) {
                break;
            }

            sourceElement = parseProgramElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = source.slice(token.range[0] + 1, token.range[1] - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        while (index < length) {
            sourceElement = parseProgramElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }
        return sourceElements;
    }

    function parseProgram() {
        var body, marker = markerCreate();
        strict = false;
        peek();
        body = parseProgramElements();
        return markerApply(marker, delegate.createProgram(body));
    }

    // The following functions are needed only when the option to preserve
    // the comments is active.

    function addComment(type, value, start, end, loc) {
        var comment;

        assert(typeof start === 'number', 'Comment must have valid position');

        // Because the way the actual token is scanned, often the comments
        // (if any) are skipped twice during the lexical analysis.
        // Thus, we need to skip adding a comment if the comment array already
        // handled it.
        if (state.lastCommentStart >= start) {
            return;
        }
        state.lastCommentStart = start;

        comment = {
            type: type,
            value: value
        };
        if (extra.range) {
            comment.range = [start, end];
        }
        if (extra.loc) {
            comment.loc = loc;
        }
        extra.comments.push(comment);
        if (extra.attachComment) {
            extra.leadingComments.push(comment);
            extra.trailingComments.push(comment);
        }
    }

    function scanComment() {
        var comment, ch, loc, start, blockComment, lineComment;

        comment = '';
        blockComment = false;
        lineComment = false;

        while (index < length) {
            ch = source[index];

            if (lineComment) {
                ch = source[index++];
                if (isLineTerminator(ch.charCodeAt(0))) {
                    loc.end = {
                        line: lineNumber,
                        column: index - lineStart - 1
                    };
                    lineComment = false;
                    addComment('Line', comment, start, index - 1, loc);
                    if (ch === '\r' && source[index] === '\n') {
                        ++index;
                    }
                    ++lineNumber;
                    lineStart = index;
                    comment = '';
                } else if (index >= length) {
                    lineComment = false;
                    comment += ch;
                    loc.end = {
                        line: lineNumber,
                        column: length - lineStart
                    };
                    addComment('Line', comment, start, length, loc);
                } else {
                    comment += ch;
                }
            } else if (blockComment) {
                if (isLineTerminator(ch.charCodeAt(0))) {
                    if (ch === '\r' && source[index + 1] === '\n') {
                        ++index;
                        comment += '\r\n';
                    } else {
                        comment += ch;
                    }
                    ++lineNumber;
                    ++index;
                    lineStart = index;
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    ch = source[index++];
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                    comment += ch;
                    if (ch === '*') {
                        ch = source[index];
                        if (ch === '/') {
                            comment = comment.substr(0, comment.length - 1);
                            blockComment = false;
                            ++index;
                            loc.end = {
                                line: lineNumber,
                                column: index - lineStart
                            };
                            addComment('Block', comment, start, index, loc);
                            comment = '';
                        }
                    }
                }
            } else if (ch === '/') {
                ch = source[index + 1];
                if (ch === '/') {
                    loc = {
                        start: {
                            line: lineNumber,
                            column: index - lineStart
                        }
                    };
                    start = index;
                    index += 2;
                    lineComment = true;
                    if (index >= length) {
                        loc.end = {
                            line: lineNumber,
                            column: index - lineStart
                        };
                        lineComment = false;
                        addComment('Line', comment, start, index, loc);
                    }
                } else if (ch === '*') {
                    start = index;
                    index += 2;
                    blockComment = true;
                    loc = {
                        start: {
                            line: lineNumber,
                            column: index - lineStart - 2
                        }
                    };
                    if (index >= length) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                } else {
                    break;
                }
            } else if (isWhiteSpace(ch.charCodeAt(0))) {
                ++index;
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                ++index;
                if (ch ===  '\r' && source[index] === '\n') {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
            } else {
                break;
            }
        }
    }

    function collectToken() {
        var start, loc, token, range, value, entry;

        skipComment();
        start = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        token = extra.advance();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        if (token.type !== Token.EOF) {
            range = [token.range[0], token.range[1]];
            value = source.slice(token.range[0], token.range[1]);
            entry = {
                type: TokenName[token.type],
                value: value,
                range: range,
                loc: loc
            };
            if (token.regex) {
                entry.regex = {
                    pattern: token.regex.pattern,
                    flags: token.regex.flags
                };
            }
            extra.tokens.push(entry);
        }

        return token;
    }

    function collectRegex() {
        var pos, loc, regex, token;

        skipComment();

        pos = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        regex = extra.scanRegExp();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        if (!extra.tokenize) {
            // Pop the previous token, which is likely '/' or '/='
            if (extra.tokens.length > 0) {
                token = extra.tokens[extra.tokens.length - 1];
                if (token.range[0] === pos && token.type === 'Punctuator') {
                    if (token.value === '/' || token.value === '/=') {
                        extra.tokens.pop();
                    }
                }
            }

            extra.tokens.push({
                type: 'RegularExpression',
                value: regex.literal,
                regex: regex.regex,
                range: [pos, index],
                loc: loc
            });
        }

        return regex;
    }

    function filterTokenLocation() {
        var i, entry, token, tokens = [];

        for (i = 0; i < extra.tokens.length; ++i) {
            entry = extra.tokens[i];
            token = {
                type: entry.type,
                value: entry.value
            };
            if (entry.regex) {
                token.regex = {
                    pattern: entry.regex.pattern,
                    flags: entry.regex.flags
                };
            }
            if (extra.range) {
                token.range = entry.range;
            }
            if (extra.loc) {
                token.loc = entry.loc;
            }
            tokens.push(token);
        }

        extra.tokens = tokens;
    }

    function patch() {
        if (extra.comments) {
            extra.skipComment = skipComment;
            skipComment = scanComment;
        }

        if (typeof extra.tokens !== 'undefined') {
            extra.advance = advance;
            extra.scanRegExp = scanRegExp;

            advance = collectToken;
            scanRegExp = collectRegex;
        }
    }

    function unpatch() {
        if (typeof extra.skipComment === 'function') {
            skipComment = extra.skipComment;
        }

        if (typeof extra.scanRegExp === 'function') {
            advance = extra.advance;
            scanRegExp = extra.scanRegExp;
        }
    }

    // This is used to modify the delegate.

    function extend(object, properties) {
        var entry, result = {};

        for (entry in object) {
            if (object.hasOwnProperty(entry)) {
                result[entry] = object[entry];
            }
        }

        for (entry in properties) {
            if (properties.hasOwnProperty(entry)) {
                result[entry] = properties[entry];
            }
        }

        return result;
    }

    function tokenize(code, options) {
        var toString,
            token,
            tokens;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        delegate = SyntaxTreeDelegate;
        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        lookahead = null;
        state = {
            allowKeyword: true,
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1
        };

        extra = {};

        // Options matching.
        options = options || {};

        // Of course we collect tokens here.
        options.tokens = true;
        extra.tokens = [];
        extra.tokenize = true;
        // The following two fields are necessary to compute the Regex tokens.
        extra.openParenToken = -1;
        extra.openCurlyToken = -1;

        extra.range = (typeof options.range === 'boolean') && options.range;
        extra.loc = (typeof options.loc === 'boolean') && options.loc;

        if (typeof options.comment === 'boolean' && options.comment) {
            extra.comments = [];
        }
        if (typeof options.tolerant === 'boolean' && options.tolerant) {
            extra.errors = [];
        }

        if (length > 0) {
            if (typeof source[0] === 'undefined') {
                // Try first to convert to a string. This is good as fast path
                // for old IE which understands string indexing for string
                // literals only and not for string object.
                if (code instanceof String) {
                    source = code.valueOf();
                }
            }
        }

        patch();

        try {
            peek();
            if (lookahead.type === Token.EOF) {
                return extra.tokens;
            }

            token = lex();
            while (lookahead.type !== Token.EOF) {
                try {
                    token = lex();
                } catch (lexError) {
                    token = lookahead;
                    if (extra.errors) {
                        extra.errors.push(lexError);
                        // We have to break on the first error
                        // to avoid infinite loops.
                        break;
                    } else {
                        throw lexError;
                    }
                }
            }

            filterTokenLocation();
            tokens = extra.tokens;
            if (typeof extra.comments !== 'undefined') {
                tokens.comments = extra.comments;
            }
            if (typeof extra.errors !== 'undefined') {
                tokens.errors = extra.errors;
            }
        } catch (e) {
            throw e;
        } finally {
            unpatch();
            extra = {};
        }
        return tokens;
    }

    function parse(code, options) {
        var program, toString;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        delegate = SyntaxTreeDelegate;
        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        lookahead = null;
        state = {
            allowKeyword: false,
            allowIn: true,
            labelSet: {},
            parenthesizedCount: 0,
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1,
            yieldAllowed: false
        };

        extra = {};
        if (typeof options !== 'undefined') {
            extra.range = (typeof options.range === 'boolean') && options.range;
            extra.loc = (typeof options.loc === 'boolean') && options.loc;
            extra.attachComment = (typeof options.attachComment === 'boolean') && options.attachComment;

            if (extra.loc && options.source !== null && options.source !== undefined) {
                delegate = extend(delegate, {
                    'postProcess': function (node) {
                        node.loc.source = toString(options.source);
                        return node;
                    }
                });
            }

            if (typeof options.tokens === 'boolean' && options.tokens) {
                extra.tokens = [];
            }
            if (typeof options.comment === 'boolean' && options.comment) {
                extra.comments = [];
            }
            if (typeof options.tolerant === 'boolean' && options.tolerant) {
                extra.errors = [];
            }
            if (extra.attachComment) {
                extra.range = true;
                extra.comments = [];
                extra.bottomRightStack = [];
                extra.trailingComments = [];
                extra.leadingComments = [];
            }
        }

        if (length > 0) {
            if (typeof source[0] === 'undefined') {
                // Try first to convert to a string. This is good as fast path
                // for old IE which understands string indexing for string
                // literals only and not for string object.
                if (code instanceof String) {
                    source = code.valueOf();
                }
            }
        }

        patch();
        try {
            program = parseProgram();
            if (typeof extra.comments !== 'undefined') {
                program.comments = extra.comments;
            }
            if (typeof extra.tokens !== 'undefined') {
                filterTokenLocation();
                program.tokens = extra.tokens;
            }
            if (typeof extra.errors !== 'undefined') {
                program.errors = extra.errors;
            }
        } catch (e) {
            throw e;
        } finally {
            unpatch();
            extra = {};
        }

        return program;
    }

    // Sync with *.json manifests.
    exports.version = '1.1.0-dev-harmony';

    exports.tokenize = tokenize;

    exports.parse = parse;

    // Deep copy.
    exports.Syntax = (function () {
        var name, types = {};

        if (typeof Object.create === 'function') {
            types = Object.create(null);
        }

        for (name in Syntax) {
            if (Syntax.hasOwnProperty(name)) {
                types[name] = Syntax[name];
            }
        }

        if (typeof Object.freeze === 'function') {
            Object.freeze(types);
        }

        return types;
    }());

}));
/* vim: set sw=4 ts=4 et tw=80 : */

},{}],124:[function(require,module,exports){
/*
  Copyright (C) 2013 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2013 Thaddee Tyl <thaddee.tyl@gmail.com>
  Copyright (C) 2013 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>
  Copyright (C) 2012 Mathias Bynens <mathias@qiwi.be>
  Copyright (C) 2012 Joost-Wim Boekesteijn <joost-wim@boekesteijn.nl>
  Copyright (C) 2012 Kris Kowal <kris.kowal@cixar.com>
  Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>
  Copyright (C) 2012 Arpad Borsos <arpad.borsos@googlemail.com>
  Copyright (C) 2011 Ariya Hidayat <ariya.hidayat@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

/*jslint bitwise:true plusplus:true */
/*global esprima:true, define:true, exports:true, window: true,
throwErrorTolerant: true,
throwError: true, generateStatement: true, peek: true,
parseAssignmentExpression: true, parseBlock: true, parseExpression: true,
parseFunctionDeclaration: true, parseFunctionExpression: true,
parseFunctionSourceElements: true, parseVariableIdentifier: true,
parseLeftHandSideExpression: true,
parseUnaryExpression: true,
parseStatement: true, parseSourceElement: true */

(function (root, factory) {
    'use strict';

    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // Rhino, and plain browser loading.

    /* istanbul ignore next */
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        factory((root.esprima = {}));
    }
}(this, function (exports) {
    'use strict';

    var Token,
        TokenName,
        FnExprTokens,
        Syntax,
        PropertyKind,
        Messages,
        Regex,
        SyntaxTreeDelegate,
        source,
        strict,
        index,
        lineNumber,
        lineStart,
        length,
        delegate,
        lookahead,
        state,
        extra;

    Token = {
        BooleanLiteral: 1,
        EOF: 2,
        Identifier: 3,
        Keyword: 4,
        NullLiteral: 5,
        NumericLiteral: 6,
        Punctuator: 7,
        StringLiteral: 8,
        RegularExpression: 9
    };

    TokenName = {};
    TokenName[Token.BooleanLiteral] = 'Boolean';
    TokenName[Token.EOF] = '<end>';
    TokenName[Token.Identifier] = 'Identifier';
    TokenName[Token.Keyword] = 'Keyword';
    TokenName[Token.NullLiteral] = 'Null';
    TokenName[Token.NumericLiteral] = 'Numeric';
    TokenName[Token.Punctuator] = 'Punctuator';
    TokenName[Token.StringLiteral] = 'String';
    TokenName[Token.RegularExpression] = 'RegularExpression';

    // A function following one of those tokens is an expression.
    FnExprTokens = ['(', '{', '[', 'in', 'typeof', 'instanceof', 'new',
                    'return', 'case', 'delete', 'throw', 'void',
                    // assignment operators
                    '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '>>>=',
                    '&=', '|=', '^=', ',',
                    // binary/unary operators
                    '+', '-', '*', '/', '%', '++', '--', '<<', '>>', '>>>', '&',
                    '|', '^', '!', '~', '&&', '||', '?', ':', '===', '==', '>=',
                    '<=', '<', '>', '!=', '!=='];

    Syntax = {
        AssignmentExpression: 'AssignmentExpression',
        ArrayExpression: 'ArrayExpression',
        BlockStatement: 'BlockStatement',
        BinaryExpression: 'BinaryExpression',
        BreakStatement: 'BreakStatement',
        CallExpression: 'CallExpression',
        CatchClause: 'CatchClause',
        ConditionalExpression: 'ConditionalExpression',
        ContinueStatement: 'ContinueStatement',
        DoWhileStatement: 'DoWhileStatement',
        DebuggerStatement: 'DebuggerStatement',
        EmptyStatement: 'EmptyStatement',
        ExpressionStatement: 'ExpressionStatement',
        ForStatement: 'ForStatement',
        ForInStatement: 'ForInStatement',
        FunctionDeclaration: 'FunctionDeclaration',
        FunctionExpression: 'FunctionExpression',
        Identifier: 'Identifier',
        IfStatement: 'IfStatement',
        Literal: 'Literal',
        LabeledStatement: 'LabeledStatement',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        NewExpression: 'NewExpression',
        ObjectExpression: 'ObjectExpression',
        Program: 'Program',
        Property: 'Property',
        ReturnStatement: 'ReturnStatement',
        SequenceExpression: 'SequenceExpression',
        SwitchStatement: 'SwitchStatement',
        SwitchCase: 'SwitchCase',
        ThisExpression: 'ThisExpression',
        ThrowStatement: 'ThrowStatement',
        TryStatement: 'TryStatement',
        UnaryExpression: 'UnaryExpression',
        UpdateExpression: 'UpdateExpression',
        VariableDeclaration: 'VariableDeclaration',
        VariableDeclarator: 'VariableDeclarator',
        WhileStatement: 'WhileStatement',
        WithStatement: 'WithStatement'
    };

    PropertyKind = {
        Data: 1,
        Get: 2,
        Set: 4
    };

    // Error messages should be identical to V8.
    Messages = {
        UnexpectedToken:  'Unexpected token %0',
        UnexpectedNumber:  'Unexpected number',
        UnexpectedString:  'Unexpected string',
        UnexpectedIdentifier:  'Unexpected identifier',
        UnexpectedReserved:  'Unexpected reserved word',
        UnexpectedEOS:  'Unexpected end of input',
        NewlineAfterThrow:  'Illegal newline after throw',
        InvalidRegExp: 'Invalid regular expression',
        UnterminatedRegExp:  'Invalid regular expression: missing /',
        InvalidLHSInAssignment:  'Invalid left-hand side in assignment',
        InvalidLHSInForIn:  'Invalid left-hand side in for-in',
        MultipleDefaultsInSwitch: 'More than one default clause in switch statement',
        NoCatchOrFinally:  'Missing catch or finally after try',
        UnknownLabel: 'Undefined label \'%0\'',
        Redeclaration: '%0 \'%1\' has already been declared',
        IllegalContinue: 'Illegal continue statement',
        IllegalBreak: 'Illegal break statement',
        IllegalReturn: 'Illegal return statement',
        StrictModeWith:  'Strict mode code may not include a with statement',
        StrictCatchVariable:  'Catch variable may not be eval or arguments in strict mode',
        StrictVarName:  'Variable name may not be eval or arguments in strict mode',
        StrictParamName:  'Parameter name eval or arguments is not allowed in strict mode',
        StrictParamDupe: 'Strict mode function may not have duplicate parameter names',
        StrictFunctionName:  'Function name may not be eval or arguments in strict mode',
        StrictOctalLiteral:  'Octal literals are not allowed in strict mode.',
        StrictDelete:  'Delete of an unqualified identifier in strict mode.',
        StrictDuplicateProperty:  'Duplicate data property in object literal not allowed in strict mode',
        AccessorDataProperty:  'Object literal may not have data and accessor property with the same name',
        AccessorGetSet:  'Object literal may not have multiple get/set accessors with the same name',
        StrictLHSAssignment:  'Assignment to eval or arguments is not allowed in strict mode',
        StrictLHSPostfix:  'Postfix increment/decrement may not have eval or arguments operand in strict mode',
        StrictLHSPrefix:  'Prefix increment/decrement may not have eval or arguments operand in strict mode',
        StrictReservedWord:  'Use of future reserved word in strict mode'
    };

    // See also tools/generate-unicode-regex.py.
    Regex = {
        NonAsciiIdentifierStart: new RegExp('[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]'),
        NonAsciiIdentifierPart: new RegExp('[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0\u08A2-\u08AC\u08E4-\u08FE\u0900-\u0963\u0966-\u096F\u0971-\u0977\u0979-\u097F\u0981-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C01-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C82\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D02\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191C\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1D00-\u1DE6\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA697\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A\uAA7B\uAA80-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE26\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]')
    };

    // Ensure the condition is true, otherwise throw an error.
    // This is only to have a better contract semantic, i.e. another safety net
    // to catch a logic error. The condition shall be fulfilled in normal case.
    // Do NOT use this to enforce a certain condition on any user input.

    function assert(condition, message) {
        /* istanbul ignore if */
        if (!condition) {
            throw new Error('ASSERT: ' + message);
        }
    }

    function isDecimalDigit(ch) {
        return (ch >= 48 && ch <= 57);   // 0..9
    }

    function isHexDigit(ch) {
        return '0123456789abcdefABCDEF'.indexOf(ch) >= 0;
    }

    function isOctalDigit(ch) {
        return '01234567'.indexOf(ch) >= 0;
    }


    // 7.2 White Space

    function isWhiteSpace(ch) {
        return (ch === 0x20) || (ch === 0x09) || (ch === 0x0B) || (ch === 0x0C) || (ch === 0xA0) ||
            (ch >= 0x1680 && [0x1680, 0x180E, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF].indexOf(ch) >= 0);
    }

    // 7.3 Line Terminators

    function isLineTerminator(ch) {
        return (ch === 0x0A) || (ch === 0x0D) || (ch === 0x2028) || (ch === 0x2029);
    }

    // 7.6 Identifier Names and Identifiers

    function isIdentifierStart(ch) {
        return (ch === 0x24) || (ch === 0x5F) ||  // $ (dollar) and _ (underscore)
            (ch >= 0x41 && ch <= 0x5A) ||         // A..Z
            (ch >= 0x61 && ch <= 0x7A) ||         // a..z
            (ch === 0x5C) ||                      // \ (backslash)
            ((ch >= 0x80) && Regex.NonAsciiIdentifierStart.test(String.fromCharCode(ch)));
    }

    function isIdentifierPart(ch) {
        return (ch === 0x24) || (ch === 0x5F) ||  // $ (dollar) and _ (underscore)
            (ch >= 0x41 && ch <= 0x5A) ||         // A..Z
            (ch >= 0x61 && ch <= 0x7A) ||         // a..z
            (ch >= 0x30 && ch <= 0x39) ||         // 0..9
            (ch === 0x5C) ||                      // \ (backslash)
            ((ch >= 0x80) && Regex.NonAsciiIdentifierPart.test(String.fromCharCode(ch)));
    }

    // 7.6.1.2 Future Reserved Words

    function isFutureReservedWord(id) {
        switch (id) {
        case 'class':
        case 'enum':
        case 'export':
        case 'extends':
        case 'import':
        case 'super':
            return true;
        default:
            return false;
        }
    }

    function isStrictModeReservedWord(id) {
        switch (id) {
        case 'implements':
        case 'interface':
        case 'package':
        case 'private':
        case 'protected':
        case 'public':
        case 'static':
        case 'yield':
        case 'let':
            return true;
        default:
            return false;
        }
    }

    function isRestrictedWord(id) {
        return id === 'eval' || id === 'arguments';
    }

    // 7.6.1.1 Keywords

    function isKeyword(id) {
        if (strict && isStrictModeReservedWord(id)) {
            return true;
        }

        // 'const' is specialized as Keyword in V8.
        // 'yield' and 'let' are for compatiblity with SpiderMonkey and ES.next.
        // Some others are from future reserved words.

        switch (id.length) {
        case 2:
            return (id === 'if') || (id === 'in') || (id === 'do');
        case 3:
            return (id === 'var') || (id === 'for') || (id === 'new') ||
                (id === 'try') || (id === 'let');
        case 4:
            return (id === 'this') || (id === 'else') || (id === 'case') ||
                (id === 'void') || (id === 'with') || (id === 'enum');
        case 5:
            return (id === 'while') || (id === 'break') || (id === 'catch') ||
                (id === 'throw') || (id === 'const') || (id === 'yield') ||
                (id === 'class') || (id === 'super');
        case 6:
            return (id === 'return') || (id === 'typeof') || (id === 'delete') ||
                (id === 'switch') || (id === 'export') || (id === 'import');
        case 7:
            return (id === 'default') || (id === 'finally') || (id === 'extends');
        case 8:
            return (id === 'function') || (id === 'continue') || (id === 'debugger');
        case 10:
            return (id === 'instanceof');
        default:
            return false;
        }
    }

    // 7.4 Comments

    function addComment(type, value, start, end, loc) {
        var comment, attacher;

        assert(typeof start === 'number', 'Comment must have valid position');

        // Because the way the actual token is scanned, often the comments
        // (if any) are skipped twice during the lexical analysis.
        // Thus, we need to skip adding a comment if the comment array already
        // handled it.
        if (state.lastCommentStart >= start) {
            return;
        }
        state.lastCommentStart = start;

        comment = {
            type: type,
            value: value
        };
        if (extra.range) {
            comment.range = [start, end];
        }
        if (extra.loc) {
            comment.loc = loc;
        }
        extra.comments.push(comment);
        if (extra.attachComment) {
            extra.leadingComments.push(comment);
            extra.trailingComments.push(comment);
        }
    }

    function skipSingleLineComment(offset) {
        var start, loc, ch, comment;

        start = index - offset;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart - offset
            }
        };

        while (index < length) {
            ch = source.charCodeAt(index);
            ++index;
            if (isLineTerminator(ch)) {
                if (extra.comments) {
                    comment = source.slice(start + offset, index - 1);
                    loc.end = {
                        line: lineNumber,
                        column: index - lineStart - 1
                    };
                    addComment('Line', comment, start, index - 1, loc);
                }
                if (ch === 13 && source.charCodeAt(index) === 10) {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
                return;
            }
        }

        if (extra.comments) {
            comment = source.slice(start + offset, index);
            loc.end = {
                line: lineNumber,
                column: index - lineStart
            };
            addComment('Line', comment, start, index, loc);
        }
    }

    function skipMultiLineComment() {
        var start, loc, ch, comment;

        if (extra.comments) {
            start = index - 2;
            loc = {
                start: {
                    line: lineNumber,
                    column: index - lineStart - 2
                }
            };
        }

        while (index < length) {
            ch = source.charCodeAt(index);
            if (isLineTerminator(ch)) {
                if (ch === 0x0D && source.charCodeAt(index + 1) === 0x0A) {
                    ++index;
                }
                ++lineNumber;
                ++index;
                lineStart = index;
                if (index >= length) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            } else if (ch === 0x2A) {
                // Block comment ends with '*/'.
                if (source.charCodeAt(index + 1) === 0x2F) {
                    ++index;
                    ++index;
                    if (extra.comments) {
                        comment = source.slice(start + 2, index - 2);
                        loc.end = {
                            line: lineNumber,
                            column: index - lineStart
                        };
                        addComment('Block', comment, start, index, loc);
                    }
                    return;
                }
                ++index;
            } else {
                ++index;
            }
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    function skipComment() {
        var ch, start;

        start = (index === 0);
        while (index < length) {
            ch = source.charCodeAt(index);

            if (isWhiteSpace(ch)) {
                ++index;
            } else if (isLineTerminator(ch)) {
                ++index;
                if (ch === 0x0D && source.charCodeAt(index) === 0x0A) {
                    ++index;
                }
                ++lineNumber;
                lineStart = index;
                start = true;
            } else if (ch === 0x2F) { // U+002F is '/'
                ch = source.charCodeAt(index + 1);
                if (ch === 0x2F) {
                    ++index;
                    ++index;
                    skipSingleLineComment(2);
                    start = true;
                } else if (ch === 0x2A) {  // U+002A is '*'
                    ++index;
                    ++index;
                    skipMultiLineComment();
                } else {
                    break;
                }
            } else if (start && ch === 0x2D) { // U+002D is '-'
                // U+003E is '>'
                if ((source.charCodeAt(index + 1) === 0x2D) && (source.charCodeAt(index + 2) === 0x3E)) {
                    // '-->' is a single-line comment
                    index += 3;
                    skipSingleLineComment(3);
                } else {
                    break;
                }
            } else if (ch === 0x3C) { // U+003C is '<'
                if (source.slice(index + 1, index + 4) === '!--') {
                    ++index; // `<`
                    ++index; // `!`
                    ++index; // `-`
                    ++index; // `-`
                    skipSingleLineComment(4);
                } else {
                    break;
                }
            } else {
                break;
            }
        }
    }

    function scanHexEscape(prefix) {
        var i, len, ch, code = 0;

        len = (prefix === 'u') ? 4 : 2;
        for (i = 0; i < len; ++i) {
            if (index < length && isHexDigit(source[index])) {
                ch = source[index++];
                code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
            } else {
                return '';
            }
        }
        return String.fromCharCode(code);
    }

    function getEscapedIdentifier() {
        var ch, id;

        ch = source.charCodeAt(index++);
        id = String.fromCharCode(ch);

        // '\u' (U+005C, U+0075) denotes an escaped character.
        if (ch === 0x5C) {
            if (source.charCodeAt(index) !== 0x75) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
            ++index;
            ch = scanHexEscape('u');
            if (!ch || ch === '\\' || !isIdentifierStart(ch.charCodeAt(0))) {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
            id = ch;
        }

        while (index < length) {
            ch = source.charCodeAt(index);
            if (!isIdentifierPart(ch)) {
                break;
            }
            ++index;
            id += String.fromCharCode(ch);

            // '\u' (U+005C, U+0075) denotes an escaped character.
            if (ch === 0x5C) {
                id = id.substr(0, id.length - 1);
                if (source.charCodeAt(index) !== 0x75) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
                ++index;
                ch = scanHexEscape('u');
                if (!ch || ch === '\\' || !isIdentifierPart(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
                id += ch;
            }
        }

        return id;
    }

    function getIdentifier() {
        var start, ch;

        start = index++;
        while (index < length) {
            ch = source.charCodeAt(index);
            if (ch === 0x5C) {
                // Blackslash (U+005C) marks Unicode escape sequence.
                index = start;
                return getEscapedIdentifier();
            }
            if (isIdentifierPart(ch)) {
                ++index;
            } else {
                break;
            }
        }

        return source.slice(start, index);
    }

    function scanIdentifier() {
        var start, id, type;

        start = index;

        // Backslash (U+005C) starts an escaped character.
        id = (source.charCodeAt(index) === 0x5C) ? getEscapedIdentifier() : getIdentifier();

        // There is no keyword or literal with only one character.
        // Thus, it must be an identifier.
        if (id.length === 1) {
            type = Token.Identifier;
        } else if (isKeyword(id)) {
            type = Token.Keyword;
        } else if (id === 'null') {
            type = Token.NullLiteral;
        } else if (id === 'true' || id === 'false') {
            type = Token.BooleanLiteral;
        } else {
            type = Token.Identifier;
        }

        return {
            type: type,
            value: id,
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
        };
    }


    // 7.7 Punctuators

    function scanPunctuator() {
        var start = index,
            code = source.charCodeAt(index),
            code2,
            ch1 = source[index],
            ch2,
            ch3,
            ch4;

        switch (code) {

        // Check for most common single-character punctuators.
        case 0x2E:  // . dot
        case 0x28:  // ( open bracket
        case 0x29:  // ) close bracket
        case 0x3B:  // ; semicolon
        case 0x2C:  // , comma
        case 0x7B:  // { open curly brace
        case 0x7D:  // } close curly brace
        case 0x5B:  // [
        case 0x5D:  // ]
        case 0x3A:  // :
        case 0x3F:  // ?
        case 0x7E:  // ~
            ++index;
            if (extra.tokenize) {
                if (code === 0x28) {
                    extra.openParenToken = extra.tokens.length;
                } else if (code === 0x7B) {
                    extra.openCurlyToken = extra.tokens.length;
                }
            }
            return {
                type: Token.Punctuator,
                value: String.fromCharCode(code),
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };

        default:
            code2 = source.charCodeAt(index + 1);

            // '=' (U+003D) marks an assignment or comparison operator.
            if (code2 === 0x3D) {
                switch (code) {
                case 0x2B:  // +
                case 0x2D:  // -
                case 0x2F:  // /
                case 0x3C:  // <
                case 0x3E:  // >
                case 0x5E:  // ^
                case 0x7C:  // |
                case 0x25:  // %
                case 0x26:  // &
                case 0x2A:  // *
                    index += 2;
                    return {
                        type: Token.Punctuator,
                        value: String.fromCharCode(code) + String.fromCharCode(code2),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        start: start,
                        end: index
                    };

                case 0x21: // !
                case 0x3D: // =
                    index += 2;

                    // !== and ===
                    if (source.charCodeAt(index) === 0x3D) {
                        ++index;
                    }
                    return {
                        type: Token.Punctuator,
                        value: source.slice(start, index),
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        start: start,
                        end: index
                    };
                }
            }
        }

        // 4-character punctuator: >>>=

        ch4 = source.substr(index, 4);

        if (ch4 === '>>>=') {
            index += 4;
            return {
                type: Token.Punctuator,
                value: ch4,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }

        // 3-character punctuators: === !== >>> <<= >>=

        ch3 = ch4.substr(0, 3);

        if (ch3 === '>>>' || ch3 === '<<=' || ch3 === '>>=') {
            index += 3;
            return {
                type: Token.Punctuator,
                value: ch3,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }

        // Other 2-character punctuators: ++ -- << >> && ||
        ch2 = ch3.substr(0, 2);

        if ((ch1 === ch2[1] && ('+-<>&|'.indexOf(ch1) >= 0)) || ch2 === '=>') {
            index += 2;
            return {
                type: Token.Punctuator,
                value: ch2,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }

        // 1-character punctuators: < > = ! + - * % & | ^ /
        if ('<>=!+-*%&|^/'.indexOf(ch1) >= 0) {
            ++index;
            return {
                type: Token.Punctuator,
                value: ch1,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }

        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
    }

    // 7.8.3 Numeric Literals

    function scanHexLiteral(start) {
        var number = '';

        while (index < length) {
            if (!isHexDigit(source[index])) {
                break;
            }
            number += source[index++];
        }

        if (number.length === 0) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseInt('0x' + number, 16),
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
        };
    }

    function scanOctalLiteral(start) {
        var number = '0' + source[index++];
        while (index < length) {
            if (!isOctalDigit(source[index])) {
                break;
            }
            number += source[index++];
        }

        if (isIdentifierStart(source.charCodeAt(index)) || isDecimalDigit(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseInt(number, 8),
            octal: true,
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
        };
    }

    function scanNumericLiteral() {
        var number, start, ch;

        ch = source[index];
        assert(isDecimalDigit(ch.charCodeAt(0)) || (ch === '.'),
            'Numeric literal must start with a decimal digit or a decimal point');

        start = index;
        number = '';
        if (ch !== '.') {
            number = source[index++];
            ch = source[index];

            // Hex number starts with '0x'.
            // Octal number starts with '0'.
            if (number === '0') {
                if (ch === 'x' || ch === 'X') {
                    ++index;
                    return scanHexLiteral(start);
                }
                if (isOctalDigit(ch)) {
                    return scanOctalLiteral(start);
                }

                // decimal number starts with '0' such as '09' is illegal.
                if (ch && isDecimalDigit(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            }

            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === '.') {
            number += source[index++];
            while (isDecimalDigit(source.charCodeAt(index))) {
                number += source[index++];
            }
            ch = source[index];
        }

        if (ch === 'e' || ch === 'E') {
            number += source[index++];

            ch = source[index];
            if (ch === '+' || ch === '-') {
                number += source[index++];
            }
            if (isDecimalDigit(source.charCodeAt(index))) {
                while (isDecimalDigit(source.charCodeAt(index))) {
                    number += source[index++];
                }
            } else {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }
        }

        if (isIdentifierStart(source.charCodeAt(index))) {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.NumericLiteral,
            value: parseFloat(number),
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
        };
    }

    // 7.8.4 String Literals

    function scanStringLiteral() {
        var str = '', quote, start, ch, code, unescaped, restore, octal = false, startLineNumber, startLineStart;
        startLineNumber = lineNumber;
        startLineStart = lineStart;

        quote = source[index];
        assert((quote === '\'' || quote === '"'),
            'String literal must starts with a quote');

        start = index;
        ++index;

        while (index < length) {
            ch = source[index++];

            if (ch === quote) {
                quote = '';
                break;
            } else if (ch === '\\') {
                ch = source[index++];
                if (!ch || !isLineTerminator(ch.charCodeAt(0))) {
                    switch (ch) {
                    case 'u':
                    case 'x':
                        restore = index;
                        unescaped = scanHexEscape(ch);
                        if (unescaped) {
                            str += unescaped;
                        } else {
                            index = restore;
                            str += ch;
                        }
                        break;
                    case 'n':
                        str += '\n';
                        break;
                    case 'r':
                        str += '\r';
                        break;
                    case 't':
                        str += '\t';
                        break;
                    case 'b':
                        str += '\b';
                        break;
                    case 'f':
                        str += '\f';
                        break;
                    case 'v':
                        str += '\x0B';
                        break;

                    default:
                        if (isOctalDigit(ch)) {
                            code = '01234567'.indexOf(ch);

                            // \0 is not octal escape sequence
                            if (code !== 0) {
                                octal = true;
                            }

                            if (index < length && isOctalDigit(source[index])) {
                                octal = true;
                                code = code * 8 + '01234567'.indexOf(source[index++]);

                                // 3 digits are only allowed when string starts
                                // with 0, 1, 2, 3
                                if ('0123'.indexOf(ch) >= 0 &&
                                        index < length &&
                                        isOctalDigit(source[index])) {
                                    code = code * 8 + '01234567'.indexOf(source[index++]);
                                }
                            }
                            str += String.fromCharCode(code);
                        } else {
                            str += ch;
                        }
                        break;
                    }
                } else {
                    ++lineNumber;
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                    lineStart = index;
                }
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                break;
            } else {
                str += ch;
            }
        }

        if (quote !== '') {
            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        return {
            type: Token.StringLiteral,
            value: str,
            octal: octal,
            startLineNumber: startLineNumber,
            startLineStart: startLineStart,
            lineNumber: lineNumber,
            lineStart: lineStart,
            start: start,
            end: index
        };
    }

    function testRegExp(pattern, flags) {
        var value;
        try {
            value = new RegExp(pattern, flags);
        } catch (e) {
            throwError({}, Messages.InvalidRegExp);
        }
        return value;
    }

    function scanRegExpBody() {
        var ch, str, classMarker, terminated, body;

        ch = source[index];
        assert(ch === '/', 'Regular expression literal must start with a slash');
        str = source[index++];

        classMarker = false;
        terminated = false;
        while (index < length) {
            ch = source[index++];
            str += ch;
            if (ch === '\\') {
                ch = source[index++];
                // ECMA-262 7.8.5
                if (isLineTerminator(ch.charCodeAt(0))) {
                    throwError({}, Messages.UnterminatedRegExp);
                }
                str += ch;
            } else if (isLineTerminator(ch.charCodeAt(0))) {
                throwError({}, Messages.UnterminatedRegExp);
            } else if (classMarker) {
                if (ch === ']') {
                    classMarker = false;
                }
            } else {
                if (ch === '/') {
                    terminated = true;
                    break;
                } else if (ch === '[') {
                    classMarker = true;
                }
            }
        }

        if (!terminated) {
            throwError({}, Messages.UnterminatedRegExp);
        }

        // Exclude leading and trailing slash.
        body = str.substr(1, str.length - 2);
        return {
            value: body,
            literal: str
        };
    }

    function scanRegExpFlags() {
        var ch, str, flags, restore;

        str = '';
        flags = '';
        while (index < length) {
            ch = source[index];
            if (!isIdentifierPart(ch.charCodeAt(0))) {
                break;
            }

            ++index;
            if (ch === '\\' && index < length) {
                ch = source[index];
                if (ch === 'u') {
                    ++index;
                    restore = index;
                    ch = scanHexEscape('u');
                    if (ch) {
                        flags += ch;
                        for (str += '\\u'; restore < index; ++restore) {
                            str += source[restore];
                        }
                    } else {
                        index = restore;
                        flags += 'u';
                        str += '\\u';
                    }
                    throwErrorTolerant({}, Messages.UnexpectedToken, 'ILLEGAL');
                } else {
                    str += '\\';
                    throwErrorTolerant({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            } else {
                flags += ch;
                str += ch;
            }
        }

        return {
            value: flags,
            literal: str
        };
    }

    function scanRegExp() {
        var start, body, flags, pattern, value;

        lookahead = null;
        skipComment();
        start = index;

        body = scanRegExpBody();
        flags = scanRegExpFlags();
        value = testRegExp(body.value, flags.value);

        if (extra.tokenize) {
            return {
                type: Token.RegularExpression,
                value: value,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: start,
                end: index
            };
        }

        return {
            literal: body.literal + flags.literal,
            value: value,
            start: start,
            end: index
        };
    }

    function collectRegex() {
        var pos, loc, regex, token;

        skipComment();

        pos = index;
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        regex = scanRegExp();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        /* istanbul ignore next */
        if (!extra.tokenize) {
            // Pop the previous token, which is likely '/' or '/='
            if (extra.tokens.length > 0) {
                token = extra.tokens[extra.tokens.length - 1];
                if (token.range[0] === pos && token.type === 'Punctuator') {
                    if (token.value === '/' || token.value === '/=') {
                        extra.tokens.pop();
                    }
                }
            }

            extra.tokens.push({
                type: 'RegularExpression',
                value: regex.literal,
                range: [pos, index],
                loc: loc
            });
        }

        return regex;
    }

    function isIdentifierName(token) {
        return token.type === Token.Identifier ||
            token.type === Token.Keyword ||
            token.type === Token.BooleanLiteral ||
            token.type === Token.NullLiteral;
    }

    function advanceSlash() {
        var prevToken,
            checkToken;
        // Using the following algorithm:
        // https://github.com/mozilla/sweet.js/wiki/design
        prevToken = extra.tokens[extra.tokens.length - 1];
        if (!prevToken) {
            // Nothing before that: it cannot be a division.
            return collectRegex();
        }
        if (prevToken.type === 'Punctuator') {
            if (prevToken.value === ']') {
                return scanPunctuator();
            }
            if (prevToken.value === ')') {
                checkToken = extra.tokens[extra.openParenToken - 1];
                if (checkToken &&
                        checkToken.type === 'Keyword' &&
                        (checkToken.value === 'if' ||
                         checkToken.value === 'while' ||
                         checkToken.value === 'for' ||
                         checkToken.value === 'with')) {
                    return collectRegex();
                }
                return scanPunctuator();
            }
            if (prevToken.value === '}') {
                // Dividing a function by anything makes little sense,
                // but we have to check for that.
                if (extra.tokens[extra.openCurlyToken - 3] &&
                        extra.tokens[extra.openCurlyToken - 3].type === 'Keyword') {
                    // Anonymous function.
                    checkToken = extra.tokens[extra.openCurlyToken - 4];
                    if (!checkToken) {
                        return scanPunctuator();
                    }
                } else if (extra.tokens[extra.openCurlyToken - 4] &&
                        extra.tokens[extra.openCurlyToken - 4].type === 'Keyword') {
                    // Named function.
                    checkToken = extra.tokens[extra.openCurlyToken - 5];
                    if (!checkToken) {
                        return collectRegex();
                    }
                } else {
                    return scanPunctuator();
                }
                // checkToken determines whether the function is
                // a declaration or an expression.
                if (FnExprTokens.indexOf(checkToken.value) >= 0) {
                    // It is an expression.
                    return scanPunctuator();
                }
                // It is a declaration.
                return collectRegex();
            }
            return collectRegex();
        }
        if (prevToken.type === 'Keyword' && prevToken.value !== 'this') {
            return collectRegex();
        }
        return scanPunctuator();
    }

    function advance() {
        var ch;

        skipComment();

        if (index >= length) {
            return {
                type: Token.EOF,
                lineNumber: lineNumber,
                lineStart: lineStart,
                start: index,
                end: index
            };
        }

        ch = source.charCodeAt(index);

        if (isIdentifierStart(ch)) {
            return scanIdentifier();
        }

        // Very common: ( and ) and ;
        if (ch === 0x28 || ch === 0x29 || ch === 0x3B) {
            return scanPunctuator();
        }

        // String literal starts with single quote (U+0027) or double quote (U+0022).
        if (ch === 0x27 || ch === 0x22) {
            return scanStringLiteral();
        }


        // Dot (.) U+002E can also start a floating-point number, hence the need
        // to check the next character.
        if (ch === 0x2E) {
            if (isDecimalDigit(source.charCodeAt(index + 1))) {
                return scanNumericLiteral();
            }
            return scanPunctuator();
        }

        if (isDecimalDigit(ch)) {
            return scanNumericLiteral();
        }

        // Slash (/) U+002F can also start a regex.
        if (extra.tokenize && ch === 0x2F) {
            return advanceSlash();
        }

        return scanPunctuator();
    }

    function collectToken() {
        var loc, token, range, value;

        skipComment();
        loc = {
            start: {
                line: lineNumber,
                column: index - lineStart
            }
        };

        token = advance();
        loc.end = {
            line: lineNumber,
            column: index - lineStart
        };

        if (token.type !== Token.EOF) {
            value = source.slice(token.start, token.end);
            extra.tokens.push({
                type: TokenName[token.type],
                value: value,
                range: [token.start, token.end],
                loc: loc
            });
        }

        return token;
    }

    function lex() {
        var token;

        token = lookahead;
        index = token.end;
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;

        lookahead = (typeof extra.tokens !== 'undefined') ? collectToken() : advance();

        index = token.end;
        lineNumber = token.lineNumber;
        lineStart = token.lineStart;

        return token;
    }

    function peek() {
        var pos, line, start;

        pos = index;
        line = lineNumber;
        start = lineStart;
        lookahead = (typeof extra.tokens !== 'undefined') ? collectToken() : advance();
        index = pos;
        lineNumber = line;
        lineStart = start;
    }

    function Position(line, column) {
        this.line = line;
        this.column = column;
    }

    function SourceLocation(startLine, startColumn, line, column) {
        this.start = new Position(startLine, startColumn);
        this.end = new Position(line, column);
    }

    SyntaxTreeDelegate = {

        name: 'SyntaxTree',

        processComment: function (node) {
            var lastChild, trailingComments;

            if (node.type === Syntax.Program) {
                if (node.body.length > 0) {
                    return;
                }
            }

            if (extra.trailingComments.length > 0) {
                if (extra.trailingComments[0].range[0] >= node.range[1]) {
                    trailingComments = extra.trailingComments;
                    extra.trailingComments = [];
                } else {
                    extra.trailingComments.length = 0;
                }
            } else {
                if (extra.bottomRightStack.length > 0 &&
                        extra.bottomRightStack[extra.bottomRightStack.length - 1].trailingComments &&
                        extra.bottomRightStack[extra.bottomRightStack.length - 1].trailingComments[0].range[0] >= node.range[1]) {
                    trailingComments = extra.bottomRightStack[extra.bottomRightStack.length - 1].trailingComments;
                    delete extra.bottomRightStack[extra.bottomRightStack.length - 1].trailingComments;
                }
            }

            // Eating the stack.
            while (extra.bottomRightStack.length > 0 && extra.bottomRightStack[extra.bottomRightStack.length - 1].range[0] >= node.range[0]) {
                lastChild = extra.bottomRightStack.pop();
            }

            if (lastChild) {
                if (lastChild.leadingComments && lastChild.leadingComments[lastChild.leadingComments.length - 1].range[1] <= node.range[0]) {
                    node.leadingComments = lastChild.leadingComments;
                    delete lastChild.leadingComments;
                }
            } else if (extra.leadingComments.length > 0 && extra.leadingComments[extra.leadingComments.length - 1].range[1] <= node.range[0]) {
                node.leadingComments = extra.leadingComments;
                extra.leadingComments = [];
            }


            if (trailingComments) {
                node.trailingComments = trailingComments;
            }

            extra.bottomRightStack.push(node);
        },

        markEnd: function (node, startToken) {
            if (extra.range) {
                node.range = [startToken.start, index];
            }
            if (extra.loc) {
                node.loc = new SourceLocation(
                    startToken.startLineNumber === undefined ?  startToken.lineNumber : startToken.startLineNumber,
                    startToken.start - (startToken.startLineStart === undefined ?  startToken.lineStart : startToken.startLineStart),
                    lineNumber,
                    index - lineStart
                );
                this.postProcess(node);
            }

            if (extra.attachComment) {
                this.processComment(node);
            }
            return node;
        },

        postProcess: function (node) {
            if (extra.source) {
                node.loc.source = extra.source;
            }
            return node;
        },

        createArrayExpression: function (elements) {
            return {
                type: Syntax.ArrayExpression,
                elements: elements
            };
        },

        createAssignmentExpression: function (operator, left, right) {
            return {
                type: Syntax.AssignmentExpression,
                operator: operator,
                left: left,
                right: right
            };
        },

        createBinaryExpression: function (operator, left, right) {
            var type = (operator === '||' || operator === '&&') ? Syntax.LogicalExpression :
                        Syntax.BinaryExpression;
            return {
                type: type,
                operator: operator,
                left: left,
                right: right
            };
        },

        createBlockStatement: function (body) {
            return {
                type: Syntax.BlockStatement,
                body: body
            };
        },

        createBreakStatement: function (label) {
            return {
                type: Syntax.BreakStatement,
                label: label
            };
        },

        createCallExpression: function (callee, args) {
            return {
                type: Syntax.CallExpression,
                callee: callee,
                'arguments': args
            };
        },

        createCatchClause: function (param, body) {
            return {
                type: Syntax.CatchClause,
                param: param,
                body: body
            };
        },

        createConditionalExpression: function (test, consequent, alternate) {
            return {
                type: Syntax.ConditionalExpression,
                test: test,
                consequent: consequent,
                alternate: alternate
            };
        },

        createContinueStatement: function (label) {
            return {
                type: Syntax.ContinueStatement,
                label: label
            };
        },

        createDebuggerStatement: function () {
            return {
                type: Syntax.DebuggerStatement
            };
        },

        createDoWhileStatement: function (body, test) {
            return {
                type: Syntax.DoWhileStatement,
                body: body,
                test: test
            };
        },

        createEmptyStatement: function () {
            return {
                type: Syntax.EmptyStatement
            };
        },

        createExpressionStatement: function (expression) {
            return {
                type: Syntax.ExpressionStatement,
                expression: expression
            };
        },

        createForStatement: function (init, test, update, body) {
            return {
                type: Syntax.ForStatement,
                init: init,
                test: test,
                update: update,
                body: body
            };
        },

        createForInStatement: function (left, right, body) {
            return {
                type: Syntax.ForInStatement,
                left: left,
                right: right,
                body: body,
                each: false
            };
        },

        createFunctionDeclaration: function (id, params, defaults, body) {
            return {
                type: Syntax.FunctionDeclaration,
                id: id,
                params: params,
                defaults: defaults,
                body: body,
                rest: null,
                generator: false,
                expression: false
            };
        },

        createFunctionExpression: function (id, params, defaults, body) {
            return {
                type: Syntax.FunctionExpression,
                id: id,
                params: params,
                defaults: defaults,
                body: body,
                rest: null,
                generator: false,
                expression: false
            };
        },

        createIdentifier: function (name) {
            return {
                type: Syntax.Identifier,
                name: name
            };
        },

        createIfStatement: function (test, consequent, alternate) {
            return {
                type: Syntax.IfStatement,
                test: test,
                consequent: consequent,
                alternate: alternate
            };
        },

        createLabeledStatement: function (label, body) {
            return {
                type: Syntax.LabeledStatement,
                label: label,
                body: body
            };
        },

        createLiteral: function (token) {
            return {
                type: Syntax.Literal,
                value: token.value,
                raw: source.slice(token.start, token.end)
            };
        },

        createMemberExpression: function (accessor, object, property) {
            return {
                type: Syntax.MemberExpression,
                computed: accessor === '[',
                object: object,
                property: property
            };
        },

        createNewExpression: function (callee, args) {
            return {
                type: Syntax.NewExpression,
                callee: callee,
                'arguments': args
            };
        },

        createObjectExpression: function (properties) {
            return {
                type: Syntax.ObjectExpression,
                properties: properties
            };
        },

        createPostfixExpression: function (operator, argument) {
            return {
                type: Syntax.UpdateExpression,
                operator: operator,
                argument: argument,
                prefix: false
            };
        },

        createProgram: function (body) {
            return {
                type: Syntax.Program,
                body: body
            };
        },

        createProperty: function (kind, key, value) {
            return {
                type: Syntax.Property,
                key: key,
                value: value,
                kind: kind
            };
        },

        createReturnStatement: function (argument) {
            return {
                type: Syntax.ReturnStatement,
                argument: argument
            };
        },

        createSequenceExpression: function (expressions) {
            return {
                type: Syntax.SequenceExpression,
                expressions: expressions
            };
        },

        createSwitchCase: function (test, consequent) {
            return {
                type: Syntax.SwitchCase,
                test: test,
                consequent: consequent
            };
        },

        createSwitchStatement: function (discriminant, cases) {
            return {
                type: Syntax.SwitchStatement,
                discriminant: discriminant,
                cases: cases
            };
        },

        createThisExpression: function () {
            return {
                type: Syntax.ThisExpression
            };
        },

        createThrowStatement: function (argument) {
            return {
                type: Syntax.ThrowStatement,
                argument: argument
            };
        },

        createTryStatement: function (block, guardedHandlers, handlers, finalizer) {
            return {
                type: Syntax.TryStatement,
                block: block,
                guardedHandlers: guardedHandlers,
                handlers: handlers,
                finalizer: finalizer
            };
        },

        createUnaryExpression: function (operator, argument) {
            if (operator === '++' || operator === '--') {
                return {
                    type: Syntax.UpdateExpression,
                    operator: operator,
                    argument: argument,
                    prefix: true
                };
            }
            return {
                type: Syntax.UnaryExpression,
                operator: operator,
                argument: argument,
                prefix: true
            };
        },

        createVariableDeclaration: function (declarations, kind) {
            return {
                type: Syntax.VariableDeclaration,
                declarations: declarations,
                kind: kind
            };
        },

        createVariableDeclarator: function (id, init) {
            return {
                type: Syntax.VariableDeclarator,
                id: id,
                init: init
            };
        },

        createWhileStatement: function (test, body) {
            return {
                type: Syntax.WhileStatement,
                test: test,
                body: body
            };
        },

        createWithStatement: function (object, body) {
            return {
                type: Syntax.WithStatement,
                object: object,
                body: body
            };
        }
    };

    // Return true if there is a line terminator before the next token.

    function peekLineTerminator() {
        var pos, line, start, found;

        pos = index;
        line = lineNumber;
        start = lineStart;
        skipComment();
        found = lineNumber !== line;
        index = pos;
        lineNumber = line;
        lineStart = start;

        return found;
    }

    // Throw an exception

    function throwError(token, messageFormat) {
        var error,
            args = Array.prototype.slice.call(arguments, 2),
            msg = messageFormat.replace(
                /%(\d)/g,
                function (whole, index) {
                    assert(index < args.length, 'Message reference must be in range');
                    return args[index];
                }
            );

        if (typeof token.lineNumber === 'number') {
            error = new Error('Line ' + token.lineNumber + ': ' + msg);
            error.index = token.start;
            error.lineNumber = token.lineNumber;
            error.column = token.start - lineStart + 1;
        } else {
            error = new Error('Line ' + lineNumber + ': ' + msg);
            error.index = index;
            error.lineNumber = lineNumber;
            error.column = index - lineStart + 1;
        }

        error.description = msg;
        throw error;
    }

    function throwErrorTolerant() {
        try {
            throwError.apply(null, arguments);
        } catch (e) {
            if (extra.errors) {
                extra.errors.push(e);
            } else {
                throw e;
            }
        }
    }


    // Throw an exception because of the token.

    function throwUnexpected(token) {
        if (token.type === Token.EOF) {
            throwError(token, Messages.UnexpectedEOS);
        }

        if (token.type === Token.NumericLiteral) {
            throwError(token, Messages.UnexpectedNumber);
        }

        if (token.type === Token.StringLiteral) {
            throwError(token, Messages.UnexpectedString);
        }

        if (token.type === Token.Identifier) {
            throwError(token, Messages.UnexpectedIdentifier);
        }

        if (token.type === Token.Keyword) {
            if (isFutureReservedWord(token.value)) {
                throwError(token, Messages.UnexpectedReserved);
            } else if (strict && isStrictModeReservedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictReservedWord);
                return;
            }
            throwError(token, Messages.UnexpectedToken, token.value);
        }

        // BooleanLiteral, NullLiteral, or Punctuator.
        throwError(token, Messages.UnexpectedToken, token.value);
    }

    // Expect the next token to match the specified punctuator.
    // If not, an exception will be thrown.

    function expect(value) {
        var token = lex();
        if (token.type !== Token.Punctuator || token.value !== value) {
            throwUnexpected(token);
        }
    }

    // Expect the next token to match the specified keyword.
    // If not, an exception will be thrown.

    function expectKeyword(keyword) {
        var token = lex();
        if (token.type !== Token.Keyword || token.value !== keyword) {
            throwUnexpected(token);
        }
    }

    // Return true if the next token matches the specified punctuator.

    function match(value) {
        return lookahead.type === Token.Punctuator && lookahead.value === value;
    }

    // Return true if the next token matches the specified keyword

    function matchKeyword(keyword) {
        return lookahead.type === Token.Keyword && lookahead.value === keyword;
    }

    // Return true if the next token is an assignment operator

    function matchAssign() {
        var op;

        if (lookahead.type !== Token.Punctuator) {
            return false;
        }
        op = lookahead.value;
        return op === '=' ||
            op === '*=' ||
            op === '/=' ||
            op === '%=' ||
            op === '+=' ||
            op === '-=' ||
            op === '<<=' ||
            op === '>>=' ||
            op === '>>>=' ||
            op === '&=' ||
            op === '^=' ||
            op === '|=';
    }

    function consumeSemicolon() {
        var line;

        // Catch the very common case first: immediately a semicolon (U+003B).
        if (source.charCodeAt(index) === 0x3B || match(';')) {
            lex();
            return;
        }

        line = lineNumber;
        skipComment();
        if (lineNumber !== line) {
            return;
        }

        if (lookahead.type !== Token.EOF && !match('}')) {
            throwUnexpected(lookahead);
        }
    }

    // Return true if provided expression is LeftHandSideExpression

    function isLeftHandSide(expr) {
        return expr.type === Syntax.Identifier || expr.type === Syntax.MemberExpression;
    }

    // 11.1.4 Array Initialiser

    function parseArrayInitialiser() {
        var elements = [], startToken;

        startToken = lookahead;
        expect('[');

        while (!match(']')) {
            if (match(',')) {
                lex();
                elements.push(null);
            } else {
                elements.push(parseAssignmentExpression());

                if (!match(']')) {
                    expect(',');
                }
            }
        }

        lex();

        return delegate.markEnd(delegate.createArrayExpression(elements), startToken);
    }

    // 11.1.5 Object Initialiser

    function parsePropertyFunction(param, first) {
        var previousStrict, body, startToken;

        previousStrict = strict;
        startToken = lookahead;
        body = parseFunctionSourceElements();
        if (first && strict && isRestrictedWord(param[0].name)) {
            throwErrorTolerant(first, Messages.StrictParamName);
        }
        strict = previousStrict;
        return delegate.markEnd(delegate.createFunctionExpression(null, param, [], body), startToken);
    }

    function parseObjectPropertyKey() {
        var token, startToken;

        startToken = lookahead;
        token = lex();

        // Note: This function is called only from parseObjectProperty(), where
        // EOF and Punctuator tokens are already filtered out.

        if (token.type === Token.StringLiteral || token.type === Token.NumericLiteral) {
            if (strict && token.octal) {
                throwErrorTolerant(token, Messages.StrictOctalLiteral);
            }
            return delegate.markEnd(delegate.createLiteral(token), startToken);
        }

        return delegate.markEnd(delegate.createIdentifier(token.value), startToken);
    }

    function parseObjectProperty() {
        var token, key, id, value, param, startToken;

        token = lookahead;
        startToken = lookahead;

        if (token.type === Token.Identifier) {

            id = parseObjectPropertyKey();

            // Property Assignment: Getter and Setter.

            if (token.value === 'get' && !match(':')) {
                key = parseObjectPropertyKey();
                expect('(');
                expect(')');
                value = parsePropertyFunction([]);
                return delegate.markEnd(delegate.createProperty('get', key, value), startToken);
            }
            if (token.value === 'set' && !match(':')) {
                key = parseObjectPropertyKey();
                expect('(');
                token = lookahead;
                if (token.type !== Token.Identifier) {
                    expect(')');
                    throwErrorTolerant(token, Messages.UnexpectedToken, token.value);
                    value = parsePropertyFunction([]);
                } else {
                    param = [ parseVariableIdentifier() ];
                    expect(')');
                    value = parsePropertyFunction(param, token);
                }
                return delegate.markEnd(delegate.createProperty('set', key, value), startToken);
            }
            expect(':');
            value = parseAssignmentExpression();
            return delegate.markEnd(delegate.createProperty('init', id, value), startToken);
        }
        if (token.type === Token.EOF || token.type === Token.Punctuator) {
            throwUnexpected(token);
        } else {
            key = parseObjectPropertyKey();
            expect(':');
            value = parseAssignmentExpression();
            return delegate.markEnd(delegate.createProperty('init', key, value), startToken);
        }
    }

    function parseObjectInitialiser() {
        var properties = [], property, name, key, kind, map = {}, toString = String, startToken;

        startToken = lookahead;

        expect('{');

        while (!match('}')) {
            property = parseObjectProperty();

            if (property.key.type === Syntax.Identifier) {
                name = property.key.name;
            } else {
                name = toString(property.key.value);
            }
            kind = (property.kind === 'init') ? PropertyKind.Data : (property.kind === 'get') ? PropertyKind.Get : PropertyKind.Set;

            key = '$' + name;
            if (Object.prototype.hasOwnProperty.call(map, key)) {
                if (map[key] === PropertyKind.Data) {
                    if (strict && kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.StrictDuplicateProperty);
                    } else if (kind !== PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    }
                } else {
                    if (kind === PropertyKind.Data) {
                        throwErrorTolerant({}, Messages.AccessorDataProperty);
                    } else if (map[key] & kind) {
                        throwErrorTolerant({}, Messages.AccessorGetSet);
                    }
                }
                map[key] |= kind;
            } else {
                map[key] = kind;
            }

            properties.push(property);

            if (!match('}')) {
                expect(',');
            }
        }

        expect('}');

        return delegate.markEnd(delegate.createObjectExpression(properties), startToken);
    }

    // 11.1.6 The Grouping Operator

    function parseGroupExpression() {
        var expr;

        expect('(');

        expr = parseExpression();

        expect(')');

        return expr;
    }


    // 11.1 Primary Expressions

    function parsePrimaryExpression() {
        var type, token, expr, startToken;

        if (match('(')) {
            return parseGroupExpression();
        }

        if (match('[')) {
            return parseArrayInitialiser();
        }

        if (match('{')) {
            return parseObjectInitialiser();
        }

        type = lookahead.type;
        startToken = lookahead;

        if (type === Token.Identifier) {
            expr =  delegate.createIdentifier(lex().value);
        } else if (type === Token.StringLiteral || type === Token.NumericLiteral) {
            if (strict && lookahead.octal) {
                throwErrorTolerant(lookahead, Messages.StrictOctalLiteral);
            }
            expr = delegate.createLiteral(lex());
        } else if (type === Token.Keyword) {
            if (matchKeyword('function')) {
                return parseFunctionExpression();
            }
            if (matchKeyword('this')) {
                lex();
                expr = delegate.createThisExpression();
            } else {
                throwUnexpected(lex());
            }
        } else if (type === Token.BooleanLiteral) {
            token = lex();
            token.value = (token.value === 'true');
            expr = delegate.createLiteral(token);
        } else if (type === Token.NullLiteral) {
            token = lex();
            token.value = null;
            expr = delegate.createLiteral(token);
        } else if (match('/') || match('/=')) {
            if (typeof extra.tokens !== 'undefined') {
                expr = delegate.createLiteral(collectRegex());
            } else {
                expr = delegate.createLiteral(scanRegExp());
            }
            peek();
        } else {
            throwUnexpected(lex());
        }

        return delegate.markEnd(expr, startToken);
    }

    // 11.2 Left-Hand-Side Expressions

    function parseArguments() {
        var args = [];

        expect('(');

        if (!match(')')) {
            while (index < length) {
                args.push(parseAssignmentExpression());
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        return args;
    }

    function parseNonComputedProperty() {
        var token, startToken;

        startToken = lookahead;
        token = lex();

        if (!isIdentifierName(token)) {
            throwUnexpected(token);
        }

        return delegate.markEnd(delegate.createIdentifier(token.value), startToken);
    }

    function parseNonComputedMember() {
        expect('.');

        return parseNonComputedProperty();
    }

    function parseComputedMember() {
        var expr;

        expect('[');

        expr = parseExpression();

        expect(']');

        return expr;
    }

    function parseNewExpression() {
        var callee, args, startToken;

        startToken = lookahead;
        expectKeyword('new');
        callee = parseLeftHandSideExpression();
        args = match('(') ? parseArguments() : [];

        return delegate.markEnd(delegate.createNewExpression(callee, args), startToken);
    }

    function parseLeftHandSideExpressionAllowCall() {
        var previousAllowIn, expr, args, property, startToken;

        startToken = lookahead;

        previousAllowIn = state.allowIn;
        state.allowIn = true;
        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();
        state.allowIn = previousAllowIn;

        for (;;) {
            if (match('.')) {
                property = parseNonComputedMember();
                expr = delegate.createMemberExpression('.', expr, property);
            } else if (match('(')) {
                args = parseArguments();
                expr = delegate.createCallExpression(expr, args);
            } else if (match('[')) {
                property = parseComputedMember();
                expr = delegate.createMemberExpression('[', expr, property);
            } else {
                break;
            }
            delegate.markEnd(expr, startToken);
        }

        return expr;
    }

    function parseLeftHandSideExpression() {
        var previousAllowIn, expr, property, startToken;

        startToken = lookahead;

        previousAllowIn = state.allowIn;
        expr = matchKeyword('new') ? parseNewExpression() : parsePrimaryExpression();
        state.allowIn = previousAllowIn;

        while (match('.') || match('[')) {
            if (match('[')) {
                property = parseComputedMember();
                expr = delegate.createMemberExpression('[', expr, property);
            } else {
                property = parseNonComputedMember();
                expr = delegate.createMemberExpression('.', expr, property);
            }
            delegate.markEnd(expr, startToken);
        }

        return expr;
    }

    // 11.3 Postfix Expressions

    function parsePostfixExpression() {
        var expr, token, startToken = lookahead;

        expr = parseLeftHandSideExpressionAllowCall();

        if (lookahead.type === Token.Punctuator) {
            if ((match('++') || match('--')) && !peekLineTerminator()) {
                // 11.3.1, 11.3.2
                if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                    throwErrorTolerant({}, Messages.StrictLHSPostfix);
                }

                if (!isLeftHandSide(expr)) {
                    throwErrorTolerant({}, Messages.InvalidLHSInAssignment);
                }

                token = lex();
                expr = delegate.markEnd(delegate.createPostfixExpression(token.value, expr), startToken);
            }
        }

        return expr;
    }

    // 11.4 Unary Operators

    function parseUnaryExpression() {
        var token, expr, startToken;

        if (lookahead.type !== Token.Punctuator && lookahead.type !== Token.Keyword) {
            expr = parsePostfixExpression();
        } else if (match('++') || match('--')) {
            startToken = lookahead;
            token = lex();
            expr = parseUnaryExpression();
            // 11.4.4, 11.4.5
            if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                throwErrorTolerant({}, Messages.StrictLHSPrefix);
            }

            if (!isLeftHandSide(expr)) {
                throwErrorTolerant({}, Messages.InvalidLHSInAssignment);
            }

            expr = delegate.createUnaryExpression(token.value, expr);
            expr = delegate.markEnd(expr, startToken);
        } else if (match('+') || match('-') || match('~') || match('!')) {
            startToken = lookahead;
            token = lex();
            expr = parseUnaryExpression();
            expr = delegate.createUnaryExpression(token.value, expr);
            expr = delegate.markEnd(expr, startToken);
        } else if (matchKeyword('delete') || matchKeyword('void') || matchKeyword('typeof')) {
            startToken = lookahead;
            token = lex();
            expr = parseUnaryExpression();
            expr = delegate.createUnaryExpression(token.value, expr);
            expr = delegate.markEnd(expr, startToken);
            if (strict && expr.operator === 'delete' && expr.argument.type === Syntax.Identifier) {
                throwErrorTolerant({}, Messages.StrictDelete);
            }
        } else {
            expr = parsePostfixExpression();
        }

        return expr;
    }

    function binaryPrecedence(token, allowIn) {
        var prec = 0;

        if (token.type !== Token.Punctuator && token.type !== Token.Keyword) {
            return 0;
        }

        switch (token.value) {
        case '||':
            prec = 1;
            break;

        case '&&':
            prec = 2;
            break;

        case '|':
            prec = 3;
            break;

        case '^':
            prec = 4;
            break;

        case '&':
            prec = 5;
            break;

        case '==':
        case '!=':
        case '===':
        case '!==':
            prec = 6;
            break;

        case '<':
        case '>':
        case '<=':
        case '>=':
        case 'instanceof':
            prec = 7;
            break;

        case 'in':
            prec = allowIn ? 7 : 0;
            break;

        case '<<':
        case '>>':
        case '>>>':
            prec = 8;
            break;

        case '+':
        case '-':
            prec = 9;
            break;

        case '*':
        case '/':
        case '%':
            prec = 11;
            break;

        default:
            break;
        }

        return prec;
    }

    // 11.5 Multiplicative Operators
    // 11.6 Additive Operators
    // 11.7 Bitwise Shift Operators
    // 11.8 Relational Operators
    // 11.9 Equality Operators
    // 11.10 Binary Bitwise Operators
    // 11.11 Binary Logical Operators

    function parseBinaryExpression() {
        var marker, markers, expr, token, prec, stack, right, operator, left, i;

        marker = lookahead;
        left = parseUnaryExpression();

        token = lookahead;
        prec = binaryPrecedence(token, state.allowIn);
        if (prec === 0) {
            return left;
        }
        token.prec = prec;
        lex();

        markers = [marker, lookahead];
        right = parseUnaryExpression();

        stack = [left, token, right];

        while ((prec = binaryPrecedence(lookahead, state.allowIn)) > 0) {

            // Reduce: make a binary expression from the three topmost entries.
            while ((stack.length > 2) && (prec <= stack[stack.length - 2].prec)) {
                right = stack.pop();
                operator = stack.pop().value;
                left = stack.pop();
                expr = delegate.createBinaryExpression(operator, left, right);
                markers.pop();
                marker = markers[markers.length - 1];
                delegate.markEnd(expr, marker);
                stack.push(expr);
            }

            // Shift.
            token = lex();
            token.prec = prec;
            stack.push(token);
            markers.push(lookahead);
            expr = parseUnaryExpression();
            stack.push(expr);
        }

        // Final reduce to clean-up the stack.
        i = stack.length - 1;
        expr = stack[i];
        markers.pop();
        while (i > 1) {
            expr = delegate.createBinaryExpression(stack[i - 1].value, stack[i - 2], expr);
            i -= 2;
            marker = markers.pop();
            delegate.markEnd(expr, marker);
        }

        return expr;
    }


    // 11.12 Conditional Operator

    function parseConditionalExpression() {
        var expr, previousAllowIn, consequent, alternate, startToken;

        startToken = lookahead;

        expr = parseBinaryExpression();

        if (match('?')) {
            lex();
            previousAllowIn = state.allowIn;
            state.allowIn = true;
            consequent = parseAssignmentExpression();
            state.allowIn = previousAllowIn;
            expect(':');
            alternate = parseAssignmentExpression();

            expr = delegate.createConditionalExpression(expr, consequent, alternate);
            delegate.markEnd(expr, startToken);
        }

        return expr;
    }

    // 11.13 Assignment Operators

    function parseAssignmentExpression() {
        var token, left, right, node, startToken;

        token = lookahead;
        startToken = lookahead;

        node = left = parseConditionalExpression();

        if (matchAssign()) {
            // LeftHandSideExpression
            if (!isLeftHandSide(left)) {
                throwErrorTolerant({}, Messages.InvalidLHSInAssignment);
            }

            // 11.13.1
            if (strict && left.type === Syntax.Identifier && isRestrictedWord(left.name)) {
                throwErrorTolerant(token, Messages.StrictLHSAssignment);
            }

            token = lex();
            right = parseAssignmentExpression();
            node = delegate.markEnd(delegate.createAssignmentExpression(token.value, left, right), startToken);
        }

        return node;
    }

    // 11.14 Comma Operator

    function parseExpression() {
        var expr, startToken = lookahead;

        expr = parseAssignmentExpression();

        if (match(',')) {
            expr = delegate.createSequenceExpression([ expr ]);

            while (index < length) {
                if (!match(',')) {
                    break;
                }
                lex();
                expr.expressions.push(parseAssignmentExpression());
            }

            delegate.markEnd(expr, startToken);
        }

        return expr;
    }

    // 12.1 Block

    function parseStatementList() {
        var list = [],
            statement;

        while (index < length) {
            if (match('}')) {
                break;
            }
            statement = parseSourceElement();
            if (typeof statement === 'undefined') {
                break;
            }
            list.push(statement);
        }

        return list;
    }

    function parseBlock() {
        var block, startToken;

        startToken = lookahead;
        expect('{');

        block = parseStatementList();

        expect('}');

        return delegate.markEnd(delegate.createBlockStatement(block), startToken);
    }

    // 12.2 Variable Statement

    function parseVariableIdentifier() {
        var token, startToken;

        startToken = lookahead;
        token = lex();

        if (token.type !== Token.Identifier) {
            throwUnexpected(token);
        }

        return delegate.markEnd(delegate.createIdentifier(token.value), startToken);
    }

    function parseVariableDeclaration(kind) {
        var init = null, id, startToken;

        startToken = lookahead;
        id = parseVariableIdentifier();

        // 12.2.1
        if (strict && isRestrictedWord(id.name)) {
            throwErrorTolerant({}, Messages.StrictVarName);
        }

        if (kind === 'const') {
            expect('=');
            init = parseAssignmentExpression();
        } else if (match('=')) {
            lex();
            init = parseAssignmentExpression();
        }

        return delegate.markEnd(delegate.createVariableDeclarator(id, init), startToken);
    }

    function parseVariableDeclarationList(kind) {
        var list = [];

        do {
            list.push(parseVariableDeclaration(kind));
            if (!match(',')) {
                break;
            }
            lex();
        } while (index < length);

        return list;
    }

    function parseVariableStatement() {
        var declarations;

        expectKeyword('var');

        declarations = parseVariableDeclarationList();

        consumeSemicolon();

        return delegate.createVariableDeclaration(declarations, 'var');
    }

    // kind may be `const` or `let`
    // Both are experimental and not in the specification yet.
    // see http://wiki.ecmascript.org/doku.php?id=harmony:const
    // and http://wiki.ecmascript.org/doku.php?id=harmony:let
    function parseConstLetDeclaration(kind) {
        var declarations, startToken;

        startToken = lookahead;

        expectKeyword(kind);

        declarations = parseVariableDeclarationList(kind);

        consumeSemicolon();

        return delegate.markEnd(delegate.createVariableDeclaration(declarations, kind), startToken);
    }

    // 12.3 Empty Statement

    function parseEmptyStatement() {
        expect(';');
        return delegate.createEmptyStatement();
    }

    // 12.4 Expression Statement

    function parseExpressionStatement() {
        var expr = parseExpression();
        consumeSemicolon();
        return delegate.createExpressionStatement(expr);
    }

    // 12.5 If statement

    function parseIfStatement() {
        var test, consequent, alternate;

        expectKeyword('if');

        expect('(');

        test = parseExpression();

        expect(')');

        consequent = parseStatement();

        if (matchKeyword('else')) {
            lex();
            alternate = parseStatement();
        } else {
            alternate = null;
        }

        return delegate.createIfStatement(test, consequent, alternate);
    }

    // 12.6 Iteration Statements

    function parseDoWhileStatement() {
        var body, test, oldInIteration;

        expectKeyword('do');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        if (match(';')) {
            lex();
        }

        return delegate.createDoWhileStatement(body, test);
    }

    function parseWhileStatement() {
        var test, body, oldInIteration;

        expectKeyword('while');

        expect('(');

        test = parseExpression();

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        return delegate.createWhileStatement(test, body);
    }

    function parseForVariableDeclaration() {
        var token, declarations, startToken;

        startToken = lookahead;
        token = lex();
        declarations = parseVariableDeclarationList();

        return delegate.markEnd(delegate.createVariableDeclaration(declarations, token.value), startToken);
    }

    function parseForStatement() {
        var init, test, update, left, right, body, oldInIteration;

        init = test = update = null;

        expectKeyword('for');

        expect('(');

        if (match(';')) {
            lex();
        } else {
            if (matchKeyword('var') || matchKeyword('let')) {
                state.allowIn = false;
                init = parseForVariableDeclaration();
                state.allowIn = true;

                if (init.declarations.length === 1 && matchKeyword('in')) {
                    lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                }
            } else {
                state.allowIn = false;
                init = parseExpression();
                state.allowIn = true;

                if (matchKeyword('in')) {
                    // LeftHandSideExpression
                    if (!isLeftHandSide(init)) {
                        throwErrorTolerant({}, Messages.InvalidLHSInForIn);
                    }

                    lex();
                    left = init;
                    right = parseExpression();
                    init = null;
                }
            }

            if (typeof left === 'undefined') {
                expect(';');
            }
        }

        if (typeof left === 'undefined') {

            if (!match(';')) {
                test = parseExpression();
            }
            expect(';');

            if (!match(')')) {
                update = parseExpression();
            }
        }

        expect(')');

        oldInIteration = state.inIteration;
        state.inIteration = true;

        body = parseStatement();

        state.inIteration = oldInIteration;

        return (typeof left === 'undefined') ?
                delegate.createForStatement(init, test, update, body) :
                delegate.createForInStatement(left, right, body);
    }

    // 12.7 The continue statement

    function parseContinueStatement() {
        var label = null, key;

        expectKeyword('continue');

        // Optimize the most common form: 'continue;'.
        if (source.charCodeAt(index) === 0x3B) {
            lex();

            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return delegate.createContinueStatement(null);
        }

        if (peekLineTerminator()) {
            if (!state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return delegate.createContinueStatement(null);
        }

        if (lookahead.type === Token.Identifier) {
            label = parseVariableIdentifier();

            key = '$' + label.name;
            if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !state.inIteration) {
            throwError({}, Messages.IllegalContinue);
        }

        return delegate.createContinueStatement(label);
    }

    // 12.8 The break statement

    function parseBreakStatement() {
        var label = null, key;

        expectKeyword('break');

        // Catch the very common case first: immediately a semicolon (U+003B).
        if (source.charCodeAt(index) === 0x3B) {
            lex();

            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return delegate.createBreakStatement(null);
        }

        if (peekLineTerminator()) {
            if (!(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return delegate.createBreakStatement(null);
        }

        if (lookahead.type === Token.Identifier) {
            label = parseVariableIdentifier();

            key = '$' + label.name;
            if (!Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.UnknownLabel, label.name);
            }
        }

        consumeSemicolon();

        if (label === null && !(state.inIteration || state.inSwitch)) {
            throwError({}, Messages.IllegalBreak);
        }

        return delegate.createBreakStatement(label);
    }

    // 12.9 The return statement

    function parseReturnStatement() {
        var argument = null;

        expectKeyword('return');

        if (!state.inFunctionBody) {
            throwErrorTolerant({}, Messages.IllegalReturn);
        }

        // 'return' followed by a space and an identifier is very common.
        if (source.charCodeAt(index) === 0x20) {
            if (isIdentifierStart(source.charCodeAt(index + 1))) {
                argument = parseExpression();
                consumeSemicolon();
                return delegate.createReturnStatement(argument);
            }
        }

        if (peekLineTerminator()) {
            return delegate.createReturnStatement(null);
        }

        if (!match(';')) {
            if (!match('}') && lookahead.type !== Token.EOF) {
                argument = parseExpression();
            }
        }

        consumeSemicolon();

        return delegate.createReturnStatement(argument);
    }

    // 12.10 The with statement

    function parseWithStatement() {
        var object, body;

        if (strict) {
            // TODO(ikarienator): Should we update the test cases instead?
            skipComment();
            throwErrorTolerant({}, Messages.StrictModeWith);
        }

        expectKeyword('with');

        expect('(');

        object = parseExpression();

        expect(')');

        body = parseStatement();

        return delegate.createWithStatement(object, body);
    }

    // 12.10 The swith statement

    function parseSwitchCase() {
        var test, consequent = [], statement, startToken;

        startToken = lookahead;
        if (matchKeyword('default')) {
            lex();
            test = null;
        } else {
            expectKeyword('case');
            test = parseExpression();
        }
        expect(':');

        while (index < length) {
            if (match('}') || matchKeyword('default') || matchKeyword('case')) {
                break;
            }
            statement = parseStatement();
            consequent.push(statement);
        }

        return delegate.markEnd(delegate.createSwitchCase(test, consequent), startToken);
    }

    function parseSwitchStatement() {
        var discriminant, cases, clause, oldInSwitch, defaultFound;

        expectKeyword('switch');

        expect('(');

        discriminant = parseExpression();

        expect(')');

        expect('{');

        cases = [];

        if (match('}')) {
            lex();
            return delegate.createSwitchStatement(discriminant, cases);
        }

        oldInSwitch = state.inSwitch;
        state.inSwitch = true;
        defaultFound = false;

        while (index < length) {
            if (match('}')) {
                break;
            }
            clause = parseSwitchCase();
            if (clause.test === null) {
                if (defaultFound) {
                    throwError({}, Messages.MultipleDefaultsInSwitch);
                }
                defaultFound = true;
            }
            cases.push(clause);
        }

        state.inSwitch = oldInSwitch;

        expect('}');

        return delegate.createSwitchStatement(discriminant, cases);
    }

    // 12.13 The throw statement

    function parseThrowStatement() {
        var argument;

        expectKeyword('throw');

        if (peekLineTerminator()) {
            throwError({}, Messages.NewlineAfterThrow);
        }

        argument = parseExpression();

        consumeSemicolon();

        return delegate.createThrowStatement(argument);
    }

    // 12.14 The try statement

    function parseCatchClause() {
        var param, body, startToken;

        startToken = lookahead;
        expectKeyword('catch');

        expect('(');
        if (match(')')) {
            throwUnexpected(lookahead);
        }

        param = parseVariableIdentifier();
        // 12.14.1
        if (strict && isRestrictedWord(param.name)) {
            throwErrorTolerant({}, Messages.StrictCatchVariable);
        }

        expect(')');
        body = parseBlock();
        return delegate.markEnd(delegate.createCatchClause(param, body), startToken);
    }

    function parseTryStatement() {
        var block, handlers = [], finalizer = null;

        expectKeyword('try');

        block = parseBlock();

        if (matchKeyword('catch')) {
            handlers.push(parseCatchClause());
        }

        if (matchKeyword('finally')) {
            lex();
            finalizer = parseBlock();
        }

        if (handlers.length === 0 && !finalizer) {
            throwError({}, Messages.NoCatchOrFinally);
        }

        return delegate.createTryStatement(block, [], handlers, finalizer);
    }

    // 12.15 The debugger statement

    function parseDebuggerStatement() {
        expectKeyword('debugger');

        consumeSemicolon();

        return delegate.createDebuggerStatement();
    }

    // 12 Statements

    function parseStatement() {
        var type = lookahead.type,
            expr,
            labeledBody,
            key,
            startToken;

        if (type === Token.EOF) {
            throwUnexpected(lookahead);
        }

        if (type === Token.Punctuator && lookahead.value === '{') {
            return parseBlock();
        }

        startToken = lookahead;

        if (type === Token.Punctuator) {
            switch (lookahead.value) {
            case ';':
                return delegate.markEnd(parseEmptyStatement(), startToken);
            case '(':
                return delegate.markEnd(parseExpressionStatement(), startToken);
            default:
                break;
            }
        }

        if (type === Token.Keyword) {
            switch (lookahead.value) {
            case 'break':
                return delegate.markEnd(parseBreakStatement(), startToken);
            case 'continue':
                return delegate.markEnd(parseContinueStatement(), startToken);
            case 'debugger':
                return delegate.markEnd(parseDebuggerStatement(), startToken);
            case 'do':
                return delegate.markEnd(parseDoWhileStatement(), startToken);
            case 'for':
                return delegate.markEnd(parseForStatement(), startToken);
            case 'function':
                return delegate.markEnd(parseFunctionDeclaration(), startToken);
            case 'if':
                return delegate.markEnd(parseIfStatement(), startToken);
            case 'return':
                return delegate.markEnd(parseReturnStatement(), startToken);
            case 'switch':
                return delegate.markEnd(parseSwitchStatement(), startToken);
            case 'throw':
                return delegate.markEnd(parseThrowStatement(), startToken);
            case 'try':
                return delegate.markEnd(parseTryStatement(), startToken);
            case 'var':
                return delegate.markEnd(parseVariableStatement(), startToken);
            case 'while':
                return delegate.markEnd(parseWhileStatement(), startToken);
            case 'with':
                return delegate.markEnd(parseWithStatement(), startToken);
            default:
                break;
            }
        }

        expr = parseExpression();

        // 12.12 Labelled Statements
        if ((expr.type === Syntax.Identifier) && match(':')) {
            lex();

            key = '$' + expr.name;
            if (Object.prototype.hasOwnProperty.call(state.labelSet, key)) {
                throwError({}, Messages.Redeclaration, 'Label', expr.name);
            }

            state.labelSet[key] = true;
            labeledBody = parseStatement();
            delete state.labelSet[key];
            return delegate.markEnd(delegate.createLabeledStatement(expr, labeledBody), startToken);
        }

        consumeSemicolon();

        return delegate.markEnd(delegate.createExpressionStatement(expr), startToken);
    }

    // 13 Function Definition

    function parseFunctionSourceElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted,
            oldLabelSet, oldInIteration, oldInSwitch, oldInFunctionBody, startToken;

        startToken = lookahead;
        expect('{');

        while (index < length) {
            if (lookahead.type !== Token.StringLiteral) {
                break;
            }
            token = lookahead;

            sourceElement = parseSourceElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = source.slice(token.start + 1, token.end - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        oldLabelSet = state.labelSet;
        oldInIteration = state.inIteration;
        oldInSwitch = state.inSwitch;
        oldInFunctionBody = state.inFunctionBody;

        state.labelSet = {};
        state.inIteration = false;
        state.inSwitch = false;
        state.inFunctionBody = true;

        while (index < length) {
            if (match('}')) {
                break;
            }
            sourceElement = parseSourceElement();
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }

        expect('}');

        state.labelSet = oldLabelSet;
        state.inIteration = oldInIteration;
        state.inSwitch = oldInSwitch;
        state.inFunctionBody = oldInFunctionBody;

        return delegate.markEnd(delegate.createBlockStatement(sourceElements), startToken);
    }

    function parseParams(firstRestricted) {
        var param, params = [], token, stricted, paramSet, key, message;
        expect('(');

        if (!match(')')) {
            paramSet = {};
            while (index < length) {
                token = lookahead;
                param = parseVariableIdentifier();
                key = '$' + token.value;
                if (strict) {
                    if (isRestrictedWord(token.value)) {
                        stricted = token;
                        message = Messages.StrictParamName;
                    }
                    if (Object.prototype.hasOwnProperty.call(paramSet, key)) {
                        stricted = token;
                        message = Messages.StrictParamDupe;
                    }
                } else if (!firstRestricted) {
                    if (isRestrictedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictParamName;
                    } else if (isStrictModeReservedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictReservedWord;
                    } else if (Object.prototype.hasOwnProperty.call(paramSet, key)) {
                        firstRestricted = token;
                        message = Messages.StrictParamDupe;
                    }
                }
                params.push(param);
                paramSet[key] = true;
                if (match(')')) {
                    break;
                }
                expect(',');
            }
        }

        expect(')');

        return {
            params: params,
            stricted: stricted,
            firstRestricted: firstRestricted,
            message: message
        };
    }

    function parseFunctionDeclaration() {
        var id, params = [], body, token, stricted, tmp, firstRestricted, message, previousStrict, startToken;

        startToken = lookahead;

        expectKeyword('function');
        token = lookahead;
        id = parseVariableIdentifier();
        if (strict) {
            if (isRestrictedWord(token.value)) {
                throwErrorTolerant(token, Messages.StrictFunctionName);
            }
        } else {
            if (isRestrictedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictFunctionName;
            } else if (isStrictModeReservedWord(token.value)) {
                firstRestricted = token;
                message = Messages.StrictReservedWord;
            }
        }

        tmp = parseParams(firstRestricted);
        params = tmp.params;
        stricted = tmp.stricted;
        firstRestricted = tmp.firstRestricted;
        if (tmp.message) {
            message = tmp.message;
        }

        previousStrict = strict;
        body = parseFunctionSourceElements();
        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && stricted) {
            throwErrorTolerant(stricted, message);
        }
        strict = previousStrict;

        return delegate.markEnd(delegate.createFunctionDeclaration(id, params, [], body), startToken);
    }

    function parseFunctionExpression() {
        var token, id = null, stricted, firstRestricted, message, tmp, params = [], body, previousStrict, startToken;

        startToken = lookahead;
        expectKeyword('function');

        if (!match('(')) {
            token = lookahead;
            id = parseVariableIdentifier();
            if (strict) {
                if (isRestrictedWord(token.value)) {
                    throwErrorTolerant(token, Messages.StrictFunctionName);
                }
            } else {
                if (isRestrictedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictFunctionName;
                } else if (isStrictModeReservedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictReservedWord;
                }
            }
        }

        tmp = parseParams(firstRestricted);
        params = tmp.params;
        stricted = tmp.stricted;
        firstRestricted = tmp.firstRestricted;
        if (tmp.message) {
            message = tmp.message;
        }

        previousStrict = strict;
        body = parseFunctionSourceElements();
        if (strict && firstRestricted) {
            throwError(firstRestricted, message);
        }
        if (strict && stricted) {
            throwErrorTolerant(stricted, message);
        }
        strict = previousStrict;

        return delegate.markEnd(delegate.createFunctionExpression(id, params, [], body), startToken);
    }

    // 14 Program

    function parseSourceElement() {
        if (lookahead.type === Token.Keyword) {
            switch (lookahead.value) {
            case 'const':
            case 'let':
                return parseConstLetDeclaration(lookahead.value);
            case 'function':
                return parseFunctionDeclaration();
            default:
                return parseStatement();
            }
        }

        if (lookahead.type !== Token.EOF) {
            return parseStatement();
        }
    }

    function parseSourceElements() {
        var sourceElement, sourceElements = [], token, directive, firstRestricted;

        while (index < length) {
            token = lookahead;
            if (token.type !== Token.StringLiteral) {
                break;
            }

            sourceElement = parseSourceElement();
            sourceElements.push(sourceElement);
            if (sourceElement.expression.type !== Syntax.Literal) {
                // this is not directive
                break;
            }
            directive = source.slice(token.start + 1, token.end - 1);
            if (directive === 'use strict') {
                strict = true;
                if (firstRestricted) {
                    throwErrorTolerant(firstRestricted, Messages.StrictOctalLiteral);
                }
            } else {
                if (!firstRestricted && token.octal) {
                    firstRestricted = token;
                }
            }
        }

        while (index < length) {
            sourceElement = parseSourceElement();
            /* istanbul ignore if */
            if (typeof sourceElement === 'undefined') {
                break;
            }
            sourceElements.push(sourceElement);
        }
        return sourceElements;
    }

    function parseProgram() {
        var body, startToken;

        skipComment();
        peek();
        startToken = lookahead;
        strict = false;

        body = parseSourceElements();
        return delegate.markEnd(delegate.createProgram(body), startToken);
    }

    function filterTokenLocation() {
        var i, entry, token, tokens = [];

        for (i = 0; i < extra.tokens.length; ++i) {
            entry = extra.tokens[i];
            token = {
                type: entry.type,
                value: entry.value
            };
            if (extra.range) {
                token.range = entry.range;
            }
            if (extra.loc) {
                token.loc = entry.loc;
            }
            tokens.push(token);
        }

        extra.tokens = tokens;
    }

    function tokenize(code, options) {
        var toString,
            token,
            tokens;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        delegate = SyntaxTreeDelegate;
        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        lookahead = null;
        state = {
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1
        };

        extra = {};

        // Options matching.
        options = options || {};

        // Of course we collect tokens here.
        options.tokens = true;
        extra.tokens = [];
        extra.tokenize = true;
        // The following two fields are necessary to compute the Regex tokens.
        extra.openParenToken = -1;
        extra.openCurlyToken = -1;

        extra.range = (typeof options.range === 'boolean') && options.range;
        extra.loc = (typeof options.loc === 'boolean') && options.loc;

        if (typeof options.comment === 'boolean' && options.comment) {
            extra.comments = [];
        }
        if (typeof options.tolerant === 'boolean' && options.tolerant) {
            extra.errors = [];
        }

        try {
            peek();
            if (lookahead.type === Token.EOF) {
                return extra.tokens;
            }

            token = lex();
            while (lookahead.type !== Token.EOF) {
                try {
                    token = lex();
                } catch (lexError) {
                    token = lookahead;
                    if (extra.errors) {
                        extra.errors.push(lexError);
                        // We have to break on the first error
                        // to avoid infinite loops.
                        break;
                    } else {
                        throw lexError;
                    }
                }
            }

            filterTokenLocation();
            tokens = extra.tokens;
            if (typeof extra.comments !== 'undefined') {
                tokens.comments = extra.comments;
            }
            if (typeof extra.errors !== 'undefined') {
                tokens.errors = extra.errors;
            }
        } catch (e) {
            throw e;
        } finally {
            extra = {};
        }
        return tokens;
    }

    function parse(code, options) {
        var program, toString;

        toString = String;
        if (typeof code !== 'string' && !(code instanceof String)) {
            code = toString(code);
        }

        delegate = SyntaxTreeDelegate;
        source = code;
        index = 0;
        lineNumber = (source.length > 0) ? 1 : 0;
        lineStart = 0;
        length = source.length;
        lookahead = null;
        state = {
            allowIn: true,
            labelSet: {},
            inFunctionBody: false,
            inIteration: false,
            inSwitch: false,
            lastCommentStart: -1
        };

        extra = {};
        if (typeof options !== 'undefined') {
            extra.range = (typeof options.range === 'boolean') && options.range;
            extra.loc = (typeof options.loc === 'boolean') && options.loc;
            extra.attachComment = (typeof options.attachComment === 'boolean') && options.attachComment;

            if (extra.loc && options.source !== null && options.source !== undefined) {
                extra.source = toString(options.source);
            }

            if (typeof options.tokens === 'boolean' && options.tokens) {
                extra.tokens = [];
            }
            if (typeof options.comment === 'boolean' && options.comment) {
                extra.comments = [];
            }
            if (typeof options.tolerant === 'boolean' && options.tolerant) {
                extra.errors = [];
            }
            if (extra.attachComment) {
                extra.range = true;
                extra.comments = [];
                extra.bottomRightStack = [];
                extra.trailingComments = [];
                extra.leadingComments = [];
            }
        }

        try {
            program = parseProgram();
            if (typeof extra.comments !== 'undefined') {
                program.comments = extra.comments;
            }
            if (typeof extra.tokens !== 'undefined') {
                filterTokenLocation();
                program.tokens = extra.tokens;
            }
            if (typeof extra.errors !== 'undefined') {
                program.errors = extra.errors;
            }
        } catch (e) {
            throw e;
        } finally {
            extra = {};
        }

        return program;
    }

    // Sync with *.json manifests.
    exports.version = '1.2.3';

    exports.tokenize = tokenize;

    exports.parse = parse;

    // Deep copy.
   /* istanbul ignore next */
    exports.Syntax = (function () {
        var name, types = {};

        if (typeof Object.create === 'function') {
            types = Object.create(null);
        }

        for (name in Syntax) {
            if (Syntax.hasOwnProperty(name)) {
                types[name] = Syntax[name];
            }
        }

        if (typeof Object.freeze === 'function') {
            Object.freeze(types);
        }

        return types;
    }());

}));
/* vim: set sw=4 ts=4 et tw=80 : */

},{}],125:[function(require,module,exports){
/*
  Copyright (C) 2012-2013 Yusuke Suzuki <utatane.tea@gmail.com>
  Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
/*jslint vars:false, bitwise:true*/
/*jshint indent:4*/
/*global exports:true, define:true*/
(function (root, factory) {
    'use strict';

    // Universal Module Definition (UMD) to support AMD, CommonJS/Node.js,
    // and plain browser loading,
    if (typeof define === 'function' && define.amd) {
        define(['exports'], factory);
    } else if (typeof exports !== 'undefined') {
        factory(exports);
    } else {
        factory((root.estraverse = {}));
    }
}(this, function clone(exports) {
    'use strict';

    var Syntax,
        isArray,
        VisitorOption,
        VisitorKeys,
        objectCreate,
        objectKeys,
        BREAK,
        SKIP,
        REMOVE;

    function ignoreJSHintError() { }

    isArray = Array.isArray;
    if (!isArray) {
        isArray = function isArray(array) {
            return Object.prototype.toString.call(array) === '[object Array]';
        };
    }

    function deepCopy(obj) {
        var ret = {}, key, val;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                val = obj[key];
                if (typeof val === 'object' && val !== null) {
                    ret[key] = deepCopy(val);
                } else {
                    ret[key] = val;
                }
            }
        }
        return ret;
    }

    function shallowCopy(obj) {
        var ret = {}, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                ret[key] = obj[key];
            }
        }
        return ret;
    }
    ignoreJSHintError(shallowCopy);

    // based on LLVM libc++ upper_bound / lower_bound
    // MIT License

    function upperBound(array, func) {
        var diff, len, i, current;

        len = array.length;
        i = 0;

        while (len) {
            diff = len >>> 1;
            current = i + diff;
            if (func(array[current])) {
                len = diff;
            } else {
                i = current + 1;
                len -= diff + 1;
            }
        }
        return i;
    }

    function lowerBound(array, func) {
        var diff, len, i, current;

        len = array.length;
        i = 0;

        while (len) {
            diff = len >>> 1;
            current = i + diff;
            if (func(array[current])) {
                i = current + 1;
                len -= diff + 1;
            } else {
                len = diff;
            }
        }
        return i;
    }
    ignoreJSHintError(lowerBound);

    objectCreate = Object.create || (function () {
        function F() { }

        return function (o) {
            F.prototype = o;
            return new F();
        };
    })();

    objectKeys = Object.keys || function (o) {
        var keys = [], key;
        for (key in o) {
            keys.push(key);
        }
        return keys;
    };

    function extend(to, from) {
        objectKeys(from).forEach(function (key) {
            to[key] = from[key];
        });
        return to;
    }

    Syntax = {
        AssignmentExpression: 'AssignmentExpression',
        ArrayExpression: 'ArrayExpression',
        ArrayPattern: 'ArrayPattern',
        ArrowFunctionExpression: 'ArrowFunctionExpression',
        AwaitExpression: 'AwaitExpression', // CAUTION: It's deferred to ES7.
        BlockStatement: 'BlockStatement',
        BinaryExpression: 'BinaryExpression',
        BreakStatement: 'BreakStatement',
        CallExpression: 'CallExpression',
        CatchClause: 'CatchClause',
        ClassBody: 'ClassBody',
        ClassDeclaration: 'ClassDeclaration',
        ClassExpression: 'ClassExpression',
        ComprehensionBlock: 'ComprehensionBlock',  // CAUTION: It's deferred to ES7.
        ComprehensionExpression: 'ComprehensionExpression',  // CAUTION: It's deferred to ES7.
        ConditionalExpression: 'ConditionalExpression',
        ContinueStatement: 'ContinueStatement',
        DebuggerStatement: 'DebuggerStatement',
        DirectiveStatement: 'DirectiveStatement',
        DoWhileStatement: 'DoWhileStatement',
        EmptyStatement: 'EmptyStatement',
        ExportBatchSpecifier: 'ExportBatchSpecifier',
        ExportDeclaration: 'ExportDeclaration',
        ExportSpecifier: 'ExportSpecifier',
        ExpressionStatement: 'ExpressionStatement',
        ForStatement: 'ForStatement',
        ForInStatement: 'ForInStatement',
        ForOfStatement: 'ForOfStatement',
        FunctionDeclaration: 'FunctionDeclaration',
        FunctionExpression: 'FunctionExpression',
        GeneratorExpression: 'GeneratorExpression',  // CAUTION: It's deferred to ES7.
        Identifier: 'Identifier',
        IfStatement: 'IfStatement',
        ImportDeclaration: 'ImportDeclaration',
        ImportDefaultSpecifier: 'ImportDefaultSpecifier',
        ImportNamespaceSpecifier: 'ImportNamespaceSpecifier',
        ImportSpecifier: 'ImportSpecifier',
        Literal: 'Literal',
        LabeledStatement: 'LabeledStatement',
        LogicalExpression: 'LogicalExpression',
        MemberExpression: 'MemberExpression',
        MethodDefinition: 'MethodDefinition',
        ModuleSpecifier: 'ModuleSpecifier',
        NewExpression: 'NewExpression',
        ObjectExpression: 'ObjectExpression',
        ObjectPattern: 'ObjectPattern',
        Program: 'Program',
        Property: 'Property',
        ReturnStatement: 'ReturnStatement',
        SequenceExpression: 'SequenceExpression',
        SpreadElement: 'SpreadElement',
        SwitchStatement: 'SwitchStatement',
        SwitchCase: 'SwitchCase',
        TaggedTemplateExpression: 'TaggedTemplateExpression',
        TemplateElement: 'TemplateElement',
        TemplateLiteral: 'TemplateLiteral',
        ThisExpression: 'ThisExpression',
        ThrowStatement: 'ThrowStatement',
        TryStatement: 'TryStatement',
        UnaryExpression: 'UnaryExpression',
        UpdateExpression: 'UpdateExpression',
        VariableDeclaration: 'VariableDeclaration',
        VariableDeclarator: 'VariableDeclarator',
        WhileStatement: 'WhileStatement',
        WithStatement: 'WithStatement',
        YieldExpression: 'YieldExpression'
    };

    VisitorKeys = {
        AssignmentExpression: ['left', 'right'],
        ArrayExpression: ['elements'],
        ArrayPattern: ['elements'],
        ArrowFunctionExpression: ['params', 'defaults', 'rest', 'body'],
        AwaitExpression: ['argument'], // CAUTION: It's deferred to ES7.
        BlockStatement: ['body'],
        BinaryExpression: ['left', 'right'],
        BreakStatement: ['label'],
        CallExpression: ['callee', 'arguments'],
        CatchClause: ['param', 'body'],
        ClassBody: ['body'],
        ClassDeclaration: ['id', 'body', 'superClass'],
        ClassExpression: ['id', 'body', 'superClass'],
        ComprehensionBlock: ['left', 'right'],  // CAUTION: It's deferred to ES7.
        ComprehensionExpression: ['blocks', 'filter', 'body'],  // CAUTION: It's deferred to ES7.
        ConditionalExpression: ['test', 'consequent', 'alternate'],
        ContinueStatement: ['label'],
        DebuggerStatement: [],
        DirectiveStatement: [],
        DoWhileStatement: ['body', 'test'],
        EmptyStatement: [],
        ExportBatchSpecifier: [],
        ExportDeclaration: ['declaration', 'specifiers', 'source'],
        ExportSpecifier: ['id', 'name'],
        ExpressionStatement: ['expression'],
        ForStatement: ['init', 'test', 'update', 'body'],
        ForInStatement: ['left', 'right', 'body'],
        ForOfStatement: ['left', 'right', 'body'],
        FunctionDeclaration: ['id', 'params', 'defaults', 'rest', 'body'],
        FunctionExpression: ['id', 'params', 'defaults', 'rest', 'body'],
        GeneratorExpression: ['blocks', 'filter', 'body'],  // CAUTION: It's deferred to ES7.
        Identifier: [],
        IfStatement: ['test', 'consequent', 'alternate'],
        ImportDeclaration: ['specifiers', 'source'],
        ImportDefaultSpecifier: ['id'],
        ImportNamespaceSpecifier: ['id'],
        ImportSpecifier: ['id', 'name'],
        Literal: [],
        LabeledStatement: ['label', 'body'],
        LogicalExpression: ['left', 'right'],
        MemberExpression: ['object', 'property'],
        MethodDefinition: ['key', 'value'],
        ModuleSpecifier: [],
        NewExpression: ['callee', 'arguments'],
        ObjectExpression: ['properties'],
        ObjectPattern: ['properties'],
        Program: ['body'],
        Property: ['key', 'value'],
        ReturnStatement: ['argument'],
        SequenceExpression: ['expressions'],
        SpreadElement: ['argument'],
        SwitchStatement: ['discriminant', 'cases'],
        SwitchCase: ['test', 'consequent'],
        TaggedTemplateExpression: ['tag', 'quasi'],
        TemplateElement: [],
        TemplateLiteral: ['quasis', 'expressions'],
        ThisExpression: [],
        ThrowStatement: ['argument'],
        TryStatement: ['block', 'handlers', 'handler', 'guardedHandlers', 'finalizer'],
        UnaryExpression: ['argument'],
        UpdateExpression: ['argument'],
        VariableDeclaration: ['declarations'],
        VariableDeclarator: ['id', 'init'],
        WhileStatement: ['test', 'body'],
        WithStatement: ['object', 'body'],
        YieldExpression: ['argument']
    };

    // unique id
    BREAK = {};
    SKIP = {};
    REMOVE = {};

    VisitorOption = {
        Break: BREAK,
        Skip: SKIP,
        Remove: REMOVE
    };

    function Reference(parent, key) {
        this.parent = parent;
        this.key = key;
    }

    Reference.prototype.replace = function replace(node) {
        this.parent[this.key] = node;
    };

    Reference.prototype.remove = function remove() {
        if (isArray(this.parent)) {
            this.parent.splice(this.key, 1);
            return true;
        } else {
            this.replace(null);
            return false;
        }
    };

    function Element(node, path, wrap, ref) {
        this.node = node;
        this.path = path;
        this.wrap = wrap;
        this.ref = ref;
    }

    function Controller() { }

    // API:
    // return property path array from root to current node
    Controller.prototype.path = function path() {
        var i, iz, j, jz, result, element;

        function addToPath(result, path) {
            if (isArray(path)) {
                for (j = 0, jz = path.length; j < jz; ++j) {
                    result.push(path[j]);
                }
            } else {
                result.push(path);
            }
        }

        // root node
        if (!this.__current.path) {
            return null;
        }

        // first node is sentinel, second node is root element
        result = [];
        for (i = 2, iz = this.__leavelist.length; i < iz; ++i) {
            element = this.__leavelist[i];
            addToPath(result, element.path);
        }
        addToPath(result, this.__current.path);
        return result;
    };

    // API:
    // return type of current node
    Controller.prototype.type = function () {
        var node = this.current();
        return node.type || this.__current.wrap;
    };

    // API:
    // return array of parent elements
    Controller.prototype.parents = function parents() {
        var i, iz, result;

        // first node is sentinel
        result = [];
        for (i = 1, iz = this.__leavelist.length; i < iz; ++i) {
            result.push(this.__leavelist[i].node);
        }

        return result;
    };

    // API:
    // return current node
    Controller.prototype.current = function current() {
        return this.__current.node;
    };

    Controller.prototype.__execute = function __execute(callback, element) {
        var previous, result;

        result = undefined;

        previous  = this.__current;
        this.__current = element;
        this.__state = null;
        if (callback) {
            result = callback.call(this, element.node, this.__leavelist[this.__leavelist.length - 1].node);
        }
        this.__current = previous;

        return result;
    };

    // API:
    // notify control skip / break
    Controller.prototype.notify = function notify(flag) {
        this.__state = flag;
    };

    // API:
    // skip child nodes of current node
    Controller.prototype.skip = function () {
        this.notify(SKIP);
    };

    // API:
    // break traversals
    Controller.prototype['break'] = function () {
        this.notify(BREAK);
    };

    // API:
    // remove node
    Controller.prototype.remove = function () {
        this.notify(REMOVE);
    };

    Controller.prototype.__initialize = function(root, visitor) {
        this.visitor = visitor;
        this.root = root;
        this.__worklist = [];
        this.__leavelist = [];
        this.__current = null;
        this.__state = null;
        this.__fallback = visitor.fallback === 'iteration';
        this.__keys = VisitorKeys;
        if (visitor.keys) {
            this.__keys = extend(objectCreate(this.__keys), visitor.keys);
        }
    };

    function isNode(node) {
        if (node == null) {
            return false;
        }
        return typeof node === 'object' && typeof node.type === 'string';
    }

    function isProperty(nodeType, key) {
        return (nodeType === Syntax.ObjectExpression || nodeType === Syntax.ObjectPattern) && 'properties' === key;
    }

    Controller.prototype.traverse = function traverse(root, visitor) {
        var worklist,
            leavelist,
            element,
            node,
            nodeType,
            ret,
            key,
            current,
            current2,
            candidates,
            candidate,
            sentinel;

        this.__initialize(root, visitor);

        sentinel = {};

        // reference
        worklist = this.__worklist;
        leavelist = this.__leavelist;

        // initialize
        worklist.push(new Element(root, null, null, null));
        leavelist.push(new Element(null, null, null, null));

        while (worklist.length) {
            element = worklist.pop();

            if (element === sentinel) {
                element = leavelist.pop();

                ret = this.__execute(visitor.leave, element);

                if (this.__state === BREAK || ret === BREAK) {
                    return;
                }
                continue;
            }

            if (element.node) {

                ret = this.__execute(visitor.enter, element);

                if (this.__state === BREAK || ret === BREAK) {
                    return;
                }

                worklist.push(sentinel);
                leavelist.push(element);

                if (this.__state === SKIP || ret === SKIP) {
                    continue;
                }

                node = element.node;
                nodeType = element.wrap || node.type;
                candidates = this.__keys[nodeType];
                if (!candidates) {
                    if (this.__fallback) {
                        candidates = objectKeys(node);
                    } else {
                        throw new Error('Unknown node type ' + nodeType + '.');
                    }
                }

                current = candidates.length;
                while ((current -= 1) >= 0) {
                    key = candidates[current];
                    candidate = node[key];
                    if (!candidate) {
                        continue;
                    }

                    if (isArray(candidate)) {
                        current2 = candidate.length;
                        while ((current2 -= 1) >= 0) {
                            if (!candidate[current2]) {
                                continue;
                            }
                            if (isProperty(nodeType, candidates[current])) {
                                element = new Element(candidate[current2], [key, current2], 'Property', null);
                            } else if (isNode(candidate[current2])) {
                                element = new Element(candidate[current2], [key, current2], null, null);
                            } else {
                                continue;
                            }
                            worklist.push(element);
                        }
                    } else if (isNode(candidate)) {
                        worklist.push(new Element(candidate, key, null, null));
                    }
                }
            }
        }
    };

    Controller.prototype.replace = function replace(root, visitor) {
        function removeElem(element) {
            var i,
                key,
                nextElem,
                parent;

            if (element.ref.remove()) {
                // When the reference is an element of an array.
                key = element.ref.key;
                parent = element.ref.parent;

                // If removed from array, then decrease following items' keys.
                i = worklist.length;
                while (i--) {
                    nextElem = worklist[i];
                    if (nextElem.ref && nextElem.ref.parent === parent) {
                        if  (nextElem.ref.key < key) {
                            break;
                        }
                        --nextElem.ref.key;
                    }
                }
            }
        }

        var worklist,
            leavelist,
            node,
            nodeType,
            target,
            element,
            current,
            current2,
            candidates,
            candidate,
            sentinel,
            outer,
            key;

        this.__initialize(root, visitor);

        sentinel = {};

        // reference
        worklist = this.__worklist;
        leavelist = this.__leavelist;

        // initialize
        outer = {
            root: root
        };
        element = new Element(root, null, null, new Reference(outer, 'root'));
        worklist.push(element);
        leavelist.push(element);

        while (worklist.length) {
            element = worklist.pop();

            if (element === sentinel) {
                element = leavelist.pop();

                target = this.__execute(visitor.leave, element);

                // node may be replaced with null,
                // so distinguish between undefined and null in this place
                if (target !== undefined && target !== BREAK && target !== SKIP && target !== REMOVE) {
                    // replace
                    element.ref.replace(target);
                }

                if (this.__state === REMOVE || target === REMOVE) {
                    removeElem(element);
                }

                if (this.__state === BREAK || target === BREAK) {
                    return outer.root;
                }
                continue;
            }

            target = this.__execute(visitor.enter, element);

            // node may be replaced with null,
            // so distinguish between undefined and null in this place
            if (target !== undefined && target !== BREAK && target !== SKIP && target !== REMOVE) {
                // replace
                element.ref.replace(target);
                element.node = target;
            }

            if (this.__state === REMOVE || target === REMOVE) {
                removeElem(element);
                element.node = null;
            }

            if (this.__state === BREAK || target === BREAK) {
                return outer.root;
            }

            // node may be null
            node = element.node;
            if (!node) {
                continue;
            }

            worklist.push(sentinel);
            leavelist.push(element);

            if (this.__state === SKIP || target === SKIP) {
                continue;
            }

            nodeType = element.wrap || node.type;
            candidates = this.__keys[nodeType];
            if (!candidates) {
                if (this.__fallback) {
                    candidates = objectKeys(node);
                } else {
                    throw new Error('Unknown node type ' + nodeType + '.');
                }
            }

            current = candidates.length;
            while ((current -= 1) >= 0) {
                key = candidates[current];
                candidate = node[key];
                if (!candidate) {
                    continue;
                }

                if (isArray(candidate)) {
                    current2 = candidate.length;
                    while ((current2 -= 1) >= 0) {
                        if (!candidate[current2]) {
                            continue;
                        }
                        if (isProperty(nodeType, candidates[current])) {
                            element = new Element(candidate[current2], [key, current2], 'Property', new Reference(candidate, current2));
                        } else if (isNode(candidate[current2])) {
                            element = new Element(candidate[current2], [key, current2], null, new Reference(candidate, current2));
                        } else {
                            continue;
                        }
                        worklist.push(element);
                    }
                } else if (isNode(candidate)) {
                    worklist.push(new Element(candidate, key, null, new Reference(node, key)));
                }
            }
        }

        return outer.root;
    };

    function traverse(root, visitor) {
        var controller = new Controller();
        return controller.traverse(root, visitor);
    }

    function replace(root, visitor) {
        var controller = new Controller();
        return controller.replace(root, visitor);
    }

    function extendCommentRange(comment, tokens) {
        var target;

        target = upperBound(tokens, function search(token) {
            return token.range[0] > comment.range[0];
        });

        comment.extendedRange = [comment.range[0], comment.range[1]];

        if (target !== tokens.length) {
            comment.extendedRange[1] = tokens[target].range[0];
        }

        target -= 1;
        if (target >= 0) {
            comment.extendedRange[0] = tokens[target].range[1];
        }

        return comment;
    }

    function attachComments(tree, providedComments, tokens) {
        // At first, we should calculate extended comment ranges.
        var comments = [], comment, len, i, cursor;

        if (!tree.range) {
            throw new Error('attachComments needs range information');
        }

        // tokens array is empty, we attach comments to tree as 'leadingComments'
        if (!tokens.length) {
            if (providedComments.length) {
                for (i = 0, len = providedComments.length; i < len; i += 1) {
                    comment = deepCopy(providedComments[i]);
                    comment.extendedRange = [0, tree.range[0]];
                    comments.push(comment);
                }
                tree.leadingComments = comments;
            }
            return tree;
        }

        for (i = 0, len = providedComments.length; i < len; i += 1) {
            comments.push(extendCommentRange(deepCopy(providedComments[i]), tokens));
        }

        // This is based on John Freeman's implementation.
        cursor = 0;
        traverse(tree, {
            enter: function (node) {
                var comment;

                while (cursor < comments.length) {
                    comment = comments[cursor];
                    if (comment.extendedRange[1] > node.range[0]) {
                        break;
                    }

                    if (comment.extendedRange[1] === node.range[0]) {
                        if (!node.leadingComments) {
                            node.leadingComments = [];
                        }
                        node.leadingComments.push(comment);
                        comments.splice(cursor, 1);
                    } else {
                        cursor += 1;
                    }
                }

                // already out of owned node
                if (cursor === comments.length) {
                    return VisitorOption.Break;
                }

                if (comments[cursor].extendedRange[0] > node.range[1]) {
                    return VisitorOption.Skip;
                }
            }
        });

        cursor = 0;
        traverse(tree, {
            leave: function (node) {
                var comment;

                while (cursor < comments.length) {
                    comment = comments[cursor];
                    if (node.range[1] < comment.extendedRange[0]) {
                        break;
                    }

                    if (node.range[1] === comment.extendedRange[0]) {
                        if (!node.trailingComments) {
                            node.trailingComments = [];
                        }
                        node.trailingComments.push(comment);
                        comments.splice(cursor, 1);
                    } else {
                        cursor += 1;
                    }
                }

                // already out of owned node
                if (cursor === comments.length) {
                    return VisitorOption.Break;
                }

                if (comments[cursor].extendedRange[0] > node.range[1]) {
                    return VisitorOption.Skip;
                }
            }
        });

        return tree;
    }

    exports.version = '1.8.1-dev';
    exports.Syntax = Syntax;
    exports.traverse = traverse;
    exports.replace = replace;
    exports.attachComments = attachComments;
    exports.VisitorKeys = VisitorKeys;
    exports.VisitorOption = VisitorOption;
    exports.Controller = Controller;
    exports.cloneEnvironment = function () { return clone({}); };

    return exports;
}));
/* vim: set sw=4 ts=4 et tw=80 : */

},{}],126:[function(require,module,exports){
(function (process){
module.exports = minimatch
minimatch.Minimatch = Minimatch

var isWindows = false
if (typeof process !== 'undefined' && process.platform === 'win32')
  isWindows = true

var GLOBSTAR = minimatch.GLOBSTAR = Minimatch.GLOBSTAR = {}
  , expand = require("brace-expansion")

  // any single thing other than /
  // don't need to escape / when using new RegExp()
  , qmark = "[^/]"

  // * => any number of characters
  , star = qmark + "*?"

  // ** when dots are allowed.  Anything goes, except .. and .
  // not (^ or / followed by one or two dots followed by $ or /),
  // followed by anything, any number of times.
  , twoStarDot = "(?:(?!(?:\\\/|^)(?:\\.{1,2})($|\\\/)).)*?"

  // not a ^ or / followed by a dot,
  // followed by anything, any number of times.
  , twoStarNoDot = "(?:(?!(?:\\\/|^)\\.).)*?"

  // characters that need to be escaped in RegExp.
  , reSpecials = charSet("().*{}+?[]^$\\!")

// "abc" -> { a:true, b:true, c:true }
function charSet (s) {
  return s.split("").reduce(function (set, c) {
    set[c] = true
    return set
  }, {})
}

// normalizes slashes.
var slashSplit = /\/+/

minimatch.filter = filter
function filter (pattern, options) {
  options = options || {}
  return function (p, i, list) {
    return minimatch(p, pattern, options)
  }
}

function ext (a, b) {
  a = a || {}
  b = b || {}
  var t = {}
  Object.keys(b).forEach(function (k) {
    t[k] = b[k]
  })
  Object.keys(a).forEach(function (k) {
    t[k] = a[k]
  })
  return t
}

minimatch.defaults = function (def) {
  if (!def || !Object.keys(def).length) return minimatch

  var orig = minimatch

  var m = function minimatch (p, pattern, options) {
    return orig.minimatch(p, pattern, ext(def, options))
  }

  m.Minimatch = function Minimatch (pattern, options) {
    return new orig.Minimatch(pattern, ext(def, options))
  }

  return m
}

Minimatch.defaults = function (def) {
  if (!def || !Object.keys(def).length) return Minimatch
  return minimatch.defaults(def).Minimatch
}


function minimatch (p, pattern, options) {
  if (typeof pattern !== "string") {
    throw new TypeError("glob pattern string required")
  }

  if (!options) options = {}

  // shortcut: comments match nothing.
  if (!options.nocomment && pattern.charAt(0) === "#") {
    return false
  }

  // "" only matches ""
  if (pattern.trim() === "") return p === ""

  return new Minimatch(pattern, options).match(p)
}

function Minimatch (pattern, options) {
  if (!(this instanceof Minimatch)) {
    return new Minimatch(pattern, options)
  }

  if (typeof pattern !== "string") {
    throw new TypeError("glob pattern string required")
  }

  if (!options) options = {}
  pattern = pattern.trim()

  // windows support: need to use /, not \
  if (isWindows)
    pattern = pattern.split("\\").join("/")

  this.options = options
  this.set = []
  this.pattern = pattern
  this.regexp = null
  this.negate = false
  this.comment = false
  this.empty = false

  // make the set of regexps etc.
  this.make()
}

Minimatch.prototype.debug = function() {}

Minimatch.prototype.make = make
function make () {
  // don't do it more than once.
  if (this._made) return

  var pattern = this.pattern
  var options = this.options

  // empty patterns and comments match nothing.
  if (!options.nocomment && pattern.charAt(0) === "#") {
    this.comment = true
    return
  }
  if (!pattern) {
    this.empty = true
    return
  }

  // step 1: figure out negation, etc.
  this.parseNegate()

  // step 2: expand braces
  var set = this.globSet = this.braceExpand()

  if (options.debug) this.debug = console.error

  this.debug(this.pattern, set)

  // step 3: now we have a set, so turn each one into a series of path-portion
  // matching patterns.
  // These will be regexps, except in the case of "**", which is
  // set to the GLOBSTAR object for globstar behavior,
  // and will not contain any / characters
  set = this.globParts = set.map(function (s) {
    return s.split(slashSplit)
  })

  this.debug(this.pattern, set)

  // glob --> regexps
  set = set.map(function (s, si, set) {
    return s.map(this.parse, this)
  }, this)

  this.debug(this.pattern, set)

  // filter out everything that didn't compile properly.
  set = set.filter(function (s) {
    return -1 === s.indexOf(false)
  })

  this.debug(this.pattern, set)

  this.set = set
}

Minimatch.prototype.parseNegate = parseNegate
function parseNegate () {
  var pattern = this.pattern
    , negate = false
    , options = this.options
    , negateOffset = 0

  if (options.nonegate) return

  for ( var i = 0, l = pattern.length
      ; i < l && pattern.charAt(i) === "!"
      ; i ++) {
    negate = !negate
    negateOffset ++
  }

  if (negateOffset) this.pattern = pattern.substr(negateOffset)
  this.negate = negate
}

// Brace expansion:
// a{b,c}d -> abd acd
// a{b,}c -> abc ac
// a{0..3}d -> a0d a1d a2d a3d
// a{b,c{d,e}f}g -> abg acdfg acefg
// a{b,c}d{e,f}g -> abdeg acdeg abdeg abdfg
//
// Invalid sets are not expanded.
// a{2..}b -> a{2..}b
// a{b}c -> a{b}c
minimatch.braceExpand = function (pattern, options) {
  return braceExpand(pattern, options)
}

Minimatch.prototype.braceExpand = braceExpand

function braceExpand (pattern, options) {
  if (!options) {
    if (this instanceof Minimatch)
      options = this.options
    else
      options = {}
  }

  pattern = typeof pattern === "undefined"
    ? this.pattern : pattern

  if (typeof pattern === "undefined") {
    throw new Error("undefined pattern")
  }

  if (options.nobrace ||
      !pattern.match(/\{.*\}/)) {
    // shortcut. no need to expand.
    return [pattern]
  }

  return expand(pattern)
}

// parse a component of the expanded set.
// At this point, no pattern may contain "/" in it
// so we're going to return a 2d array, where each entry is the full
// pattern, split on '/', and then turned into a regular expression.
// A regexp is made at the end which joins each array with an
// escaped /, and another full one which joins each regexp with |.
//
// Following the lead of Bash 4.1, note that "**" only has special meaning
// when it is the *only* thing in a path portion.  Otherwise, any series
// of * is equivalent to a single *.  Globstar behavior is enabled by
// default, and can be disabled by setting options.noglobstar.
Minimatch.prototype.parse = parse
var SUBPARSE = {}
function parse (pattern, isSub) {
  var options = this.options

  // shortcuts
  if (!options.noglobstar && pattern === "**") return GLOBSTAR
  if (pattern === "") return ""

  var re = ""
    , hasMagic = !!options.nocase
    , escaping = false
    // ? => one single character
    , patternListStack = []
    , plType
    , stateChar
    , inClass = false
    , reClassStart = -1
    , classStart = -1
    // . and .. never match anything that doesn't start with .,
    // even when options.dot is set.
    , patternStart = pattern.charAt(0) === "." ? "" // anything
      // not (start or / followed by . or .. followed by / or end)
      : options.dot ? "(?!(?:^|\\\/)\\.{1,2}(?:$|\\\/))"
      : "(?!\\.)"
    , self = this

  function clearStateChar () {
    if (stateChar) {
      // we had some state-tracking character
      // that wasn't consumed by this pass.
      switch (stateChar) {
        case "*":
          re += star
          hasMagic = true
          break
        case "?":
          re += qmark
          hasMagic = true
          break
        default:
          re += "\\"+stateChar
          break
      }
      self.debug('clearStateChar %j %j', stateChar, re)
      stateChar = false
    }
  }

  for ( var i = 0, len = pattern.length, c
      ; (i < len) && (c = pattern.charAt(i))
      ; i ++ ) {

    this.debug("%s\t%s %s %j", pattern, i, re, c)

    // skip over any that are escaped.
    if (escaping && reSpecials[c]) {
      re += "\\" + c
      escaping = false
      continue
    }

    SWITCH: switch (c) {
      case "/":
        // completely not allowed, even escaped.
        // Should already be path-split by now.
        return false

      case "\\":
        clearStateChar()
        escaping = true
        continue

      // the various stateChar values
      // for the "extglob" stuff.
      case "?":
      case "*":
      case "+":
      case "@":
      case "!":
        this.debug("%s\t%s %s %j <-- stateChar", pattern, i, re, c)

        // all of those are literals inside a class, except that
        // the glob [!a] means [^a] in regexp
        if (inClass) {
          this.debug('  in class')
          if (c === "!" && i === classStart + 1) c = "^"
          re += c
          continue
        }

        // if we already have a stateChar, then it means
        // that there was something like ** or +? in there.
        // Handle the stateChar, then proceed with this one.
        self.debug('call clearStateChar %j', stateChar)
        clearStateChar()
        stateChar = c
        // if extglob is disabled, then +(asdf|foo) isn't a thing.
        // just clear the statechar *now*, rather than even diving into
        // the patternList stuff.
        if (options.noext) clearStateChar()
        continue

      case "(":
        if (inClass) {
          re += "("
          continue
        }

        if (!stateChar) {
          re += "\\("
          continue
        }

        plType = stateChar
        patternListStack.push({ type: plType
                              , start: i - 1
                              , reStart: re.length })
        // negation is (?:(?!js)[^/]*)
        re += stateChar === "!" ? "(?:(?!" : "(?:"
        this.debug('plType %j %j', stateChar, re)
        stateChar = false
        continue

      case ")":
        if (inClass || !patternListStack.length) {
          re += "\\)"
          continue
        }

        clearStateChar()
        hasMagic = true
        re += ")"
        plType = patternListStack.pop().type
        // negation is (?:(?!js)[^/]*)
        // The others are (?:<pattern>)<type>
        switch (plType) {
          case "!":
            re += "[^/]*?)"
            break
          case "?":
          case "+":
          case "*": re += plType
          case "@": break // the default anyway
        }
        continue

      case "|":
        if (inClass || !patternListStack.length || escaping) {
          re += "\\|"
          escaping = false
          continue
        }

        clearStateChar()
        re += "|"
        continue

      // these are mostly the same in regexp and glob
      case "[":
        // swallow any state-tracking char before the [
        clearStateChar()

        if (inClass) {
          re += "\\" + c
          continue
        }

        inClass = true
        classStart = i
        reClassStart = re.length
        re += c
        continue

      case "]":
        //  a right bracket shall lose its special
        //  meaning and represent itself in
        //  a bracket expression if it occurs
        //  first in the list.  -- POSIX.2 2.8.3.2
        if (i === classStart + 1 || !inClass) {
          re += "\\" + c
          escaping = false
          continue
        }

        // finish up the class.
        hasMagic = true
        inClass = false
        re += c
        continue

      default:
        // swallow any state char that wasn't consumed
        clearStateChar()

        if (escaping) {
          // no need
          escaping = false
        } else if (reSpecials[c]
                   && !(c === "^" && inClass)) {
          re += "\\"
        }

        re += c

    } // switch
  } // for


  // handle the case where we left a class open.
  // "[abc" is valid, equivalent to "\[abc"
  if (inClass) {
    // split where the last [ was, and escape it
    // this is a huge pita.  We now have to re-walk
    // the contents of the would-be class to re-translate
    // any characters that were passed through as-is
    var cs = pattern.substr(classStart + 1)
      , sp = this.parse(cs, SUBPARSE)
    re = re.substr(0, reClassStart) + "\\[" + sp[0]
    hasMagic = hasMagic || sp[1]
  }

  // handle the case where we had a +( thing at the *end*
  // of the pattern.
  // each pattern list stack adds 3 chars, and we need to go through
  // and escape any | chars that were passed through as-is for the regexp.
  // Go through and escape them, taking care not to double-escape any
  // | chars that were already escaped.
  var pl
  while (pl = patternListStack.pop()) {
    var tail = re.slice(pl.reStart + 3)
    // maybe some even number of \, then maybe 1 \, followed by a |
    tail = tail.replace(/((?:\\{2})*)(\\?)\|/g, function (_, $1, $2) {
      if (!$2) {
        // the | isn't already escaped, so escape it.
        $2 = "\\"
      }

      // need to escape all those slashes *again*, without escaping the
      // one that we need for escaping the | character.  As it works out,
      // escaping an even number of slashes can be done by simply repeating
      // it exactly after itself.  That's why this trick works.
      //
      // I am sorry that you have to see this.
      return $1 + $1 + $2 + "|"
    })

    this.debug("tail=%j\n   %s", tail, tail)
    var t = pl.type === "*" ? star
          : pl.type === "?" ? qmark
          : "\\" + pl.type

    hasMagic = true
    re = re.slice(0, pl.reStart)
       + t + "\\("
       + tail
  }

  // handle trailing things that only matter at the very end.
  clearStateChar()
  if (escaping) {
    // trailing \\
    re += "\\\\"
  }

  // only need to apply the nodot start if the re starts with
  // something that could conceivably capture a dot
  var addPatternStart = false
  switch (re.charAt(0)) {
    case ".":
    case "[":
    case "(": addPatternStart = true
  }

  // if the re is not "" at this point, then we need to make sure
  // it doesn't match against an empty path part.
  // Otherwise a/* will match a/, which it should not.
  if (re !== "" && hasMagic) re = "(?=.)" + re

  if (addPatternStart) re = patternStart + re

  // parsing just a piece of a larger pattern.
  if (isSub === SUBPARSE) {
    return [ re, hasMagic ]
  }

  // skip the regexp for non-magical patterns
  // unescape anything in it, though, so that it'll be
  // an exact match against a file etc.
  if (!hasMagic) {
    return globUnescape(pattern)
  }

  var flags = options.nocase ? "i" : ""
    , regExp = new RegExp("^" + re + "$", flags)

  regExp._glob = pattern
  regExp._src = re

  return regExp
}

minimatch.makeRe = function (pattern, options) {
  return new Minimatch(pattern, options || {}).makeRe()
}

Minimatch.prototype.makeRe = makeRe
function makeRe () {
  if (this.regexp || this.regexp === false) return this.regexp

  // at this point, this.set is a 2d array of partial
  // pattern strings, or "**".
  //
  // It's better to use .match().  This function shouldn't
  // be used, really, but it's pretty convenient sometimes,
  // when you just want to work with a regex.
  var set = this.set

  if (!set.length) return this.regexp = false
  var options = this.options

  var twoStar = options.noglobstar ? star
      : options.dot ? twoStarDot
      : twoStarNoDot
    , flags = options.nocase ? "i" : ""

  var re = set.map(function (pattern) {
    return pattern.map(function (p) {
      return (p === GLOBSTAR) ? twoStar
           : (typeof p === "string") ? regExpEscape(p)
           : p._src
    }).join("\\\/")
  }).join("|")

  // must match entire pattern
  // ending in a * or ** will make it less strict.
  re = "^(?:" + re + ")$"

  // can match anything, as long as it's not this.
  if (this.negate) re = "^(?!" + re + ").*$"

  try {
    return this.regexp = new RegExp(re, flags)
  } catch (ex) {
    return this.regexp = false
  }
}

minimatch.match = function (list, pattern, options) {
  options = options || {}
  var mm = new Minimatch(pattern, options)
  list = list.filter(function (f) {
    return mm.match(f)
  })
  if (mm.options.nonull && !list.length) {
    list.push(pattern)
  }
  return list
}

Minimatch.prototype.match = match
function match (f, partial) {
  this.debug("match", f, this.pattern)
  // short-circuit in the case of busted things.
  // comments, etc.
  if (this.comment) return false
  if (this.empty) return f === ""

  if (f === "/" && partial) return true

  var options = this.options

  // windows: need to use /, not \
  if (isWindows)
    f = f.split("\\").join("/")

  // treat the test path as a set of pathparts.
  f = f.split(slashSplit)
  this.debug(this.pattern, "split", f)

  // just ONE of the pattern sets in this.set needs to match
  // in order for it to be valid.  If negating, then just one
  // match means that we have failed.
  // Either way, return on the first hit.

  var set = this.set
  this.debug(this.pattern, "set", set)

  // Find the basename of the path by looking for the last non-empty segment
  var filename;
  for (var i = f.length - 1; i >= 0; i--) {
    filename = f[i]
    if (filename) break
  }

  for (var i = 0, l = set.length; i < l; i ++) {
    var pattern = set[i], file = f
    if (options.matchBase && pattern.length === 1) {
      file = [filename]
    }
    var hit = this.matchOne(file, pattern, partial)
    if (hit) {
      if (options.flipNegate) return true
      return !this.negate
    }
  }

  // didn't get any hits.  this is success if it's a negative
  // pattern, failure otherwise.
  if (options.flipNegate) return false
  return this.negate
}

// set partial to true to test if, for example,
// "/a/b" matches the start of "/*/b/*/d"
// Partial means, if you run out of file before you run
// out of pattern, then that's fine, as long as all
// the parts match.
Minimatch.prototype.matchOne = function (file, pattern, partial) {
  var options = this.options

  this.debug("matchOne",
              { "this": this
              , file: file
              , pattern: pattern })

  this.debug("matchOne", file.length, pattern.length)

  for ( var fi = 0
          , pi = 0
          , fl = file.length
          , pl = pattern.length
      ; (fi < fl) && (pi < pl)
      ; fi ++, pi ++ ) {

    this.debug("matchOne loop")
    var p = pattern[pi]
      , f = file[fi]

    this.debug(pattern, p, f)

    // should be impossible.
    // some invalid regexp stuff in the set.
    if (p === false) return false

    if (p === GLOBSTAR) {
      this.debug('GLOBSTAR', [pattern, p, f])

      // "**"
      // a/**/b/**/c would match the following:
      // a/b/x/y/z/c
      // a/x/y/z/b/c
      // a/b/x/b/x/c
      // a/b/c
      // To do this, take the rest of the pattern after
      // the **, and see if it would match the file remainder.
      // If so, return success.
      // If not, the ** "swallows" a segment, and try again.
      // This is recursively awful.
      //
      // a/**/b/**/c matching a/b/x/y/z/c
      // - a matches a
      // - doublestar
      //   - matchOne(b/x/y/z/c, b/**/c)
      //     - b matches b
      //     - doublestar
      //       - matchOne(x/y/z/c, c) -> no
      //       - matchOne(y/z/c, c) -> no
      //       - matchOne(z/c, c) -> no
      //       - matchOne(c, c) yes, hit
      var fr = fi
        , pr = pi + 1
      if (pr === pl) {
        this.debug('** at the end')
        // a ** at the end will just swallow the rest.
        // We have found a match.
        // however, it will not swallow /.x, unless
        // options.dot is set.
        // . and .. are *never* matched by **, for explosively
        // exponential reasons.
        for ( ; fi < fl; fi ++) {
          if (file[fi] === "." || file[fi] === ".." ||
              (!options.dot && file[fi].charAt(0) === ".")) return false
        }
        return true
      }

      // ok, let's see if we can swallow whatever we can.
      WHILE: while (fr < fl) {
        var swallowee = file[fr]

        this.debug('\nglobstar while',
                    file, fr, pattern, pr, swallowee)

        // XXX remove this slice.  Just pass the start index.
        if (this.matchOne(file.slice(fr), pattern.slice(pr), partial)) {
          this.debug('globstar found match!', fr, fl, swallowee)
          // found a match.
          return true
        } else {
          // can't swallow "." or ".." ever.
          // can only swallow ".foo" when explicitly asked.
          if (swallowee === "." || swallowee === ".." ||
              (!options.dot && swallowee.charAt(0) === ".")) {
            this.debug("dot detected!", file, fr, pattern, pr)
            break WHILE
          }

          // ** swallows a segment, and continue.
          this.debug('globstar swallow a segment, and continue')
          fr ++
        }
      }
      // no match was found.
      // However, in partial mode, we can't say this is necessarily over.
      // If there's more *pattern* left, then
      if (partial) {
        // ran out of file
        this.debug("\n>>> no match, partial?", file, fr, pattern, pr)
        if (fr === fl) return true
      }
      return false
    }

    // something other than **
    // non-magic patterns just have to match exactly
    // patterns with magic have been turned into regexps.
    var hit
    if (typeof p === "string") {
      if (options.nocase) {
        hit = f.toLowerCase() === p.toLowerCase()
      } else {
        hit = f === p
      }
      this.debug("string match", p, f, hit)
    } else {
      hit = f.match(p)
      this.debug("pattern match", p, f, hit)
    }

    if (!hit) return false
  }

  // Note: ending in / means that we'll get a final ""
  // at the end of the pattern.  This can only match a
  // corresponding "" at the end of the file.
  // If the file ends in /, then it can only match a
  // a pattern that ends in /, unless the pattern just
  // doesn't have any more for it. But, a/b/ should *not*
  // match "a/b/*", even though "" matches against the
  // [^/]*? pattern, except in partial mode, where it might
  // simply not be reached yet.
  // However, a/b/ should still satisfy a/*

  // now either we fell off the end of the pattern, or we're done.
  if (fi === fl && pi === pl) {
    // ran out of pattern and filename at the same time.
    // an exact hit!
    return true
  } else if (fi === fl) {
    // ran out of file, but still had pattern left.
    // this is ok if we're doing the match as part of
    // a glob fs traversal.
    return partial
  } else if (pi === pl) {
    // ran out of pattern, still have file left.
    // this is only acceptable if we're on the very last
    // empty segment of a file with a trailing slash.
    // a/* should match a/b/
    var emptyFileEnd = (fi === fl - 1) && (file[fi] === "")
    return emptyFileEnd
  }

  // should be unreachable.
  throw new Error("wtf?")
}


// replace stuff like \* with *
function globUnescape (s) {
  return s.replace(/\\(.)/g, "$1")
}


function regExpEscape (s) {
  return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&")
}

}).call(this,require('_process'))
},{"_process":147,"brace-expansion":127}],127:[function(require,module,exports){
var concatMap = require('concat-map');
var balanced = require('balanced-match');

module.exports = expandTop;

var escSlash = '\0SLASH'+Math.random()+'\0';
var escOpen = '\0OPEN'+Math.random()+'\0';
var escClose = '\0CLOSE'+Math.random()+'\0';
var escComma = '\0COMMA'+Math.random()+'\0';
var escPeriod = '\0PERIOD'+Math.random()+'\0';

function numeric(str) {
  return parseInt(str, 10) == str
    ? parseInt(str, 10)
    : str.charCodeAt(0);
}

function escapeBraces(str) {
  return str.split('\\\\').join(escSlash)
            .split('\\{').join(escOpen)
            .split('\\}').join(escClose)
            .split('\\,').join(escComma)
            .split('\\.').join(escPeriod);
}

function unescapeBraces(str) {
  return str.split(escSlash).join('\\')
            .split(escOpen).join('{')
            .split(escClose).join('}')
            .split(escComma).join(',')
            .split(escPeriod).join('.');
}


// Basically just str.split(","), but handling cases
// where we have nested braced sections, which should be
// treated as individual members, like {a,{b,c},d}
function parseCommaParts(str) {
  if (!str)
    return [''];

  var parts = [];
  var m = balanced('{', '}', str);

  if (!m)
    return str.split(',');

  var pre = m.pre;
  var body = m.body;
  var post = m.post;
  var p = pre.split(',');

  p[p.length-1] += '{' + body + '}';
  var postParts = parseCommaParts(post);
  if (post.length) {
    p[p.length-1] += postParts.shift();
    p.push.apply(p, postParts);
  }

  parts.push.apply(parts, p);

  return parts;
}

function expandTop(str) {
  if (!str)
    return [];

  return expand(escapeBraces(str), true).map(unescapeBraces);
}

function identity(e) {
  return e;
}

function embrace(str) {
  return '{' + str + '}';
}
function isPadded(el) {
  return /^-?0\d/.test(el);
}

function lte(i, y) {
  return i <= y;
}
function gte(i, y) {
  return i >= y;
}

function expand(str, isTop) {
  var expansions = [];

  var m = balanced('{', '}', str);
  if (!m || /\$$/.test(m.pre)) return [str];

  var isNumericSequence = /^-?\d+\.\.-?\d+(?:\.\.-?\d+)?$/.test(m.body);
  var isAlphaSequence = /^[a-zA-Z]\.\.[a-zA-Z](?:\.\.-?\d+)?$/.test(m.body);
  var isSequence = isNumericSequence || isAlphaSequence;
  var isOptions = /^(.*,)+(.+)?$/.test(m.body);
  if (!isSequence && !isOptions) {
    // {a},b}
    if (m.post.match(/,.*}/)) {
      str = m.pre + '{' + m.body + escClose + m.post;
      return expand(str);
    }
    return [str];
  }

  var n;
  if (isSequence) {
    n = m.body.split(/\.\./);
  } else {
    n = parseCommaParts(m.body);
    if (n.length === 1) {
      // x{{a,b}}y ==> x{a}y x{b}y
      n = expand(n[0], false).map(embrace);
      if (n.length === 1) {
        var post = m.post.length
          ? expand(m.post, false)
          : [''];
        return post.map(function(p) {
          return m.pre + n[0] + p;
        });
      }
    }
  }

  // at this point, n is the parts, and we know it's not a comma set
  // with a single entry.

  // no need to expand pre, since it is guaranteed to be free of brace-sets
  var pre = m.pre;
  var post = m.post.length
    ? expand(m.post, false)
    : [''];

  var N;

  if (isSequence) {
    var x = numeric(n[0]);
    var y = numeric(n[1]);
    var width = Math.max(n[0].length, n[1].length)
    var incr = n.length == 3
      ? Math.abs(numeric(n[2]))
      : 1;
    var test = lte;
    var reverse = y < x;
    if (reverse) {
      incr *= -1;
      test = gte;
    }
    var pad = n.some(isPadded);

    N = [];

    for (var i = x; test(i, y); i += incr) {
      var c;
      if (isAlphaSequence) {
        c = String.fromCharCode(i);
        if (c === '\\')
          c = '';
      } else {
        c = String(i);
        if (pad) {
          var need = width - c.length;
          if (need > 0) {
            var z = new Array(need + 1).join('0');
            if (i < 0)
              c = '-' + z + c.slice(1);
            else
              c = z + c;
          }
        }
      }
      N.push(c);
    }
  } else {
    N = concatMap(n, function(el) { return expand(el, false) });
  }

  for (var j = 0; j < N.length; j++) {
    for (var k = 0; k < post.length; k++) {
      var expansion = pre + N[j] + post[k];
      if (!isTop || isSequence || expansion)
        expansions.push(expansion);
    }
  }

  return expansions;
}


},{"balanced-match":128,"concat-map":129}],128:[function(require,module,exports){
module.exports = balanced;
function balanced(a, b, str) {
  var bal = 0;
  var m = {};
  var ended = false;

  for (var i = 0; i < str.length; i++) {
    if (a == str.substr(i, a.length)) {
      if (!('start' in m)) m.start = i;
      bal++;
    }
    else if (b == str.substr(i, b.length) && 'start' in m) {
      ended = true;
      bal--;
      if (!bal) {
        m.end = i;
        m.pre = str.substr(0, m.start);
        m.body = (m.end - m.start > 1)
          ? str.substring(m.start + a.length, m.end)
          : '';
        m.post = str.slice(m.end + b.length);
        return m;
      }
    }
  }

  // if we opened more than we closed, find the one we closed
  if (bal && ended) {
    var start = m.start + a.length;
    m = balanced(a, b, str.substr(start));
    if (m) {
      m.start += start;
      m.end += start;
      m.pre = str.slice(0, start) + m.pre;
    }
    return m;
  }
}

},{}],129:[function(require,module,exports){
module.exports = function (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        var x = fn(xs[i], i);
        if (isArray(x)) res.push.apply(res, x);
        else res.push(x);
    }
    return res;
};

var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],130:[function(require,module,exports){
module.exports=/[a-z\xB5\xDF-\xF6\xF8-\xFF\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148\u0149\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\u017A\u017C\u017E-\u0180\u0183\u0185\u0188\u018C\u018D\u0192\u0195\u0199-\u019B\u019E\u01A1\u01A3\u01A5\u01A8\u01AA\u01AB\u01AD\u01B0\u01B4\u01B6\u01B9\u01BA\u01BD-\u01BF\u01C6\u01C9\u01CC\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u01DD\u01DF\u01E1\u01E3\u01E5\u01E7\u01E9\u01EB\u01ED\u01EF\u01F0\u01F3\u01F5\u01F9\u01FB\u01FD\u01FF\u0201\u0203\u0205\u0207\u0209\u020B\u020D\u020F\u0211\u0213\u0215\u0217\u0219\u021B\u021D\u021F\u0221\u0223\u0225\u0227\u0229\u022B\u022D\u022F\u0231\u0233-\u0239\u023C\u023F\u0240\u0242\u0247\u0249\u024B\u024D\u024F-\u0293\u0295-\u02AF\u0371\u0373\u0377\u037B-\u037D\u0390\u03AC-\u03CE\u03D0\u03D1\u03D5-\u03D7\u03D9\u03DB\u03DD\u03DF\u03E1\u03E3\u03E5\u03E7\u03E9\u03EB\u03ED\u03EF-\u03F3\u03F5\u03F8\u03FB\u03FC\u0430-\u045F\u0461\u0463\u0465\u0467\u0469\u046B\u046D\u046F\u0471\u0473\u0475\u0477\u0479\u047B\u047D\u047F\u0481\u048B\u048D\u048F\u0491\u0493\u0495\u0497\u0499\u049B\u049D\u049F\u04A1\u04A3\u04A5\u04A7\u04A9\u04AB\u04AD\u04AF\u04B1\u04B3\u04B5\u04B7\u04B9\u04BB\u04BD\u04BF\u04C2\u04C4\u04C6\u04C8\u04CA\u04CC\u04CE\u04CF\u04D1\u04D3\u04D5\u04D7\u04D9\u04DB\u04DD\u04DF\u04E1\u04E3\u04E5\u04E7\u04E9\u04EB\u04ED\u04EF\u04F1\u04F3\u04F5\u04F7\u04F9\u04FB\u04FD\u04FF\u0501\u0503\u0505\u0507\u0509\u050B\u050D\u050F\u0511\u0513\u0515\u0517\u0519\u051B\u051D\u051F\u0521\u0523\u0525\u0527\u0561-\u0587\u1D00-\u1D2B\u1D6B-\u1D77\u1D79-\u1D9A\u1E01\u1E03\u1E05\u1E07\u1E09\u1E0B\u1E0D\u1E0F\u1E11\u1E13\u1E15\u1E17\u1E19\u1E1B\u1E1D\u1E1F\u1E21\u1E23\u1E25\u1E27\u1E29\u1E2B\u1E2D\u1E2F\u1E31\u1E33\u1E35\u1E37\u1E39\u1E3B\u1E3D\u1E3F\u1E41\u1E43\u1E45\u1E47\u1E49\u1E4B\u1E4D\u1E4F\u1E51\u1E53\u1E55\u1E57\u1E59\u1E5B\u1E5D\u1E5F\u1E61\u1E63\u1E65\u1E67\u1E69\u1E6B\u1E6D\u1E6F\u1E71\u1E73\u1E75\u1E77\u1E79\u1E7B\u1E7D\u1E7F\u1E81\u1E83\u1E85\u1E87\u1E89\u1E8B\u1E8D\u1E8F\u1E91\u1E93\u1E95-\u1E9D\u1E9F\u1EA1\u1EA3\u1EA5\u1EA7\u1EA9\u1EAB\u1EAD\u1EAF\u1EB1\u1EB3\u1EB5\u1EB7\u1EB9\u1EBB\u1EBD\u1EBF\u1EC1\u1EC3\u1EC5\u1EC7\u1EC9\u1ECB\u1ECD\u1ECF\u1ED1\u1ED3\u1ED5\u1ED7\u1ED9\u1EDB\u1EDD\u1EDF\u1EE1\u1EE3\u1EE5\u1EE7\u1EE9\u1EEB\u1EED\u1EEF\u1EF1\u1EF3\u1EF5\u1EF7\u1EF9\u1EFB\u1EFD\u1EFF-\u1F07\u1F10-\u1F15\u1F20-\u1F27\u1F30-\u1F37\u1F40-\u1F45\u1F50-\u1F57\u1F60-\u1F67\u1F70-\u1F7D\u1F80-\u1F87\u1F90-\u1F97\u1FA0-\u1FA7\u1FB0-\u1FB4\u1FB6\u1FB7\u1FBE\u1FC2-\u1FC4\u1FC6\u1FC7\u1FD0-\u1FD3\u1FD6\u1FD7\u1FE0-\u1FE7\u1FF2-\u1FF4\u1FF6\u1FF7\u210A\u210E\u210F\u2113\u212F\u2134\u2139\u213C\u213D\u2146-\u2149\u214E\u2184\u2C30-\u2C5E\u2C61\u2C65\u2C66\u2C68\u2C6A\u2C6C\u2C71\u2C73\u2C74\u2C76-\u2C7B\u2C81\u2C83\u2C85\u2C87\u2C89\u2C8B\u2C8D\u2C8F\u2C91\u2C93\u2C95\u2C97\u2C99\u2C9B\u2C9D\u2C9F\u2CA1\u2CA3\u2CA5\u2CA7\u2CA9\u2CAB\u2CAD\u2CAF\u2CB1\u2CB3\u2CB5\u2CB7\u2CB9\u2CBB\u2CBD\u2CBF\u2CC1\u2CC3\u2CC5\u2CC7\u2CC9\u2CCB\u2CCD\u2CCF\u2CD1\u2CD3\u2CD5\u2CD7\u2CD9\u2CDB\u2CDD\u2CDF\u2CE1\u2CE3\u2CE4\u2CEC\u2CEE\u2CF3\u2D00-\u2D25\u2D27\u2D2D\uA641\uA643\uA645\uA647\uA649\uA64B\uA64D\uA64F\uA651\uA653\uA655\uA657\uA659\uA65B\uA65D\uA65F\uA661\uA663\uA665\uA667\uA669\uA66B\uA66D\uA681\uA683\uA685\uA687\uA689\uA68B\uA68D\uA68F\uA691\uA693\uA695\uA697\uA723\uA725\uA727\uA729\uA72B\uA72D\uA72F-\uA731\uA733\uA735\uA737\uA739\uA73B\uA73D\uA73F\uA741\uA743\uA745\uA747\uA749\uA74B\uA74D\uA74F\uA751\uA753\uA755\uA757\uA759\uA75B\uA75D\uA75F\uA761\uA763\uA765\uA767\uA769\uA76B\uA76D\uA76F\uA771-\uA778\uA77A\uA77C\uA77F\uA781\uA783\uA785\uA787\uA78C\uA78E\uA791\uA793\uA7A1\uA7A3\uA7A5\uA7A7\uA7A9\uA7FA\uFB00-\uFB06\uFB13-\uFB17\uFF41-\uFF5A]|\uD801[\uDC28-\uDC4F]|\uD835[\uDC1A-\uDC33\uDC4E-\uDC54\uDC56-\uDC67\uDC82-\uDC9B\uDCB6-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDCCF\uDCEA-\uDD03\uDD1E-\uDD37\uDD52-\uDD6B\uDD86-\uDD9F\uDDBA-\uDDD3\uDDEE-\uDE07\uDE22-\uDE3B\uDE56-\uDE6F\uDE8A-\uDEA5\uDEC2-\uDEDA\uDEDC-\uDEE1\uDEFC-\uDF14\uDF16-\uDF1B\uDF36-\uDF4E\uDF50-\uDF55\uDF70-\uDF88\uDF8A-\uDF8F\uDFAA-\uDFC2\uDFC4-\uDFC9\uDFCB]/
},{}],131:[function(require,module,exports){
module.exports=/[\u02B0-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0374\u037A\u0559\u0640\u06E5\u06E6\u07F4\u07F5\u07FA\u081A\u0824\u0828\u0971\u0E46\u0EC6\u10FC\u17D7\u1843\u1AA7\u1C78-\u1C7D\u1D2C-\u1D6A\u1D78\u1D9B-\u1DBF\u2071\u207F\u2090-\u209C\u2C7C\u2C7D\u2D6F\u2E2F\u3005\u3031-\u3035\u303B\u309D\u309E\u30FC-\u30FE\uA015\uA4F8-\uA4FD\uA60C\uA67F\uA717-\uA71F\uA770\uA788\uA7F8\uA7F9\uA9CF\uAA70\uAADD\uAAF3\uAAF4\uFF70\uFF9E\uFF9F]|\uD81B[\uDF93-\uDF9F]/
},{}],132:[function(require,module,exports){
module.exports=/[\xAA\xBA\u01BB\u01C0-\u01C3\u0294\u05D0-\u05EA\u05F0-\u05F2\u0620-\u063F\u0641-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u0800-\u0815\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0972-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E45\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10D0-\u10FA\u10FD-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17DC\u1820-\u1842\u1844-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C77\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u2135-\u2138\u2D30-\u2D67\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u3006\u303C\u3041-\u3096\u309F\u30A1-\u30FA\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA014\uA016-\uA48C\uA4D0-\uA4F7\uA500-\uA60B\uA610-\uA61F\uA62A\uA62B\uA66E\uA6A0-\uA6E5\uA7FB-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA6F\uAA71-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB\uAADC\uAAE0-\uAAEA\uAAF2\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF66-\uFF6F\uFF71-\uFF9D\uFFA0-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]|\uD800[\uDC00-\uDC0B\uDC0D-\uDC26\uDC28-\uDC3A\uDC3C\uDC3D\uDC3F-\uDC4D\uDC50-\uDC5D\uDC80-\uDCFA\uDE80-\uDE9C\uDEA0-\uDED0\uDF00-\uDF1E\uDF30-\uDF40\uDF42-\uDF49\uDF80-\uDF9D\uDFA0-\uDFC3\uDFC8-\uDFCF]|\uD801[\uDC50-\uDC9D]|\uD802[\uDC00-\uDC05\uDC08\uDC0A-\uDC35\uDC37\uDC38\uDC3C\uDC3F-\uDC55\uDD00-\uDD15\uDD20-\uDD39\uDD80-\uDDB7\uDDBE\uDDBF\uDE00\uDE10-\uDE13\uDE15-\uDE17\uDE19-\uDE33\uDE60-\uDE7C\uDF00-\uDF35\uDF40-\uDF55\uDF60-\uDF72]|\uD803[\uDC00-\uDC48]|\uD804[\uDC03-\uDC37\uDC83-\uDCAF\uDCD0-\uDCE8\uDD03-\uDD26\uDD83-\uDDB2\uDDC1-\uDDC4]|\uD805[\uDE80-\uDEAA]|\uD808[\uDC00-\uDF6E]|[\uD80C\uD840-\uD868\uD86A-\uD86C][\uDC00-\uDFFF]|\uD80D[\uDC00-\uDC2E]|\uD81A[\uDC00-\uDE38]|\uD81B[\uDF00-\uDF44\uDF50]|\uD82C[\uDC00\uDC01]|\uD83B[\uDE00-\uDE03\uDE05-\uDE1F\uDE21\uDE22\uDE24\uDE27\uDE29-\uDE32\uDE34-\uDE37\uDE39\uDE3B\uDE42\uDE47\uDE49\uDE4B\uDE4D-\uDE4F\uDE51\uDE52\uDE54\uDE57\uDE59\uDE5B\uDE5D\uDE5F\uDE61\uDE62\uDE64\uDE67-\uDE6A\uDE6C-\uDE72\uDE74-\uDE77\uDE79-\uDE7C\uDE7E\uDE80-\uDE89\uDE8B-\uDE9B\uDEA1-\uDEA3\uDEA5-\uDEA9\uDEAB-\uDEBB]|\uD869[\uDC00-\uDED6\uDF00-\uDFFF]|\uD86D[\uDC00-\uDF34\uDF40-\uDFFF]|\uD86E[\uDC00-\uDC1D]|\uD87E[\uDC00-\uDE1D]/
},{}],133:[function(require,module,exports){
module.exports=/[\u01C5\u01C8\u01CB\u01F2\u1F88-\u1F8F\u1F98-\u1F9F\u1FA8-\u1FAF\u1FBC\u1FCC\u1FFC]/
},{}],134:[function(require,module,exports){
module.exports=/[A-Z\xC0-\xD6\xD8-\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178\u0179\u017B\u017D\u0181\u0182\u0184\u0186\u0187\u0189-\u018B\u018E-\u0191\u0193\u0194\u0196-\u0198\u019C\u019D\u019F\u01A0\u01A2\u01A4\u01A6\u01A7\u01A9\u01AC\u01AE\u01AF\u01B1-\u01B3\u01B5\u01B7\u01B8\u01BC\u01C4\u01C7\u01CA\u01CD\u01CF\u01D1\u01D3\u01D5\u01D7\u01D9\u01DB\u01DE\u01E0\u01E2\u01E4\u01E6\u01E8\u01EA\u01EC\u01EE\u01F1\u01F4\u01F6-\u01F8\u01FA\u01FC\u01FE\u0200\u0202\u0204\u0206\u0208\u020A\u020C\u020E\u0210\u0212\u0214\u0216\u0218\u021A\u021C\u021E\u0220\u0222\u0224\u0226\u0228\u022A\u022C\u022E\u0230\u0232\u023A\u023B\u023D\u023E\u0241\u0243-\u0246\u0248\u024A\u024C\u024E\u0370\u0372\u0376\u0386\u0388-\u038A\u038C\u038E\u038F\u0391-\u03A1\u03A3-\u03AB\u03CF\u03D2-\u03D4\u03D8\u03DA\u03DC\u03DE\u03E0\u03E2\u03E4\u03E6\u03E8\u03EA\u03EC\u03EE\u03F4\u03F7\u03F9\u03FA\u03FD-\u042F\u0460\u0462\u0464\u0466\u0468\u046A\u046C\u046E\u0470\u0472\u0474\u0476\u0478\u047A\u047C\u047E\u0480\u048A\u048C\u048E\u0490\u0492\u0494\u0496\u0498\u049A\u049C\u049E\u04A0\u04A2\u04A4\u04A6\u04A8\u04AA\u04AC\u04AE\u04B0\u04B2\u04B4\u04B6\u04B8\u04BA\u04BC\u04BE\u04C0\u04C1\u04C3\u04C5\u04C7\u04C9\u04CB\u04CD\u04D0\u04D2\u04D4\u04D6\u04D8\u04DA\u04DC\u04DE\u04E0\u04E2\u04E4\u04E6\u04E8\u04EA\u04EC\u04EE\u04F0\u04F2\u04F4\u04F6\u04F8\u04FA\u04FC\u04FE\u0500\u0502\u0504\u0506\u0508\u050A\u050C\u050E\u0510\u0512\u0514\u0516\u0518\u051A\u051C\u051E\u0520\u0522\u0524\u0526\u0531-\u0556\u10A0-\u10C5\u10C7\u10CD\u1E00\u1E02\u1E04\u1E06\u1E08\u1E0A\u1E0C\u1E0E\u1E10\u1E12\u1E14\u1E16\u1E18\u1E1A\u1E1C\u1E1E\u1E20\u1E22\u1E24\u1E26\u1E28\u1E2A\u1E2C\u1E2E\u1E30\u1E32\u1E34\u1E36\u1E38\u1E3A\u1E3C\u1E3E\u1E40\u1E42\u1E44\u1E46\u1E48\u1E4A\u1E4C\u1E4E\u1E50\u1E52\u1E54\u1E56\u1E58\u1E5A\u1E5C\u1E5E\u1E60\u1E62\u1E64\u1E66\u1E68\u1E6A\u1E6C\u1E6E\u1E70\u1E72\u1E74\u1E76\u1E78\u1E7A\u1E7C\u1E7E\u1E80\u1E82\u1E84\u1E86\u1E88\u1E8A\u1E8C\u1E8E\u1E90\u1E92\u1E94\u1E9E\u1EA0\u1EA2\u1EA4\u1EA6\u1EA8\u1EAA\u1EAC\u1EAE\u1EB0\u1EB2\u1EB4\u1EB6\u1EB8\u1EBA\u1EBC\u1EBE\u1EC0\u1EC2\u1EC4\u1EC6\u1EC8\u1ECA\u1ECC\u1ECE\u1ED0\u1ED2\u1ED4\u1ED6\u1ED8\u1EDA\u1EDC\u1EDE\u1EE0\u1EE2\u1EE4\u1EE6\u1EE8\u1EEA\u1EEC\u1EEE\u1EF0\u1EF2\u1EF4\u1EF6\u1EF8\u1EFA\u1EFC\u1EFE\u1F08-\u1F0F\u1F18-\u1F1D\u1F28-\u1F2F\u1F38-\u1F3F\u1F48-\u1F4D\u1F59\u1F5B\u1F5D\u1F5F\u1F68-\u1F6F\u1FB8-\u1FBB\u1FC8-\u1FCB\u1FD8-\u1FDB\u1FE8-\u1FEC\u1FF8-\u1FFB\u2102\u2107\u210B-\u210D\u2110-\u2112\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u2130-\u2133\u213E\u213F\u2145\u2183\u2C00-\u2C2E\u2C60\u2C62-\u2C64\u2C67\u2C69\u2C6B\u2C6D-\u2C70\u2C72\u2C75\u2C7E-\u2C80\u2C82\u2C84\u2C86\u2C88\u2C8A\u2C8C\u2C8E\u2C90\u2C92\u2C94\u2C96\u2C98\u2C9A\u2C9C\u2C9E\u2CA0\u2CA2\u2CA4\u2CA6\u2CA8\u2CAA\u2CAC\u2CAE\u2CB0\u2CB2\u2CB4\u2CB6\u2CB8\u2CBA\u2CBC\u2CBE\u2CC0\u2CC2\u2CC4\u2CC6\u2CC8\u2CCA\u2CCC\u2CCE\u2CD0\u2CD2\u2CD4\u2CD6\u2CD8\u2CDA\u2CDC\u2CDE\u2CE0\u2CE2\u2CEB\u2CED\u2CF2\uA640\uA642\uA644\uA646\uA648\uA64A\uA64C\uA64E\uA650\uA652\uA654\uA656\uA658\uA65A\uA65C\uA65E\uA660\uA662\uA664\uA666\uA668\uA66A\uA66C\uA680\uA682\uA684\uA686\uA688\uA68A\uA68C\uA68E\uA690\uA692\uA694\uA696\uA722\uA724\uA726\uA728\uA72A\uA72C\uA72E\uA732\uA734\uA736\uA738\uA73A\uA73C\uA73E\uA740\uA742\uA744\uA746\uA748\uA74A\uA74C\uA74E\uA750\uA752\uA754\uA756\uA758\uA75A\uA75C\uA75E\uA760\uA762\uA764\uA766\uA768\uA76A\uA76C\uA76E\uA779\uA77B\uA77D\uA77E\uA780\uA782\uA784\uA786\uA78B\uA78D\uA790\uA792\uA7A0\uA7A2\uA7A4\uA7A6\uA7A8\uA7AA\uFF21-\uFF3A]|\uD801[\uDC00-\uDC27]|\uD835[\uDC00-\uDC19\uDC34-\uDC4D\uDC68-\uDC81\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB5\uDCD0-\uDCE9\uDD04\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD38\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD6C-\uDD85\uDDA0-\uDDB9\uDDD4-\uDDED\uDE08-\uDE21\uDE3C-\uDE55\uDE70-\uDE89\uDEA8-\uDEC0\uDEE2-\uDEFA\uDF1C-\uDF34\uDF56-\uDF6E\uDF90-\uDFA8\uDFCA]/
},{}],135:[function(require,module,exports){
module.exports={
    "disallowSpacesInNamedFunctionExpression": {
        "beforeOpeningRoundBrace": true
    },
    "disallowSpacesInFunctionExpression": {
        "beforeOpeningRoundBrace": true
    },
    "disallowSpacesInAnonymousFunctionExpression": {
        "beforeOpeningRoundBrace": true
    },
    "disallowSpacesInFunctionDeclaration": {
        "beforeOpeningRoundBrace": true
    },
    "disallowEmptyBlocks": true,
    "disallowSpacesInsideArrayBrackets": true,
    "disallowSpacesInsideParentheses": true,
    "disallowQuotedKeysInObjects": true,
    "disallowSpaceAfterObjectKeys": true,
    "disallowSpaceAfterPrefixUnaryOperators": true,
    "disallowSpaceBeforePostfixUnaryOperators": true,
    "disallowSpaceBeforeBinaryOperators": [
        ","
    ],
    "disallowMixedSpacesAndTabs": true,
    "disallowTrailingWhitespace": true,
    "disallowTrailingComma": true,
    "disallowYodaConditions": true,
    "disallowKeywords": [ "with" ],
    "disallowMultipleLineBreaks": true,
    "requireSpaceBeforeBlockStatements": true,
    "requireParenthesesAroundIIFE": true,
    "requireSpacesInConditionalExpression": true,
    "requireMultipleVarDecl": "onevar",
    "requireBlocksOnNewline": 1,
    "requireCommaBeforeLineBreak": true,
    "requireSpaceBeforeBinaryOperators": true,
    "requireSpaceAfterBinaryOperators": true,
    "requireCamelCaseOrUpperCaseIdentifiers": true,
    "requireLineFeedAtFileEnd": true,
    "requireCapitalizedConstructors": true,
    "requireDotNotation": true,
    "requireCurlyBraces": [
        "do"
    ],
    "requireSpaceAfterKeywords": [
        "if",
        "else",
        "for",
        "while",
        "do",
        "switch",
        "case",
        "return",
        "try",
        "catch",
        "typeof"
    ],
    "safeContextKeyword": "_this",
    "validateLineBreaks": "LF",
    "validateQuoteMarks": "'",
    "validateIndentation": 2
}

},{}],136:[function(require,module,exports){
module.exports={
    "requireCurlyBraces": [
        "if",
        "else",
        "for",
        "while",
        "do",
        "try",
        "catch"
    ],
    "requireSpaceAfterKeywords": [
        "if",
        "else",
        "for",
        "while",
        "do",
        "switch",
        "case",
        "return",
        "try",
        "catch",
        "function",
        "typeof"
    ],
    "requireSpaceBeforeBlockStatements": true,
    "requireParenthesesAroundIIFE": true,
    "requireSpacesInConditionalExpression": true,
    "disallowSpacesInNamedFunctionExpression": {
        "beforeOpeningRoundBrace": true
    },
    "disallowSpacesInFunctionDeclaration": {
        "beforeOpeningRoundBrace": true
    },
    "requireMultipleVarDecl": "onevar",
    "requireBlocksOnNewline": true,
    "disallowEmptyBlocks": true,
    "disallowSpacesInsideArrayBrackets": true,
    "disallowSpacesInsideParentheses": true,
    "disallowDanglingUnderscores": true,
    "requireCommaBeforeLineBreak": true,
    "disallowSpaceAfterPrefixUnaryOperators": true,
    "disallowSpaceBeforePostfixUnaryOperators": true,
    "disallowSpaceBeforeBinaryOperators": [
        ","
    ],
    "requireSpaceBeforeBinaryOperators": true,
    "requireSpaceAfterBinaryOperators": true,
    "disallowKeywords": [
        "with",
        "continue"
    ],
    "validateIndentation": 4,
    "disallowMixedSpacesAndTabs": true,
    "disallowTrailingWhitespace": true,
    "disallowTrailingComma": true,
    "disallowKeywordsOnNewLine": [
        "else"
    ],
    "requireLineFeedAtFileEnd": true,
    "requireCapitalizedConstructors": true,
    "requireDotNotation": true,
    "disallowNewlineBeforeBlockStatements": true,
    "disallowMultipleLineStrings": true
}

},{}],137:[function(require,module,exports){
module.exports={
    "requireCurlyBraces": [
        "if",
        "else",
        "for",
        "while",
        "do",
        "try",
        "catch"
    ],
    "requireOperatorBeforeLineBreak": true,
    "requireCamelCaseOrUpperCaseIdentifiers": true,
    "maximumLineLength": {
      "value": 80,
      "allowComments": true,
      "allowRegex": true
    },
    "validateIndentation": 2,
    "validateQuoteMarks": "'",

    "disallowMultipleLineStrings": true,
    "disallowMixedSpacesAndTabs": true,
    "disallowTrailingWhitespace": true,
    "disallowSpaceAfterPrefixUnaryOperators": true,
    "disallowMultipleVarDecl": true,

    "requireSpaceAfterKeywords": [
      "if",
      "else",
      "for",
      "while",
      "do",
      "switch",
      "return",
      "try",
      "catch"
    ],
    "requireSpaceBeforeBinaryOperators": [
        "=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>=", ">>>=",
        "&=", "|=", "^=", "+=",

        "+", "-", "*", "/", "%", "<<", ">>", ">>>", "&",
        "|", "^", "&&", "||", "===", "==", ">=",
        "<=", "<", ">", "!=", "!=="
    ],
    "requireSpaceAfterBinaryOperators": true,
    "requireSpacesInConditionalExpression": true,
    "requireSpaceBeforeBlockStatements": true,
    "requireLineFeedAtFileEnd": true,
    "requireSpacesInFunctionExpression": {
        "beforeOpeningCurlyBrace": true
    },
    "disallowSpacesInAnonymousFunctionExpression": {
        "beforeOpeningRoundBrace": true
    },
    "disallowSpacesInsideObjectBrackets": "all",
    "disallowSpacesInsideArrayBrackets": "all",
    "disallowSpacesInsideParentheses": true,


    "validateJSDoc": {
        "checkParamNames": true,
        "requireParamTypes": true
    },

    "disallowMultipleLineBreaks": true,
    "disallowNewlineBeforeBlockStatements": true
}

},{}],138:[function(require,module,exports){
module.exports={
  "preset": "google",
  "maximumLineLength": 120,
  "requireCamelCaseOrUpperCaseIdentifiers": "ignoreProperties",
  "validateQuoteMarks": { "mark": "'", "escape": true },
  "disallowMultipleVarDecl": "exceptUndefined"
}

},{}],139:[function(require,module,exports){
module.exports={
    "requireCurlyBraces": [
        "if",
        "else",
        "for",
        "while",
        "do",
        "try",
        "catch"
    ],
    "requireOperatorBeforeLineBreak": true,
    "requireParenthesesAroundIIFE": true,
    "requireMultipleVarDecl": "onevar",
    "requireCommaBeforeLineBreak": true,
    "requireCamelCaseOrUpperCaseIdentifiers": true,
    "requireDotNotation": true,
    "maximumLineLength": {
        "value": 100,
        "tabSize": 4,
        "allowUrlComments": true,
        "allowRegex": true
    },
    "validateQuoteMarks": { "mark": "\"", "escape": true },

    "disallowMixedSpacesAndTabs": "smart",
    "disallowTrailingWhitespace": true,
    "disallowMultipleLineStrings": true,
    "disallowTrailingComma": true,

    "requireSpaceBeforeBlockStatements": true,
    "requireSpacesInFunctionExpression": {
        "beforeOpeningCurlyBrace": true
    },
    "requireSpaceAfterKeywords": [
        "if",
        "else",
        "for",
        "while",
        "do",
        "switch",
        "return",
        "try",
        "catch"
    ],
    "requireSpacesInsideObjectBrackets": "all",
    "requireSpacesInsideArrayBrackets": "all",
    "requireSpacesInConditionalExpression": true,
    "requireSpaceAfterBinaryOperators": true,
    "requireLineFeedAtFileEnd": true,
    "requireSpaceBeforeBinaryOperators": [
        "=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>=", ">>>=",
        "&=", "|=", "^=", "+=",

        "+", "-", "*", "/", "%", "<<", ">>", ">>>", "&",
        "|", "^", "&&", "||", "===", "==", ">=",
        "<=", "<", ">", "!=", "!=="
    ],
    "requireSpacesInAnonymousFunctionExpression": {
        "beforeOpeningCurlyBrace": true
    },
    "requireSpacesInNamedFunctionExpression": {
        "beforeOpeningCurlyBrace": true
    },
    "validateLineBreaks": "LF",

    "disallowKeywords": [ "with" ],
    "disallowKeywordsOnNewLine": [ "else" ],
    "disallowSpacesInFunctionExpression": {
        "beforeOpeningRoundBrace": true
    },
    "disallowSpacesInNamedFunctionExpression": {
        "beforeOpeningRoundBrace": true
    },
    "disallowSpacesInAnonymousFunctionExpression": {
        "beforeOpeningRoundBrace": true
    },
    "disallowSpaceAfterObjectKeys": true,
    "disallowSpaceAfterPrefixUnaryOperators": true,
    "disallowSpaceBeforePostfixUnaryOperators": true,
    "disallowSpaceBeforeBinaryOperators": [ ",", ":" ],
    "disallowMultipleLineBreaks": true
}

},{}],140:[function(require,module,exports){
module.exports={
    "requireCurlyBraces": ["while", "do", "try", "catch"],
    "requireSpaceAfterKeywords": ["if", "else", "for", "while", "do", "switch", "return", "try", "catch"],
    "requireSpacesInFunctionExpression": {
        "beforeOpeningCurlyBrace": true
    },
    "requirePaddingNewlinesInBlocks": true,
    "requireSpacesInsideParentheses": "all",
    "requireSpacesInsideObjectBrackets": "all",
    "requireSpacesInsideArrayBrackets": "allButNested",
    "requireSpaceBeforeBlockStatements": true,
    "requireSpacesInForStatement": true,
    "requireSpacesInComputedMemberExpression":true,
    "requireSpaceBeforeObjectValues":true,
    "disallowKeywords": [ "with" ],
    "requireLineFeedAtFileEnd": true,
    "validateLineBreaks": "LF",
    "validateIndentation": "\t",
    "validateObjectIndentation": "\t",

    "requireSpaceAfterPrefixUnaryOperators": ["++", "--"],
    "requireSpaceBeforePostfixUnaryOperators": ["++", "--"],
    "requireSpaceBeforeBinaryOperators": true,
    "requireSpaceAfterBinaryOperators": true,
    "disallowSpaceBeforeBinaryOperators": [","],
    "requireSpacesInConditionalExpression": {
        "afterTest": true,
        "beforeConsequent": true,
        "afterConsequent": true,
        "beforeAlternate": true
    }
}

},{}],141:[function(require,module,exports){
module.exports={
    "requireCurlyBraces": [
        "if",
        "else",
        "for",
        "while",
        "do",
        "try",
        "catch"
    ],
    "requireSpaceBeforeKeywords": true,
    "requireSpaceAfterKeywords": true,
    "requireSpaceBeforeBlockStatements": true,
    "requireParenthesesAroundIIFE": true,
    "requireSpacesInConditionalExpression": true,
    "disallowSpacesInNamedFunctionExpression": {
        "beforeOpeningRoundBrace": true
    },
    "disallowSpacesInFunctionDeclaration": {
        "beforeOpeningRoundBrace": true
    },
    "disallowSpacesInCallExpression": true,
    "requireMultipleVarDecl": "onevar",
    "requireBlocksOnNewline": 1,
    "disallowEmptyBlocks": true,
    "requireSpacesInsideObjectBrackets": "all",
    "requireSpacesInsideArrayBrackets": "all",
    "requireSpacesInsideParentheses": "all",
    "disallowQuotedKeysInObjects": "allButReserved",
    "disallowDanglingUnderscores": true,
    "disallowSpaceAfterObjectKeys": true,
    "requireSpaceBeforeObjectValues": true,
    "requireCommaBeforeLineBreak": true,
    "disallowSpaceAfterPrefixUnaryOperators": true,
    "disallowSpaceBeforePostfixUnaryOperators": true,
    "disallowSpaceBeforeBinaryOperators": [
        ","
    ],
    "requireSpaceBeforeBinaryOperators": true,
    "requireSpaceAfterBinaryOperators": true,
    "disallowImplicitTypeConversion": [
        "binary",
        "string"
    ],
    "requireCamelCaseOrUpperCaseIdentifiers": true,
    "disallowKeywords": [
        "with"
    ],
    "disallowMultipleLineBreaks": true,
    "disallowMixedSpacesAndTabs": true,
    "disallowOperatorBeforeLineBreak": [
        "."
    ],
    "disallowTrailingWhitespace": true,
    "disallowTrailingComma": true,
    "disallowKeywordsOnNewLine": [
        "else"
    ],
    "requireLineBreakAfterVariableAssignment": true,
    "requireLineFeedAtFileEnd": true,
    "requireCapitalizedConstructors": true,
    "requireDotNotation": true,
    "disallowYodaConditions": true,
    "requireSpaceAfterLineComment": true,
    "disallowNewlineBeforeBlockStatements": true,
    "validateLineBreaks": "LF",
    "validateQuoteMarks": "'",
    "validateIndentation": "\t"
}

},{}],142:[function(require,module,exports){
module.exports={
    "requireCurlyBraces": [
        "if",
        "else",
        "for",
        "while",
        "do"
    ],
    "requireSpaceAfterKeywords": [
        "if",
        "else",
        "for",
        "while",
        "do",
        "switch",
        "return",
        "catch"
    ],
    "disallowKeywords": [
        "with"
    ],
    "disallowKeywordsOnNewLine": [
        "else",
        "catch"
    ],

    "disallowSpaceAfterPrefixUnaryOperators": true,
    "disallowSpaceBeforePostfixUnaryOperators": [
        "++",
        "--"
    ],
    "requireSpaceBeforeBinaryOperators": true,
    "requireSpaceAfterBinaryOperators": true,

    "disallowMultipleVarDecl": true,

    "disallowSpacesInsideParentheses": true,
    "disallowEmptyBlocks": true,

    "requireParenthesesAroundIIFE": true,
    "requireSpacesInFunctionDeclaration": {
        "beforeOpeningCurlyBrace": true
    },
    "disallowSpacesInFunctionDeclaration": {
        "beforeOpeningRoundBrace": true
    },
    "requireSpacesInAnonymousFunctionExpression": {
        "beforeOpeningRoundBrace": true,
        "beforeOpeningCurlyBrace": true
    },
    "disallowSpacesInNamedFunctionExpression": {
        "beforeOpeningRoundBrace": true
    },
    "requireSpacesInNamedFunctionExpression": {
        "beforeOpeningCurlyBrace": true
    },

    "requireSpacesInConditionalExpression": {
        "afterTest": true,
        "beforeConsequent": true,
        "afterConsequent": true,
        "beforeAlternate": true
    },

    "disallowSpaceBeforeBinaryOperators": [
        ","
    ],
    "requireCommaBeforeLineBreak": true,

    "validateQuoteMarks": "'",
    "disallowMultipleLineStrings": true,

    "disallowImplicitTypeConversion": [
        "numeric",
        "boolean",
        "binary",
        "string"
    ],
    "disallowYodaConditions": true,

    "disallowSpacesInsideArrayBrackets": true,

    "requireDotNotation": true,
    "disallowSpaceAfterObjectKeys": true,
    "disallowSpacesInsideObjectBrackets": true,
    "disallowQuotedKeysInObjects": true,

    "validateJSDoc": {
        "checkParamNames": true,
        "requireParamTypes": true
    },

    "maximumLineLength": {
        "value": 120,
        "allowUrlComments": true
    },
    "requireSpaceAfterLineComment": true,
    "requireLineFeedAtFileEnd": true,
    "disallowMultipleLineBreaks": true,
    "disallowMixedSpacesAndTabs": true,
    "disallowTrailingWhitespace": true,
    "validateLineBreaks": "LF"
}

},{}],143:[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
var util = require('util/');

var pSlice = Array.prototype.slice;
var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

assert.AssertionError = function AssertionError(options) {
  this.name = 'AssertionError';
  this.actual = options.actual;
  this.expected = options.expected;
  this.operator = options.operator;
  if (options.message) {
    this.message = options.message;
    this.generatedMessage = false;
  } else {
    this.message = getMessage(this);
    this.generatedMessage = true;
  }
  var stackStartFunction = options.stackStartFunction || fail;

  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, stackStartFunction);
  }
  else {
    // non v8 browsers so we can have a stacktrace
    var err = new Error();
    if (err.stack) {
      var out = err.stack;

      // try to strip useless frames
      var fn_name = stackStartFunction.name;
      var idx = out.indexOf('\n' + fn_name);
      if (idx >= 0) {
        // once we have located the function frame
        // we need to strip out everything before it (and its line)
        var next_line = out.indexOf('\n', idx + 1);
        out = out.substring(next_line + 1);
      }

      this.stack = out;
    }
  }
};

// assert.AssertionError instanceof Error
util.inherits(assert.AssertionError, Error);

function replacer(key, value) {
  if (util.isUndefined(value)) {
    return '' + value;
  }
  if (util.isNumber(value) && (isNaN(value) || !isFinite(value))) {
    return value.toString();
  }
  if (util.isFunction(value) || util.isRegExp(value)) {
    return value.toString();
  }
  return value;
}

function truncate(s, n) {
  if (util.isString(s)) {
    return s.length < n ? s : s.slice(0, n);
  } else {
    return s;
  }
}

function getMessage(self) {
  return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
         self.operator + ' ' +
         truncate(JSON.stringify(self.expected, replacer), 128);
}

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

function fail(actual, expected, message, operator, stackStartFunction) {
  throw new assert.AssertionError({
    message: message,
    actual: actual,
    expected: expected,
    operator: operator,
    stackStartFunction: stackStartFunction
  });
}

// EXTENSION! allows for well behaved errors defined elsewhere.
assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

function ok(value, message) {
  if (!value) fail(value, true, message, '==', assert.ok);
}
assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

assert.equal = function equal(actual, expected, message) {
  if (actual != expected) fail(actual, expected, message, '==', assert.equal);
};

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

assert.notEqual = function notEqual(actual, expected, message) {
  if (actual == expected) {
    fail(actual, expected, message, '!=', assert.notEqual);
  }
};

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

assert.deepEqual = function deepEqual(actual, expected, message) {
  if (!_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'deepEqual', assert.deepEqual);
  }
};

function _deepEqual(actual, expected) {
  // 7.1. All identical values are equivalent, as determined by ===.
  if (actual === expected) {
    return true;

  } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
    if (actual.length != expected.length) return false;

    for (var i = 0; i < actual.length; i++) {
      if (actual[i] !== expected[i]) return false;
    }

    return true;

  // 7.2. If the expected value is a Date object, the actual value is
  // equivalent if it is also a Date object that refers to the same time.
  } else if (util.isDate(actual) && util.isDate(expected)) {
    return actual.getTime() === expected.getTime();

  // 7.3 If the expected value is a RegExp object, the actual value is
  // equivalent if it is also a RegExp object with the same source and
  // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
  } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
    return actual.source === expected.source &&
           actual.global === expected.global &&
           actual.multiline === expected.multiline &&
           actual.lastIndex === expected.lastIndex &&
           actual.ignoreCase === expected.ignoreCase;

  // 7.4. Other pairs that do not both pass typeof value == 'object',
  // equivalence is determined by ==.
  } else if (!util.isObject(actual) && !util.isObject(expected)) {
    return actual == expected;

  // 7.5 For all other Object pairs, including Array objects, equivalence is
  // determined by having the same number of owned properties (as verified
  // with Object.prototype.hasOwnProperty.call), the same set of keys
  // (although not necessarily the same order), equivalent values for every
  // corresponding key, and an identical 'prototype' property. Note: this
  // accounts for both named and indexed properties on Arrays.
  } else {
    return objEquiv(actual, expected);
  }
}

function isArguments(object) {
  return Object.prototype.toString.call(object) == '[object Arguments]';
}

function objEquiv(a, b) {
  if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
    return false;
  // an identical 'prototype' property.
  if (a.prototype !== b.prototype) return false;
  //~~~I've managed to break Object.keys through screwy arguments passing.
  //   Converting to array solves the problem.
  if (isArguments(a)) {
    if (!isArguments(b)) {
      return false;
    }
    a = pSlice.call(a);
    b = pSlice.call(b);
    return _deepEqual(a, b);
  }
  try {
    var ka = objectKeys(a),
        kb = objectKeys(b),
        key, i;
  } catch (e) {//happens when one is a string literal and the other isn't
    return false;
  }
  // having the same number of owned properties (keys incorporates
  // hasOwnProperty)
  if (ka.length != kb.length)
    return false;
  //the same set of keys (although not necessarily the same order),
  ka.sort();
  kb.sort();
  //~~~cheap key test
  for (i = ka.length - 1; i >= 0; i--) {
    if (ka[i] != kb[i])
      return false;
  }
  //equivalent values for every corresponding key, and
  //~~~possibly expensive deep test
  for (i = ka.length - 1; i >= 0; i--) {
    key = ka[i];
    if (!_deepEqual(a[key], b[key])) return false;
  }
  return true;
}

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
  if (_deepEqual(actual, expected)) {
    fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
  }
};

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

assert.strictEqual = function strictEqual(actual, expected, message) {
  if (actual !== expected) {
    fail(actual, expected, message, '===', assert.strictEqual);
  }
};

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
  if (actual === expected) {
    fail(actual, expected, message, '!==', assert.notStrictEqual);
  }
};

function expectedException(actual, expected) {
  if (!actual || !expected) {
    return false;
  }

  if (Object.prototype.toString.call(expected) == '[object RegExp]') {
    return expected.test(actual);
  } else if (actual instanceof expected) {
    return true;
  } else if (expected.call({}, actual) === true) {
    return true;
  }

  return false;
}

function _throws(shouldThrow, block, expected, message) {
  var actual;

  if (util.isString(expected)) {
    message = expected;
    expected = null;
  }

  try {
    block();
  } catch (e) {
    actual = e;
  }

  message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
            (message ? ' ' + message : '.');

  if (shouldThrow && !actual) {
    fail(actual, expected, 'Missing expected exception' + message);
  }

  if (!shouldThrow && expectedException(actual, expected)) {
    fail(actual, expected, 'Got unwanted exception' + message);
  }

  if ((shouldThrow && actual && expected &&
      !expectedException(actual, expected)) || (!shouldThrow && actual)) {
    throw actual;
  }
}

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

assert.throws = function(block, /*optional*/error, /*optional*/message) {
  _throws.apply(this, [true].concat(pSlice.call(arguments)));
};

// EXTENSION! This is annoying to write outside this module.
assert.doesNotThrow = function(block, /*optional*/message) {
  _throws.apply(this, [false].concat(pSlice.call(arguments)));
};

assert.ifError = function(err) { if (err) {throw err;}};

var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    if (hasOwn.call(obj, key)) keys.push(key);
  }
  return keys;
};

},{"util/":149}],144:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],145:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],146:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":147}],147:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canMutationObserver = typeof window !== 'undefined'
    && window.MutationObserver;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    var queue = [];

    if (canMutationObserver) {
        var hiddenDiv = document.createElement("div");
        var observer = new MutationObserver(function () {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function (fn) {
                fn();
            });
        });

        observer.observe(hiddenDiv, { attributes: true });

        return function nextTick(fn) {
            if (!queue.length) {
                hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
        };
    }

    if (canPost) {
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],148:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],149:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":148,"_process":147,"inherits":145}]},{},[1]);
