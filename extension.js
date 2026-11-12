// Modified for Wigga, 2026-11-12. See AUTHORS.txt and LICENSE.txt.
'use strict';

import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { getPointerWatcher } from 'resource:///org/gnome/shell/ui/pointerWatcher.js';

import { Field } from './const.js';
import Effect from './effect.js';
import History from './history.js';

const removePointerWatch = (watch) => {
    watch?.remove();
};

export default class WiggaExtension extends Extension {
    _onCheckIntervalChange(interval) {
        if (this._checkTimeoutId) {
            GLib.Source.remove(this._checkTimeoutId);
            this._checkTimeoutId = null;
        }
        this._checkTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
            if (this._checkCursorHiddenByProgram()) {
                return GLib.SOURCE_CONTINUE;
            }
            if (this._history.check()) {
                this._effect.magnify();
            } else if (this._effect.isWiggling) {
                this._effect.unmagnify();
            }
            return GLib.SOURCE_CONTINUE;
        });
    }

    _checkCursorHiddenByProgram() {
        // different program might take other methods to hide the cursor, so this check should contain more conditions
        if (!this._effect.cursor.tracker.get_sprite()) {
            if (!this._isHiddenByProgram) {
                this._togglePointerWatcher(false);
                this._isHiddenByProgram = true;
            }
            return true;
        } else if (this._isHiddenByProgram) {
            this._togglePointerWatcher(true);
            this._isHiddenByProgram = false;
        }
        return false;
    }

    _onDrawIntervalChange(interval) {
        this._drawInterval = interval;
        if (this._drawIntervalWatch) {
            removePointerWatch(this._drawIntervalWatch);
        }
        this._drawIntervalWatch = this._pointerWatcher.addWatch(interval, (x, y) => {
            this._history.push(x, y);
            if (this._effect.isWiggling) {
                this._effect.move(x, y);
            }
        });
    }

    _togglePointerWatcher(state) {
        if (state) {
            if (!this._drawIntervalWatch) {
                this._onDrawIntervalChange(this._drawInterval);
            }
        } else {
            if (this._effect.isWiggling) {
                this._effect.unmagnify();
            }
            if (this._drawIntervalWatch) {
                removePointerWatch(this._drawIntervalWatch);
                this._drawIntervalWatch = null;
                this._history.clear();
            }
        }
    }

    enable() {
        this._pointerWatcher = getPointerWatcher();
        this._history = new History();
        this._effect = new Effect();
        this._settings = this.getSettings();
        this._settingIds = [
            [Field.SIZE, (r) => {this._effect.cursorSize = r}],
            [Field.MAGN, (r) => {this._effect.magnifyDuration = r}],
            [Field.UMGN, (r) => {this._effect.unmagnifyDuration = r}],
            [Field.DLAY, (r) => {this._effect.unmagnifyDelay = r}],

            [Field.SAMP, (r) => {this._history.sampleSize = r}],
            [Field.RADI, (r) => {this._history.radiansThreshold = r}],
            [Field.DIST, (r) => {this._history.distanceThreshold = r}],
            [Field.CHCK, (r) => this._onCheckIntervalChange(r)],
            [Field.DRAW, (r) => this._onDrawIntervalChange(r)],
        ].map(([key, apply]) => {
            const update = () => apply(this._settings.get_int(key));
            update();
            return this._settings.connect(`changed::${key}`, update);
        });
    }

    disable() {
        for (const id of this._settingIds)
            this._settings.disconnect(id);
        this._settingIds = [];
        if (this._checkTimeoutId) {
            GLib.Source.remove(this._checkTimeoutId);
            this._checkTimeoutId = null;
        }
        this._togglePointerWatcher(false);
        if (this._effect) {
            this._effect.destroy();
        }
        this._effect = null;
        this._pointerWatcher = null;
        this._history = null;
        this._settings = null;
    }
}
