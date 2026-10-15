# AI Accountant (AiA): Context for the Video Engine

ENGINE OVERRIDES (from the AiA team, 15 Oct 2026; these win over anything below):
- PRIMARY GOAL of every reel: fun, engaging storytelling that explains a mundane accounting/bookkeeping topic. AiA is mentioned ONLY when it directly solves the story's problem; never forced.
- Competitors MAY be named factually (section 6 facts only), with a clear but fair bias toward AiA, shown through concrete differences, never mockery, never "best"/"number one" superlatives, never salesy.
- Illustrative hypotheticals with round made-up amounts are allowed when clearly framed ("मान लो ..."); real figures, rates, rules and proof points must come from the blog, research notes or this file, exactly as written.

Use this file as fixed context for the script-writing LLM. Facts in a reel must come from the source blog or from this file. If a fact is in neither, leave it out.

## Summary

| Area | Rule for scripts |
|---|---|
| What AiA is | An AI automation layer on top of TallyPrime. Not accounting software, not a Tally replacement |
| Who the reel speaks to | Founders and owners of Indian SMBs (Rs 1 cr to Rs 100 cr turnover) whose in-house team runs Tally |
| Who it does not speak to | CA firms, accountants as a profession, businesses that fully outsource daily entry |
| Core promise | Removes manual data entry and reconciliation work in Tally so the team closes books faster |
| Tone | Calm, confident expert. Dramatic hook is fine, hype and superlatives are not |
| Competitors | (Overridden above: may be named factually.) Default contrast: "manual entry", "Excel", "typing bills into Tally" |
| CTA | Point to the blog on aiaccountant.com, or an approved line (see CTA section) |

## 1. Product in one line

AI Accountant reads bank statements and vendor bills, maps every line to the right Tally ledger, matches payments to open bills, and pushes verified entries into TallyPrime. The team reviews and approves; Tally stays the system of record.

Positioning: an AI-powered partner, a "digital colleague" for finance teams. It complements Tally rather than replacing it, automating the tedious work that comes before posting.

## 2. Who it is for

Fit (speak to these people):
- SMB founders, owners, MDs whose in-house accountant or small finance team enters data into Tally
- Businesses with high voucher volume: hundreds or thousands of bills and bank lines a month
- Examples of segments where it is being used: distributors (pharma, FMCG), wholesale traders, manufacturers, hotels and restaurants. Do not claim AiA fits a whole industry; frame around the problem, not the sector

Not a fit (do not target in scripts):
- CA firms and practising accountants
- Businesses with no in-house team who outsource all daily entry. These are a fit for AiA's Virtual Accounting service, not the tool
- Businesses on Tally versions below TallyPrime 6.0

Problems and triggers that make good reel topics:
- Handwritten or messy vendor bills (mandi bills, faded receipts, phone photos)
- Accountant resigns, and books fall behind; repeated hiring and retraining
- Backlog and filing delays when the accountant is on leave
- GSTR-2B reconciliation done line by line in Excel every month
- Thousands of bank statement lines typed into Tally by hand
- Founder cannot get real-time numbers (cash, who owes me, what I owe) without asking the CA
- Duplicate bills slipping into the books

## 3. Product modules and features (safe to describe)

| Module | What it does, in plain words |
|---|---|
| Bills / Accounts Payable | Reads vendor bills from PDF, scans, photos, and handwritten bills. Extracts vendor, GSTIN, HSN, line items, amounts, due date. Maps to vendors and ledgers. Flags possible duplicates. Approved bills post to Tally as purchase vouchers |
| Bill-level adjustments | Maps discounts, freight, insurance, loading charges, round-off and TCS to the right Tally ledgers, set once and applied consistently |
| Bill allocation | Links payments and receipts to specific bills (bill-by-bill tracking in Tally) |
| Transactions / Banking | Upload a bank or credit card statement. AI extracts and categorises every transaction, matches payments and receipts to open bills and invoices pulled from Tally, team reviews, then syncs to Tally. 50+ Indian banks supported |
| GST | Matches the purchase register against GSTR-2B to catch mismatches and protect input tax credit |
| AR / Invoices | Sales entries via Excel upload today. Sales invoice PDF/image upload is planned for early November 2026; do not claim it before launch |
| Dashboards | AP and AR outstanding, ageing, DPO, DSO, vendor spend concentration. Every number drills down to the underlying bill or invoice |
| Journal vouchers | Fetch and edit JVs from Tally with cost centres, bill-by-bill tracking and narration |
| WhatsApp for AI Accountant | Owners ask business questions on WhatsApp (cash and bank balance, who owes me, payables, sales). Forward a bill photo and it lands in AiA for review. Proactive nudges about pending entries. The WhatsApp bot is free, not metered. One WhatsApp user per company in the current release |
| Guided onboarding | In-product guided tours on demo data for purchase bills and bank reconciliation |

How it works (for "how it works" scenes):
1. Connect Tally and sync masters, ledgers, open bills and invoices
2. Upload bills or statements (or forward bills on WhatsApp)
3. AI reads, categorises and matches
4. Team reviews and approves
5. Entries post to TallyPrime

Key message: nothing posts to Tally without human review. Automation proposes, the team approves, Tally records.

## 4. Proof points (approved for use)

