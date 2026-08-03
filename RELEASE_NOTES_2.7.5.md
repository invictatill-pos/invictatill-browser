# InvictaTill Browser v2.7.5

## Improvements

### Layout Calculation Refactoring
- Extracted layout normalization into a central `normalizeViewLayout` function to ensure view bounds consistently respect the minimum required layout.
- Added a `viewBoundsForLayout` helper to compute the correct `x`, `y`, `width`, and `height` properties for remote content views safely.
- Introduced `prepareRemoteContentView` to streamline the setup and bounds adjustment of browser views when attaching them to the main window.
- Adjusted the notification stack horizontal offset perfectly to align with updated UI constraints.

## Internal
- Updated DOM contract tests to cover the new `minimumViewLayout` and `normalizeViewLayout` methods, ensuring that the native tab surface continues to stay correctly below the browser chrome and app rail.
