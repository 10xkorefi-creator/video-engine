import { workflow, node, trigger, sticky, newCredential, expr, ifElse } from '@n8n/workflow-sdk';

const dailySchedule = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Daily 9:00 IST',
    parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 9 * * *' }] } },
    position: [0, 0]
  },
  output: [{}]
});

const getUsedBlogs = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Get Used Blogs',
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'getAll',
      tableId: 'reel_jobs',
      returnAll: true,
      filterType: 'none'
    },
    credentials: { supabaseApi: { id: 'XcUFSpQMu9SiDlfJ', name: 'Supabase account korefi' } },
    position: [220, 0]
  },
  output: [{ blog_url: 'https://www.aiaccountant.com/blog/2a-vs-2b-gst-itc', angle: 'A', status: 'ready' }]
});

const pickNextBlog = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick Next Blog',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: "// Ranked by GA4 landing-page sessions (last 90 days, ga_daily). Edit freely: top = next.\nconst BLOGS = [\n  'https://www.aiaccountant.com/blog/all-tally-prime-shortcut-keys-list',\n  'https://www.aiaccountant.com/blog/how-to-download-gst-registration-certificate',\n  'https://www.aiaccountant.com/blog/best-accounting-software-for-small-businesses-in-india',\n  'https://www.aiaccountant.com/blog/hsn-code-list',\n  'https://www.aiaccountant.com/blog/vat-gst-registration-number',\n  'https://www.aiaccountant.com/blog/tally-integration-with-ai-accountant',\n  'https://www.aiaccountant.com/blog/ptec-and-ptrc-registration',\n  'https://www.aiaccountant.com/blog/tds-filing-due-date',\n  'https://www.aiaccountant.com/blog/purchase-bill-entry-in-tally',\n  'https://www.aiaccountant.com/blog/financial-records-management-india',\n  'https://www.aiaccountant.com/blog/reverse-charge-mechanism-accounting-india',\n  'https://www.aiaccountant.com/blog/gstr-2b-reconciliation-tools-guide',\n  'https://www.aiaccountant.com/blog/tcs-on-sale-of-goods',\n  'https://www.aiaccountant.com/blog/delivery-challan-format',\n  'https://www.aiaccountant.com/blog/ai-audit-tools-india-guide',\n  'https://www.aiaccountant.com/blog/payroll-in-tally-prime-setup',\n  'https://www.aiaccountant.com/blog/virtual-accounting-cost-india-pricing',\n  'https://www.aiaccountant.com/blog/ultimate-guide-tally-prime-automation',\n  'https://www.aiaccountant.com/blog/tally-api-integration-guide',\n  'https://www.aiaccountant.com/blog/manufacturing-accounting-software',\n  'https://www.aiaccountant.com/blog/best-virtual-accounting-services-india',\n  'https://www.aiaccountant.com/blog/2a-vs-2b-gst-itc',\n];\nconst used = new Set($input.all().map(i => i.json.blog_url).filter(Boolean));\nconst next = BLOGS.find(u => !used.has(u));\nif (!next) return [{ json: { blog_url: null, exhausted: true } }];\nreturn [{ json: { blog_url: next, exhausted: false, remaining: BLOGS.filter(u => !used.has(u)).length - 1 } }];"
    },
    position: [440, 0]
  },
  output: [{ blog_url: 'https://www.aiaccountant.com/blog/tds-filing-due-date', exhausted: false, remaining: 20 }]
});


const makeReelA = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Make Reel A',
    executeOnce: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 5000,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'http://reel-engine:8080/reels',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ blog_url: $("Pick Next Blog").first().json.blog_url, angle: "A" }) }}'),
      options: { timeout: 1500000 }
    },
    credentials: { httpBearerAuth: newCredential('Reel Engine Token') },
    position: [880, 0]
  },
  output: [{ ok: true, angle: 'A', title: 'Title', script: 'Script', caption: 'Caption #GST', video_url: 'https://example.supabase.co/x.mp4', duration_s: 52.1, cost_usd: { total: 0.06 }, render_seconds: 160 }]
});
const makeReelB = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Make Reel B',
    executeOnce: true,
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 5000,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'http://reel-engine:8080/reels',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBearerAuth',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ blog_url: $("Pick Next Blog").first().json.blog_url, angle: "B" }) }}'),
      options: { timeout: 1500000 }
    },
    credentials: { httpBearerAuth: newCredential('Reel Engine Token') },
    position: [1100, 0]
  },
  output: [{ ok: true, angle: 'B', title: 'Title', script: 'Script', caption: 'Caption #GST', video_url: 'https://example.supabase.co/x.mp4', duration_s: 52.1, cost_usd: { total: 0.06 }, render_seconds: 160 }]
});

