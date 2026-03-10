

# Fix: Birthday date picker dropdowns + Employee card button placement

## Problem 1: Birthday picker month/year selector broken
The Profile page uses `captionLayout="dropdown-buttons"` on the Calendar component, but the Calendar component (`src/components/ui/calendar.tsx`) has no styles for dropdown elements (`vhd-dropdown`, `caption_dropdowns`, etc.). The native `<select>` elements render unstyled and look broken.

## Problem 2: Edit/Delete buttons cramped next to name
In the employee card modal (`HRModule.tsx` lines 189-225), the Edit and Delete buttons sit in the same flex row as the avatar and name, causing layout issues on smaller screens.

## Changes

### 1. `src/components/ui/calendar.tsx`
Add classNames for dropdown caption layout elements:
- `caption_dropdowns` — flex container for the two dropdowns
- `dropdown_month`, `dropdown_year` — styled select elements
- `dropdown` — base select styling with proper appearance, border, padding

### 2. `src/components/modules/HRModule.tsx` (lines 188-225)
Restructure the employee card modal layout:
- Top section: avatar + name/position/department (no buttons)
- Bottom of the card (after contact info): action buttons row with Edit and Delete, separated by a border-top

```
Before:
┌─────────────────────────────────┐
│ [avatar] Name    [Edit][Delete] │
│          Position               │
│ email / phone / birthday        │
└─────────────────────────────────┘

After:
┌─────────────────────────────────┐
│ [avatar] Name                   │
│          Position               │
│ email / phone / birthday        │
│ ─────────────────────────────── │
│              [Edit]   [Delete]  │
└─────────────────────────────────┘
```

