const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('game.js','utf8');
test('JS source parses',()=>assert.doesNotThrow(()=>new Function(source)));
test('both source hrefs enforce http(s) schemes',()=>{
  assert.equal((source.match(/href="\$\{escapeAttribute\(safeHttpURL\(source.url\)\)\}"/g)||[]).length,2);
  assert.equal((source.match(/href="\$\{escapeAttribute\(source.url\)\}"/g)||[]).length,0);
});
test('reject executable source URLs',()=>{
  const begin=source.indexOf('function safeHttpURL(value)');
  const end=source.indexOf('function escapeAttribute(value)',begin);
  const safe=new Function('window',source.slice(begin,end)+'return safeHttpURL;')({location:{href:'https://ryotamatsuki.github.io/ehime_quiz/'}});
  assert.equal(safe('javascript:alert(1)'),'');
  assert.equal(safe('data:text/html,xx'),'');
  assert.equal(safe('https://example.org/'),'https://example.org/');
});
