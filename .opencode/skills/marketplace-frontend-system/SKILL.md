---
name: marketplace-frontend-system
description: Build sophisticated, content-led marketplace frontends inspired by the interaction principles, information architecture, motion language, responsive behavior, and product-system discipline found in modern Airbnb. Use for React, Next.js, Tailwind, shadcn/ui, or comparable frontend projects where discovery, search, listings, maps, detail pages, booking, services, experiences, or other marketplace workflows are involved. Do not copy Airbnb branding, assets, proprietary artwork, exact layouts, exact copy, or exact styling. Extract reusable product and frontend principles and adapt them to the product's own brand.
---

# Marketplace Frontend System

## 0. PURPOSE

Build marketplace interfaces that feel like mature consumer products rather than AI-generated templates.

The target quality bar is:

- content-led rather than component-led
- visually calm but not sterile
- information-dense without feeling crowded
- highly interactive without being over-animated
- responsive by behavior, not merely by width
- state-complete rather than happy-path-only
- transactional interfaces optimized for confidence
- discovery interfaces optimized for curiosity and decision making
- reusable at the design-system and component levels
- accessible
- performant
- production-oriented

This skill is inspired by interaction and product-design principles observable in modern Airbnb.

It must NEVER reproduce:

- Airbnb logo
- Airbnb wordmark
- Airbnb proprietary artwork
- Airbnb proprietary illustrations
- Airbnb proprietary photography
- Airbnb exact copy
- Airbnb exact CSS
- Airbnb exact icon artwork
- Airbnb exact page layouts
- Airbnb exact branded colors
- Airbnb exact animations

The objective is to extract the underlying product-design intelligence and apply it to the user's own product and brand.

---

# 1. FIRST PRINCIPLE: THINK IN SYSTEMS, NOT PAGES

Do not begin by creating isolated pages.

First understand the complete product journey.

Typical marketplace journey:

DISCOVER
→ SEARCH
→ FILTER
→ COMPARE
→ INSPECT
→ DECIDE
→ BOOK / BUY
→ CONFIRM
→ MANAGE

Before implementing a page, determine:

1. What is the user's intent?
2. What decision is the user making?
3. What information is required for that decision?
4. What information is secondary?
5. What action should become easier?
6. What state should the user be in after completing the action?
7. What happens if the action fails?
8. What happens on mobile?
9. What happens with keyboard navigation?
10. What happens with slow or missing data?

Never build a beautiful page whose underlying interaction model is weak.

---

# 2. PRODUCT PHILOSOPHY

## 2.1 The interface is a decision system

Every interface element should help the user:

- understand
- compare
- decide
- act
- recover

Do not display information merely because the backend contains it.

Ask:

> "Does the user need this information at this exact point in the journey?"

If not, defer it.

---

## 2.2 Content is the visual hero

For marketplaces, the actual content should create most of the visual richness.

Examples:

- property photography
- products
- destinations
- people
- experiences
- services
- editorial imagery

The interface should frame the content rather than compete with it.

Prefer:

- neutral surfaces
- strong typography hierarchy
- subtle borders
- restrained shadows
- generous spacing
- strong imagery
- controlled accent color

Avoid:

- decorative gradients everywhere
- excessive glassmorphism
- nested cards
- excessive pills
- giant CTA buttons
- dashboard-style containers
- arbitrary visual effects
- excessive colored backgrounds

---

## 2.3 One primary decision per viewport

Every viewport should have an obvious primary action.

Examples:

Homepage:

> Start discovering

Search:

> Refine and select

Detail:

> Understand and reserve

Checkout:

> Verify and pay

Confirmation:

> Understand what happens next

Do not make every button visually dominant.

---

# 3. MARKETPLACE INFORMATION ARCHITECTURE

Use this as a conceptual architecture.

Adapt it to the actual product.

```text
GLOBAL SHELL
├── Brand
├── Primary category navigation
├── Search
├── Account
├── Locale / currency
└── Contextual controls

DISCOVERY
├── Homepage
├── Categories
├── Recommendations
├── Destinations
├── Collections
└── Editorial / inspiration

SEARCH
├── Search parameters
├── Quick filters
├── Advanced filters
├── Results
├── Sorting
├── Map
└── Pagination / infinite loading

DETAIL
├── Gallery
├── Title
├── Metadata
├── Description
├── Highlights
├── Features / amenities
├── Provider / host
├── Reviews
├── Location
├── Policies
└── Transaction module

TRANSACTION
├── Availability
├── Selection
├── Price breakdown
├── Customer details
├── Payment
├── Confirmation
└── Post-purchase management

USER
├── Trips / orders
├── Saved / wishlists
├── Messages
├── Profile
└── Settings

PROVIDER / HOST
├── Inventory
├── Calendar
├── Pricing
├── Reservations / orders
├── Messages
└── Analytics / resources
```

Do not implement domains that the product does not need.

---

# 4. GLOBAL SHELL

## 4.1 Desktop

