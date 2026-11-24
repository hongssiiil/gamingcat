const hints={
    pond:[
        '발판에 규칙이 있어! 더 힌트가 필요하면 /hint를 쳐 줘',
        '방향과 숫자가 중요해! 더 힌트가 필요하면 /hint를 쳐 줘',
        '순서대로 16개를 다 눌러야 해! 더 힌트가 필요하면 /hint를 쳐 줘',
        '고양이는 어디로 움직일까?',
    ],
    climb:[
        '앞선 퍼즐과 비슷해! 더 힌트가 필요하면 /hint를 쳐 줘',
        '발판에 두 숫자는 서로 다른 것을 의미해! 더 힌트가 필요하면 /hint를 쳐 줘',
        'x축 y축이 생각나네! 더 힌트가 필요하면 /hint를 쳐 줘',
        '이번에는 끝이 구석에 있지 않을 수 있어!',
    ],
};
const plans={
    pond:'시작 칸부터 누르고 발자국 방향으로 발자국 개수만큼 떨어진 칸을 눌러봐! 16칸을 순서대로 밝혀야 해. 밝힌 칸이 2개 이하면 틀려도 그대로야. 3개 이상이면 직전 칸으로 한 칸만 돌아가.',
    climb:'십의 자리는 좌우 거리, 일의 자리는 상하 거리야. 12라면 좌우 1칸과 상하 2칸을 함께 이동한 칸이야. 0인 축은 움직이지 않아. 시작 칸부터 16칸을 중복 없이 모두 밝혀봐. 밝힌 칸이 2개 이하면 틀려도 그대로야. 3개 이상이면 직전 칸으로 한 칸만 돌아가.',
};
export function puzzleHelpAnswer(state,command){
    if(command==='hint'){
        const count=state.chat.filter(item=>item.stage===state.stage&&item.command==='hint').length;
        return hints[state.stage][Math.min(count,3)];
    }
    return command==='plan'?plans[state.stage]:'정답 순서대로 발판을 밝혀줄게!';
}
