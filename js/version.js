// Bump APP_VERSION and add a CHANGELOG entry with every user-visible
// release — whatsNew.js compares this against what a returning visitor
// last saw and shows the "What's new" sheet for anything newer. Keep the
// version string in YYYY.MM.DD form (zero-padded) so plain string
// comparison sorts the same as chronological order.
export const APP_VERSION = "2026.07.28.4";

export const CHANGELOG = [
  {
    version: "2026.07.28.4",
    date: "July 28, 2026",
    changes: [
      "Added a Restock button to a stock item's detail view — sets \"last bought\" to today in one tap, instead of opening the edit form to change the date.",
    ],
  },
  {
    version: "2026.07.28.3",
    date: "July 28, 2026",
    changes: [
      "A new stock item's \"last bought\" date now starts preset to today instead of blank, so it's clearer at a glance that it's a date field.",
    ],
  },
  {
    version: "2026.07.28.2",
    date: "July 28, 2026",
    changes: [
      "Fixed the \"last bought\" date picker on Stock items (and Sizes & measurements) looking oddly narrow with no visible text — it was missing its styling entirely.",
      "\"Remind me\" on a stock item now starts off, and turning it on explains what it actually does (an in-app banner, no push notifications) alongside the calendar export options, instead of silently flipping on.",
    ],
  },
  {
    version: "2026.07.28",
    date: "July 28, 2026",
    changes: [
      "New: Stock items, in the menu — a table for the everyday things you buy on repeat (underwear, contact lenses, razors...), with a reminder when it's time to restock and one-tap calendar export.",
      "Saved photos now use a lot more storage space on your device, so 'closet is full' errors should be a thing of the past.",
      "Fixed the Home feed sometimes stacking almost everything into one column instead of balancing both.",
      "A card with no title now shows just the image, full-bleed, instead of the word \"Untitled\".",
      "Prices on cards are smaller and more muted, so they don't compete with the image.",
    ],
  },
  {
    version: "2026.07.19",
    date: "July 19, 2026",
    changes: [
      "Full backups now also include your theme, measurement unit, and home screen title, not just what you've saved — if you've exported one before, it's worth making a fresh one.",
      "You'll see a note like this one whenever the app updates, so you always know what's changed.",
    ],
  },
];