The desktop shell may contain:

- brand
- primary product/category navigation
- search
- account actions
- locale/currency
- provider/host entry where appropriate

Keep the shell visually lighter than the content.

The shell should not consume unnecessary vertical space.

---

## 4.2 Mobile

Do NOT simply shrink desktop navigation.

Reinterpret it.

Desktop:

```text
Brand
Navigation
Search
Account
```

Mobile may become:

```text
Compact header
Search entry
Contextual controls
Bottom navigation
```

depending on the product.

Mobile is a different interaction environment.

---

## 4.3 Sticky behavior

Use sticky UI only when it preserves important context.

Good uses:

- search
- filters
- booking action
- contextual navigation

Bad use:

- making every toolbar sticky
- stacking multiple sticky bars
- consuming half the viewport

---

# 5. NAVIGATION SYSTEM

Navigation must communicate:

- where the user is
- what category they are browsing
- what can be changed
- what happens next

---

## 5.1 Category switching

If the marketplace contains domains such as:

- Homes
- Experiences
- Services
- Hotels
- Products
- Other verticals

switching between them should feel like changing the content mode of the same product.

Do not make every vertical feel like a different website.

Preserve:

- global shell
- navigation language
- search mental model
- typography system
- interaction conventions

Change:

- content grammar
- information hierarchy
- card composition
- detail composition

---

## 5.2 Navigation states

Every interactive navigation element must support:

```text
DEFAULT
HOVER
FOCUS
PRESSED
ACTIVE
ACTIVE + HOVER
DISABLED
```

Never communicate state through color alone.

---

# 6. SEARCH IS A STATE MACHINE

Search is not merely an input.

Treat it as a product subsystem.

---

## 6.1 Core states

```text
IDLE

WHERE_ACTIVE

WHEN_ACTIVE

WHO_ACTIVE

FILTER_ACTIVE

PARTIALLY_COMPLETE

COMPLETE

SUBMITTING

RESULTS

ERROR
```

---

## 6.2 Date states

Where dates are relevant:

```text
DATE_IDLE

DATE_START_SELECTING

DATE_END_SELECTING

DATE_RANGE_COMPLETE

FLEXIBLE_DATE_MODE

MONTH_SELECTING
```

---

## 6.3 Quantity states

For guests, rooms, seats, participants, etc.:

```text
QUANTITY_IDLE

ADULTS_ACTIVE

CHILDREN_ACTIVE

INFANTS_ACTIVE

PETS_ACTIVE

ROOMS_ACTIVE
```

Only implement relevant categories.

---

# 7. SEARCH INVARIANTS

When editing one search dimension:

- preserve other committed values
- never reset unrelated fields
- show current selection
- make active field obvious
- preserve context
- support Escape
- support outside click
- restore focus
- support keyboard navigation

Example:

```text
Where: Delhi
When: 12–16 October
Who: 2 guests
```

If the user changes `When`, `Delhi` and `2 guests` remain committed.

---

# 8. SEARCH INTERACTION MODEL

Preferred pattern:

```text
SEARCH SHELL
      ↓
ACTIVE SEGMENT
      ↓
CONTEXTUAL PANEL
      ↓
USER SELECTION
      ↓
NEXT SEGMENT
```

Avoid:

```text
click search
→ navigate to unrelated page
→ lose context
```

---

# 9. SEARCH ANIMATION

Search should feel like one continuous object.

Use:

- active segment movement
- height interpolation
- controlled expansion
- contextual panel transition
- subtle crossfade
- spatial continuity
- spring-like motion where appropriate

Do not:

- abruptly replace the whole search bar
- animate every child independently
- reset search state during animation
- use dramatic page transitions
- make animation slower than the task requires

---

# 10. SEARCH MODAL / FULL-SCREEN MODE

When search becomes modal:

1. Move focus into the active control.
2. Preserve search state.
3. Prevent background interaction.
4. Provide Escape.
5. Prevent scroll bleed.
6. Support keyboard navigation.
7. Restore focus when closed.
8. Provide accessible labels.

On mobile, complex search may become full-screen.

---

# 11. DATE PICKER

A calendar is a stateful interaction system.

Required states:

```text
DEFAULT
HOVER
FOCUS
TODAY
UNAVAILABLE
SELECTED_START
SELECTED_END
IN_RANGE
ADJACENT_MONTH
KEYBOARD_FOCUS
DISABLED
```

Range selection:

```text
NO_SELECTION
→ START_SELECTED
→ RANGE_SELECTED
```

Invalid dates must not silently create invalid states.

---

## 11.1 Calendar motion

Use subtle motion for:

- month transitions
- range selection
- focus changes

Do not animate every date cell unnecessarily.

---

# 12. QUANTITY SELECTOR

For guests, rooms, seats, etc.:

Each row should contain:

- label
- optional explanation
- current quantity
- decrement
- increment
- disabled states

Prevent invalid values.

Provide immediate feedback.

---

# 13. HOMEPAGE / DISCOVERY

