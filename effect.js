// Modified for Wigga, 2026-11-12. See AUTHORS.txt and LICENSE.txt.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Cursor from './cursor.js';

const CursorContent = GObject.registerClass({
    Implements: [Clutter.Content],
}, class CursorContent extends GObject.Object {
    set texture(texture) {
        this._texture = texture;
        this.invalidate();
    }

    vfunc_paint_content(actor, node) {
        if (!this._texture)
            return;

        const textureNode = new Clutter.TextureNode(
            this._texture, null, Clutter.ScalingFilter.LINEAR, Clutter.ScalingFilter.NEAREST);
        node.add_child(textureNode);
        textureNode.add_rectangle(actor.get_content_box());
    }
});

export default class Effect {
    constructor() {
        this.cursor = new Cursor();
        this._actor = new Clutter.Actor({reactive: false, visible: false});
        this._content = new CursorContent();
        this._actor.content = this._content;
        this._returning = false;
        this._delayId = 0;
        this._growthId = 0;
        Main.uiGroup.add_child(this._actor);
        this._spriteId = this.cursor.tracker.connect('cursor-changed', () => {
            if (this.isWiggling && !this._updateSprite())
                this._finish();
        });
    }

    get isWiggling() {
        return this._actor.visible;
    }

    _updateSprite() {
        const tracker = this.cursor.tracker;
        const texture = tracker.get_sprite();
        if (!texture)
            return false;

        const [hotX, hotY] = tracker.get_hot();
        const scale = tracker.get_scale?.() || 1;
        const width = texture.get_width();
        const height = texture.get_height();
        this._hotX = hotX * scale;
        this._hotY = hotY * scale;
        this._nativeSize = Math.max(width, height) * scale;
        this._content.texture = texture;
        this._actor.set_size(width * scale, height * scale);
        this._actor.set_pivot_point(hotX / width, hotY / height);
        this.move();
        return true;
    }

    move(x, y) {
        if (x === undefined)
            [x, y] = global.get_pointer();
        this._actor.set_position(x - this._hotX, y - this._hotY);
    }

    magnify() {
        if (this.isWiggling && !this._returning)
            return;

        if (!this.isWiggling) {
            if (!this._updateSprite() || !this.cursor.hide())
                return;
            this._actor.set_scale(1, 1);
            this._actor.get_parent().set_child_above_sibling(this._actor, null);
            this._actor.show();
        }
        this._cancelReturn();
        const initialScale = Math.max(1, this.cursorSize / this._nativeSize);
        if (this._actor.scale_x >= initialScale) {
            this._startGrowth();
        } else {
            this._actor.ease({
                duration: this.magnifyDuration,
                mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
                scale_x: initialScale,
                scale_y: initialScale,
                onComplete: () => this._startGrowth(),
            });
        }
    }

    _startGrowth() {
        const growthPixelsPerSecond = 120;
        let lastFrame = GLib.get_monotonic_time();
        this._growthId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 16, () => {
            const now = GLib.get_monotonic_time();
            const elapsedSeconds = (now - lastFrame) / 1_000_000;
            lastFrame = now;
            const scale = this._actor.scale_x +
                growthPixelsPerSecond * elapsedSeconds / this._nativeSize;
            this._actor.set_scale(scale, scale);
            return GLib.SOURCE_CONTINUE;
        });
    }

    _stopGrowth() {
        if (this._growthId) {
            GLib.Source.remove(this._growthId);
            this._growthId = 0;
        }
    }

    unmagnify() {
        if (!this.isWiggling || this._returning)
            return;

        this._returning = true;
        this._stopGrowth();
        this._actor.remove_all_transitions();
        this._delayId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.unmagnifyDelay, () => {
            this._delayId = 0;
            this._actor.ease({
                duration: this.unmagnifyDuration,
                mode: Clutter.AnimationMode.EASE_IN_OUT_CUBIC,
                scale_x: 1,
                scale_y: 1,
                onComplete: () => this._finish(),
            });
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelReturn() {
        this._stopGrowth();
        if (this._delayId) {
            GLib.Source.remove(this._delayId);
            this._delayId = 0;
        }
        this._returning = false;
        this._actor.remove_all_transitions();
    }

    _finish() {
        this._cancelReturn();
        this._actor.hide();
        this.cursor.show();
        this._content.texture = null;
    }

    destroy() {
        this.cursor.tracker.disconnect(this._spriteId);
        this._finish();
        this._actor.destroy();
    }
}
