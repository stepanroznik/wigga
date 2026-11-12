// Modified for Wigga, 2026-11-12. See AUTHORS.txt and LICENSE.txt.
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

export default class Cursor {
    constructor() {
        this.tracker = global.backend.get_cursor_tracker?.() ??
            Meta.CursorTracker.get_for_display(global.display);
        this._hidden = false;
        this._seat = Clutter.get_default_backend().get_default_seat();
    }

    hide() {
        if (!this.tracker.get_pointer_visible())
            return false;

        if (this.tracker.inhibit_cursor_visibility) {
            this.tracker.inhibit_cursor_visibility();
        } else {
            this._seat.inhibit_unfocus();
            this._visibilityId = this.tracker.connect('visibility-changed', () => {
                if (this.tracker.get_pointer_visible())
                    this.tracker.set_pointer_visible(false);
            });
            this.tracker.set_pointer_visible(false);
        }
        this._hidden = true;
        return true;
    }

    show() {
        if (!this._hidden)
            return;

        if (this._visibilityId) {
            this.tracker.disconnect(this._visibilityId);
            this._visibilityId = 0;
            this._seat.uninhibit_unfocus();
            this.tracker.set_pointer_visible(true);
        } else {
            this.tracker.uninhibit_cursor_visibility();
        }
        this._hidden = false;
    }
}
