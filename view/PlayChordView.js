// Written by Thomas Mainka - https://github.com/mainkats
// (c) 2015
// Licensed under LGPLv3 - http://www.gnu.org/licenses/lgpl-3.0.txt

// PlayChordsView extends PlayView for the bottom half of the surface
function PlayChordsView(model)
{
    PlayView.call(this, model);
    this.chordPlaying = [];
    this.chordMapping = [];
};
PlayChordsView.prototype = new PlayView();

// FIXME: this should be moved somewhere else, like updateChordMapping()
PlayChordsView.prototype.CHORDS = [
    [ 1, -3, -5 ],
    [ 1,  3, -5 ],
    [ 1,  3,  5 ],
    [ 1,  3,  5,  7 ]
];

// update chord mapping Matrix
PlayChordsView.prototype.updateChordMapping = function ()
{
    var mapping    = [];

    // FIXME: this should be moved as a function to framework/Scales.js
    // so we don't have access the scale data from there directly
    // maybe move it there, or create a custom Chord framework
    var scalenotes = Scales.INTERVALS[this.scales.selectedScale].notes;
    var scalelen   = scalenotes.length;
    var rootnote   = this.scales.startNote + this.scales.octave * 12 +
                      Scales.OFFSETS[this.scales.scaleOffset];

    // create a mapping for four rows, 8 columns of scale offsets
    for (var row = 0; row < 4; row++)
        if (row < this.CHORDS.length)
            for (var col = 0; col < 8; col++) {
                var notes = [];
                for (var n = 0; n < this.CHORDS[row].length; n++) {
                    var offset = col + Math.abs(this.CHORDS[row][n]) - 1;
                    var note = rootnote + scalenotes[offset % scalelen] +
                               Math.floor(offset / scalelen) * 12;
                    if (this.CHORDS[row][n] < 0)
                        note -= 12;
                    if (note > 0 && note < 127)
                        notes.push(note);
                }
                mapping.push(notes);
            }
        else
            mapping.push([]);

    return mapping;
};

// overwrite function to call our own delayedUpdateNoteMapping function
PlayChordsView.prototype.updateNoteMapping = function ()
{
    scheduleTask(doObject(this,
            PlayChordsView.prototype.delayedUpdateNoteMapping), null, 100);
};

// re-implement this so we don't call setKeyTranslationTable twice
PlayChordsView.prototype.delayedUpdateNoteMapping = function ()
{
    if (this.canSelectedTrackHoldNotes()) {
        // use the default note matrix ...
	this.noteMap = this.scales.getNoteMatrix();

        // ... but remove the top half of it
        for (var i = 68; i < 100; i++)
	    this.noteMap[i] = -1;

        // also generate a chord map
        this.chordMap = this.updateChordMapping();
    } else {
        // clear both the note and chord maps
	this.noteMap = this.scales.getEmptyMatrix();
        this.chordMap = [];
    }
    this.surface.setKeyTranslationTable(this.noteMap);
};

// custom drawGrid
PlayChordsView.prototype.drawGrid = function ()
{
    // don't display anything on non-note tracks
    if (!this.canSelectedTrackHoldNotes())
        return this.surface.pads.turnOff();

    var isRecording = this.model.hasRecordingState();

    // bottom half: normal playgrid
    for (var i = 36; i < 68; i++) {
        this.surface.pads.light(i, this.pressedKeys[i] > 0 ?
                    (isRecording ? PUSH_COLOR2_RED_HI : PUSH_COLOR2_GREEN_HI) :
                    this.scales.getColor(this.noteMap, i),
                null, false);
    }

    // top half: chord map
    for (var i = 68; i < 76; i++)
        this.surface.pads.light(i, PUSH_COLOR2_YELLOW_LO, null, false);
    for (var i = 76; i < 84; i++)
        this.surface.pads.light(i, PUSH_COLOR2_LIME_LO, null, false);
    for (var i = 84; i < 92; i++)
        this.surface.pads.light(i, PUSH_COLOR2_GREEN, null, false);
    for (var i = 92; i < 100; i++)
        this.surface.pads.light(i, PUSH_COLOR2_YELLOW, null, false);

    // colorize playing chords buttons
    for (var i = 0; i < this.chordPlaying.length; i++)
        this.surface.pads.light(this.chordPlaying[i]+68,
                (isRecording ? PUSH_COLOR2_RED_HI : PUSH_COLOR2_GREEN_HI),
                null, false);
};

// play a chord
PlayChordsView.prototype.playChord = function (key, velocity)
{
    // add chord to playing list
    this.chordPlaying.push(key);

    // process each chord note
    for (var i = 0; i < this.chordMap[key].length; i++) {
        // send note to DAW
        var note = this.chordMap[key][i];
        this.surface.sendMidiEvent(0x90, note, velocity);

        // mark played note like in PlayView
        for (var n = 0; n < 128; n++)
            if (this.noteMap[i] === note)
                this.pressedKeys[n] = velocity;
    }
};

// stop a chord
PlayChordsView.prototype.stopChord = function (key, velocity)
{
    // delete chord from playing list
    var i = this.chordPlaying.indexOf(key);
    if (i >= 0)
        this.chordPlaying.splice(i, 1);
    else
        return;

    // compile a list of chord notes still playing
    var notes = [];
    for (var i = 0; i < this.chordPlaying.length; i++)
        this.chordMap[this.chordPlaying[i]].forEach(
            function(v) {notes.push(v);}
        );

    // process each chord note
    for (var i = 0; i < this.chordMap[key].length; i++) {
        var note = this.chordMap[key][i];

        // only send stop note if no other chord plays this note
        if (notes.indexOf(note) < 0) {
            this.surface.sendMidiEvent(0x80, note, velocity);

            // clear played note like in PlayView
            for (var n = 0; n < 128; n++)
                if (this.noteMap[i] === note)
                    this.pressedKeys[n] = velocity;
        }
    }
};

// onGridNote handler
PlayChordsView.prototype.onGridNote = function (note, velocity)
{
    if (!this.canSelectedTrackHoldNotes())
        return;

    // if it has a note it must be the bottom half
    if (this.noteMap[note] !== -1) {
        for (var i = 0; i < 128; i++)
            if (this.noteMap[note] === this.noteMap[i])
                this.pressedKeys[i] = velocity;
        return;
    }

    // top half of the grid: notes 68 to 99
    if (note > 67 && note < 100) {
        var key = note - 68;
        if (key >= this.chordMap.length)
            return;
        if (velocity > 0)
            this.playChord(key, velocity);
        else
            this.stopChord(key, velocity);
    }
};
