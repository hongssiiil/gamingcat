import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTES } from './content.js';
import { freshState, restoreState } from './model.js';
import { nearbyForestTarget, discoverNote, FOREST_SIGN } from './forest.js';

test('notes start undiscovered and each hiding place is reachable from a trail',()=>{
    const state=freshState();
    assert.deepEqual(state.notes,[]);
    assert.equal(nearbyForestTarget(state.player),null);
    const approaches={leaf:{x:330,y:643},moon:{x:375,y:295},rain:{x:945,y:518},star:{x:340,y:560}};
    for(const note of NOTES)assert.equal(nearbyForestTarget(approaches[note.id]).id,note.id);
    assert.equal(nearbyForestTarget({x:550,y:483}),FOREST_SIGN);
    assert.equal(nearbyForestTarget({x:70,y:552}),null);
});
test('investigation reveals only that note, persists, and never duplicates discovery',()=>{
    const s=freshState();
    assert.equal(discoverNote(s,NOTES[0]),true);
    assert.equal(discoverNote(s,NOTES[0]),false);
    assert.equal(discoverNote(s,FOREST_SIGN),false);
    assert.deepEqual(s.notes,['leaf']);
    assert.deepEqual(s.events,[{type:'note',id:'leaf'}]);
    assert.deepEqual(restoreState(JSON.stringify(s)).notes,['leaf']);
});
