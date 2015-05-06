/*
 * Created: 28 Mar 2014 Ximin Luo <xl@mega.co.nz>
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
    "mpenc/message",
    "mpenc/helper/assert",
    "mpenc/helper/async",
    "mpenc/helper/struct"
], function(message, assert, async, struct) {
    "use strict";

    /**
     * @exports mpenc/transcript
     * @description
     * Transcript interfaces.
     */
    var ns = {};

    var _assert = assert.assert;


    /**
     * A set of Messages forming all or part of a session.
     *
     * @interface
     * @memberOf module:mpenc/transcript
     */
    var Messages = function() {
        throw new Error("cannot instantiate an interface");
    };

    /**
     * @method
     * @param mId {string} Message (node) id.
     * @returns {module:mpenc/message.Message} Message object for the id. */
    Messages.prototype.get;

    /**
     * The immediately-preceding messages seen by the author of mId.
     * @method
     * @param mId {string} Message (node) id.
     * @returns {module:mpenc/helper/struct.ImmutableSet} Set of mIds. */
    Messages.prototype.parents;

    /**
     * The recipients that have not acked the given message, as seen by
     * the local process. If this is empty, the message has been fully-acked.
     *
     * We (the local process) consider a message m authored by u to be "acked"
     * by a recipient ru, iff we have accepted a message m_a authored by ru
     * where m <= m_a, and there is a chain of messages [m .. m_a] all of
     * which are visible to ru (i.e. authored by them, or by another to them).
     *
     * @method
     * @param {string} mId
     * @returns {module:mpenc/helper/struct.ImmutableSet} Set of uIds. */
    Messages.prototype.unackby;

    /**
     * Messages that are not yet fully-acked.
     * @method
     * @returns {Array.<string>} List of mIds in some topological order. */
    Messages.prototype.unacked;

    Object.freeze(Messages.prototype);
    ns.Messages = Messages;


    /**
     * A Transcript.
     *
     * TODO(xl): document
     *
     * @interface
     * @augments module:mpenc/helper/graph.CausalOrder
     * @augments module:mpenc/transcript.Messages
     * @memberOf module:mpenc/transcript
     */
    var Transcript = function() {
        throw new Error("cannot instantiate an interface");
    };

    /**
     * Add a message; all its parents must already have been added.
     *
     * @method
     * @param msg {module:mpenc/message.Message} Message to add.
     * @returns {Array.<string>} List of messages that became fully-acked by
     * the addition of this message, in some topological order. */
    Transcript.prototype.add;

    /**
     * The latest message before mId authored by the same author, or
     * <code>null</code> if mId is the first message authored by them.
     *
     * @method
     * @param mId {string} Message id.
     * @returns {?string} Latest preceding message id or <code>null</code>.
     */
    Transcript.prototype.pre_uId;

    /**
     * The latest message before mId authored by the given recipient of mId, or
     * <code>null</code> if they did not author any such messages.
     *
     * @method
     * @param mId {string} Message id.
     * @param ruId {string} Author (a recipient of mId) to find message for.
     * @returns {?string} Latest preceding message id or <code>null</code>.
     * */
    Transcript.prototype.pre_ruId;

    /**
     * The earliest message after mId authored by the given recipient of mId, or
     * <code>null</code> we did not yet see them author such a message.
     *
     * @method
     * @param mId {string} Message id.
     * @param ruId {string} Author (a recipient of mId) to find message for.
     * @returns {?string} Earliest succeeding message id or <code>null</code>.
     */
    Transcript.prototype.suc_ruId;

    Object.freeze(Transcript.prototype);
    ns.Transcript = Transcript;


    /**
     * When a message is accepted into the transcript, in causal order.
     *
     * @class
     * @property mId {string} The message id.
     * @memberOf module:mpenc/transcript
     */
    var MsgAccepted = struct.createTupleClass("mId");

    Object.freeze(MsgAccepted.prototype);
    ns.MsgAccepted = MsgAccepted;

    /**
     * When a message is acked by all of its intended recipients.
     *
     * @class
     * @property mId {string} The message id.
     * @memberOf module:mpenc/transcript
     */
    var MsgFullyAcked = struct.createTupleClass("mId");

    Object.freeze(MsgFullyAcked.prototype);
    ns.MsgFullyAcked = MsgFullyAcked;

    /**
     * When a message is ready to be consumed by higher layers, such as the UI.
     *
     * These events may be published in a different order from MsgAccepted, but
     * should still be a topological (preserves causality) total order. Events
     * are published in sequence from a single EventContext.
     *
     * Typically, only UserData messages are included here. Implementations may
     * expose the UserData-parents of a message mId from transcript ts as:
     *
     * ud_pmId = ts.pre_pred(mId, lambda m: type(ts[m].secobj) == UserData)
     *
     * Note the right index definitions. For example, if three events were
     * published as (x, 0, []), (a, 0, [1]), (b, 1, [1]), the overall resulting
     * order would be [x, b, a], with the real parents of b and a both being x.
     *
     * @class
     * @property mId {string} The message id.
     * @property ridx {number} The right (negative) index in the existing total
     *      order before which to insert this message. An ordering where these
     *      indexes are all 0, we call "append-only".
     * @property parents {module:mpenc/helper/struct.ImmutableSet} Set of
     *      integers, the right-indexes of the parent messages, relative to the
     *      current message. (For example, if a transcript is already in a
     *      linear order, this would be {1} for every message.) If this is the
     *      first message in the sequence, then this must be {}. For subsequent
     *      messages, the UI should distinguish messages where this is not {1}.
     * @memberOf module:mpenc/transcript
     */
    var MsgReady = struct.createTupleClass("mId", "rIdx", "parents");

    Object.freeze(MsgReady.prototype);
    ns.MsgReady = MsgReady;


    /**
     * A log (or total order, or linear sequence) of messages for the user.
     *
     * Only contains UserData messages. We generate "apparent" parents for each
     * message, by collapsing non-UserData parents into the nearest UserData
     * ancestor, preserving transitive reduction. For example:
     *
     * <pre>
     *       B - D - E
     *      /   /
     * O - A - C
     * </pre>
     *
     * O is the root; everything is UserData except C, D. Then, the parents of
     * E are {B}, because even though A < C, it is also the case that A < B.
     *
     * @class
     * @extends module:mpenc/helper/async.ObservableSequence
     * @augments module:mpenc/transcript.Messages
     * @memberOf module:mpenc/transcript
     */
    var MessageLog = function() {
        throw new Error("cannot instantiate an abstract class");
    };

    MessageLog.prototype = Object.create(async.ObservableSequence.prototype);

    /**
     * Add a message to the log, at an index defined by the implementation.
     *
     * Subscribers to the ObservableSequence trait of this class are notified.
     *
     * @abstract
     * @method
     * @param transcript {module:mpenc/transcript.Transcript} Transcript object that contains the message.
     * @param mId {string} Identifier of the message to add.
     * @param parents {string} Effective UserData parents of this message.
     */
    MessageLog.prototype.add;

    /**
     * Subscribe to MsgAccepted events and add() them to this log.
     *
     * @method
     * @param source {module:mpenc/helper/async.EventSource} Source of MsgAccepted events.
     * @param transcript {module:mpenc/transcript.Transcript} Transcript object that contains the message.
     * @returns {module:mpenc/helper/async~canceller} Canceller for the subscription.
     */
    MessageLog.prototype.bindSource = function(source, transcript) {
        var self = this;
        var totalOrderCb = function(evt) {
            _assert(transcript.contains(evt.mId));
            if (!(transcript.get(evt.mId).secretContent instanceof message.UserData)) {
                return;
            }
            var userDataParents = transcript.prePredicate(evt.mId, function(m) {
                return transcript.get(m).secretContent instanceof message.UserData;
            });
            self.add(transcript, evt.mId, userDataParents);
        };
        return source.onEvent(MsgAccepted)(totalOrderCb);
    };

    /**
     * Whenever this log is updated, publish a MsgReady event.
     *
     * @method
     * @param source {module:mpenc/helper/async.EventContext} Target for MsgReady events.
     * @returns {module:mpenc/helper/async~canceller} Canceller for the subscription.
     */
    MessageLog.prototype.bindTarget = function(target) {
        var self = this;
        var msgReadyCb = function(update) {
            var rIdx = update.rIdx, mId = update.mId;
            var parents = self.parents.toArray().map(function(pm) {
                return (self.length - rIdx - 1) - self.indexOf(pm);
            });
            _assert(parents.every(function(p) { return p > 0; }));
            target.publish(MsgReady(mId, rIdx, parents));
        };
        return this.onUpdate(msgReadyCb);
    };

    Object.freeze(MessageLog.prototype);
    ns.MessageLog = MessageLog;

    return ns;
});
