# Autocomplete in Address Bar

The goal is to provide intelligent address bar suggestions based on the user's browsing history as they type.

## User Review Required

- **Suggestion UI**: We will display a dropdown below the address bar when the user types. It will list matching history items.
- **Search vs Navigation**: If the user presses Enter and the text is not a valid URL, it defaults to a Google search (which is already implemented). If they click a suggestion, it will immediately navigate to that URL.

## Open Questions

- None at the moment.

## Proposed Changes

### `renderer.js`
- **Address Bar Input Listener**: Add an `input` event listener to the `#address-input` element to capture keystrokes.
- **Suggestion Engine**: Filter `state.history` based on the typed query. Match against the URL and the page Title.
- **Dropdown Rendering**: Create a dropdown container positioned absolutely below the address bar.
- **Keyboard Navigation**: Add Arrow Up/Down and Enter key support to navigate and select suggestions without using the mouse.

### `style.css`
- **Dropdown Styling**: Add CSS for `.address-suggestions-dropdown` and `.address-suggestion-item` to match the dark, sleek UI of InvictaTill Browser. It will include hover effects and highlighted states.

## Verification Plan

### Manual Verification
- Type a known history URL into the address bar and verify the dropdown appears.
- Verify Arrow keys can navigate the dropdown.
- Verify clicking a suggestion navigates to that page.
