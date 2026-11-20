// Collision coordinates traced against images/backgrounds/road_white.png (1023 × 769).
export const FOREST_SIZE = { width: 1023, height: 769 };
export const ground = [
    [398,0],[430,0],[450,85],[465,105],[465,235],[560,300],[610,302],
    [660,302],[705,302],[715,345],[775,345],[805,405],[865,400],
    [885,350],[900,300],[980,300],[1000,400],[1023,405],[1023,548],
    [985,558],[930,594],[860,606],[810,625],[770,645],[745,685],
    [685,710],[635,750],[620,769],[425,769],[425,718],[410,705],
    [300,705],[285,685],[255,695],[245,650],[190,645],[130,635],
    [115,595],[0,595],[0,398],[85,397],[150,403],[205,398],
    [205,355],[260,357],[300,335],[300,300],[350,245],[355,105],[380,85]
];
export const forestIslands = [
    [[246,438],[280,430],[315,448],[328,472],[318,510],[301,533],
     [299,565],[271,590],[230,588],[211,564],[187,551],[181,526],
     [192,502],[218,488],[236,488],[238,460]],
    [[606,545],[638,533],[670,545],[699,535],[729,553],[742,581],
     [733,610],[703,630],[663,640],[628,625],[606,616],[590,589],[590,563]],
    [[849,396],[878,381],[916,388],[935,413],[936,446],[925,465],
     [896,484],[866,475],[842,456],[836,425]]
];
// Ground contact only: foliage, rock tops and trunk height do not enlarge these boxes.
export const props = [
    {kind:'rock', box:[9,437,36,16]}, {kind:'rock', box:[55,488,42,18]},
    {kind:'rock', box:[153,445,43,16]}, {kind:'rock', box:[209,383,40,16]},
    {kind:'rock', box:[53,385,44,15]}, {kind:'rock', box:[209,339,37,16]},
    {kind:'rock', box:[298,280,50,23]}, {kind:'rock', box:[464,338,40,15]},
    {kind:'rock', box:[462,443,42,16]}, {kind:'stump',box:[414,442,37,14]},
    {kind:'rock', box:[363,537,91,27]}, {kind:'rock', box:[360,592,43,14]},
    {kind:'rock', box:[256,646,33,16]}, {kind:'rock', box:[613,281,47,20]},
    {kind:'rock', box:[719,337,47,20]}, {kind:'rock', box:[773,380,48,23]},
    {kind:'rock', box:[926,338,40,17]}, {kind:'rock', box:[931,441,42,18]},
    {kind:'rock', box:[707,681,43,19]}, {kind:'rock', box:[567,747,40,18]},
    {kind:'stump',box:[514,677,39,28]},
    {kind:'tree', box:[102,481,40,24]}, {kind:'tree', box:[262,339,30,22]},
    {kind:'tree', box:[565,381,38,24]}, {kind:'tree', box:[680,340,22,20]},
    {kind:'tree', box:[822,375,31,24]}, {kind:'tree', box:[981,380,36,25]},
    {kind:'tree', box:[214,669,30,24]}, {kind:'tree', box:[270,634,26,23]},
    {kind:'tree', box:[632,669,30,24]}, {kind:'tree', box:[684,684,27,21]},
    {kind:'tree', box:[867,565,27,22]}, {kind:'tree', box:[905,542,25,22]},
    {kind:'sign', box:[543,470,14,13]}
];
export function pointInPolygon(x,y,polygon){
    let inside=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
        const [xi,yi]=polygon[i],[xj,yj]=polygon[j];
        if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
    }
    return inside;
}
export function isGround(x,y){
    return pointInPolygon(x,y,ground)&&!forestIslands.some(p=>pointInPolygon(x,y,p))
        &&!props.some(({box:[left,top,width,height]})=>x>=left&&x<=left+width&&y>=top&&y<=top+height);
}
// A small footprint at the sprite's feet, independent of its tall visible image.
const footSamples=[[0,0],[-7,0],[7,0],[0,-4],[0,4],[-5,-3],[5,-3],[-5,3],[5,3]];
export function canWalk(x,y){return footSamples.every(([dx,dy])=>isGround(x+dx,y+dy));}
export function nearestWalkable(position){
    if(canWalk(position.x,position.y))return position;
    // Preserve the journey when an older saved position overlaps a newly corrected obstacle.
    for(let r=4;r<1300;r+=4){
        for(let i=0;i<32;i++){
            const angle=i*Math.PI/16,x=position.x+Math.cos(angle)*r,y=position.y+Math.sin(angle)*r;
            if(canWalk(x,y))return {x,y};
        }
    }
    return {x:340,y:483};
}

