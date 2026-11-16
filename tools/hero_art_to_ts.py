# Converts sprites.json from import_hero_art.py into src/render/heroArt.ts.
import json
D=json.load(open('sprites.json'))
A='0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
out=["// Party sprites from Dennis's own generated character art (17 November 2026), cut out of the",
"// magenta background, shrunk to sprite size and reduced to 32 colours by tools/import_hero_art.py.",
"// Each row string uses '.' for transparent and one character per palette index.",
"export interface HeroArt { w: number; h: number; pal: string[]; rows: string[] }",
"export const HERO_ART: Record<string, HeroArt> = {"]
for k in ['c404','grib','hexa','brugg']:
    d=D[k]; rows=[''.join(A[d['idx'][y][x]] if d['keep'][y][x] else '.' for x in range(d['w'])) for y in range(d['h'])]
    out.append(f"  {k}: {{\n    w: {d['w']}, h: {d['h']},\n    pal: {json.dumps(d['pal'])},\n    rows: [\n"+''.join(f"      '{r}',\n" for r in rows)+"    ],\n  },")
out.append("};\n")
open('src/render/heroArt.ts','w').write('\n'.join(out))
