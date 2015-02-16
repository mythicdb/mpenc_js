/**
 * @fileOverview
 * Tests for `mpenc/helper/utils` module.
 */

/*
 * Created: 7 Feb 2014-2015 Guy K. Kloss <gk@mega.co.nz>
 *
 * (c) 2014-2015 by Mega Limited, Auckland, New Zealand
 *     http://mega.co.nz/
 *
 * This file is part of the multi-party chat encryption suite.
 *
 * This code is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License version 3
 * as published by the Free Software Foundation. See the accompanying
 * LICENSE file or <https://www.gnu.org/licenses/> if it is unavailable.
 *
 * This code is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 */

define([
    "mpenc/helper/utils",
    "chai",
    "asmcrypto",
], function(ns, chai, asmCrypto) {
    "use strict";

    var assert = chai.assert;

    // Shut up warning messages on random number generation for unit tests.
    asmCrypto.random.skipSystemRNGWarning = true;

    describe("module level", function() {
        describe('_arrayIsSubSet()', function() {
            it('check for sub/superset between arrays', function() {
                var subset = ['1', '2', '3'];
                var superset = ['0', '1', '2', '3', '4'];
                assert.ok(ns._arrayIsSubSet(subset, superset));
                assert.strictEqual(ns._arrayIsSubSet(superset, subset), false);
            });
        });

        describe('_arrayIsSet()', function() {
            it('check for non-duplicatoin of members in array', function() {
                var theArray = ['1', '2', '3'];
                assert.ok(ns._arrayIsSet(theArray));
                assert.strictEqual(ns._arrayIsSet(['2'].concat(theArray)), false);
            });
        });

        describe('_newKey08()', function() {
            it('properly sized keys', function() {
                var keySizes = [128, 256, 512];
                for (var i = 0; i < keySizes.length; i++) {
                    var newKey = ns._newKey08(keySizes[i]);
                    assert.strictEqual(_tu.keyBits(newKey, 8), keySizes[i]);
                }
            });
        });

        describe('sha256()', function() {
            it('hash some values', function() {
                var values = ['42', "Don't panic!", 'Flying Spaghetti Monster',
                              "Ph'nglui mglw'nafh Cthulhu R'lyeh wgah'nagl fhtagn"];
                var expected = ['c0dctApWjo2ooEXO0RATfhWfiQrE2og7axfcZRs6gEk=',
                                'TmLsTicvHVMesbDSYdkglep+nRe3N4zjd/9M9hzt4K8=',
                                '7yxZ7NbTWc3tm0ls0sEFmuzoE+r0rLmVvnIwI7obFdo=',
                                'O19HQMj+HOz9y3uUBDS4uG8GPXYmZmAUj8ZLVQEFxzY='];
                for (var i = 0; i < values.length; i++) {
                    var result = ns.sha256(values[i]);
                    assert.strictEqual(result, atob(expected[i]));
                }
            });
        });

        describe('constTimeStringCmp()', function() {
            it('tests for equality', function() {
                var tests = [['', ''],
                             ['\u0000', '\u0000'],
                             [_td.ED25519_PUB_KEY, _td.ED25519_PUB_KEY],
                             ["Duck's stuck!", "Duck's Stuck!"],
                             ['42', '42']];
                for (var i = 0; i < tests.length; i++) {
                    assert.ok(ns.constTimeStringCmp(tests[0][0], tests[0][1]),
                              'case ' + (i + 1));
                }
            });

            it('tests for inequality', function() {
                var tests = [['', '\u0000'],
                             ['\u0000', '\u0001'],
                             [_td.ED25519_PUB_KEY, _td.ED25519_PRIV_KEY],
                             ["Duck's stuck!", "Duck's Stuck"],
                             ["Duck's stuck", "Duck's Stuck!"],
                             ['42', '43']];
                for (var i = 0; i < tests.length; i++) {
                    assert.notOk(ns.constTimeStringCmp(tests[0][0], tests[0][1]),
                                 'case ' + (i + 1));
                }
            });
        });

        describe('checkInvariants()', function() {
            it('inheritance test', function() {
                // define invariant functions
                var run_flags = 0;
                var superInvariant = function(obj) {
                    if (obj.super_prop) {
                        run_flags |= 1;
                    }
                };
                var childInvariant = function(obj) {
                    if (obj.child_prop) {
                        run_flags |= 2;
                    }
                };
                // define interfaces
                var SuperClass = function() {
                    this.super_prop = true;
                };
                SuperClass.prototype.__invariants = {superInvariant:superInvariant};
                var ChildClass = function() {
                    SuperClass.call(this);
                    this.child_prop = true;
                };
                ChildClass.prototype = Object.create(SuperClass.prototype);
                ChildClass.prototype.__invariants = {childInvariant:childInvariant};
                // test the object against invariants
                var childObj = new ChildClass();
                ns.checkInvariants(childObj);
                assert.strictEqual(run_flags, 3);
            });
        });

        describe('_objectToString()', function() {
            it('simple tests', function() {
                // TODO: Do we want a more canonical stringification that will be convergent for these two test cases?
                //       E. g. all object properties sorted in lexical order?
                var tests = [{'i': 42, 'f': 3.141, 'l': [1, 2, 3], 't': 'hello', 'o': {0: 'null', 42: 'zweiundvierzig'}},
                             {'f': 3.141, 'i': 42, 'l': [1, 2, 3], 'o': {0: 'null', 42: 'zweiundvierzig'}, 't': 'hello'}];
                var expected = ['{"i":42,"f":3.141,"l":[1,2,3],"t":"hello","o":{"0":"null","42":"zweiundvierzig"}}',
                                '{"f":3.141,"i":42,"l":[1,2,3],"o":{"0":"null","42":"zweiundvierzig"},"t":"hello"}'];
                for (var i in tests) {
                    assert.strictEqual(ns._objectToString(tests[i]), expected[i]);
                }
            });
        });

        describe('objectToHash()', function() {
            it('simple tests', function() {
                var tests = ['foo',
                             ['foo', 'bar'],
                             {1: 'tahi', 2: 'rua', 3: 'toru'},
                             {'i': 42, 'f': 3.141, 'l': [1, 2, 3], 't': 'hello', 'o': {0: 'null', 42: 'zweiundvierzig'}},
                             {'f': 3.141, 'i': 42, 'l': [1, 2, 3], 'o': {0: 'null', 42: 'zweiundvierzig'}, 't': 'hello'}];
                var lastResult = '';
                for (var i in tests) {
                    var result = ns.objectToHash(tests[i]);
                    assert.notStrictEqual(result, lastResult);
                    lastResult = result;
                }
            });
        });
    });
});
