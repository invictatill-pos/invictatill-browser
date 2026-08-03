# InvictaTill Browser v2.7.6

## Improvements

### View Layout Timing
- Delayed rendering of browser content until the renderer provides its desired UI layout to prevent UI flickering on application startup.
- Initialized `tabsVisible` to false and added `shellLayoutReady` state to ensure bounds are correctly computed before mounting content views.

## Internal
- Updated DOM contract tests to cover the new `shellLayoutReady` requirement.
