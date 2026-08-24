# Notes to self

- Whenever I add a new user-facing feature to this app, I should also add an entry to the `FEATURES` array in
  [src/renderer/src/components/GettingStartedModal.tsx](src/renderer/src/components/GettingStartedModal.tsx)
  (the "features" step of the in-app tutorial, opened via the `?` button). Keep entries short: an icon, a title,
  and a one-sentence description. If a new keyboard shortcut is added to the player, update the `SHORTCUTS` array
  in the same file too.