const buildTeamsMessage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Teams Message',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: "const REVIEW_URL = 'https://n8n.aiaccountant.com/webhook/reel-review';\nconst TOKEN = 'loPdiAeyMCRJdbzPf31jkDLz';\nconst blog = $('Pick Next Blog').first().json.blog_url;\nconst esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\nconst parse = (name, angle) => {\n  let r = $(name).first().json || {};\n  if (r.error && !r.ok) {\n    const msg = typeof r.error === 'string' ? r.error : (r.error.message || JSON.stringify(r.error));\n    const m = msg.match(/\\{[\\s\\S]*\\}/);\n    let body = {}; try { body = m ? JSON.parse(m[0]) : {}; } catch (e) {}\n    r = { ok: false, angle, failed_step: body.failed_step || r.failed_step || 'http_call', error: body.error || msg };\n  }\n  return { ...r, angle };\n};\nconst reels = [parse('Make Reel A', 'A'), parse('Make Reel B', 'B')];\nconst link = (a, d) => REVIEW_URL + '?blog=' + encodeURIComponent(blog) + '&angle=' + a + '&decision=' + d + '&token=' + TOKEN;\nconst parts = ['<h2>\ud83c\udfac Daily reels for review</h2>', '<p>Blog: <a href=\"' + blog + '\">' + esc(blog) + '</a></p>'];\nfor (const r of reels) {\n  if (r.ok) {\n    parts.push('<hr><h3>Reel ' + r.angle + ': ' + esc(r.title) + '</h3>',\n      '<p>\u25b6\ufe0f <a href=\"' + r.video_url + '\">Watch MP4</a> \u00b7 ' + r.duration_s + 's \u00b7 $' + (r.cost_usd?.total ?? '?') + ' \u00b7 render ' + r.render_seconds + 's</p>',\n      '<p><b>Script:</b> ' + esc(r.script) + '</p>',\n      '<p><b>Caption:</b><br>' + esc(r.caption).replace(/\\n/g, '<br>') + '</p>',\n      '<p>\u2705 <a href=\"' + link(r.angle, 'approved') + '\">Approve</a> &nbsp; \u274c <a href=\"' + link(r.angle, 'rejected') + '\">Reject</a></p>');\n  } else {\n    parts.push('<hr><h3>\u26a0\ufe0f Reel ' + r.angle + ' FAILED at step: ' + esc(r.failed_step) + '</h3>', '<p>' + esc(String(r.error).slice(0, 600)) + '</p>');\n  }\n}\nreturn [{ json: { html: parts.join('\\n'), ok_count: reels.filter(r => r.ok).length } }];"
    },
    position: [1320, 0]
  },
  output: [{ html: '<h2>Daily reels</h2>', ok_count: 2 }]
});

const sendToTeams = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Send to Teams',
    parameters: {
      method: 'POST',
      url: 'https://graph.microsoft.com/v1.0/chats/REPLACE_WITH_TEAMS_CHAT_ID/messages',
      authentication: 'genericCredentialType',
      genericAuthType: 'oAuth2Api',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ body: { contentType: "html", content: $json.html } }) }}'),
      options: {}
    },
    credentials: { oAuth2Api: newCredential('Microsoft Teams Graph') },
    position: [1540, 0]
  },
  output: [{ id: '1700000000000' }]
});

const listAllDone = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Blog List Exhausted Message',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: "return [{ json: { html: '<h3>⚠️ Reel engine: every blog in the Pick Next Blog list has been used. Add more URLs to the list.</h3>' } }];"
    },
    position: [880, 220]
  },
  output: [{ html: '<h3>list exhausted</h3>' }]
});