| Claim | Source |
|---|---|
| Automates up to 75% of bookkeeping work | aiaccountant.com home page |
| 300M+ (30 crore+) transactions analysed | aiaccountant.com home page, brand guide |
| 95% accuracy on handwritten bills, faded receipts and blurry photos | aiaccountant.com (bills OCR only; do not apply to bank statements) |
| ISO certified, SOC 2 Type II certified | aiaccountant.com home page |
| 50+ banks supported (HDFC, ICICI, SBI, Axis, Kotak, and more) | Bookkeeping automation page |
| A 21-branch hotel group processes 1,500 to 2,000 purchase bills a month through AiA | Hospitality page |
| Manual entry takes roughly 10 to 15 hours for every 100 to 150 bills | AiA blog on purchase bill entry |
| 64% say GSTR-2B reconciliation still happens line by line in Excel | Home page survey stat |
| 78% say manual entry of statement lines into Tally slows monthly accounting | Home page survey stat |
| 91% report accountant churn within 6 months | Home page survey stat |

Rules:
- Use numbers exactly as written. Never round up or combine them into new claims
- Never invent customer names, savings, or rupee figures. Rupee figures must come from the blog being adapted
- Do not promise "fully automatic" or "zero errors". Review step always exists

## 5. Things to never say

| Do not say | Say instead |
|---|---|
| "Accounting software" or "replace Tally" | "Works on top of Tally", "automation for Tally" |
| "Free to start" about WhatsApp | "The WhatsApp assistant is free" |
| "Works for every manufacturer" (any blanket industry claim) | "If your team types hundreds of bills into Tally every month..." |
| "Built for CAs" | Speak to founders and their in-house team |
| 95% accuracy on bank statements | 95% applies to bills only |
| Claims about features not yet launched | Only describe live features from section 3 |
| Mocking or unverified claims about competitors | Factual contrast from section 6 only |

## 6. Competitive landscape (facts usable for fair comparison)

| Alternative | What it is | Who it targets | How AiA is different |
|---|---|---|---|
| Manual entry in Tally | Accountant types every bill and bank line | Everyone by default | The real competitor. Slow, error-prone, breaks when the accountant leaves |
| Excel import utilities / TDL add-ons | Templates that push Excel data into Tally | Teams comfortable with Excel | Still needs someone to prepare clean Excel; no reading of PDFs, photos or handwritten bills |
| Tally's Docs by Ira | Tally's own AI plug-in that reads invoices and bills and creates draft vouchers for review | TallyPrime users on Release 7.1+ with an active Tally Software Subscription; phased rollout with a waitlist | Docs by Ira focuses on invoice documents and batches need one transaction per file and one voucher type per batch. AiA covers bills plus bank statements, GSTR-2B matching, dashboards and a free WhatsApp assistant, and works from TallyPrime 6.0. Docs by Ira usage is metered with paid top-ups |
| Suvit | Tally automation tool for bank, sales and purchase entries with GST reconciliation | CA firms managing many clients (practice management) | AiA is built for a single business's in-house finance team and founder, with dashboards and owner-facing WhatsApp |
| VouchrIt | Tally-first automation tool | SMBs and accountants on Tally | Closest like-for-like competitor; AiA has a public comparison page. Use only claims from that page (none supplied here, so make no specific claims about VouchrIt) |
| Nanonets and generic OCR tools | General document AI | Any industry, global | Not Tally-native; needs setup and integration work to post into Tally |
| Zoho Books and other accounting software | Full accounting software | SMBs switching systems | AiA does not ask anyone to leave Tally |
| CA firm doing daily entry | Outsourced bookkeeping | Businesses without an in-house team | That segment fits AiA's Virtual Accounting (CA-led managed service), not the tool |

Angle ideas the landscape supports:
- "Your accountant is not slow. The process is."
- "Why switching software is not the answer when the problem is data entry"
- "AI that reads bills is half the job. The other half is the bank statement."

## 7. Virtual Accounting (VA), only if the blog is about it

A CA-led managed accounting service for businesses without an in-house team. Each client gets a pod (CA, accountant, account manager, director) and updates over a WhatsApp group. Keep VA reels separate from AiA tool reels; never mix the two offers in one reel.

## 8. Voice for narration

- Calm, credible, confident. A seasoned financial expert who explains simply
- Speak to non-accountant owners. Explain any term the moment it is used ("GSTR-2B, the government's list of GST your suppliers actually filed")
- Lead with the benefit, then the detail
- Thinketh-style tension in the hook and twist is fine, but no exclamation-heavy selling, no "revolutionary", "game-changing", "best", "number one"
- Active voice, short sentences, one idea per sentence
- Light humour is allowed, used sparingly

## 10. CTA options

| Type | Line |
|---|---|
| Default (blog reel) | "Full breakdown on aiaccountant.com" |
| Approved tagline | "Meet your new AI Accountant" |
| Approved tagline | "Accounting done for you in minutes, not hours" |
| Approved tagline | "Simplify accounting, amplify growth" |
| Action | "Try it on your own bills" |

Use approved taglines as written; do not invent new straplines.

## 11. Plain-English glossary (for scripts aimed at founders)

| Term | Plain meaning |
|---|---|
| Tally / TallyPrime | The accounting software most Indian SMBs use to keep their books |
| Voucher | One entry in Tally, like a purchase, payment or receipt |
| Ledger | A running account for one party or category, like a vendor or "rent" |
| Purchase bill | The invoice a supplier sends you |
| Bank reconciliation | Checking that every bank line matches an entry in your books |
| GSTR-2B | Monthly GST statement showing the invoices your suppliers reported to the government |
| ITC (input tax credit) | GST you paid on purchases that you can claim back. Only claimable if it shows in GSTR-2B |
| TDS | Tax you deduct from certain payments and deposit with the government |
| Accounts payable / receivable | What you owe suppliers / what customers owe you |
| DSO / DPO | Average days to collect from customers / to pay suppliers |
