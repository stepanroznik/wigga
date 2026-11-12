// Modified for Wigga, 2026-11-12. See AUTHORS.txt and LICENSE.txt.
'use strict';

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { Field } from './const.js';

const _ = (text) => (text === null ? null : gettext(text));

const nSpin = (title, subtitle, lower, upper, step_increment) => new Adw.SpinRow({
    title: _(title),
    subtitle: _(subtitle),
    numeric: true,
    adjustment: new Gtk.Adjustment({ lower, upper, step_increment }),
});

class PrefGroup extends Adw.PreferencesGroup {
    static {
        GObject.registerClass(this);
    }

    constructor(title, description, rows) {
        super({
            title: _(title),
            description: _(description),
        });
        this._rows = rows;
    }

    bind(settings) {
        this._rows.forEach(([key, obj]) => {
            this.add(obj);
            settings.bind(key, obj, 'value', Gio.SettingsBindFlags.DEFAULT);
        });
    }
}

class PrefPage extends Adw.PreferencesPage {
    static {
        GObject.registerClass(this);
    }

    constructor(title, icon_name, groups) {
        super({
            title: _(title),
            icon_name,
        });
        this._groups = groups;
    }

    bind(settings) {
        this._groups.forEach((group) => {
            group.bind(settings);
            this.add(group);
        });
    }
}

export default class WiggaPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const _settings = this.getSettings();

        const _appearancePage = new PrefPage('Appearance', 'org.gnome.Settings-appearance', [
            new PrefGroup('Cursor Size', 'The cursor keeps growing while you shake.', [
                [Field.SIZE, nSpin('Initial Cursor Size', 'Set how large the cursor gets at the start of a shake.', 24, 512, 1)],
            ]),
            new PrefGroup('Cursor Effect', 'Configure the appearance of the cursor effect.', [
                [Field.MAGN, nSpin('Magnify Duration', 'Configure the duration (ms) of the magnify animation.', 0, 10000, 1)],
                [Field.UMGN, nSpin('Unmagnify Duration', 'Configure the duration (ms) of the shrink animation.', 0, 10000, 1)],
                [Field.DLAY, nSpin('Unmagnify Delay', 'Configure the delay (ms) before the unmagnify animation is played.', 0, 10000, 1)],
            ]),
        ]);

        const _behaviorPage = new PrefPage('Behavior', 'org.gnome.Settings-mouse', [
            new PrefGroup('Trigger Parameters', 'Configure the parameters to trigger the animation.', [
                [Field.SAMP, nSpin('Sample Size', 'Configure the sample size of the cursor track.', 0, 1024, 1)],
                [Field.DIST, nSpin('Distance Threshold', 'Configure the distance threshold to trigger the animation.', 0, 1920, 1)],
                [Field.RADI, nSpin('Radians Threshold', 'Configure the angle threshold to trigger the animation.', 0, 512, 1)],
            ]),
            new PrefGroup('Timer Intervals', 'Configure the intervals of the timers.', [
                [Field.CHCK, nSpin('Check Interval', 'Configure the interval of checking if Wigga should trigger the animation.', 0, 1000, 1)],
                [Field.DRAW, nSpin('Draw/Sample Interval', 'Configure the interval of drawing the cursor and sampling the cursor track. You may need to adjust trigger parameters as well.', 0, 1000, 1)],
            ]),
        ]);

        _appearancePage.bind(_settings);
        _behaviorPage.bind(_settings);

        window.add(_appearancePage);
        window.add(_behaviorPage);
    }
}