Do not automatically create:

```text
Hero
↓
three cards
↓
three more cards
↓
footer
```

Instead create a discovery narrative.

Possible structure:

```text
GLOBAL SHELL

PRIMARY SEARCH

DISCOVERY CATEGORY

PRIMARY CONTENT

TRENDING / POPULAR

PERSONALIZED

EDITORIAL / INSPIRATION

DESTINATION / CONTEXT

SECONDARY DISCOVERY

FOOTER
```

Every section must have a purpose.

---

# 14. DISCOVERY SECTION RULES

Possible section types:

- popular nearby
- recommended
- trending
- recently viewed
- seasonal
- category-based
- editorial
- destination collection
- personalized

Do not create ten visually identical horizontal carousels.

Vary composition according to content importance.

---

# 15. CONTENT CARD SYSTEM

Cards are not generic containers.

Marketplace cards should prioritize:

1. media
2. primary identity
3. contextual metadata
4. price/value
5. rating/trust
6. secondary action

---

## 15.1 Card anatomy

```text
MEDIA
├── image / video
├── save action
├── media navigation
└── meaningful badge

CONTENT
├── location / title
├── contextual metadata
├── price / value
└── rating / trust
```

---

## 15.2 Card visual rules

Prefer:

- large media
- minimal chrome
- consistent aspect ratios
- concise metadata
- subtle interactions

Avoid:

- thick borders
- heavy shadows
- large button groups
- excessive badges
- giant descriptions
- nested cards

---

# 16. CARD STATES

Every important card should define:

```text
DEFAULT

HOVER

FOCUS

PRESS

SAVED

MEDIA_NEXT

MEDIA_PREVIOUS

LOADING

ERROR

DISABLED
```

Do not leave important states undefined.

---

# 17. MEDIA INTERACTION

Images are interaction surfaces.

Support when relevant:

- swipe
- previous/next
- keyboard navigation
- current position
- loading
- fallback
- fixed aspect ratio
- no layout shift

Do not animate the entire card when only the image changes.

---

# 18. SAVE / WISHLIST

Preferred state transition:

```text
UNSAVED
→ PRESSED
→ SAVED
```

Possible feedback:

- icon morph
- subtle scale
- opacity change
- restrained semantic feedback

Do not use giant celebration animations for ordinary saves.

If authentication is required:

```text
SAVE
→ AUTHENTICATION
→ RETURN TO ORIGINAL CONTEXT
→ COMPLETE SAVE
```

Never unnecessarily lose the user's browsing state.

---

# 19. SEARCH RESULTS

Search results optimize for decision making, not inspiration.

Typical hierarchy:

```text
SEARCH SUMMARY

FILTERS

SORT

RESULT COUNT

RESULT GRID / LIST

MAP WHERE RELEVANT
```

Increase information density compared with the homepage.

---

# 20. MAP + LIST SYSTEM

A map is a second representation of the search space.

It is not decorative.

---

## 20.1 Bidirectional interaction

Card hover/select:

```text
CARD
→ MAP MARKER EMPHASIS
```

Marker hover/select:

```text
MAP MARKER
→ RESULT EMPHASIS
```

Map movement:

```text
PAN / ZOOM
→ UPDATE GEOGRAPHIC RESULT CONTEXT
```

Marker click:

```text
MARKER
→ LISTING PREVIEW
```

Selection must preserve search/filter state.

---

# 21. MAP RESPONSIVENESS

Desktop:

```text
RESULTS | MAP
```

Tablet:

```text
RESULTS
+
CONTEXTUAL MAP
```

Mobile:

```text
RESULTS
↕
MAP MODE / SHEET
```

Do not force a permanent 50/50 map split on mobile.

---

# 22. FILTER SYSTEM

Filters should be layered.

```text
PRIMARY FILTERS
↓
QUICK FILTERS
↓
RECOMMENDED FILTERS
↓
ADVANCED FILTERS
```

Do not expose dozens of controls at once.

---

## 22.1 Filter state

Track:

- available options
- selected options
- disabled options
- selected count
- result count where available
- unsaved changes
- applied state

---

## 22.2 Filter interaction

Preferred:

```text
OPEN
→ CHANGE
→ PRESERVE RESULT CONTEXT
→ APPLY
→ UPDATE RESULTS
```

The user should understand what their filter changes.

---

# 23. MOBILE FILTERS

Use:

- bottom sheets
- full-screen sheets
- grouped sections
- sticky Apply/Done where necessary

Do not squeeze a desktop filter sidebar into mobile.

---

# 24. SORTING

Sorting and filtering are conceptually different.

Examples:

```text
Recommended
Price
Rating
Distance
Newest
```

Do not hide important sorting controls behind ambiguous filter UI.

---

# 25. DETAIL PAGE

The detail page changes the user mental state:

```text
DISCOVERY
→ CONFIDENCE
→ DECISION
```

The page should answer:

