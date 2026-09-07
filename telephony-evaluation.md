# Phase 9 — Telephony Provider Evaluation

Status: **decision proposed, awaiting approval**
Date: 2026-09-06

This document exists because the calling architecture cannot be designed before the
regulatory position is known. The finding below changes the provider choice recorded in
`architecture.md`, so this phase is a decision gate, not an implementation phase.

---

## 1. The finding that drives everything

**A WebRTC/VoIP softphone in the browser or Capacitor app cannot legally place calls to
Indian mobile or landline numbers.**

India prohibits domestic VoIP-to-PSTN dial-out. Internet telephony may not interconnect
with the domestic PSTN, because doing so bypasses the licensed operators' toll revenue.
This restriction predates the Telecommunications Act 2023 and **survived it** — the Act
came into force in June 2024 but did not lift the prohibition, and the replacement
authorisation rules were still not finalised as of early 2025.
[[1]](https://ozonetel.com/voip-in-india/) [[2]](https://proactive.co.in/blog-details/webex-calling-deployment-india-regulations)

Twilio states this plainly for India: **outbound calls to India can only be made from
international (non-Indian) numbers**, and domestic in-country calling is listed as `N/A`.
[[3]](https://www.twilio.com/en-us/guidelines/in/voice)

| Use case | Status in India |
| --- | --- |
| VoIP ↔ VoIP (app-to-app) | Allowed |
| Inbound international → India | Allowed |
| Outbound international from India | Allowed |
| **VoIP dial-out to an Indian mobile/landline** | **Prohibited** |
| PSTN ↔ VoIP mixing for domestic calls | Prohibited |
| SIP trunking over dedicated private circuits | Limited — private circuits only, not public internet |

Source: [[1]](https://ozonetel.com/voip-in-india/)

### What this rules out

The obvious design — a WebRTC softphone in the Angular app, `@twilio/voice-sdk`, agent
talks through the browser — is **not lawful for domestic Indian calling**. It would work
for calling US/EU numbers and is a perfectly normal design elsewhere. It is not available
for this product's primary market.

I am flagging this now rather than after building it, because the entire calling screen,
audio-route handling, and mute/hold design differ between the two models.

---

## 2. The compliant alternative: PSTN-to-PSTN bridging (click-to-call)

The lawful pattern in India is that **the provider dials both parties over the PSTN and
bridges the two legs**. Nothing is carried over the internet except the API request that
starts the call.

```
Agent taps "Call" in the app
        │
        ▼  HTTPS API request (data only, no voice)
   Our backend  ──────►  Provider (UL/VNO licensed)
                              │
                              ├─ Leg 1: provider ──PSTN──► agent's phone   (rings first)
                              │
                              └─ Leg 2: provider ──PSTN──► contact's phone (dialled on answer)
                                          │
                                          └─ legs bridged; caller ID = our virtual number
```

Exotel's Click-to-Call works exactly this way: two outbound legs, leg 2 dialled once leg 1
answers, then patched together. The agent needs an internet connection only to trigger the
API call — **the voice path is PSTN throughout**.
[[4]](https://support.exotel.com/support/solutions/articles/3000108147-click-to-call-2-way-calling-)

Providers such as Exotel hold a **Unified Licence (Virtual Network Operator)**, which is
what makes their PSTN ingress/egress lawful; they explicitly market this as the bridge for
platforms that "lack direct access to India's PSTN due to licensing and regulatory
restrictions."
[[5]](https://support.exotel.com/support/solutions/articles/3000133452-flow-and-api-configuration-guide-for-voice-ai-contact-centre-platforms-via-exotel-virtual-sip-trunk)

### The honest consequence

The agent's own phone rings. **They talk on their handset, not through the app.**

That means several things the phase plan lists as scope are *not ours to implement* in the
India-domestic model:

| Feature | WebRTC model | PSTN-bridge model (India) |
| --- | --- | --- |
| Mute | In-app, we control it | **Handset does it.** We cannot |
| Speaker / audio route | In-app | **Handset does it.** We cannot |
| Hold | In-app | Provider-dependent, usually not exposed |
| DTMF | In-app keypad | **Handset keypad.** Not ours |
| Call timer | Local, exact | Derived from provider webhooks |
| End call | In-app | Hang up handset; API cancel only while ringing |

This is not a limitation I can engineer around. Presenting an in-app mute button that does
nothing would be exactly the kind of fake calling UI `rules.md` forbids (lines 270–274,
466). The calling screen must be honest: it shows **call state**, not fake device controls.

---

## 3. Provider comparison

| | Twilio Voice | Exotel | Ozonetel | Telnyx / Vonage |
| --- | --- | --- | --- | --- |
| India domestic outbound | **No** [[3]](https://www.twilio.com/en-us/guidelines/in/voice) | Yes (UL-VNO) | Yes | No / restricted |
| India licence held | — | UL-VNO [[5]](https://support.exotel.com/support/solutions/articles/3000133452-flow-and-api-configuration-guide-for-voice-ai-contact-centre-platforms-via-exotel-virtual-sip-trunk) | UL-VNO | — |
| International outbound | Excellent | Limited | Limited | Excellent |
| Click-to-call bridging API | Yes | Yes [[4]](https://support.exotel.com/support/solutions/articles/3000108147-click-to-call-2-way-calling-) | Yes | Yes |
| Recording | Yes | Yes, `record` flag; MP3 URL in webhook [[6]](https://developer.exotel.com/api/ccm-calls) | Yes | Yes |
| Status webhooks | Yes | Yes, `StatusCallback` + terminal events [[7]](https://developer.exotel.com/api/make-a-call-api) | Yes | Yes |
| Web/mobile SDK needed | Yes | **No** — plain REST | No | Yes |
| Docs quality | Best in class | Good | Adequate | Good |

### Recommendation

**Primary: Exotel** for India-domestic calling, via the Click-to-Call / Connect API.
It is licensed for exactly this, needs no client SDK (so the Capacitor app stays thin),
returns recordings and terminal call events over webhooks, and its two-leg model maps
cleanly onto a provider-agnostic adapter.

**Secondary: Twilio**, kept behind the same adapter interface, for international
destinations if the product later sells outside India. Twilio is *not* a fallback for
Indian numbers — it is a different market's implementation.

The adapter interface in §6 is designed so this is a configuration choice per workspace,
not a rewrite.

---

## 4. Recording: consent is not a checkbox

India's baseline is **one-party consent** — a participant may record a call they are part
of. [[8]](https://www.recordinglaw.com/world-laws/world-recording-laws/india-recording-laws/)
But that baseline is not sufficient for a commercial product, because the DPDP Act 2023
layers data-protection duties on top: recorded audio identifying a living person is
personal data, and the recording business is a Data Fiduciary that must give notice and
obtain meaningful consent before collecting it.
[[8]](https://www.recordinglaw.com/world-laws/world-recording-laws/india-recording-laws/)

The DPDP Rules were notified in November 2025, with full notice-and-consent compliance
required from **May 13, 2027** (Phase III) — though the general obligation to have a lawful
basis is operative now.
[[8]](https://www.recordinglaw.com/world-laws/world-recording-laws/india-recording-laws/)

Design consequences, to be built in Phase 11 rather than retrofitted:

- **Recording is off by default**, per workspace, and must be deliberately enabled.
- When enabled, an **announcement plays before the conversation** stating the specific
  purpose (not a vague "this call may be recorded").
- **Consent is logged with a timestamp** against the call record — the log is the evidence.
- A **retention period** is configured per workspace and recordings are deleted when it
  expires; indefinite retention is not offered.
- Recordings are **private objects**, never public URLs, behind authorisation checks.
- Agents are data principals too: their consent to being recorded belongs in onboarding,
  which is a product/legal task, not a code task.

I am not a lawyer and this is not legal advice. These are engineering defaults chosen to
be defensible; the operator must confirm them with counsel before enabling recording.

### DND / TCCCPR

Outbound commercial calling to Indian consumers is subject to TRAI's unsolicited-commercial-
communication regime, and unregistered commercial calling compounds liability.
[[9]](https://frejun.com/trai-call-recording-rules-india/) Twilio's own India guidance warns
that calls without recipient consent are treated as UCC and can trigger account termination.
[[3]](https://www.twilio.com/en-us/guidelines/in/voice)

The product will therefore **not** ship an auto-dialler that blasts a contact list. The
calling queue stays manually advanced, one call at a time, per `rules.md` line 289. Scrubbing
against DND registers is an operator responsibility we surface, not one we can silently
assume.

---

## 5. Platform capability matrix

| Capability | Web (Angular) | Android (Capacitor) | iOS (Capacitor) |
| --- | --- | --- | --- |
| Trigger a bridged call | Yes (REST) | Yes (REST) | Yes (REST) |
| Live call state via webhook + poll/SSE | Yes | Yes | Yes |
| Voice audio in-app | **No** (PSTN bridge) | **No** | **No** |
| Mute / hold / DTMF | No — handset | No — handset | No — handset |
| Call recording | Provider-side | Provider-side | Provider-side |
| Requires native permissions | None | None for bridged calls | None for bridged calls |
| `tel:` deep link | Not used as the calling implementation | Not used | Not used |

Because the voice path never touches the device's audio stack, the Capacitor shell needs
**no microphone permission and no native telephony plugin** for the bridged model. That is
a genuine simplification, and it is the reason Phase 14 (packaging) gets easier, not harder.

---

## 6. Provider adapter contract

Written to `backend/src/infrastructure/telephony/telephony-provider.ts` so Phase 10 codes
against the interface rather than against Exotel.

Design decisions embedded in it:

- **Two legs are first-class.** A model with a single "call" hides the fact that the agent
  leg can answer while the customer leg fails, which is the most common real outcome.
- **Capabilities are declared, not assumed.** `supports` lets the UI hide a control the
  provider genuinely cannot perform, instead of showing a dead button.
- **Webhook verification is part of the interface.** An unverified provider webhook is an
  open endpoint that lets anyone forge call outcomes.
- **Normalized status enum.** Provider-specific strings (`no-answer`, `busy`, `terminal`)
  are mapped at the adapter edge so the domain never learns Exotel's vocabulary.

---

## 7. Exit criteria

| Criterion | Status |
| --- | --- |
| Provider selected | **Exotel primary, Twilio international** — pending your approval |
| Credentials available outside Git | Contract defined; `.env` keys documented, none committed |
| Platform capability matrix documented | §5 |
| Legal and recording assumptions documented | §4 |
| Provider adapter contract approved | §6 + code — **pending your approval** |

## 8. Open questions for you

1. **Is India the primary market?** Everything above assumes yes. If the first customers
   are US/EU, Twilio + WebRTC is the better design and the in-app controls become real.
2. **Do you have an Exotel account,** or should Phase 10 be built against the adapter with
   a recorded-fixture test double until one exists?
3. **Recording at launch, or deferred?** Given the May 2027 compliance horizon, shipping
   with recording off and the consent machinery built is the low-risk path.

---

### Sources

1. [VoIP in India (2026): What's Allowed](https://ozonetel.com/voip-in-india/)
2. [Webex Calling Deployment India Regulations](https://proactive.co.in/blog-details/webex-calling-deployment-india-regulations)
3. [Twilio — India Voice Guidelines](https://www.twilio.com/en-us/guidelines/in/voice)
4. [Exotel — Click to Call (2-way calling)](https://support.exotel.com/support/solutions/articles/3000108147-click-to-call-2-way-calling-)
5. [Exotel — Virtual SIP Trunk / UL VNO PSTN access](https://support.exotel.com/support/solutions/articles/3000133452-flow-and-api-configuration-guide-for-voice-ai-contact-centre-platforms-via-exotel-virtual-sip-trunk)
6. [Exotel — CCM Make Call API](https://developer.exotel.com/api/ccm-calls)
7. [Exotel — Connect two numbers API](https://developer.exotel.com/api/make-a-call-api)
8. [India Recording Laws: One-Party Consent, DPDPA](https://www.recordinglaw.com/world-laws/world-recording-laws/india-recording-laws/)
9. [TRAI Call Recording Rules India](https://frejun.com/trai-call-recording-rules-india/)
