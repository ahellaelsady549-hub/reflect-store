# Reflect store rebuild

## Goal
Turn the current store into **Reflect**, matching the supplied youthful Arabic references while preserving the existing working commerce, inventory, ratings, payments, and admin features.

## What will change
- Replace the old brand everywhere with Reflect and use the supplied logo after removing its background.
- Rebuild the sign-in/sign-up screen in the supplied split-panel style, with Egyptian Arabic copy, accessible mobile stacking, language and theme controls.
- Remove email verification, six-digit confirmation, forgot-password, and reset-password entry points. New registrations will sign in immediately.
- Extend registration to collect full name, primary and backup phone numbers, customer address, Google Maps delivery location, and delivery instructions; save these securely to the customer profile and reuse them at checkout.
- Assign the admin role to `reflect@gmail.com` when that account exists or signs up, while continuing to enforce admin access in the backend.
- Extend product management with multiple color-linked images, sizes and stock, price and optional discount, final price preview, estimated delivery, height/weight sizing guidance, and tracking copy.
- Keep customer star ratings and show the average out of five clearly on listing and product pages.
- Add an admin-authored posts/offers page, visible to customers but writable only by the admin.
- Add order totals for item count and size count during checkout and in the completed order view.
- Refresh the home page, navigation, filters, product cards, footer, and animations with a bold Gen Z visual system and informal Egyptian Arabic copy.

## Technical details
- Apply additive database changes with row-level access controls and explicit grants, keeping roles in `user_roles`.
- Use the existing product `images` and `sizes` structures, extending them compatibly so old rows remain readable.
- Use Google Maps through the official connector for address search/picking; keep API credentials on the server and limit requests to authenticated, debounced flows.
- Keep the existing Fawry provider architecture and current payment behavior unchanged.
- Preserve reduced-motion support, keyboard access, dark mode, bilingual layout, and mobile-safe controls.
- Update every content page’s metadata to the Reflect brand.

## Verification
- Check sign-up/sign-in, immediate access after registration, saved profile delivery details, admin-only tools, product creation/editing, filters/ratings, cart/checkout counts, posts, and order tracking.
- Test the redesigned auth and storefront at desktop and mobile sizes and confirm the app builds without errors.
