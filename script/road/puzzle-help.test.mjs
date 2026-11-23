import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,sendRoadMessage} from './model.js';
import {puzzleHelpAnswer} from './puzzle-help.js';

test('each puzzle advances its own hints; other commands do not advance them',()=>{
    const state=freshState();
    const send=message=>sendRoadMessage(state,message,command=>puzzleHelpAnswer(state,command));
    for(const kind of ['pond','climb']){
        state.stage=kind;
        const first=send('/hint').answer;
        assert(first.startsWith(kind==='pond'?'발판에 규칙이 있어!':'앞선 퍼즐과 비슷해!'));
        assert(send('/plan').answer.startsWith(kind==='pond'?'시작 칸부터':'십의 자리는'));
        const second=send('/hint').answer;
        assert(second.startsWith(kind==='pond'?'방향과 숫자가 중요해!':'발판에 두 숫자는'));
        const third=send('/hint').answer;
        assert(third.startsWith(kind==='pond'?'순서대로 16개':'x축 y축'));
        const fourth=send('/hint').answer;
        assert.equal(send('/hint').answer,fourth);
        const tokens=state.tokens;
        assert.equal(send('/solve').answer,'정답 순서대로 발판을 밝혀줄게!');
        assert.equal(state.tokens,tokens-8);
    }
});
