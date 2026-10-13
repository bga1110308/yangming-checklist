"""每次上傳前跑一次：把所有檔案引用的版本號換成新的。
為什麼要這樣：GitHub Pages 會讓手機留住舊檔案約 10 分鐘，
檔名後面加 ?v=版本號，版本一換，手機就一定會抓新檔。
用法：python3 tools/bump.py
"""
import re, time, json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
ver = time.strftime('%Y%m%d%H%M%S')
pat = re.compile(r'(\.(?:js|css))\?v=\d+')

files = [root / 'index.html', *sorted((root / 'js').glob('*.js'))]
for f in files:
    s = f.read_text(encoding='utf-8')
    s2 = pat.sub(rf'\1?v={ver}', s)
    s2 = re.sub(r"const V='\d+'", f"const V='{ver}'", s2)
    if s2 != s:
        f.write_text(s2, encoding='utf-8')
(root / 'version.json').write_text(json.dumps({'v': ver}) + '\n', encoding='utf-8')
print('版本號', ver)