- What is it?
- Where is it?
- What is included?
- Who provides it?
- Can I trust it?
- What does it cost?
- What are the constraints?
- Can I book/buy it?

---

## 25.1 Detail anatomy

Adapt as required:

```text
GALLERY

TITLE

METADATA

LOCATION

PROVIDER / HOST

DESCRIPTION

HIGHLIGHTS

FEATURES / AMENITIES

DETAILED INFORMATION

REVIEWS

LOCATION

POLICIES

IMPORTANT INFORMATION

TRANSACTION MODULE
```

---

# 26. GALLERY SYSTEM

Desktop can use:

```text
PRIMARY IMAGE
+
SECONDARY IMAGE GRID
```

Mobile:

```text
SINGLE IMAGE
+
GESTURE NAVIGATION
+
POSITION INDICATOR
```

Do not merely shrink desktop gallery.

---

# 27. GALLERY OVERLAY

When expanded:

- trap focus
- prevent background scroll
- preserve current image
- previous/next
- current position
- close action
- Escape
- keyboard support
- focus restoration

---

# 28. PROVIDER / HOST SYSTEM

Trust is a product feature.

Provider/host UI may communicate:

- identity
- verification
- credibility
- expertise
- reliability
- response information

Do not overwhelm the user with biography before essential product information.

Use progressive disclosure.

---

# 29. REVIEWS

Reviews should optimize for signal.

Preferred hierarchy:

```text
OVERALL RATING

CATEGORY SIGNALS

SUMMARY / HIGHLIGHTS

REVIEW LIST
```

If AI-generated summaries are used:

- clearly identify them as generated
- never represent synthesis as a direct quote
- preserve access to source reviews
- avoid fabricated evidence

---

# 30. PRICE TRANSPARENCY

Never force the user to mentally calculate.

Use:

```text
BASE PRICE
+
RELEVANT FEES
+
TAX
=
TOTAL
```

Support:

```text
headline price
→ detailed breakdown
→ final total
```

The final amount must be unambiguous before payment.

---

# 31. TRANSACTION / BOOKING MODULE

Desktop may use:

```text
STICKY SIDE MODULE
```

Mobile may use:

```text
FIXED BOTTOM ACTION
```

or:

```text
COMPACT PRICE + ACTION
→ EXPANDABLE SHEET
```

The transaction module should remain discoverable without blocking the page.

---

# 32. TRANSACTION STATES

Define explicitly:

```text
READY

DATE_REQUIRED

GUEST_REQUIRED

AVAILABILITY_CHECKING

AVAILABLE

UNAVAILABLE

CALCULATING_PRICE

READY_TO_BOOK

SUBMITTING

PAYMENT_REQUIRED

SUCCESS

ERROR
```

Every state must explain what the user should do next.

---

# 33. CHECKOUT

Checkout should be calmer than discovery.

Reduce:

- decorative animation
- unnecessary imagery
- secondary navigation
- distractions

Increase:

- clarity
- totals
- validation
- trust
- error explanation
- confirmation

Mental model:

```text
DISCOVERY
emotion + curiosity

DETAIL
confidence + evidence

CHECKOUT
clarity + correctness
```

---

# 34. CONFIRMATION

Immediately answer:

1. Did it succeed?
2. What did I purchase/book?
3. When?
4. Where?
5. What happens next?
6. How can I manage it?

Confirmation animation should reinforce success without delaying useful information.

---

# 35. MULTI-VERTICAL MARKETPLACE

Do not force every vertical into one exact card or detail template.

Shared:

- design tokens
- shell
- accessibility
- motion system
- search architecture
- state conventions

Can vary:

- card content
- detail structure
- metadata
- booking model
- visual emphasis

Examples:

Homes:

```text
space
location
amenities
stay
```

Experiences:

```text
person
activity
story
time
place
```

Services:

```text
provider
expertise
deliverable
availability
price
```

Hotels:

```text
property
room
rate
availability
```

---

# 36. MOTION PHILOSOPHY

Motion must have a reason.

Valid purposes:

```text
FEEDBACK
ORIENTATION
CONTINUITY
HIERARCHY
DISCOVERY
DELIGHT
```

If motion serves none of these, remove it.

---

# 37. MOTION CATEGORIES

## 37.1 Micro interaction

Use for:

- hover
- focus
- press
- toggle
- save
- selection

Typical duration:

```text
100–200ms
```

---

## 37.2 Component transition

Use for:

- dropdowns
- popovers
- calendars
- filters
- guest selectors
- sheets

Typical duration:

```text
180–350ms
```

---

## 37.3 Navigation transition

Use for:

- search → results
- result → detail
- mode changes

Prioritize spatial continuity.

---

## 37.4 Gesture motion

Use for:

- galleries
- sheets
- carousels
- maps

Whenever possible, movement should follow user input.

---

## 37.5 Emotional motion

Use sparingly for:

- successful booking
- meaningful milestones
- special category interactions

Never allow emotional motion to delay functionality.

---

# 38. MOTION RULES

## DO

