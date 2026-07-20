# SEOULMATE Pricing Draft

This is a working draft for the Free / Pro membership model. Keep safety and trust features available to every user; Pro should save time, improve privacy controls, and make cross-language communication easier.

## Recommended Tiers

| Plan | Thailand | Korea | International | Best For |
| --- | ---: | ---: | ---: | --- |
| Free | Free | Free | Free | Trying the app, basic discovery, community, and safe chat |
| Pro Monthly | THB 199 / month | KRW 7,900 / month | USD 6.99 / month | Active users who want better filters and translation |
| Pro 3 Months | THB 499 | KRW 19,900 | USD 17.99 | Lower-friction first paid plan |
| Pro Yearly | THB 1,490 / year | KRW 59,000 / year | USD 49.99 / year | Committed users and early supporters |

## Free Plan

Free should feel useful and safe, not like a locked demo.

- Create profile
- Choose intent: dating, friendship, exchange
- Community feed access
- Limited posting, suggested starting point: 3 posts per day
- Limited discovery, suggested starting point: 20 profiles per day
- Limited new chats, suggested starting point: 3 new chats per day
- Basic chat
- AI translation trial, suggested starting point: 10 translations per day
- Basic profile visibility
- Report users/content
- Block users
- Core safety protection

## Pro Plan

Pro should feel like calm leverage: better signal, less friction, more control.

- Higher or unlimited discovery with soft abuse limits
- Advanced filters:
  - nationality
  - intent
  - language
  - active recently
  - city/travel area
- See who showed interest
- Priority profile placement, kept subtle and trust-safe
- Higher AI translation allowance, suggested starting point: 300 translations per month
- AI icebreakers
- AI profile polish
- Message nuance helper for Thai/Korean context
- Read receipts
- Private mode: only visible to people the user interacts with or approves
- Travel mode: Seoul, Bangkok, Chiang Mai, Busan, and selected cities
- Save favorite profiles
- Monthly profile review
- More match hints from community topics
- Pro badge, visually quiet

## Do Not Put Behind Paywall

These must stay available for everyone.

- Reporting
- Blocking
- Abuse protection
- Safety review
- Basic account security
- Basic chat after a connection
- Account deletion
- Privacy controls required by law

## Product Positioning

Free:
Use Seoulmate safely, understand the community, and start real conversations.

Pro:
Save time, communicate across language barriers better, and control how discovery works.

## Suggested Backend Model

Implemented in the Stripe-ready entitlement layer:

```text
users.plan = free | pro

subscriptions
- id
- user_id
- plan
- status
- provider
- current_period_start
- current_period_end
- created_at
- updated_at

subscription_events
- id
- subscription_id
- event_type
- provider_event_id
- payload
- created_at

usage_counters
- user_id
- feature_key
- period_key
- used_count
- limit_count
- reset_at
```

Stripe should later update these records through webhook events. Until then,
admin can manually grant or remove Pro from the safety console.

## Suggested Feature Keys

```text
discover_profiles_daily
new_chats_daily
posts_daily
ai_translations_daily
ai_translations_monthly
advanced_filters
see_interest
private_mode
travel_mode
profile_review
```

## Launch Recommendation

Start with Free and Pro only. Avoid adding Gold, Platinum, Boost, Super Like, or aggressive swipe-style monetization until the trust and safety layer is mature.

First paid feature set to ship:

1. Advanced filters
2. Higher discovery limit
3. Higher AI translation allowance
4. See who showed interest
5. Private mode

Review prices after 30-60 days using:

- free to paid conversion
- churn after first month
- daily active users
- report rate by plan
- AI cost per Pro user
- average chats started per Pro user

## Checkout Branding Draft

Use these colors for the pricing table and later Stripe Checkout styling:

| Token | Value |
| --- | --- |
| Background color | `#FFFDF8` |
| Button color | `#E9524F` |
| Text / ink | `#332B5F` |
| Accent | `#60CDB8` |

## Stripe Pricing Table Embed

The Pro panel loads Stripe's Pricing Table script client-side and renders the configured table.

```text
VITE_STRIPE_PRICING_TABLE_ID=prctbl_1TuakZKBsyjRnliaFmokLqrk
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_STRIPE_CUSTOMER_PORTAL_URL=https://billing.stripe.com/p/login/test_28E8wQ5KWc3m4jI6hG7AI00
```

Do not embed payment method IDs such as `pmd_...` in frontend code. They belong to Stripe/payment records and should only be handled server-side when needed.
