import { POND, CLIMB } from './content.js';

const cells=Array.from({length:16},(_,i)=>i);
const delta=(a,b)=>[b%4-a%4,Math.floor(b/4)-Math.floor(a/4)];
function shuffled(values,random){
    const result=[...values];
    for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
    return result;
}
function hint(kind,from,to){
    const [dx,dy]=delta(from,to);
    return kind==='pond'?[dx>0?'→':dx<0?'←':dy>0?'↓':'↑',Math.abs(dx||dy)]:Math.abs(dx)*10+Math.abs(dy);
}
function climbTargets(from,code){
    return cells.filter(to=>to!==from&&hint('climb',from,to)===code);
}
export function hasUniqueClimbMoves(board){
    return Array.isArray(board?.tiles)&&board.tiles.length===16&&
        board.tiles.filter(code=>code===11).length<=2&&
        board.tiles.every((code,from)=>climbTargets(from,code).length===1);
}
export function hasLimitedPondSteps(board){
    return Array.isArray(board?.tiles)&&board.tiles.length===16&&
        board.tiles.filter(tile=>tile?.[1]===1).length<=2;
}
export function generatePuzzle(kind,random=Math.random){
    if(!['pond','climb'].includes(kind))throw new Error('Unknown puzzle kind');
    const neighbors=cells.map(from=>cells.filter(to=>{
        if(from===to)return false;
        const [dx,dy]=delta(from,to);
        // Count every in-bounds destination, even previously visited cells.
        // The printed distances alone must identify the next tile.
        return kind==='climb'?climbTargets(from,hint(kind,from,to)).length===1:dx===0||dy===0;
    }));
    const solution=[0],used=new Set(solution);
    function search(from,ones=0){
        if(solution.length===16)return kind==='climb'||from===15;
        const candidates=shuffled(neighbors[from],random).filter(to=>!used.has(to)&&(kind!=='pond'||to!==15||solution.length===15));
        // Keep the shuffled order so the distance limits do not favor one layout.
        for(const next of candidates){
            const clue=hint(kind,from,next);
            const added=(kind==='pond'?clue[1]===1:clue===11)?1:0;
            if(ones+added>2)continue;
            used.add(next);solution.push(next);
            if(search(next,ones+added))return true;
            solution.pop();used.delete(next);
        }
        return false;
    }
    if(!search(0))throw new Error('No complete puzzle path');
    const tiles=Array(16);
    for(let i=0;i<15;i++)tiles[solution[i]]=hint(kind,solution[i],solution[i+1]);
    const last=solution[15];
    tiles[last]=kind==='pond'?['☆',0]:hint(kind,last,shuffled(neighbors[last].filter(to=>hint(kind,last,to)!==11),random)[0]);
    return {tiles,solution};
}
export function validPuzzle(kind,board){
    const path=board?.solution,tiles=board?.tiles;
    if(!Array.isArray(path)||path.length!==16||path[0]!==0||new Set(path).size!==16||path.some(i=>!Number.isInteger(i)||i<0||i>15))return false;
    if(!Array.isArray(tiles)||tiles.length!==16)return false;
    if(kind==='pond'&&(path[15]!==15||JSON.stringify(tiles[15])!==JSON.stringify(['☆',0])))return false;
    if(kind==='climb'&&tiles.some(n=>!Number.isInteger(n)||n<=0||n>33||n%10>3))return false;
    return path.slice(0,15).every((from,i)=>{
        const to=path[i+1],[dx,dy]=delta(from,to);
        return (kind==='climb'||dx===0||dy===0)&&JSON.stringify(tiles[from])===JSON.stringify(hint(kind,from,to));
    });
}
// Saves from the fixed-board version can finish their existing attempt.
export const puzzleTiles=(state,kind)=>state?.puzzleBoards?.[kind]?.tiles??(kind==='pond'?POND:CLIMB);
export function resetPuzzleProgress(state,kind){
    state[kind==='pond'?'pondTrail':'climbTrail']=[];state.puzzle[kind]=0;
}
export function startPuzzle(state,kind,random=Math.random){
    state.puzzleBoards??={};state.puzzleBoards[kind]=generatePuzzle(kind,random);
    resetPuzzleProgress(state,kind);
}