- animate state changes
- preserve spatial relationships
- use transform and opacity where appropriate
- use physical/spring-like motion for physical surfaces where appropriate
- keep interaction feedback fast
- allow gestures to interrupt animation
- support reduced motion

## DO NOT

- animate everything
- fade every section into existence
- use excessive parallax
- bounce every button
- scale every card dramatically
- delay important content
- animate unrelated components simultaneously
- create unpredictable layout movement

---

# 39. MOTION TOKENS

Centralize motion.

Example:

```css
--motion-instant: 80ms;
--motion-micro: 120ms;
--motion-quick: 180ms;
--motion-standard: 240ms;
--motion-emphasis: 320ms;
--motion-sheet: 400ms;
```

Use semantic names.

Examples:

```text
button press
→ micro

popover
→ quick

search expansion
→ standard

bottom sheet
→ sheet

success
→ emphasis
```

Actual values can be adjusted to the product.

---

# 40. REDUCED MOTION

Always support:

```css
@media (prefers-reduced-motion: reduce)
```

When reduced motion is enabled:

- remove nonessential movement
- retain state changes
- retain useful opacity transitions
- preserve functionality
- never hide information behind animation

---

# 41. RESPONSIVE DESIGN

Responsive design means reinterpretation, not compression.

---

## 41.1 Desktop

May support:

- multi-column discovery
- persistent search
- list/map
- sticky booking
- complex galleries
- richer navigation

---

## 41.2 Tablet

May require:

- reduced density
- simplified navigation
- fewer simultaneous surfaces
- repositioned transaction UI
- simplified gallery

---

## 41.3 Mobile

Prefer:

- one-handed interaction
- full-screen search when complex
- bottom sheets
- swipeable media
- fixed primary action where needed
- thumb-reachable controls
- fewer simultaneous UI regions

---

# 42. BEHAVIORAL BREAKPOINTS

Do not choose breakpoints only because:

```text
768px
1024px
1280px
```

are common.

Instead ask:

- Does navigation fit?
- Does search remain coherent?
- Is the gallery useful?
- Can booking remain readable?
- Can map/list coexist?
- Are controls reachable?

Change the interaction model when the current model stops working.

---

# 43. ACCESSIBILITY

Every interactive component must define:

- semantic element
- accessible name
- keyboard behavior
- focus-visible state
- disabled state
- selected state
- pressed state
- expanded/collapsed state where relevant
- screen-reader context
- focus restoration

---

## 43.1 Keyboard

Support where applicable:

- Tab
- Shift+Tab
- Enter
- Space
- Escape
- Arrow navigation for composite controls

Maintain logical focus order.

---

## 43.2 Color

Never rely only on color.

Use combinations of:

- text
- icon
- shape
- state
- position

where necessary.

---

# 44. LOADING STATES

Define loading before implementing data fetching.

Possible states:

```text
INITIAL_LOADING

SEARCHING

PARTIAL_RESULTS

IMAGE_LOADING

MAP_LOADING

FILTERING

PAGINATION_LOADING

ACTION_SUBMITTING
```

Avoid layout shifts.

Skeleton geometry should resemble the final layout.

Do not show a spinner for every tiny interaction.

---

# 45. EMPTY STATES

Every empty state should answer:

1. What happened?
2. Why?
3. What can I do now?

Example:

```text
No results match your current filters.

Try:

[Remove dates]
[Increase budget]
[Clear filters]

Recommended alternatives...
```

Avoid:

```text
No results.
```

as the entire experience.

---

# 46. ERROR STATES

Errors must be actionable.

Network:

```text
We couldn't load these results.

[Try again]
```

Availability:

```text
Those dates are no longer available.

[Choose different dates]
```

Payment:

```text
Your payment could not be completed.

Check your payment method or try another one.
```

Never expose raw API errors.

---

# 47. AUTHENTICATION CONTINUITY

If authentication interrupts an action:

```text
USER ACTION
→ AUTH REQUIRED
→ AUTHENTICATION
→ RETURN TO ORIGINAL CONTEXT
→ COMPLETE ORIGINAL ACTION
```

Preserve where possible:

- search state
- selected item
- filters
- intended action
- scroll position
- non-sensitive form data

Do not unnecessarily redirect users to a generic dashboard.

---

# 48. PERSONALIZATION

Personalization should feel useful rather than mysterious.

Examples:

```text
Recommended for you

Based on your searches

Popular nearby

Great for families

Guest favorite
```

When appropriate, explain relevance.

Never fabricate personalization.

Never present generated recommendations as objective facts.

---

# 49. COMPONENT ARCHITECTURE

Build primitives before pages.

Recommended layers:

