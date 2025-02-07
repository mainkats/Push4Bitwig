// Written by Jürgen Moßgraber - mossgrabers.de
//            Michael Schmalle - teotigraphix.com
// (c) 2014-2015
// Licensed under LGPLv3 - http://www.gnu.org/licenses/lgpl-3.0.txt

function SessionView (model)
{
    AbstractSessionView.call (this, model, 8, 8);
}
SessionView.prototype = new AbstractSessionView ();

SessionView.prototype.onActivate = function ()
{
    AbstractSessionView.prototype.onActivate.call (this);
    this.surface.setButton (PUSH_BUTTON_NOTE, PUSH_BUTTON_STATE_ON);
    this.surface.setButton (PUSH_BUTTON_SESSION, PUSH_BUTTON_STATE_HI);

    this.updateRibbonMode ();
};

SessionView.prototype.onPitchbend = function (data1, data2)
{
    if (this.surface.isShiftPressed ())
        data2 = 63;
    this.model.getTransport ().setCrossfade (data2);
    this.surface.output.sendPitchbend (0, data2);
};

SessionView.prototype.updateRibbonMode = function ()
{
    this.surface.setRibbonMode (PUSH_RIBBON_PAN);
    this.surface.output.sendPitchbend (0, this.model.getTransport ().getCrossfade ());
};

SessionView.prototype.drawSceneButtons = function ()
{
    var tb = this.model.getCurrentTrackBank ();
    var color = PUSH_COLOR_BLACK;
    for (var i = 0; i < 8; i++)
    {
        if (this.flip)
        {
            var track = tb.getTrack (i);
            if (tb.isMuteState ())
                color = track.mute ? PUSH_COLOR_BLACK : PUSH_COLOR_SCENE_YELLOW_HI;
            else
                color = track.solo ? PUSH_COLOR_SCENE_RED : PUSH_COLOR_BLACK;
            this.surface.setButton (PUSH_BUTTON_SCENE1 + (7 - i), track.exists ? color : PUSH_COLOR_BLACK);
        }
        else
            this.surface.setButton (PUSH_BUTTON_SCENE1 + i, PUSH_COLOR_SCENE_GREEN);
    }
};

SessionView.prototype.updateDevice = function ()
{
    var m = this.surface.getActiveMode ();
    if (m != null)
    {
        m.updateDisplay ();
        m.updateFirstRow ();
    }

    if (this.flip && !m.hasSecondRowPriority)
    {
        for (var i = 0; i < 8; i++)
            this.surface.setButton (102 + i, PUSH_COLOR2_GREEN);
    }
    else
        m.updateSecondRow ();

    this.updateButtons ();
    this.updateArrows ();
};

SessionView.prototype.usesButton = function (buttonID)
{
    switch (buttonID)
    {
        case PUSH_BUTTON_OCTAVE_DOWN:
        case PUSH_BUTTON_OCTAVE_UP:
        case PUSH_BUTTON_REPEAT:
        case PUSH_BUTTON_ACCENT:
            return false;
    }
    return true;
};

SessionView.prototype.onAccent = function (event)
{
    // No accent button usage in the Session view
};

SessionView.prototype.onSession = function (event)
{
    if (event.isLong ())
        this.isTemporary = true;
    else if (event.isUp ())
    {
        if (this.isTemporary)
        {
            this.isTemporary = false;
            var tb = this.model.getTrackBank ();
            var viewId = tb.getPreferredView (tb.getSelectedTrack ().index);
            if (viewId != null)
                this.surface.setActiveView (viewId);
        }
    }
    else if (event.isDown ())
    {
        this.flip = !this.flip;
        var dUp   = this.canScrollUp;
        var dDown = this.canScrollDown;
        this.canScrollUp = this.canScrollLeft;
        this.canScrollDown = this.canScrollRight;
        this.canScrollLeft = dUp;
        this.canScrollRight = dDown;
        this.drawSceneButtons ();
    }
};

SessionView.prototype.onScene = function (scene)
{
    this.sceneOrSecondRowButtonPressed (scene, !this.flip);
};

SessionView.prototype.onSecondRow = function (index)
{
    if (this.surface.getActiveMode ().hasSecondRowPriority)
        AbstractView.prototype.onSecondRow.call (this, index);
    else
        this.sceneOrSecondRowButtonPressed (index, this.flip);
};

SessionView.prototype.sceneOrSecondRowButtonPressed = function (index, isScene)
{
    if (isScene)
        this.model.getCurrentTrackBank ().launchScene (index);
    else
    {
        if (this.surface.isPressed (PUSH_BUTTON_STOP))
            this.model.getCurrentTrackBank ().stop (index);
        else if (this.surface.isShiftPressed ())
            this.model.getCurrentTrackBank ().returnToArrangement (index);
        else
        {
            if (this.flip)
            {
                // Only execute Solo or Mute
                this.surface.getMode (MODE_TRACK).onSecondRow (index);
            }
            else
                AbstractView.prototype.onSecondRow.call (this, index);
            
            this.drawSceneButtons ();
        }
    }
};
