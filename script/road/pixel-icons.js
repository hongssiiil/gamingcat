// Small original bitmap-style glyphs. Rectangles stay on the pixel grid;
// platform emoji rendering cannot change the game's icon style.
const glyphs = {
    leaf: ['0000000000110000','0000000111110000','0000011111110000','0001111111110000','0011111101110000','0011111011100000','0011110111100000','0001101111000000','0001011110000000','0010111000000000','0100000000000000'],
    moon: ['0000011111000000','0001111100000000','0011111000000000','0111110000000000','0111110000000000','1111110000000000','1111110000000000','0111111000001000','0111111100011000','0011111111110000','0001111111100000','0000011110000000'],
    rain: ['0000001100000000','0000001100000000','0000011110000000','0000111111000000','0001111111100000','0011111111110000','0011111111110000','0011111111110000','0001111111100000','0000111111000000','0000011110000000'],
    star: ['0000001100000000','0000001100000000','0000011110000000','0111111111111000','0011111111110000','0001111111100000','0000111111000000','0001111111100000','0001110011100000','0011100001110000','0011000000110000'],
    paw: ['0001100110000000','0001100110000000','1100000000110000','1100000000110000','0000011000000000','0001111110000000','0011111111000000','0011111111000000','0001100110000000'],
};
const colors = {leaf:'#49633c',moon:'#6e614b',rain:'#557486',star:'#9b733b',paw:'#e0c799'};
export function pixelIcon(name, label = '') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 16 16');
    svg.setAttribute('shape-rendering','crispEdges');
    svg.setAttribute('class','road-pixel-icon');
    if(label){svg.setAttribute('role','img');svg.setAttribute('aria-label',label);}else svg.setAttribute('aria-hidden','true');
    for(const [y,row] of (glyphs[name] || glyphs.star).entries()) for(const [x,pixel] of [...row].entries()) if(pixel==='1') {
        const r=document.createElementNS(svg.namespaceURI,'rect');
        r.setAttribute('x',x);r.setAttribute('y',y+2);r.setAttribute('width',1);r.setAttribute('height',1);r.setAttribute('fill',colors[name]||colors.star);svg.append(r);
    }
    return svg;
}