```text
FOUNDATION
├── Typography
├── Spacing
├── Color
├── Radius
├── Shadow
├── Motion
└── Breakpoints

PRIMITIVES
├── Button
├── IconButton
├── Badge
├── Avatar
├── Divider
├── Image
├── Price
└── Rating

INTERACTION
├── Popover
├── Modal
├── Sheet
├── Calendar
├── Counter
├── Tabs
├── Carousel
└── Dropdown

MARKETPLACE
├── SearchBar
├── FilterBar
├── ListingCard
├── ResultGrid
├── MapPanel
├── Gallery
├── ReviewSummary
├── ProviderCard
└── BookingCard

COMPOSITION
├── Header
├── DiscoveryPage
├── SearchResultsPage
├── DetailPage
├── CheckoutPage
└── ConfirmationPage
```

Do not create a new component for every page-specific variation.

Prefer composition and variants.

---

# 50. COMPONENT CONTRACTS

Every reusable component should define:

```text
Purpose

Props

Events

Visual states

Interaction states

Responsive behavior

Accessibility

Loading behavior

Error behavior

Motion behavior
```

Example:

```text
ListingCard

Props:
- item
- media
- price
- rating
- saved
- onSave
- onSelect

States:
- default
- hover
- focus
- saved
- loading
- error

Responsive:
- grid card desktop
- compact/full-width mobile where appropriate

Accessibility:
- semantic article
- keyboard support
- accessible save control
```

---

# 51. DESIGN TOKENS

Never scatter arbitrary values.

Centralize:

```css
--color-bg
--color-surface
--color-text
--color-text-secondary
--color-border
--color-accent
--color-danger
--color-success

--space-1
--space-2
--space-3
--space-4
--space-5
--space-6
--space-8
--space-10
--space-12

--radius-sm
--radius-md
--radius-lg
--radius-pill

--shadow-sm
--shadow-md
--shadow-lg

--motion-micro
--motion-standard
--motion-emphasis
```

Adapt values to the product's own brand.

Never blindly copy another company's design tokens.

---

# 52. TYPOGRAPHY

Define semantic roles:

```text
display
heading-xl
heading-lg
heading-md
body-lg
body
body-sm
caption
label
price
```

Hierarchy should use:

- size
- line height
- weight
- spacing
- placement

Do not make everything bold.

Do not use huge headings everywhere.

---

# 53. SURFACE AND CONTAINER RULES

Containers should clarify:

- grouping
- hierarchy
- interaction
- ownership
- boundaries

Do not place every section in a rounded white card.

Avoid:

```text
CARD
CARD
CARD
CARD
CARD
```

when open composition would communicate better.

---

# 54. IMAGE SYSTEM

Use responsive images.

Requirements:

- explicit dimensions
- fixed aspect ratio where appropriate
- responsive sizing
- lazy loading below the fold
- priority loading for primary visual content
- fallback
- object-fit strategy
- no cumulative layout shift

Do not load huge original assets into tiny cards.

---

# 55. PERFORMANCE

Prioritize:

- server rendering where appropriate
- optimized images
- lazy loading
- route-level code splitting
- minimal client-side JavaScript
- memoization for expensive components
- virtualization for long lists when needed
- debounced search
- cached data where appropriate
- optimistic UI for safe interactions

Motion must not create performance problems.

---

# 56. STATE ARCHITECTURE

Separate:

```text
SERVER STATE

UI STATE

FORM STATE

URL STATE

SESSION STATE
```

Do not put everything into one giant global state.

Search/filter state often belongs in URL state so it can be:

- shared
- refreshed
- bookmarked
- navigated
- restored

---

# 57. URL STATE

Where appropriate:

```text
/search?
destination=...
start=...
end=...
guests=...
filters=...
sort=...
```

The URL should represent search intent.

Browser:

```text
Back
Forward
Refresh
Share
```

should behave predictably.

---

# 58. PROGRESSIVE DISCLOSURE

Use three information layers:

```text
PRIMARY
what the user needs now

SECONDARY
supporting information

TERTIARY
details available on demand
```

Do not expose every possible option simultaneously.

---

# 59. TRUST DESIGN

Marketplace users need evidence.

Trust signals can include:

- ratings
- reviews
- provider identity
- verification
- response information
- policies
- transparent pricing
- secure payment information
- cancellation terms

Never manufacture trust through decorative badges.

Every trust signal should correspond to real product data or capability.

---

# 60. MICROCOPY

Use concise, functional copy.

Prefer:

```text
Choose dates

Add guests

View all

See details

Reserve

Save

Clear filters
```

Avoid unnecessary marketing language inside functional UI.

Microcopy should reduce uncertainty.

---

# 61. ANTI-PATTERN LIBRARY

Never default to generic AI aesthetics.

---

## 61.1 Generic SaaS aesthetic

Avoid:

- giant rounded cards
- dashboard sidebars
- gradient backgrounds
- excessive badges
- glass panels
- excessive shadows
- giant hero headings

unless the product explicitly requires them.

---

## 61.2 AI template aesthetic

Avoid:

- repetitive 3-column cards
- random purple/blue gradients
- floating blobs
- excessive icons
- identical section layouts
- arbitrary decorative animations
- giant text with weak content
- card-everything architecture

---

## 61.3 Fake marketplace

