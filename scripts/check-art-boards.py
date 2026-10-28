"""Fail on comparison column overflow, mismatched IDs, era mixing or a legacy new-card source."""
import json
import hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
boards=root/'docs/art-unification/boards'
m=json.loads((boards/'board-manifest.json').read_text());c=json.loads((root/'docs/art-unification/coverage.json').read_text());tech={t['id']:t for t in c['technologies']}
count=0
for name,b in m.items():
    assert all(len(row)==len(b['headers']) for row in b['rows']),name
    data=(boards/(name+'.webp')).read_bytes();assert data[:4]==b'RIFF' and data[8:12]==b'WEBP',name
    assert hashlib.sha256((boards/(name+'.webp')).read_bytes()).hexdigest()==b['sha256'],name
    for row in b['rows']:
        for cell in filter(None,row):
            spec=tech[cell['id']] if cell['side']=='new' else None
            if spec: assert cell['path']==spec['path'] and cell['path'].endswith('.webp') and not spec.get('sheet'),cell
traditional=m['civilization-technology-pairs']['rows'];modern=m['modern-civilization-technologies']['rows']
assert len(traditional)==len(modern)==6
for row in traditional:
    assert [x['side'] for x in row]==['old','old','new','new']
    assert row[0]['id']==row[2]['id'] and row[1]['id']==row[3]['id']
    assert all(not x['id'].startswith('modern.') for x in row)
    assert [tech[x['id']]['age'] for x in row]==[2,3,2,3]
for row in modern:
    assert row[0]['id']==row[1]['id'] and row[0]['id'].startswith('modern.')
    assert [x['side'] for x in row]==['old','new']
all_ids=[]
for name,b in m.items():
    if name.startswith('technology-all-'):
        for row in b['rows']:
            for i in [0,2]:
                if row[i]:
                    assert row[i]['id']==row[i+1]['id']
                    assert [row[i]['side'],row[i+1]['side']]==['old','new']
                    all_ids.append(row[i]['id'])
    if name.startswith('technology-tiers-'):
        for row in b['rows']:
            for i in range(3):
                if row[i]:assert row[i]['id']==row[i+3]['id'] and row[i+3]['side']=='new'
assert len(all_ids)==82 and set(all_ids)==set(tech)
print('PASS: 6 traditional pairs, 6 modern exclusives, 82 ID pairs, all new columns use frontend WebP mappings; tier boards aligned.')