const hasBlog = ifElse({
  version: 2.2,
  config: {
    name: 'Blog Available?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.exhausted }}'), operator: { type: 'boolean', operation: 'false', singleValue: true } }],
        combinator: 'and'
      }
    },
    position: [660, 0]
  },
  output: [{ blog_url: 'https://www.aiaccountant.com/blog/tds-filing-due-date', exhausted: false }]
});

const reviewWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Reel Review Link',
    parameters: { httpMethod: 'GET', path: 'reel-review', responseMode: 'responseNode' },
    position: [0, 480]
  },
  output: [{ query: { blog: 'https://www.aiaccountant.com/blog/tds-filing-due-date', angle: 'A', decision: 'approved', token: 'x' } }]
});

const checkReview = ifElse({
  version: 2.2,
  config: {
    name: 'Valid Review?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [
          { leftValue: expr('{{ $json.query.token }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'loPdiAeyMCRJdbzPf31jkDLz' },
          { leftValue: expr('{{ ["approved", "rejected"].includes($json.query.decision) }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }
        ],
        combinator: 'and'
      }
    },
    position: [220, 480]
  },
  output: [{ query: { blog: 'https://www.aiaccountant.com/blog/tds-filing-due-date', angle: 'A', decision: 'approved' } }]
});

const updateStatus = node({
  type: 'n8n-nodes-base.supabase',
  version: 1,
  config: {
    name: 'Update Reel Status',
    parameters: {
      resource: 'row',
      operation: 'update',
      tableId: 'reel_jobs',
      filterType: 'manual',
      matchType: 'allFilters',
      filters: {
        conditions: [
          { keyName: 'blog_url', condition: 'eq', keyValue: expr('{{ $json.query.blog }}') },
          { keyName: 'angle', condition: 'eq', keyValue: expr('{{ $json.query.angle }}') }
        ]
      },
      dataToSend: 'defineBelow',
      fieldsUi: {
        fieldValues: [
          { fieldId: 'status', fieldValue: expr('{{ $json.query.decision }}') },
          { fieldId: 'updated_at', fieldValue: expr('{{ $now.toISO() }}') }
        ]
      }
    },
    credentials: { supabaseApi: { id: 'XcUFSpQMu9SiDlfJ', name: 'Supabase account korefi' } },
    position: [440, 400]
  },
  output: [{ status: 'approved' }]
});

const respondDone = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Show Confirmation',
    parameters: {
      respondWith: 'text',
      responseBody: expr('<html><body style="font-family:sans-serif;padding:40px"><h2>Reel {{ $("Reel Review Link").first().json.query.angle }} marked {{ $("Reel Review Link").first().json.query.decision }} ✔</h2><p>{{ $("Reel Review Link").first().json.query.blog }}</p></body></html>'),
      options: { responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }] } }
    },
    position: [660, 400]
  },
  output: [{}]
});

const respondBad = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Reject Bad Link',
    parameters: { respondWith: 'text', responseBody: 'Invalid or expired review link.', options: { responseCode: 403 } },
    position: [440, 580]
  },
  output: [{}]
});

const notes = sticky(
  "## Blog \u2192 Reels (daily)\n1. **Pick Next Blog**: edit the ranked list; first URL not yet in `reel_jobs` wins.\n2. **Make Reel A/B** call the reel-engine container (`http://reel-engine:8080`, same Docker network as n8n). 25-min timeout, retried once; failures still reach Teams with the failing step.\n3. **Send to Teams**: set the chat ID in the URL and pick your Microsoft Graph OAuth2 credential.\n4. Approve/Reject links hit **Reel Review Link**, which updates `reel_jobs.status`.",
  [dailySchedule, getUsedBlogs, pickNextBlog, makeReelA, makeReelB, buildTeamsMessage, sendToTeams],
  { color: 4 }
);

export default workflow('reel-engine-daily', 'Blog → Shorts Reels (daily)')
  .add(dailySchedule)
  .to(getUsedBlogs)
  .to(pickNextBlog)
  .to(hasBlog
    .onTrue(makeReelA.to(makeReelB.to(buildTeamsMessage.to(sendToTeams))))
    .onFalse(listAllDone.to(sendToTeams)))
  .add(reviewWebhook)
  .to(checkReview
    .onTrue(updateStatus.to(respondDone))
    .onFalse(respondBad))
  .add(notes);