Never create:

- search that does nothing
- fake filters
- fake map
- dead wishlist
- static dates
- fake booking
- fake pagination
- buttons with no state
- forms with no validation

If functionality cannot be implemented yet, represent the limitation honestly rather than creating fake behavior.

---

## 61.4 Motion abuse

Avoid:

- every component fading in
- every button scaling dramatically
- parallax everywhere
- perpetual floating
- long page transitions
- bouncing controls
- excessive spring physics

---

## 61.5 Responsive failure

Avoid:

- desktop sidebar squeezed into mobile
- tiny controls
- horizontal overflow
- inaccessible modals
- disappearing primary actions
- unreadable maps
- giant desktop galleries on mobile
- fixed desktop navigation on small screens

---

# 62. IMPLEMENTATION WORKFLOW

## PHASE 1 — INSPECT

Before writing code, identify:

- framework
- router
- existing components
- design tokens
- data model
- API boundaries
- state architecture
- responsive system
- animation library
- existing patterns

Reuse before creating.

---

## PHASE 2 — MODEL

Define:

- user journey
- page hierarchy
- state machines
- URL state
- component boundaries
- responsive transformations
- interaction states

---

## PHASE 3 — FOUNDATION

Implement:

- tokens
- typography
- spacing
- buttons
- inputs
- surfaces
- motion
- accessibility primitives

---

## PHASE 4 — CORE INTERACTIONS

Implement:

- search
- calendar
- quantity selectors
- filters
- overlays
- galleries
- save states
- map/list interactions

---

## PHASE 5 — PAGE COMPOSITIONS

Implement:

- discovery
- search results
- detail
- transaction
- confirmation

---

## PHASE 6 — RESPONSIVE REINTERPRETATION

Do not wait until the end to make the site mobile.

For every major component define:

```text
desktop behavior
tablet behavior
mobile behavior
```

---

## PHASE 7 — STATE COMPLETENESS

Implement:

- loading
- empty
- error
- disabled
- unavailable
- partial data
- network failure
- submitting
- success

---

## PHASE 8 — QA

Test:

- desktop
- tablet
- mobile
- keyboard
- reduced motion
- slow network
- long text
- missing images
- empty results
- API failure
- browser back
- browser forward
- refresh
- deep links

---

# 63. VISUAL QA

Before calling a page complete, inspect:

## Hierarchy

- Is the primary action obvious?
- Is visual weight proportional to importance?
- Are secondary controls quiet?

## Spacing

- Is the rhythm consistent?
- Are there accidental gaps?
- Are containers overused?

## Cards

- Is media dominant?
- Is metadata concise?
- Are controls discoverable but quiet?

## Typography

- Is line height readable?
- Are headings too heavy?
- Are prices easy to parse?

## Motion

- Does animation explain state?
- Does it finish quickly?
- Does it interrupt interaction?
- Does reduced motion work?

## Responsive

- Does mobile reinterpret the interaction?
- Are controls reachable?
- Is the primary action still obvious?

## Accessibility

- Can important interactions be keyboard-operated?
- Are focus states visible?
- Are overlays correctly managed?
- Are labels meaningful?

---

# 64. INTERACTION QA MATRIX

For every major component test:

```text
DEFAULT
HOVER
FOCUS
PRESS
ACTIVE
DISABLED
LOADING
ERROR
EMPTY
SUCCESS
MOBILE
TABLET
DESKTOP
REDUCED MOTION
KEYBOARD
```

If a state does not make sense, explicitly decide why.

Do not silently omit it.

---

# 65. AGENT DECISION RULES

When uncertain, use this priority order:

```text
1. User task
2. Information hierarchy
3. Existing product patterns
4. Accessibility
5. Responsiveness
6. Performance
7. Motion
8. Decoration
```

Never sacrifice task clarity for visual novelty.

When two designs are equally attractive:

Choose the one with fewer cognitive steps.

When two components solve the same problem:

Reuse the existing component.

When introducing a new pattern:

First determine whether an existing pattern can be composed instead.

---

# 66. CODE QUALITY RULES

Use:

- semantic HTML
- TypeScript where available
- typed props
- reusable primitives
- CSS variables
- composable components
- predictable state transitions
- accessible interactions
- focused components

Avoid:

- giant components
- duplicated markup
- duplicated CSS values
- arbitrary side effects
- random z-index values
- random animation durations
- magic numbers
- repeated inline styles
- dead interactions
- fake functionality

---

# 67. Z-INDEX ARCHITECTURE

Do not randomly use:

```css
z-index: 99999;
```

Use semantic layers:

```text
base
content
sticky
popover
dropdown
sheet
modal
toast
```

The exact numbers are implementation details.

The hierarchy must be predictable.

---

# 68. OVERLAY ARCHITECTURE

Every modal/popover/sheet should define:

- open state
- close state
- Escape
- outside click where appropriate
- focus management
- scroll locking where appropriate
- stacking order
- responsive behavior
- accessible labeling

