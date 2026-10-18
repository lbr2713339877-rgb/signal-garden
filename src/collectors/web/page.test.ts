import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWebsite, publicWebsiteUrl } from './page';

test('website evidence uses readable text, official image and actual trial links', () => {
  const p = parseWebsite(`<title>Test editor</title><meta content="Turn raw video into clips" name="description"><meta property='og:image' content='/screen.png'>
    <script>const invented = 'This app is perfectly safe';</script><h1>AI video editing</h1><a href="https://app.example.com/try">Try the editor</a>`, 'https://example.com/');
  assert.equal(p.description, 'Turn raw video into clips');
  assert.equal(p.image, 'https://example.com/screen.png');
  assert.equal(p.links[0].url, 'https://app.example.com/try');
  assert.equal(p.text.includes('perfectly safe'), false);
});
test('discovery URLs cannot target local machines or non-HTTPS services', () => {
  for (const u of ['http://example.com', 'https://localhost/', 'https://127.0.0.1/', 'https://[::1]/', 'https://host.internal/', 'https://user:pass@example.com/', 'https://example.com:8080/']) assert.equal(publicWebsiteUrl(u), null, u);
  assert.ok(publicWebsiteUrl('https://example.com/'));
});
