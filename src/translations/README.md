# Internationalization (i18n) System

This directory contains all translation files for the Fanta F1 application.

## Structure

```
translations/
├── README.md          # This file
├── index.js          # Exports all translations and language metadata
├── it.js             # Italian translations (default)
├── en.js             # English translations
└── [new-lang].js     # Add new languages here
```

## Supported Languages

- **Italian (it)** 🇮🇹 - Default language
- **English (en)** 🇬🇧

## How to Add a New Language

### 1. Create Translation File

Create a new file `[language-code].js` (e.g., `fr.js` for French, `es.js` for Spanish):

```javascript
/**
 * @file fr.js
 * @description French translations
 */

export const fr = {
  // Copy structure from it.js or en.js
  common: {
    save: "Sauvegarder",
    cancel: "Annuler",
    // ...
  },
  nav: {
    home: "Accueil",
    leaderboard: "Classement",
    // ...
  },
  // ... continue with all sections
};
```

### 2. Register Language in index.js

Add the import and export in `index.js`:

```javascript
import { it } from "./it";
import { en } from "./en";
import { fr } from "./fr"; // Add this

export const translations = {
  it,
  en,
  fr, // Add this
};

export const supportedLanguages = [
  { code: "it", name: "Italiano", flag: "🇮🇹", default: true },
  { code: "en", name: "English", flag: "🇬🇧", default: false },
  { code: "fr", name: "Français", flag: "🇫🇷", default: false }, // Add this
];
```

### 3. Translation File Structure

Each translation file should follow this structure:

```javascript
export const [langCode] = {
  // Common UI elements
  common: {
    save, cancel, delete, edit, add, update, close, confirm,
    back, next, loading, error, success, warning, search,
    filter, reset, submit, points, position, name, date, actions
  },

  // Navigation menu
  nav: {
    home, leaderboard, formations, history, statistics,
    admin, calculatePoints, toggleTheme, changeLanguage
  },

  // Home page
  home: { /* ... */ },

  // Leaderboard page
  leaderboard: { /* ... */ },

  // Formations page
  formations: { /* ... */ },

  // History page
  history: { /* ... */ },

  // Statistics page
  statistics: { /* ... */ },

  // Admin panel
  admin: { /* ... */ },

  // Calculate points page
  calculate: { /* ... */ },

  // Championship form
  championshipForm: { /* ... */ },

  // Error messages
  errors: { /* ... */ },

  // Success messages
  success: { /* ... */ },

  // Date & time
  dateTime: { /* ... */ },

  // Language names
  languages: {
    it: "Italiano",
    en: "English",
    fr: "Français", // Add new languages
  },
};
```

## Usage in Components

### Import and use the translation hook:

```javascript
import { useLanguage } from "../contexts/LanguageContext";

function MyComponent() {
  const { t } = useLanguage();

  return (
    <div>
      <h1>{t("nav.home")}</h1>
      <button>{t("common.save")}</button>
    </div>
  );
}
```

### Alternative with useTranslation:

```javascript
import { useTranslation } from "../hooks/useTranslation";

function MyComponent() {
  const t = useTranslation();

  return <button>{t("common.cancel")}</button>;
}
```

### With parameters (interpolation):

```javascript
// In translation file:
welcome: "Welcome, {{name}}!"

// In component:
<p>{t("home.welcome", { name: "John" })}</p>
// Output: "Welcome, John!"
```

## Language Selector

The language selector is available in two locations:

1. **Desktop**: Next to the theme toggle in the navigation bar
2. **Mobile**: Same position, always visible

Users can switch languages by clicking the flag emoji and selecting from the dropdown.

## Persistence

The selected language is automatically saved to `localStorage` under the key `fanta-f1-language` and persists across sessions.

## Default Language

The default language is Italian (`it`), as specified in `translations/index.js`:

```javascript
export const DEFAULT_LANGUAGE = "it";
```

To change the default language, update this constant and set `default: true` for the desired language in `supportedLanguages`.

## Best Practices

1. **Keep translations organized** by page/feature in separate sections
2. **Use descriptive keys** that indicate context (e.g., `nav.home` vs just `home`)
3. **Maintain consistency** across all language files - same keys in all files
4. **Test translations** after adding/modifying them
5. **Avoid hardcoded strings** - always use translation keys
6. **Keep strings concise** but clear
7. **Use placeholders** for dynamic content with `{{paramName}}` syntax

## Testing

After adding a new language:

1. Run `npm run build` to verify no errors
2. Test the language selector in the UI
3. Navigate through all pages to verify translations appear correctly
4. Check both desktop and mobile views

## Translation Keys Reference

See `it.js` for the complete reference of all available translation keys and their structure.