Desktop popovers may become mobile bottom sheets.

---

# 69. SEARCH REQUEST CONSISTENCY

When search parameters change:

- update URL where appropriate
- preserve shareability
- preserve browser navigation
- avoid unnecessary full-page reloads
- synchronize UI with URL
- prevent stale request races

If requests can race:

- cancel stale requests
- or ignore stale responses

Never allow an old search response to overwrite a newer search.

---

# 70. OPTIMISTIC UI

Use optimistic UI for:

- save
- favorite
- reversible toggles

Do NOT use optimistic UI for actions where incorrect success state could cause financial or transactional inconsistency.

Booking/payment should generally be:

```text
VALIDATE
→ SUBMIT
→ SERVER CONFIRMATION
→ SUCCESS
```

---

# 71. ERROR RECOVERY

Preserve user work whenever safe.

For example:

Payment failure should not erase:

- dates
- guest count
- selected product
- booking information
- non-sensitive entered data

Recovery should return the user to the nearest actionable state.

---

# 72. FINAL PRODUCT QUALITY BAR

The final frontend should feel:

- calm
- intentional
- responsive
- content-led
- interactive
- trustworthy
- coherent
- mature

It should NOT feel:

- like a template
- like a dashboard
- like an AI-generated landing page
- like a clone
- like a collection of disconnected components

---

# 73. THE MOST IMPORTANT TEST

Ask:

> If all decorative gradients, shadows, icons and animations were removed, would the product still have excellent UX?

If the answer is no:

STOP.

Do not polish the visuals.

Fix the interaction architecture.

---

# 74. FINAL AGENT CHECKLIST

## PRODUCT

- [ ] User journey is coherent
- [ ] Primary action is obvious
- [ ] Information hierarchy is intentional
- [ ] Every important action has a clear result

## NAVIGATION

- [ ] Global shell is consistent
- [ ] Active state is clear
- [ ] Mobile navigation is intentionally redesigned
- [ ] Back/forward behavior is predictable

## SEARCH

- [ ] Search is stateful
- [ ] Existing values persist
- [ ] Keyboard interaction works
- [ ] Focus management works
- [ ] URL state is synchronized where appropriate
- [ ] Stale search requests cannot overwrite newer results

## RESULTS

- [ ] Cards are content-led
- [ ] Filters are layered
- [ ] Sorting is clear
- [ ] Map/list synchronization works where relevant
- [ ] Loading states exist
- [ ] Empty states exist
- [ ] Error states exist

## DETAIL

- [ ] Gallery works
- [ ] Gallery is responsive
- [ ] Provider/host trust is clear
- [ ] Reviews provide useful signal
- [ ] Price is transparent
- [ ] Transaction module is clear
- [ ] Policies are discoverable

## TRANSACTION

- [ ] Availability states exist
- [ ] Price calculation states exist
- [ ] Validation exists
- [ ] Errors are actionable
- [ ] Payment state is clear
- [ ] Confirmation is clear

## MOTION

- [ ] Motion has a purpose
- [ ] Motion is not excessive
- [ ] Spatial continuity is preserved
- [ ] Gesture interactions feel physical
- [ ] Reduced motion works
- [ ] Important information is never delayed unnecessarily

## RESPONSIVE

- [ ] Desktop is intentional
- [ ] Tablet is intentional
- [ ] Mobile is behaviorally redesigned
- [ ] Primary actions remain accessible
- [ ] No horizontal overflow
- [ ] Touch targets are usable

## ACCESSIBILITY

- [ ] Keyboard navigation works
- [ ] Focus-visible states exist
- [ ] Semantic controls are used
- [ ] Screen-reader labels exist
- [ ] Modal focus management works
- [ ] Color is not the only state indicator
- [ ] Reduced motion is supported

## PERFORMANCE

- [ ] Images are optimized
- [ ] Layout shift is minimized
- [ ] Images lazy-load appropriately
- [ ] Expensive interactions are optimized
- [ ] Search is debounced/cancelled appropriately
- [ ] Long lists are handled efficiently

## ENGINEERING

- [ ] Components are reusable
- [ ] Design tokens are centralized
- [ ] No arbitrary magic values
- [ ] No dead interactions
- [ ] No duplicated patterns
- [ ] No fake functionality
- [ ] State architecture is understandable
- [ ] Error handling is intentional

---

# 75. FINAL PRINCIPLE

Do not ask:

> "How do I make this look like Airbnb?"

Ask:

> "How would a mature marketplace product solve this interaction?"

Then determine:

```text
USER INTENT
↓
INFORMATION HIERARCHY
↓
INTERACTION MODEL
↓
STATE MACHINE
↓
COMPONENT ARCHITECTURE
↓
RESPONSIVE TRANSFORMATION
↓
MOTION
↓
VISUAL POLISH
↓
ACCESSIBILITY
↓
PERFORMANCE
↓
QA
```

Visual polish is the final layer.

The system underneath is what makes the interface feel premium.
